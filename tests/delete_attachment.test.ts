import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleDeleteAttachment } from '../src/handlers/delete_attachment.js'
import type { TpClient } from '../src/tp.js'

const mockTp = {
  deleteAttachment: vi.fn(),
} as unknown as TpClient

beforeEach(() => {
  vi.clearAllMocks()
})

describe('handleDeleteAttachment', () => {
  it('returns deleted confirmation on success', async () => {
    vi.mocked(mockTp.deleteAttachment).mockResolvedValue({
      ok: true,
      data: { Id: 20748 },
    } as any)

    const result = await handleDeleteAttachment(mockTp, { attachmentId: '20748' })
    const parsed = JSON.parse(result.content[0].text)

    expect(parsed.deleted).toBe(true)
    expect(parsed.id).toBe(20748)
    expect(mockTp.deleteAttachment).toHaveBeenCalledWith('20748')
  })

  it('surfaces HTTP status and response body on failure', async () => {
    vi.mocked(mockTp.deleteAttachment).mockResolvedValue({
      ok: false,
      status: 404,
      body: '{"Status":"NotFound","Message":"Attachment 999 not found"}',
    } as any)

    const result = await handleDeleteAttachment(mockTp, { attachmentId: '999' })

    expect(result.content[0].text).toContain('Failed to delete attachment id: 999')
    expect(result.content[0].text).toContain('HTTP status: 404')
    expect(result.content[0].text).toContain('Attachment 999 not found')
  })
})
