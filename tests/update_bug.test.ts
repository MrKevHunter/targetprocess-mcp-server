import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleUpdateBug } from '../src/handlers/update_bug.js'
import type { TpClient } from '../src/tp.js'

const mockTp = {
  updateBug: vi.fn(),
  assignDeveloper: vi.fn(),
} as unknown as TpClient

beforeEach(() => {
  vi.clearAllMocks()
})

describe('handleUpdateBug', () => {
  it('returns updated bug on success', async () => {
    vi.mocked(mockTp.updateBug).mockResolvedValue({ Id: 145789, Name: 'Updated' } as any)

    const result = await handleUpdateBug(mockTp, { id: '145789', title: 'Updated' })
    const parsed = JSON.parse(result.content[0].text)

    expect(parsed.Name).toBe('Updated')
    expect(mockTp.updateBug).toHaveBeenCalledWith({ id: '145789', title: 'Updated' })
    expect(mockTp.assignDeveloper).not.toHaveBeenCalled()
  })

  it('returns failure message when null', async () => {
    vi.mocked(mockTp.updateBug).mockResolvedValue(null as any)

    const result = await handleUpdateBug(mockTp, { id: '145789' })

    expect(result.content[0].text).toContain('Failed to update bug')
  })

  it('passes releaseId to updateBug', async () => {
    vi.mocked(mockTp.updateBug).mockResolvedValue({ Id: 145789, Name: 'Bug' } as any)

    await handleUpdateBug(mockTp, { id: '145789', releaseId: '999' })

    expect(mockTp.updateBug).toHaveBeenCalledWith({ id: '145789', releaseId: '999' })
  })

  it('assigns the developer role when developerId is provided, without sending it to updateBug', async () => {
    vi.mocked(mockTp.updateBug).mockResolvedValue({ Id: 145789, Name: 'Bug' } as any)
    vi.mocked(mockTp.assignDeveloper).mockResolvedValue({ Id: 999 } as any)

    const result = await handleUpdateBug(mockTp, { id: '145789', developerId: '4242' })
    const parsed = JSON.parse(result.content[0].text)

    expect(mockTp.updateBug).toHaveBeenCalledWith({ id: '145789' })
    expect(mockTp.assignDeveloper).toHaveBeenCalledWith('145789', '4242')
    expect(parsed.developerAssignment).toEqual({ Id: 999 })
  })

  it('does not call assignDeveloper when the bug update fails', async () => {
    vi.mocked(mockTp.updateBug).mockResolvedValue(null as any)

    await handleUpdateBug(mockTp, { id: '145789', developerId: '4242' })

    expect(mockTp.assignDeveloper).not.toHaveBeenCalled()
  })
})
