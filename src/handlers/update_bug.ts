import type { TpClient } from '../tp.js'

export async function handleUpdateBug(
  tp: TpClient,
  params: {
    id: string
    title?: string
    bugContent?: string
    origin?: string
    projectId?: string
    teamId?: string
    entityStateId?: string
    releaseId?: string
    tags?: string
    teamIterationId?: string
    developerId?: string
  },
) {
  const { developerId, ...updateParams } = params
  const bugResponse = await tp.updateBug<any>(updateParams)

  if (!bugResponse) {
    return {
      content: [{
        type: 'text' as const,
        text: `Failed to update bug "${params.title}"\n JSON: ${JSON.stringify(bugResponse, null, 2)}`
      }],
    }
  }

  let developerAssignment = null
  if (developerId) {
    developerAssignment = await tp.assignDeveloper(params.id, developerId)
  }

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(developerId ? { ...bugResponse, developerAssignment } : bugResponse)
    }],
  }
}
