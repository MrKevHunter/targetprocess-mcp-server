import type { TpClient } from '../tp.js'

export async function handleCreateRelease(
  tp: TpClient,
  params: {
    title: string
    startDate?: string
    endDate?: string
    projectId?: string
  },
) {
  const response = await tp.createRelease(params)

  if (response instanceof Error) {
    return {
      content: [{
        type: 'text' as const,
        text: `Failed to create release "${params.title}"\n Error: ${response.message}`
      }],
    }
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(response) }],
  }
}
