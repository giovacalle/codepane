// ---------------------------------------------------------------------------
// codepane — useSearch hook
// ---------------------------------------------------------------------------
// Provides reactive access to the search state and actions for executing
// and clearing file content searches.
// ---------------------------------------------------------------------------

import { useEditorStore } from '../core/context'
import type { SearchResult } from '../core/types'

export interface UseSearchReturn {
  /** The current search query string. */
  query: string
  /** The current search scope: search by file names or file content. */
  scope: 'files' | 'content'
  /** Search results, or `null` if no search has been executed. */
  results: SearchResult[] | null
  /** Whether a search is currently in progress. */
  isSearching: boolean
  /**
   * Execute a search with the given query and scope.
   * Results are stored in the store and available via `results`.
   */
  search: (query: string, scope?: 'files' | 'content') => Promise<void>
  /** Clear the search query and results. */
  clearSearch: () => void
  /** Replace a single match in a file and re-run the search. */
  replaceOne: (
    path: string,
    match: { line: number; column: number; length: number },
    replaceText: string,
  ) => Promise<void>
  /** Replace all current search matches across all files and re-run the search. */
  replaceAll: (replaceText: string) => Promise<void>
}

/**
 * Hook for interacting with the editor's search functionality.
 *
 * Returns the current search state and actions for executing and
 * clearing searches. Uses granular store selectors to minimize re-renders.
 *
 * @example
 * ```tsx
 * function MySearchPanel() {
 *   const { query, results, isSearching, search, clearSearch } = useSearch();
 *
 *   return (
 *     <div>
 *       <input
 *         value={query}
 *         onChange={(e) => search(e.target.value)}
 *         placeholder="Search..."
 *       />
 *       {isSearching && <span>Searching...</span>}
 *       {results?.map(result => (
 *         <div key={result.path}>
 *           {result.path}: {result.matches.length} matches
 *         </div>
 *       ))}
 *       <button onClick={clearSearch}>Clear</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSearch(): UseSearchReturn {
  const query = useEditorStore((s) => s.searchQuery)
  const scope = useEditorStore((s) => s.searchScope)
  const results = useEditorStore((s) => s.searchResults)
  const isSearching = useEditorStore((s) => s.searchLoading)
  const search = useEditorStore((s) => s.search)
  const clearSearch = useEditorStore((s) => s.clearSearch)
  const replaceOne = useEditorStore((s) => s.replaceOne)
  const replaceAll = useEditorStore((s) => s.replaceAll)

  return {
    query,
    scope,
    results,
    isSearching,
    search,
    clearSearch,
    replaceOne,
    replaceAll,
  }
}
