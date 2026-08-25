import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleUpdateRelease } from '../src/handlers/update_release.js'
import type { TpClient } from '../src/tp.js'

const mockTp = {
  updateRelease: vi.fn(),
} as unknown as TpClient

beforeEach(() => {
  vi.clearAllMocks()
})

describe('handleUpdateRelease', () => {
  it('returns updated release on success', async () => {
    vi.mocked(mockTp.updateRelease).mockResolvedValue({ Id: 58951, Name: 'Case Manager 4.70.0', EndDate: '2026-09-03' } as any)

    const result = await handleUpdateRelease(mockTp, { id: '58951', endDate: '2026-09-03' })
    const parsed = JSON.parse(result.content[0].text)

    expect(parsed.EndDate).toBe('2026-09-03')
    expect(mockTp.updateRelease).toHaveBeenCalledWith({ id: '58951', endDate: '2026-09-03' })
  })

  it('returns failure message when the API call errors', async () => {
    vi.mocked(mockTp.updateRelease).mockResolvedValue(new Error('Simulated failure') as any)

    const result = await handleUpdateRelease(mockTp, { id: '58951', endDate: '2026-09-03' })

    expect(result.content[0].text).toContain('Failed to update release id: 58951')
  })
})
