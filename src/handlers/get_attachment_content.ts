import type { TpClient } from '../tp.js'
import type * as TP from '../types.js'

// Base64 inflates raw bytes by ~33%, and inlined image bytes count against
// the conversation's context budget - cap what gets inlined.
const MAX_INLINE_BYTES = 5 * 1024 * 1024 // 5 MB

// Some TP instances serve binary downloads with a generic content-type
// instead of the real one - in that case trust the attachment's own
// MimeType rather than treating it as "not an image".
const GENERIC_BINARY_MIME_TYPES = new Set(['application/octet-stream', 'binary/octet-stream'])

function metadataText(attachment: TP.Attachment, note: string) {
  return JSON.stringify({
    id: attachment.Id,
    name: attachment.Name,
    mimeType: attachment.MimeType,
    size: attachment.Size,
    uri: attachment.Uri,
    note,
  })
}

export async function handleGetAttachmentContent(tp: TpClient, params: { attachmentId: string }) {
  const metaResult = await tp.getAttachment<TP.Attachment>(params.attachmentId)

  if (!metaResult.ok) {
    return {
      content: [{
        type: 'text' as const,
        text: `Failed to get attachment id: ${params.attachmentId}\n` +
          `HTTP status: ${metaResult.status}\nResponse body: ${metaResult.body}`,
      }],
    }
  }

  const attachment = metaResult.data

  if (attachment.Size > MAX_INLINE_BYTES) {
    return {
      content: [{
        type: 'text' as const,
        text: metadataText(attachment, `File is ${attachment.Size} bytes, over the ${MAX_INLINE_BYTES} byte inline limit. Not fetched - open "uri" directly in a browser session authenticated to Targetprocess.`),
      }],
    }
  }

  // Only images ever get inlined, so don't spend the download (bandwidth,
  // and the "content download failed" fallback message below, which is
  // misleading when we never needed the content anyway) on a type that was
  // never going to be inlined in the first place.
  if (!(attachment.MimeType || '').startsWith('image/')) {
    return {
      content: [{
        type: 'text' as const,
        text: metadataText(attachment, 'Only image/* attachments are inlined as image content. Metadata returned instead.'),
      }],
    }
  }

  const contentResult = await tp.downloadAttachmentContent(attachment.Uri)

  if (!contentResult.ok) {
    // Graceful fallback: official TP docs claim token-auth downloads don't
    // work for attachment content on some instances. If that's the case
    // here, surface the Uri instead of failing outright.
    return {
      content: [{
        type: 'text' as const,
        text: metadataText(attachment, `Failed to download attachment content (HTTP ${contentResult.status}). This Targetprocess instance may require browser/basic auth for downloads rather than the API token. Open "uri" directly in a browser instead.`),
      }],
    }
  }

  const { data, mimeType: downloadedMimeType, size } = contentResult.data

  if (size > MAX_INLINE_BYTES) {
    return {
      content: [{
        type: 'text' as const,
        text: metadataText({ ...attachment, MimeType: downloadedMimeType, Size: size }, `Downloaded content is ${size} bytes, over the ${MAX_INLINE_BYTES} byte inline limit. Not inlined.`),
      }],
    }
  }

  // We only get here when the metadata already said image/*. Trust the
  // downloaded content-type over that metadata, unless it's a generic
  // binary type - that guards against e.g. an auth redirect (HTTP 200 with
  // an HTML login page) being mistaken for the real image.
  const isGenericBinary = !downloadedMimeType || GENERIC_BINARY_MIME_TYPES.has(downloadedMimeType.toLowerCase())
  const effectiveMimeType = isGenericBinary ? attachment.MimeType : downloadedMimeType

  if ((effectiveMimeType || '').startsWith('image/')) {
    return {
      content: [{ type: 'image' as const, data: data.toString('base64'), mimeType: effectiveMimeType }],
    }
  }

  return {
    content: [{
      type: 'text' as const,
      text: metadataText(
        { ...attachment, MimeType: effectiveMimeType, Size: size },
        `Downloaded content-type was "${downloadedMimeType}", not an image - this may be an authentication redirect rather than the actual file. Open "uri" directly in a browser instead.`,
      ),
    }],
  }
}
