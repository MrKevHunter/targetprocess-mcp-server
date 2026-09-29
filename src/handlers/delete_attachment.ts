import type { TpClient } from '../tp.js'

export async function handleDeleteAttachment(tp: TpClient, params: { attachmentId: string }) {
  const result = await tp.deleteAttachment(params.attachmentId)

  if (!result.ok) {
    return {
      content: [{
        type: 'text' as const,
        text: `Failed to delete attachment id: ${params.attachmentId}\n` +
          `HTTP status: ${result.status}\nResponse body: ${result.body}`,
      }],
    }
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ deleted: true, id: Number(params.attachmentId) }) }],
  }
}
