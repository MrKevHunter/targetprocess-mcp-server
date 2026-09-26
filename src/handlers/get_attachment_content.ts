import type { TpClient } from '../tp.js'
import type * as TP from '../types.js'

// Base64 inflates raw bytes by ~33%, and inlined image bytes count against
// the conversation's context budget - cap what gets inlined.
const MAX_INLINE_BYTES = 5 * 1024 * 1024 // 5 MB

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
  const isImage = (attachment.MimeType || '').startsWith('image/')

  if (attachment.Size > MAX_INLINE_BYTES) {
    return {
      content: [{
        type: 'text' as const,
        text: metadataText(attachment, `File is ${attachment.Size} bytes, over the ${MAX_INLINE_BYTES} byte inline limit. Not fetched - open "uri" directly in a browser session authenticated to Targetprocess.`),
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

  const { data, mimeType, size } = contentResult.data

  if (size > MAX_INLINE_BYTES) {
    return {
      content: [{
        type: 'text' as const,
        text: metadataText({ ...attachment, MimeType: mimeType, Size: size }, `Downloaded content is ${size} bytes, over the ${MAX_INLINE_BYTES} byte inline limit. Not inlined.`),
      }],
    }
  }

  if (isImage) {
    return {
      content: [{ type: 'image' as const, data: data.toString('base64'), mimeType: mimeType || attachment.MimeType }],
    }
  }

  return {
    content: [{
      type: 'text' as const,
      text: metadataText({ ...attachment, MimeType: mimeType, Size: size }, 'Only image/* attachments are inlined as image content. Metadata returned instead.'),
    }],
  }
}
