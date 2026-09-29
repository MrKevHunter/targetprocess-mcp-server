import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const TOKEN = 'abc123'
const BASE_URL = 'https://tp.example.com'

async function loadClient() {
  vi.resetModules()
  vi.stubEnv('TP_TOKEN', TOKEN)
  vi.stubEnv('TP_BASE_URL', BASE_URL)
  const { TpClient } = await import('../src/tp.js')
  return new TpClient()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => { })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('TpClient.listAttachments pagination', () => {
  it('follows the Next cursor across pages and flattens the results', async () => {
    const tp = await loadClient()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ Next: 'page2', Items: [{ Id: 1 }] }) })
      .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ Next: '', Items: [{ Id: 2 }] }) })
    vi.stubGlobal('fetch', fetchMock)

    const result = await tp.listAttachments<{ Id: number }>('148980')

    expect(result).toEqual({ ok: true, data: [{ Id: 1 }, { Id: 2 }] })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns the failure of whichever page fails', async () => {
    const tp = await loadClient()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ Next: 'page2', Items: [{ Id: 1 }] }) })
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'boom' }))

    const result = await tp.listAttachments<{ Id: number }>('148980')

    expect(result).toEqual({ ok: false, status: 500, body: 'boom' })
  })
})

describe('TpClient.downloadAttachmentContent origin guard', () => {
  it('appends the access_token for a same-origin absolute Uri', async () => {
    const tp = await loadClient()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
      headers: { get: () => 'image/png' },
    })
    vi.stubGlobal('fetch', fetchMock)

    await tp.downloadAttachmentContent(`${BASE_URL}/Attachment.aspx?AttachmentID=1`)

    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain(`access_token=${TOKEN}`)
  })

  it('does not send the access_token to an off-origin Uri', async () => {
    const tp = await loadClient()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
      headers: { get: () => 'image/png' },
    })
    vi.stubGlobal('fetch', fetchMock)

    await tp.downloadAttachmentContent('https://attacker.example.com/steal?x=1')

    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).not.toContain(TOKEN)
    expect(calledUrl).toBe('https://attacker.example.com/steal?x=1')
  })

  it('does not overwrite an access_token already present in an off-origin Uri', async () => {
    const tp = await loadClient()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
      headers: { get: () => 'image/png' },
    })
    vi.stubGlobal('fetch', fetchMock)

    await tp.downloadAttachmentContent('https://cdn.example.com/file.png?access_token=presigned-value')

    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toBe('https://cdn.example.com/file.png?access_token=presigned-value')
  })

  it('fails gracefully on a malformed absolute Uri instead of throwing', async () => {
    const tp = await loadClient()
    vi.stubGlobal('fetch', vi.fn())

    const result = await tp.downloadAttachmentContent('https://[invalid')

    expect(result.ok).toBe(false)
  })
})
