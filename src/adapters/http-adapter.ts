import type {
  FileSystemAdapter,
  FileEntry,
  FileStat,
  ReadDirOptions,
  SearchQuery,
  SearchResult,
  AdapterCapabilities,
  HttpAdapterConfig,
  HttpMethod,
} from './types'

type EndpointKey =
  | 'tree'
  | 'read'
  | 'write'
  | 'delete'
  | 'rename'
  | 'mkdir'
  | 'stat'
  | 'exists'
  | 'search'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

const DEFAULT_ENDPOINTS: Record<EndpointKey, string> = {
  tree: '/tree',
  read: '/read',
  write: '/write',
  delete: '/delete',
  rename: '/rename',
  mkdir: '/mkdir',
  stat: '/stat',
  exists: '/exists',
  search: '/search',
}

const DEFAULT_METHODS: Record<EndpointKey, HttpMethod> = {
  tree: 'GET',
  read: 'GET',
  write: 'POST',
  delete: 'DELETE',
  rename: 'POST',
  mkdir: 'POST',
  stat: 'GET',
  exists: 'GET',
  search: 'POST',
}

export function createHttpAdapter(config: HttpAdapterConfig): FileSystemAdapter {
  const endpoints = { ...DEFAULT_ENDPOINTS, ...config.endpoints }
  const methods = { ...DEFAULT_METHODS, ...config.methods }
  let searchSupported = true

  function getUrl(endpoint: EndpointKey, params?: Record<string, string>): string {
    const base = config.baseUrl.replace(/\/+$/, '')
    const path = endpoints[endpoint]
    const url = new URL(`${base}${path}`, globalThis.location?.origin ?? 'http://localhost')

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value)
      }
    }

    return url.toString()
  }

  function getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (config.headers) {
      const extra = typeof config.headers === 'function' ? config.headers() : config.headers
      Object.assign(headers, extra)
    }

    return headers
  }

  async function request<T>(
    endpoint: EndpointKey,
    options?: { params?: Record<string, string>; body?: unknown },
  ): Promise<T> {
    const method = methods[endpoint]
    const url = getUrl(
      endpoint,
      method === 'GET' || method === 'DELETE' ? options?.params : undefined,
    )

    const fetchOptions: RequestInit = {
      method,
      headers: getHeaders(),
    }

    if (options?.body !== undefined && method !== 'GET') {
      fetchOptions.body = JSON.stringify(
        options.params
          ? { ...options.params, ...(options.body as Record<string, unknown>) }
          : options.body,
      )
    } else if (options?.params && method !== 'GET' && method !== 'DELETE') {
      fetchOptions.body = JSON.stringify(options.params)
    }

    const maxAttempts = config.retry?.maxAttempts ?? 3
    const initialDelay = config.retry?.delayMs ?? 1000
    const backoff = config.retry?.backoffMultiplier ?? 2

    let response: Response | undefined
    let lastError: Error | undefined
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        response = await fetch(url, fetchOptions)
        break
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        if (attempt < maxAttempts - 1) {
          const delay = initialDelay * Math.pow(backoff, attempt)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }
    if (!response) {
      throw new Error(
        `Network error calling ${endpoint} after ${maxAttempts} attempts: ${lastError!.message}`,
      )
    }

    if (!response.ok) {
      if (endpoint === 'search' && response.status === 404) {
        searchSupported = false
        throw new Error('Search not supported by server')
      }
      throw new Error(`HTTP ${response.status} from ${endpoint}: ${response.statusText}`)
    }

    let json: ApiResponse<T>
    try {
      json = (await response.json()) as ApiResponse<T>
    } catch {
      throw new Error(`Invalid JSON response from ${endpoint}`)
    }

    if (!json.success) {
      throw new Error(json.error ?? `Request to ${endpoint} failed`)
    }

    return json.data as T
  }

  const capabilities: AdapterCapabilities = Object.freeze({
    write: true,
    rename: true,
    delete: true,
    createDir: true,
    search: true,
    watch: false,
    binaryPreview: false,
  })

  const adapter: FileSystemAdapter = {
    async readDirectory(path: string, options?: ReadDirOptions): Promise<FileEntry[]> {
      const params: Record<string, string> = { path }
      if (options?.depth) params.depth = String(options.depth)
      if (options?.showHidden) params.showHidden = 'true'
      if (options?.showIgnored) params.showIgnored = 'true'

      return request<FileEntry[]>('tree', { params })
    },

    async readFile(path: string): Promise<string> {
      return request<string>('read', { params: { path } })
    },

    async writeFile(path: string, content: string): Promise<void> {
      await request<void>('write', { body: { path, content } })
    },

    async deleteFile(path: string): Promise<void> {
      await request<void>('delete', { params: { path } })
    },

    async rename(oldPath: string, newPath: string): Promise<void> {
      await request<void>('rename', { body: { oldPath, newPath } })
    },

    async createDirectory(path: string): Promise<void> {
      await request<void>('mkdir', { body: { path } })
    },

    async stat(path: string): Promise<FileStat> {
      return request<FileStat>('stat', { params: { path } })
    },

    async exists(path: string): Promise<boolean> {
      return request<boolean>('exists', { params: { path } })
    },

    async search(query: SearchQuery): Promise<SearchResult[]> {
      if (!searchSupported) {
        throw new Error('Search is not supported by this server')
      }
      return request<SearchResult[]>('search', { body: query })
    },

    get capabilities() {
      // Dynamic getter so `search` reflects runtime 404 discovery
      return Object.freeze({
        ...capabilities,
        search: searchSupported,
      })
    },
  } as FileSystemAdapter

  return adapter
}
