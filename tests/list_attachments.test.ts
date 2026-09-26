import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleListAttachments } from '../src/handlers/list_attachments.js'
import type { TpClient } from '../src/tp.js'

const mockTp = {
  listAttachments: vi.fn(),
} as unknown as TpClient

beforeEach(() => {
  vi.clearAllMocks()
})

describe('handleListAttachments', () => {
  it('returns the attachment items on success', async () => {
    const items = [{ Id: 1, Name: 'a.png' }, { Id: 2, Name: 'b.png' }]
    vi.mocked(mockTp.listAttachments).mockResolvedValue({
      ok: true,
      data: { Next: '', Items: items },
    } as any)

    const result = await handleListAttachments(mockTp, { generalId: '148980' })
    const parsed = JSON.parse(result.content[0].text)

    expect(parsed).toEqual(items)
    expect(mockTp.listAttachments).toHaveBeenCalledWith('148980')
  })

  it('returns an empty array when there are no attachments', async () => {
    vi.mocked(mockTp.listAttachments).mockResolvedValue({
      ok: true,
      data: { Next: '', Items: [] },
    } as any)

    const result = await handleListAttachments(mockTp, { generalId: '148980' })

    expect(JSON.parse(result.content[0].text)).toEqual([])
  })

  it('surfaces HTTP status and response body on failure', async () => {
    vi.mocked(mockTp.listAttachments).mockResolvedValue({
      ok: false,
      status: 404,
      body: '{"Status":"NotFound"}',
    } as any)

    const result = await handleListAttachments(mockTp, { generalId: '999' })

    expect(result.content[0].text).toContain('Failed to list attachments for general id: 999')
    expect(result.content[0].text).toContain('HTTP status: 404')
  })
})
