import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleCreateRelease } from '../src/handlers/create_release.js'
import type { TpClient } from '../src/tp.js'

const mockTp = {
  createRelease: vi.fn(),
} as unknown as TpClient

beforeEach(() => {
  vi.clearAllMocks()
})

describe('handleCreateRelease', () => {
  it('returns created release on success', async () => {
    vi.mocked(mockTp.createRelease).mockResolvedValue({ Id: 58951, Name: 'Case Manager 4.70.0' } as any)

    const result = await handleCreateRelease(mockTp, { title: 'Case Manager 4.70.0' })
    const parsed = JSON.parse(result.content[0].text)

    expect(parsed.Name).toBe('Case Manager 4.70.0')
    expect(mockTp.createRelease).toHaveBeenCalledWith({ title: 'Case Manager 4.70.0' })
  })

  it('returns failure message when the API call errors', async () => {
    vi.mocked(mockTp.createRelease).mockResolvedValue(new Error('Simulated failure') as any)

    const result = await handleCreateRelease(mockTp, { title: 'Case Manager 4.70.0' })

    expect(result.content[0].text).toContain('Failed to create release "Case Manager 4.70.0"')
  })
})
