import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', () => ({ statSync: vi.fn() }))

import { statSync } from 'fs'
import { handleAddAttachment } from '../src/handlers/add_attachment.js'
import type { TpClient } from '../src/tp.js'

const mockTp = {
  listAttachments: vi.fn(),
  uploadAttachment: vi.fn(),
} as unknown as TpClient

beforeEach(() => {
  vi.clearAllMocks()
})

describe('handleAddAttachment', () => {
  it('uploads via fileContent and confirms via the before/after diff', async () => {
    vi.mocked(mockTp.listAttachments)
      .mockResolvedValueOnce({ ok: true, data: [{ Id: 1, Name: 'old.png' }] } as any)
      .mockResolvedValueOnce({ ok: true, data: [{ Id: 1, Name: 'old.png' }, { Id: 2, Name: 'new.png' }] } as any)
    vi.mocked(mockTp.uploadAttachment).mockResolvedValue({ ok: true, data: 'ok' } as any)

    const result = await handleAddAttachment(mockTp, { generalId: '148980', fileContent: 'aGk=', fileName: 'new.png' })
    const parsed = JSON.parse(result.content[0].text)

    expect(parsed).toEqual({ Id: 2, Name: 'new.png' })
    expect(mockTp.uploadAttachment).toHaveBeenCalledWith('148980', { fileContent: 'aGk=', fileName: 'new.png' }, undefined)
  })

  it('uploads via filePath, matching the uploaded attachment by basename', async () => {
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as any)
    vi.mocked(mockTp.listAttachments)
      .mockResolvedValueOnce({ ok: true, data: [] } as any)
      .mockResolvedValueOnce({ ok: true, data: [{ Id: 5, Name: 'shot.png' }] } as any)
    vi.mocked(mockTp.uploadAttachment).mockResolvedValue({ ok: true, data: 'ok' } as any)

    const result = await handleAddAttachment(mockTp, { generalId: '148980', filePath: '/tmp/shot.png' })
    const parsed = JSON.parse(result.content[0].text)

    expect(parsed).toEqual({ Id: 5, Name: 'shot.png' })
    expect(mockTp.uploadAttachment).toHaveBeenCalledWith('148980', { filePath: '/tmp/shot.png' }, undefined)
  })

  it('rejects a filePath over the size limit without reading or uploading it', async () => {
    vi.mocked(statSync).mockReturnValue({ size: 11 * 1024 * 1024 } as any)

    const result = await handleAddAttachment(mockTp, { generalId: '148980', filePath: '/tmp/huge.png' })

    expect(result.content[0].text).toContain('exceeds the')
    expect(mockTp.uploadAttachment).not.toHaveBeenCalled()
    expect(mockTp.listAttachments).not.toHaveBeenCalled()
  })

  it('reports an error when the filePath cannot be read', async () => {
    vi.mocked(statSync).mockImplementation(() => { throw new Error('ENOENT: no such file') })

    const result = await handleAddAttachment(mockTp, { generalId: '148980', filePath: '/tmp/missing.png' })

    expect(result.content[0].text).toContain('Could not read "/tmp/missing.png"')
    expect(mockTp.uploadAttachment).not.toHaveBeenCalled()
  })

  it('does not confirm an unrelated attachment that appears concurrently', async () => {
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as any)
    vi.mocked(mockTp.listAttachments)
      .mockResolvedValueOnce({ ok: true, data: [] } as any)
      .mockResolvedValueOnce({ ok: true, data: [{ Id: 9, Name: 'someone-elses-upload.png' }] } as any)
    vi.mocked(mockTp.uploadAttachment).mockResolvedValue({ ok: true, data: 'ok' } as any)

    const result = await handleAddAttachment(mockTp, { generalId: '148980', filePath: '/tmp/shot.png' })

    expect(result.content[0].text).toContain('may not have persisted')
  })

  it('rejects when neither filePath nor fileContent is given', async () => {
    const result = await handleAddAttachment(mockTp, { generalId: '148980' })

    expect(result.content[0].text).toContain('Provide either "filePath" or "fileContent"')
    expect(mockTp.uploadAttachment).not.toHaveBeenCalled()
  })

  it('rejects when both filePath and fileContent are given', async () => {
    const result = await handleAddAttachment(mockTp, { generalId: '148980', filePath: '/tmp/a.png', fileContent: 'aGk=', fileName: 'a.png' })

    expect(result.content[0].text).toContain('Provide only one of')
    expect(mockTp.uploadAttachment).not.toHaveBeenCalled()
  })

  it('rejects fileContent without fileName', async () => {
    const result = await handleAddAttachment(mockTp, { generalId: '148980', fileContent: 'aGk=' })

    expect(result.content[0].text).toContain('"fileName" is required')
    expect(mockTp.uploadAttachment).not.toHaveBeenCalled()
  })

  it('rejects base64 content over the size limit without calling uploadAttachment', async () => {
    const bigBase64 = Buffer.alloc(11 * 1024 * 1024).toString('base64')

    const result = await handleAddAttachment(mockTp, { generalId: '148980', fileContent: bigBase64, fileName: 'big.png' })

    expect(result.content[0].text).toContain('exceeds the')
    expect(mockTp.uploadAttachment).not.toHaveBeenCalled()
    expect(mockTp.listAttachments).not.toHaveBeenCalled()
  })

  it('surfaces HTTP status and response body when the upload fails', async () => {
    vi.mocked(mockTp.listAttachments).mockResolvedValue({ ok: true, data: [] } as any)
    vi.mocked(mockTp.uploadAttachment).mockResolvedValue({ ok: false, status: 500, body: 'boom' } as any)

    const result = await handleAddAttachment(mockTp, { generalId: '148980', fileContent: 'aGk=', fileName: 'new.png' })

    expect(result.content[0].text).toContain('Failed to upload "new.png"')
    expect(result.content[0].text).toContain('HTTP status: 500')
  })

  it('reports when the upload succeeds but no new attachment appears afterward', async () => {
    vi.mocked(mockTp.listAttachments)
      .mockResolvedValueOnce({ ok: true, data: [{ Id: 1, Name: 'old.png' }] } as any)
      .mockResolvedValueOnce({ ok: true, data: [{ Id: 1, Name: 'old.png' }] } as any)
    vi.mocked(mockTp.uploadAttachment).mockResolvedValue({ ok: true, data: 'ok' } as any)

    const result = await handleAddAttachment(mockTp, { generalId: '148980', fileContent: 'aGk=', fileName: 'new.png' })

    expect(result.content[0].text).toContain('may not have persisted')
  })

  it('reports when the pre-upload listAttachments call fails', async () => {
    vi.mocked(mockTp.listAttachments).mockResolvedValue({ ok: false, status: 500, body: 'boom' } as any)

    const result = await handleAddAttachment(mockTp, { generalId: '148980', fileContent: 'aGk=', fileName: 'new.png' })

    expect(result.content[0].text).toContain('nothing was uploaded')
    expect(mockTp.uploadAttachment).not.toHaveBeenCalled()
  })

  it('reports when the post-upload listAttachments call fails', async () => {
    vi.mocked(mockTp.listAttachments)
      .mockResolvedValueOnce({ ok: true, data: [] } as any)
      .mockResolvedValueOnce({ ok: false, status: 500, body: 'boom' } as any)
    vi.mocked(mockTp.uploadAttachment).mockResolvedValue({ ok: true, data: 'ok' } as any)

    const result = await handleAddAttachment(mockTp, { generalId: '148980', fileContent: 'aGk=', fileName: 'new.png' })

    expect(result.content[0].text).toContain('could not confirm it via listAttachments')
  })
})
