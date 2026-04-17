// ---------------------------------------------------------------------------
// codepane — Diff Algorithm
// ---------------------------------------------------------------------------
// Pure, side-effect-free line-level diff computation. Uses an LCS-based
// approach for inputs up to 5,000 lines each, falling back to a linear
// O(n) heuristic for very large files.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

/** Classification of a single diff line. */
export type DiffLineType = 'added' | 'removed' | 'unchanged'

/** A single line in the diff output. */
export interface DiffLine {
  /** Whether this line was added, removed, or unchanged. */
  type: DiffLineType
  /** The text content of the line (without trailing newline). */
  content: string
  /** 1-based line number in the old text, or `null` for added lines. */
  oldLineNumber: number | null
  /** 1-based line number in the new text, or `null` for removed lines. */
  newLineNumber: number | null
}

/** The complete result of a diff computation. */
export interface DiffResult {
  /** Ordered list of diff lines. */
  lines: DiffLine[]
  /** Summary statistics. */
  stats: {
    added: number
    removed: number
    unchanged: number
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Threshold above which we switch to the linear heuristic. */
const LARGE_FILE_THRESHOLD = 5_000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Split text into lines. An empty string produces a single empty-string
 * element so that the diff always has at least one entry per side.
 */
function splitLines(text: string): string[] {
  if (text.length === 0) return []
  // Remove a single trailing newline so "foo\n" doesn't produce a phantom
  // empty line at the end, matching standard diff behaviour.
  const normalized = text.endsWith('\n') ? text.slice(0, -1) : text
  return normalized.split('\n')
}

// ---------------------------------------------------------------------------
// LCS-based diff  (O(n*m) time & space, suitable for <=5 000 lines each)
// ---------------------------------------------------------------------------

/**
 * Compute the Longest Common Subsequence table between `a` and `b`.
 * Returns a 2-D array where `table[i][j]` is the LCS length for
 * `a[0..i-1]` and `b[0..j-1]`.
 */
function lcsTable(a: string[], b: string[]): Uint16Array[] {
  const m = a.length
  const n = b.length

  // Allocate rows as typed arrays for memory efficiency.
  const table: Uint16Array[] = new Array(m + 1)
  for (let i = 0; i <= m; i++) {
    table[i] = new Uint16Array(n + 1)
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1])
      }
    }
  }

  return table
}

/**
 * Back-track the LCS table to produce an ordered list of DiffLines.
 */
function backtrack(table: Uint16Array[], a: string[], b: string[]): DiffLine[] {
  const result: DiffLine[] = []
  let i = a.length
  let j = b.length

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.push({
        type: 'unchanged',
        content: a[i - 1],
        oldLineNumber: i,
        newLineNumber: j,
      })
      i--
      j--
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      result.push({
        type: 'added',
        content: b[j - 1],
        oldLineNumber: null,
        newLineNumber: j,
      })
      j--
    } else {
      result.push({
        type: 'removed',
        content: a[i - 1],
        oldLineNumber: i,
        newLineNumber: null,
      })
      i--
    }
  }

  return result.reverse()
}

// ---------------------------------------------------------------------------
// Linear heuristic diff  (O(n+m), for very large files)
// ---------------------------------------------------------------------------

/**
 * A simple line-matching heuristic: index every line in the old text,
 * then walk the new text greedily matching against that index. Unmatched
 * old lines are removals, unmatched new lines are additions.
 *
 * This is *not* optimal but runs in linear time and produces reasonable
 * output for large files where an O(n*m) approach would be too slow.
 */
function linearDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  // Build a map from line content -> list of indices in oldLines.
  const oldIndex = new Map<string, number[]>()
  for (let i = 0; i < oldLines.length; i++) {
    const line = oldLines[i]
    let list = oldIndex.get(line)
    if (!list) {
      list = []
      oldIndex.set(line, list)
    }
    list.push(i)
  }

  const result: DiffLine[] = []
  const usedOld = new Uint8Array(oldLines.length)
  let oldPtr = 0

  for (let j = 0; j < newLines.length; j++) {
    const line = newLines[j]
    const candidates = oldIndex.get(line)

    // Find the earliest unused old line at or after oldPtr.
    let matchIdx = -1
    if (candidates) {
      for (const c of candidates) {
        if (c >= oldPtr && !usedOld[c]) {
          matchIdx = c
          break
        }
      }
    }

    if (matchIdx >= 0) {
      // Emit all unmatched old lines between oldPtr and matchIdx as removals.
      for (let k = oldPtr; k < matchIdx; k++) {
        if (!usedOld[k]) {
          result.push({
            type: 'removed',
            content: oldLines[k],
            oldLineNumber: k + 1,
            newLineNumber: null,
          })
          usedOld[k] = 1
        }
      }
      // Emit the matched line.
      result.push({
        type: 'unchanged',
        content: line,
        oldLineNumber: matchIdx + 1,
        newLineNumber: j + 1,
      })
      usedOld[matchIdx] = 1
      oldPtr = matchIdx + 1
    } else {
      result.push({
        type: 'added',
        content: line,
        oldLineNumber: null,
        newLineNumber: j + 1,
      })
    }
  }

  // Remaining unmatched old lines are removals.
  for (let k = oldPtr; k < oldLines.length; k++) {
    if (!usedOld[k]) {
      result.push({
        type: 'removed',
        content: oldLines[k],
        oldLineNumber: k + 1,
        newLineNumber: null,
      })
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute a line-level diff between two strings.
 *
 * For inputs where both sides are at most {@link LARGE_FILE_THRESHOLD} lines
 * an LCS-based algorithm is used (optimal output, O(n*m)). For larger inputs
 * a linear heuristic produces a reasonable (but potentially non-minimal) diff.
 *
 * @param oldText - The original text.
 * @param newText - The modified text.
 * @returns A {@link DiffResult} containing the diff lines and summary stats.
 */
export function computeDiff(oldText: string, newText: string): DiffResult {
  const oldLines = splitLines(oldText)
  const newLines = splitLines(newText)

  let lines: DiffLine[]

  if (oldLines.length > LARGE_FILE_THRESHOLD || newLines.length > LARGE_FILE_THRESHOLD) {
    lines = linearDiff(oldLines, newLines)
  } else {
    const table = lcsTable(oldLines, newLines)
    lines = backtrack(table, oldLines, newLines)
  }

  let added = 0
  let removed = 0
  let unchanged = 0
  for (const line of lines) {
    if (line.type === 'added') added++
    else if (line.type === 'removed') removed++
    else unchanged++
  }

  return { lines, stats: { added, removed, unchanged } }
}
