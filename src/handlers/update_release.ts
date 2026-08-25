import type { TpClient } from '../tp.js'

export async function handleUpdateRelease(
  tp: TpClient,
  params: {
    id: string
    title?: string
    startDate?: string
    endDate?: string
    projectId?: string
  },
) {
  const response = await tp.updateRelease(params)

  if (response instanceof Error) {
    return {
      content: [{
        type: 'text' as const,
        text: `Failed to update release id: ${params.id}\n Error: ${response.message}`
      }],
    }
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(response) }],
  }
}
