import type { TpClient } from '../tp.js'
import type * as TP from '../types.js'

export async function handleListAttachments(tp: TpClient, params: { generalId: string }) {
  const result = await tp.listAttachments<TP.TpResponse<TP.Attachment>>(params.generalId)

  if (!result.ok) {
    return {
      content: [{
        type: 'text' as const,
        text: `Failed to list attachments for general id: ${params.generalId}\n` +
          `HTTP status: ${result.status}\nResponse body: ${result.body}`,
      }],
    }
  }

  return { content: [{ type: 'text' as const, text: JSON.stringify(result.data.Items) }] }
}
