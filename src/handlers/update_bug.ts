import type { TpClient } from '../tp.js'

export async function handleUpdateBug(
  tp: TpClient,
  params: {
    id: string
    title?: string
    bugContent?: string
    origin?: string
    releaseId?: string
    projectId?: string
    teamId?: string
    entityStateId?: string
    tags?: string
    teamIterationId?: string
    developerId?: string
  },
) {
  const { developerId, ...updateParams } = params
  const bugResponse = await tp.updateBug<any>(updateParams)

  if (bugResponse instanceof Error) {
    return {
      content: [{
        type: 'text' as const,
        text: `Failed to update bug "${params.title}"\n Error: ${bugResponse.message}`
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
