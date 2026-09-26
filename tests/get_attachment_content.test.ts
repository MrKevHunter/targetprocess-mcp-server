import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleGetAttachmentContent } from '../src/handlers/get_attachment_content.js'
import type { TpClient } from '../src/tp.js'

const mockTp = {
  getAttachment: vi.fn(),
  downloadAttachmentContent: vi.fn(),
} as unknown as TpClient

beforeEach(() => {
  vi.clearAllMocks()
})

function attachment(overrides: Partial<Record<string, any>> = {}) {
  return {
    Id: 20748,
    Name: 'screenshot.png',
    MimeType: 'image/png',
    Size: 1024,
    Uri: 'https://tp.example.com/attachment/20748',
    ...overrides,
  }
}

describe('handleGetAttachmentContent', () => {
  it('inlines an image under the size limit as an image content block', async () => {
    vi.mocked(mockTp.getAttachment).mockResolvedValue({ ok: true, data: attachment() } as any)
    vi.mocked(mockTp.downloadAttachmentContent).mockResolvedValue({
      ok: true,
      data: { data: Buffer.from('fake-bytes'), mimeType: 'image/png', size: 10 },
    } as any)

    const result = await handleGetAttachmentContent(mockTp, { attachmentId: '20748' })

    expect(result.content[0].type).toBe('image')
    expect((result.content[0] as any).mimeType).toBe('image/png')
    expect((result.content[0] as any).data).toBe(Buffer.from('fake-bytes').toString('base64'))
  })

  it('returns metadata text for a non-image mime type', async () => {
    vi.mocked(mockTp.getAttachment).mockResolvedValue({ ok: true, data: attachment({ MimeType: 'application/pdf', Size: 10 }) } as any)
    vi.mocked(mockTp.downloadAttachmentContent).mockResolvedValue({
      ok: true,
      data: { data: Buffer.from('fake-bytes'), mimeType: 'application/pdf', size: 10 },
    } as any)

    const result = await handleGetAttachmentContent(mockTp, { attachmentId: '20748' })
    const parsed = JSON.parse(result.content[0].text)

    expect(result.content[0].type).toBe('text')
    expect(parsed.note).toContain('Only image/* attachments are inlined')
  })

  it('skips downloading when metadata Size exceeds the inline limit', async () => {
    vi.mocked(mockTp.getAttachment).mockResolvedValue({
      ok: true,
      data: attachment({ Size: 6 * 1024 * 1024 }),
    } as any)

    const result = await handleGetAttachmentContent(mockTp, { attachmentId: '20748' })
    const parsed = JSON.parse(result.content[0].text)

    expect(mockTp.downloadAttachmentContent).not.toHaveBeenCalled()
    expect(parsed.uri).toBe('https://tp.example.com/attachment/20748')
    expect(parsed.note).toContain('over the')
  })

  it('surfaces HTTP status and response body when metadata lookup fails', async () => {
    vi.mocked(mockTp.getAttachment).mockResolvedValue({ ok: false, status: 404, body: 'not found' } as any)

    const result = await handleGetAttachmentContent(mockTp, { attachmentId: '999' })

    expect(result.content[0].text).toContain('Failed to get attachment id: 999')
    expect(result.content[0].text).toContain('HTTP status: 404')
  })

  it('does not inline as an image when the download content-type contradicts the metadata', async () => {
    vi.mocked(mockTp.getAttachment).mockResolvedValue({ ok: true, data: attachment({ MimeType: 'image/png' }) } as any)
    vi.mocked(mockTp.downloadAttachmentContent).mockResolvedValue({
      ok: true,
      data: { data: Buffer.from('<html>login</html>'), mimeType: 'text/html', size: 19 },
    } as any)

    const result = await handleGetAttachmentContent(mockTp, { attachmentId: '20748' })
    const parsed = JSON.parse(result.content[0].text)

    expect(result.content[0].type).toBe('text')
    expect(parsed.note).toContain('authentication redirect')
  })

  it('still inlines as an image when the download reports a generic binary content-type', async () => {
    vi.mocked(mockTp.getAttachment).mockResolvedValue({ ok: true, data: attachment({ MimeType: 'image/png' }) } as any)
    vi.mocked(mockTp.downloadAttachmentContent).mockResolvedValue({
      ok: true,
      data: { data: Buffer.from('fake-bytes'), mimeType: 'application/octet-stream', size: 10 },
    } as any)

    const result = await handleGetAttachmentContent(mockTp, { attachmentId: '20748' })

    expect(result.content[0].type).toBe('image')
    expect((result.content[0] as any).mimeType).toBe('image/png')
  })

  it('falls back to metadata + uri when content download fails', async () => {
    vi.mocked(mockTp.getAttachment).mockResolvedValue({ ok: true, data: attachment() } as any)
    vi.mocked(mockTp.downloadAttachmentContent).mockResolvedValue({ ok: false, status: 401, body: 'unauthorized' } as any)

    const result = await handleGetAttachmentContent(mockTp, { attachmentId: '20748' })
    const parsed = JSON.parse(result.content[0].text)

    expect(parsed.uri).toBe('https://tp.example.com/attachment/20748')
    expect(parsed.note).toContain('basic auth')
  })
})
