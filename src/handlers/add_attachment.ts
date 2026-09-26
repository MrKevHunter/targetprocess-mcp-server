import { statSync } from 'fs'
import { basename } from 'path'
import type { TpClient } from '../tp.js'
import type * as TP from '../types.js'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

export async function handleAddAttachment(
  tp: TpClient,
  params: { generalId: string; filePath?: string; fileContent?: string; fileName?: string; mimeType?: string },
) {
  if (!params.filePath && !params.fileContent) {
    return { content: [{ type: 'text' as const, text: 'Provide either "filePath" or "fileContent" (base64) to upload.' }] }
  }
  if (params.filePath && params.fileContent) {
    return { content: [{ type: 'text' as const, text: 'Provide only one of "filePath" or "fileContent", not both.' }] }
  }
  if (params.fileContent && !params.fileName) {
    return { content: [{ type: 'text' as const, text: '"fileName" is required when uploading via "fileContent".' }] }
  }

  let source: { filePath: string } | { fileContent: string; fileName: string }
  let displayName: string

  if (params.filePath) {
    let size: number
    try {
      size = statSync(params.filePath).size
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Could not read "${params.filePath}": ${String(error)}` }] }
    }
    if (size > MAX_UPLOAD_BYTES) {
      return {
        content: [{
          type: 'text' as const,
          text: `Refusing to upload "${params.filePath}": size ${size} bytes exceeds the ${MAX_UPLOAD_BYTES} byte limit.`,
        }],
      }
    }
    source = { filePath: params.filePath }
    displayName = basename(params.filePath)
  } else {
    const decoded = Buffer.from(params.fileContent!, 'base64')
    if (decoded.byteLength > MAX_UPLOAD_BYTES) {
      return {
        content: [{
          type: 'text' as const,
          text: `Refusing to upload "${params.fileName}": decoded size ${decoded.byteLength} bytes exceeds the ${MAX_UPLOAD_BYTES} byte limit.`,
        }],
      }
    }
    source = { fileContent: params.fileContent!, fileName: params.fileName! }
    displayName = params.fileName!
  }

  const before = await tp.listAttachments<TP.Attachment>(params.generalId)
  if (!before.ok) {
    return {
      content: [{
        type: 'text' as const,
        text: `Could not read the existing attachments of general id: ${params.generalId}; nothing was uploaded.\n` +
          `HTTP status: ${before.status}\nResponse body: ${before.body}`,
      }],
    }
  }
  const beforeIds = new Set(before.data.map((a) => a.Id))

  const uploadResult = await tp.uploadAttachment(params.generalId, source, params.mimeType)
  if (!uploadResult.ok) {
    return {
      content: [{
        type: 'text' as const,
        text: `Failed to upload "${displayName}" to general id: ${params.generalId}\n` +
          `HTTP status: ${uploadResult.status}\nResponse body: ${uploadResult.body}`,
      }],
    }
  }

  // UploadFile.ashx's response body isn't a reliably-parseable/documented
  // shape on every TP instance, so a 200 only means "accepted" - confirm
  // the file actually persisted by re-listing and diffing against what
  // existed before the upload.
  const after = await tp.listAttachments<TP.Attachment>(params.generalId)
  if (!after.ok) {
    return {
      content: [{
        type: 'text' as const,
        text: `Uploaded "${displayName}" (HTTP 200) but could not confirm it via listAttachments.\n` +
          `HTTP status: ${after.status}\nResponse body: ${after.body}`,
      }],
    }
  }

  const newItems = after.data.filter((a) => !beforeIds.has(a.Id))
  const match = newItems.find((a) => a.Name === displayName)

  if (!match) {
    return {
      content: [{
        type: 'text' as const,
        text: `Upload request for "${displayName}" returned HTTP 200, but no new attachment appeared on general id: ${params.generalId} afterward. It may not have persisted.`,
      }],
    }
  }

  return { content: [{ type: 'text' as const, text: JSON.stringify(match) }] }
}
