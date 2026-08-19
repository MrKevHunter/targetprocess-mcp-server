import type { TpClient } from '../tp.js'
import type * as TP from '../types.js'

export async function handleCreateBug(
  tp: TpClient,
  params: {
    title: string
    bugContent: string
    origin?: string
    releaseId?: string
    projectId?: string
    teamId?: string
    entityStateId?: string
    tags?: string
    teamIterationId?: string
  },
) {
  const bugResponse = await tp.createBugOnly<TP.Bug>(params)

  if (!bugResponse.ok) {
    return {
      content: [{
        type: 'text' as const,
        text: `Failed to create bug "${params.title}"\n` +
          `HTTP status: ${bugResponse.status}\n` +
          `Response body: ${bugResponse.body}`
      }],
    }
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(bugResponse.data) }],
  }
}
