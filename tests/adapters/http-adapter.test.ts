import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createHttpAdapter } from '../../src/adapters/http-adapter'

// happy-dom provides globalThis.location, but we need a stable origin for URL resolution
const BASE_URL = 'http://localhost:3000/api/fs'

function mockResponse(data: unknown, ok = true, status = 200, statusText = 'OK') {
  return {
    ok,
    status,
    statusText,
    json: async () => ({ success: true, data }),
    text: async () => JSON.stringify({ success: true, data }),
  }
}

function mockErrorResponse(status: number, statusText = 'Error') {
  return {
    ok: false,
    status,
    statusText,
    json: async () => ({ success: false, error: statusText }),
    text: async () => JSON.stringify({ success: false, error: statusText }),
  }
}

function mockApiFailure(error: string) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ success: false, error }),
    text: async () => JSON.stringify({ success: false, error }),
  }
}

describe('createHttpAdapter', () => {
  let mockFetch: ReturnType<typeof vi.fn>
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    mockFetch = vi.fn()
    globalThis.fetch = mockFetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  // ---------------------------------------------------------------------------
  // Basic operations
  // ---------------------------------------------------------------------------

  describe('basic operations', () => {
    it('readDirectory sends GET to /tree with path as query param', async () => {
      const entries = [
        { name: 'index.ts', path: 'src/index.ts', type: 'file' },
      ]
      mockFetch.mockResolvedValueOnce(mockResponse(entries))

      const adapter = createHttpAdapter({ baseUrl: BASE_URL })
      const result = await adapter.readDirectory('src')

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toContain('/tree')
      expect(url).toContain('path=src')
      expect(opts.method).toBe('GET')
      expect(result).toEqual(entries)
    })

    it('readDirectory passes options as query params', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([]))

      const adapter = createHttpAdapter({ baseUrl: BASE_URL })
      await adapter.readDirectory('src', { depth: 2, showHidden: true, showIgnored: true })

      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain('depth=2')
      expect(url).toContain('showHidden=true')
      expect(url).toContain('showIgnored=true')
    })

    it('readFile sends GET to /read with path as query param', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse('console.log("hello")'))

      const adapter = createHttpAdapter({ baseUrl: BASE_URL })
      const content = await adapter.readFile('src/index.ts')

      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toContain('/read')
      expect(url).toContain('path=src%2Findex.ts')
      expect(opts.method).toBe('GET')
      expect(content).toBe('console.log("hello")')
    })

    it('writeFile sends POST to /write with path and content in body', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(undefined))

      const adapter = createHttpAdapter({ baseUrl: BASE_URL })
      await adapter.writeFile('src/index.ts', 'new content')

      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toContain('/write')
      expect(opts.method).toBe('POST')
      const body = JSON.parse(opts.body)
      expect(body.path).toBe('src/index.ts')
      expect(body.content).toBe('new content')
    })

    it('deleteFile sends DELETE to /delete with path as query param', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(undefined))

      const adapter = createHttpAdapter({ baseUrl: BASE_URL })
      await adapter.deleteFile('src/old.ts')

      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toContain('/delete')
      expect(url).toContain('path=src%2Fold.ts')
      expect(opts.method).toBe('DELETE')
    })

    it('rename sends POST to /rename with oldPath and newPath in body', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(undefined))

      const adapter = createHttpAdapter({ baseUrl: BASE_URL })
      await adapter.rename('src/old.ts', 'src/new.ts')

      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toContain('/rename')
      expect(opts.method).toBe('POST')
      const body = JSON.parse(opts.body)
      expect(body.oldPath).toBe('src/old.ts')
      expect(body.newPath).toBe('src/new.ts')
    })

    it('createDirectory sends POST to /mkdir with path in body', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(undefined))

      const adapter = createHttpAdapter({ baseUrl: BASE_URL })
      await adapter.createDirectory('src/components')

      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toContain('/mkdir')
      expect(opts.method).toBe('POST')
      const body = JSON.parse(opts.body)
      expect(body.path).toBe('src/components')
    })

    it('stat sends GET to /stat with path as query param', async () => {
      const statData = { type: 'file', size: 1024, mtime: 1234567890 }
      mockFetch.mockResolvedValueOnce(mockResponse(statData))

      const adapter = createHttpAdapter({ baseUrl: BASE_URL })
      const result = await adapter.stat('src/index.ts')

      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toContain('/stat')
      expect(url).toContain('path=src%2Findex.ts')
      expect(opts.method).toBe('GET')
      expect(result).toEqual(statData)
    })

    it('exists sends GET to /exists with path as query param', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(true))

      const adapter = createHttpAdapter({ baseUrl: BASE_URL })
      const result = await adapter.exists('src/index.ts')

      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toContain('/exists')
      expect(url).toContain('path=src%2Findex.ts')
      expect(opts.method).toBe('GET')
      expect(result).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  describe('configuration', () => {
    it('static headers are sent with every request', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([]))
      mockFetch.mockResolvedValueOnce(mockResponse('content'))

      const adapter = createHttpAdapter({
        baseUrl: BASE_URL,
        headers: { Authorization: 'Bearer token123', 'X-Custom': 'value' },
      })

      await adapter.readDirectory('src')
      await adapter.readFile('src/index.ts')

      for (const call of mockFetch.mock.calls) {
        const opts = call[1]
        expect(opts.headers).toMatchObject({
          Authorization: 'Bearer token123',
          'X-Custom': 'value',
          'Content-Type': 'application/json',
        })
      }
    })

    it('dynamic headers function is called per request', async () => {
      let callCount = 0
      const headersFn = vi.fn(() => {
        callCount++
        return { Authorization: `Bearer token-${callCount}` }
      })

      mockFetch.mockResolvedValueOnce(mockResponse([]))
      mockFetch.mockResolvedValueOnce(mockResponse('content'))

      const adapter = createHttpAdapter({ baseUrl: BASE_URL, headers: headersFn })

      await adapter.readDirectory('src')
      await adapter.readFile('src/index.ts')

      expect(headersFn).toHaveBeenCalledTimes(2)
      expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer token-1')
      expect(mockFetch.mock.calls[1][1].headers.Authorization).toBe('Bearer token-2')
    })

    it('custom endpoint overrides change the URL path', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([]))

      const adapter = createHttpAdapter({
        baseUrl: BASE_URL,
        endpoints: { tree: '/custom-tree' },
      })

      await adapter.readDirectory('src')

      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain('/custom-tree')
      expect(url).not.toContain('/tree')
    })

    it('custom method overrides change the HTTP method', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(undefined))

      const adapter = createHttpAdapter({
        baseUrl: BASE_URL,
        methods: { write: 'PUT' },
      })

      await adapter.writeFile('src/index.ts', 'content')

      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.method).toBe('PUT')
    })

    it('strips trailing slashes from baseUrl', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([]))

      const adapter = createHttpAdapter({ baseUrl: BASE_URL + '///' })
      await adapter.readDirectory('src')

      const [url] = mockFetch.mock.calls[0]
      // Should not have triple slashes before /tree
      expect(url).not.toMatch(/\/\/\/tree/)
      expect(url).toContain('/tree')
    })
  })

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  describe('error handling', () => {
    it('throws on network error (fetch rejects)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'))

      const adapter = createHttpAdapter({ baseUrl: BASE_URL, retry: { maxAttempts: 1 } })

      await expect(adapter.readFile('src/index.ts')).rejects.toThrow(
        'Network error calling read after 1 attempts: Failed to fetch'
      )
    })

    it('throws on non-200 response with status info', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse(500, 'Internal Server Error'))

      const adapter = createHttpAdapter({ baseUrl: BASE_URL })

      await expect(adapter.readFile('src/index.ts')).rejects.toThrow(
        'HTTP 500 from read: Internal Server Error'
      )
    })

    it('throws on invalid JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => {
          throw new SyntaxError('Unexpected token')
        },
      })

      const adapter = createHttpAdapter({ baseUrl: BASE_URL })

      await expect(adapter.readFile('src/index.ts')).rejects.toThrow(
        'Invalid JSON response from read'
      )
    })

    it('throws when API returns success: false with error message', async () => {
      mockFetch.mockResolvedValueOnce(mockApiFailure('File not found'))

      const adapter = createHttpAdapter({ baseUrl: BASE_URL })

      await expect(adapter.readFile('src/missing.ts')).rejects.toThrow('File not found')
    })

    it('throws generic message when API returns success: false without error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ success: false }),
      })

      const adapter = createHttpAdapter({ baseUrl: BASE_URL })

      await expect(adapter.readFile('src/missing.ts')).rejects.toThrow(
        'Request to read failed'
      )
    })

    it('wraps non-Error thrown values in network error message', async () => {
      mockFetch.mockRejectedValueOnce('string error')

      const adapter = createHttpAdapter({ baseUrl: BASE_URL, retry: { maxAttempts: 1 } })

      await expect(adapter.readFile('src/index.ts')).rejects.toThrow(
        'Network error calling read after 1 attempts: string error'
      )
    })
  })

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  describe('search', () => {
    it('sends POST to /search with query in body', async () => {
      const searchResults = [
        { path: 'src/index.ts', matches: [{ line: 1, content: 'hello', offset: 0 }] },
      ]
      mockFetch.mockResolvedValueOnce(mockResponse(searchResults))

      const adapter = createHttpAdapter({ baseUrl: BASE_URL })
      const query = { pattern: 'hello', path: 'src' }
      const result = await adapter.search!(query)

      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toContain('/search')
      expect(opts.method).toBe('POST')
      const body = JSON.parse(opts.body)
      expect(body.pattern).toBe('hello')
      expect(body.path).toBe('src')
      expect(result).toEqual(searchResults)
    })

    it('disables search capability on 404 response', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse(404, 'Not Found'))

      const adapter = createHttpAdapter({ baseUrl: BASE_URL })

      // First search call: 404 disables search
      await expect(adapter.search!({ pattern: 'hello' })).rejects.toThrow(
        'Search not supported by server'
      )

      // Capability should now reflect that search is disabled
      expect(adapter.capabilities.search).toBe(false)

      // Subsequent calls should throw immediately without hitting fetch
      await expect(adapter.search!({ pattern: 'hello' })).rejects.toThrow(
        'Search is not supported by this server'
      )

      // fetch should only have been called once (the initial 404)
      expect(mockFetch).toHaveBeenCalledOnce()
    })
  })

  // ---------------------------------------------------------------------------
  // Capabilities
  // ---------------------------------------------------------------------------

  describe('capabilities', () => {
    it('returns correct default capabilities', () => {
      const adapter = createHttpAdapter({ baseUrl: BASE_URL })
      const caps = adapter.capabilities

      expect(caps.write).toBe(true)
      expect(caps.rename).toBe(true)
      expect(caps.delete).toBe(true)
      expect(caps.createDir).toBe(true)
      expect(caps.search).toBe(true)
      expect(caps.watch).toBe(false)
      expect(caps.binaryPreview).toBe(false)
    })

    it('capabilities object is frozen', () => {
      const adapter = createHttpAdapter({ baseUrl: BASE_URL })
      const caps = adapter.capabilities

      expect(Object.isFrozen(caps)).toBe(true)
    })

    it('search capability updates dynamically after 404', async () => {
      const adapter = createHttpAdapter({ baseUrl: BASE_URL })

      // Initially search is true
      expect(adapter.capabilities.search).toBe(true)

      // Trigger a 404 on search
      mockFetch.mockResolvedValueOnce(mockErrorResponse(404, 'Not Found'))
      await adapter.search!({ pattern: 'test' }).catch(() => {})

      // Now search should be false
      expect(adapter.capabilities.search).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Retry logic
  // ---------------------------------------------------------------------------

  describe('retry logic', () => {
    it('retries on network error up to maxAttempts times', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(mockResponse('test content'))

      const adapter = createHttpAdapter({
        baseUrl: BASE_URL,
        retry: { maxAttempts: 3, delayMs: 10, backoffMultiplier: 1 },
      })

      const result = await adapter.readFile('test.ts')
      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(result).toBe('test content')
    })

    it('fails after exhausting all retry attempts', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('network down'))
        .mockRejectedValueOnce(new Error('network down'))
        .mockRejectedValueOnce(new Error('network down'))

      const adapter = createHttpAdapter({
        baseUrl: BASE_URL,
        retry: { maxAttempts: 3, delayMs: 10, backoffMultiplier: 1 },
      })

      await expect(adapter.readFile('test.ts')).rejects.toThrow(
        'Network error calling read after 3 attempts: network down'
      )
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('does not retry on HTTP error responses (4xx/5xx)', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse(500, 'Internal Server Error'))

      const adapter = createHttpAdapter({
        baseUrl: BASE_URL,
        retry: { maxAttempts: 3, delayMs: 10, backoffMultiplier: 1 },
      })

      await expect(adapter.readFile('test.ts')).rejects.toThrow(
        'HTTP 500 from read: Internal Server Error'
      )
      // fetch succeeded (returned a response), so no retries
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('uses exponential backoff delay', async () => {
      vi.useFakeTimers()

      mockFetch
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(mockResponse('ok'))

      const adapter = createHttpAdapter({
        baseUrl: BASE_URL,
        retry: { maxAttempts: 3, delayMs: 100, backoffMultiplier: 2 },
      })

      const promise = adapter.readFile('test.ts')

      // First retry delay: 100 * 2^0 = 100ms
      await vi.advanceTimersByTimeAsync(100)
      // Second retry delay: 100 * 2^1 = 200ms
      await vi.advanceTimersByTimeAsync(200)

      const result = await promise
      expect(result).toBe('ok')
      expect(mockFetch).toHaveBeenCalledTimes(3)

      vi.useRealTimers()
    })
  })
})
