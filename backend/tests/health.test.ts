import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'

import app from '../src/app.js'

describe('GET /api/health', () => {
  it('returns the backend health status', async () => {
    const response = await request(app).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
  })
})

describe('GET /api/health/database', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('returns connected when Supabase responds successfully', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SECRET_KEY', 'test-secret-key')
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await request(app).get('/api/health/database')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok', database: 'connected' })
    expect(fetchMock).toHaveBeenCalledOnce()

    const [requestUrl, requestOptions] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ]
    expect(requestUrl).toBe('https://example.supabase.co/rest/v1/')
    expect(new Headers(requestOptions.headers).get('apikey')).toBe(
      'test-secret-key',
    )
  })

  it('returns unavailable without exposing connection details when Supabase cannot be reached', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SECRET_KEY', 'test-secret-key')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('secret detail')))

    const response = await request(app).get('/api/health/database')

    expect(response.status).toBe(503)
    expect(response.body).toEqual({ status: 'error', database: 'unavailable' })
    expect(response.text).not.toContain('secret detail')
    expect(response.text).not.toContain('test-secret-key')
  })
})
