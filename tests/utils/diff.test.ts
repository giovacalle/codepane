import { computeDiff } from '../../src/utils/diff'
import type { DiffResult, DiffLine } from '../../src/utils/diff'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Count lines of a given type in a DiffResult. */
function countType(result: DiffResult, type: DiffLine['type']): number {
  return result.lines.filter((l) => l.type === type).length
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeDiff', () => {
  // -----------------------------------------------------------------------
  // 1. Identical strings
  // -----------------------------------------------------------------------
  describe('identical strings', () => {
    it('returns all unchanged for single-line identical text', () => {
      const result = computeDiff('hello', 'hello')
      expect(result.stats).toEqual({ added: 0, removed: 0, unchanged: 1 })
      expect(result.lines).toHaveLength(1)
      expect(result.lines[0]).toEqual({
        type: 'unchanged',
        content: 'hello',
        oldLineNumber: 1,
        newLineNumber: 1,
      })
    })

    it('returns all unchanged for multi-line identical text', () => {
      const text = 'line1\nline2\nline3'
      const result = computeDiff(text, text)
      expect(result.stats).toEqual({ added: 0, removed: 0, unchanged: 3 })
      expect(result.lines.every((l) => l.type === 'unchanged')).toBe(true)
    })
  })

  // -----------------------------------------------------------------------
  // 2. Empty old text, non-empty new
  // -----------------------------------------------------------------------
  describe('empty old text, non-empty new text', () => {
    it('marks all lines as added', () => {
      const result = computeDiff('', 'a\nb\nc')
      expect(result.stats).toEqual({ added: 3, removed: 0, unchanged: 0 })
      expect(result.lines.every((l) => l.type === 'added')).toBe(true)
    })

    it('sets oldLineNumber to null for every added line', () => {
      const result = computeDiff('', 'x\ny')
      for (const line of result.lines) {
        expect(line.oldLineNumber).toBeNull()
      }
    })

    it('assigns correct 1-based newLineNumbers', () => {
      const result = computeDiff('', 'a\nb\nc')
      expect(result.lines.map((l) => l.newLineNumber)).toEqual([1, 2, 3])
    })
  })

  // -----------------------------------------------------------------------
  // 3. Non-empty old, empty new
  // -----------------------------------------------------------------------
  describe('non-empty old text, empty new text', () => {
    it('marks all lines as removed', () => {
      const result = computeDiff('a\nb\nc', '')
      expect(result.stats).toEqual({ added: 0, removed: 3, unchanged: 0 })
      expect(result.lines.every((l) => l.type === 'removed')).toBe(true)
    })

    it('sets newLineNumber to null for every removed line', () => {
      const result = computeDiff('x\ny', '')
      for (const line of result.lines) {
        expect(line.newLineNumber).toBeNull()
      }
    })

    it('assigns correct 1-based oldLineNumbers', () => {
      const result = computeDiff('a\nb\nc', '')
      expect(result.lines.map((l) => l.oldLineNumber)).toEqual([1, 2, 3])
    })
  })

  // -----------------------------------------------------------------------
  // 4. Both empty
  // -----------------------------------------------------------------------
  describe('both texts empty', () => {
    it('returns an empty result', () => {
      const result = computeDiff('', '')
      expect(result.lines).toHaveLength(0)
      expect(result.stats).toEqual({ added: 0, removed: 0, unchanged: 0 })
    })
  })

  // -----------------------------------------------------------------------
  // 5. Additions only (new has extra lines)
  // -----------------------------------------------------------------------
  describe('additions only', () => {
    it('detects appended lines', () => {
      const result = computeDiff('a\nb', 'a\nb\nc\nd')
      expect(result.stats.added).toBe(2)
      expect(result.stats.removed).toBe(0)
      expect(result.stats.unchanged).toBe(2)
    })

    it('detects prepended lines', () => {
      const result = computeDiff('c\nd', 'a\nb\nc\nd')
      expect(result.stats.added).toBe(2)
      expect(result.stats.removed).toBe(0)
      expect(result.stats.unchanged).toBe(2)
    })

    it('detects lines inserted in the middle', () => {
      const result = computeDiff('a\nc', 'a\nb\nc')
      expect(result.stats).toEqual({ added: 1, removed: 0, unchanged: 2 })
      const added = result.lines.filter((l) => l.type === 'added')
      expect(added).toHaveLength(1)
      expect(added[0].content).toBe('b')
    })
  })

  // -----------------------------------------------------------------------
  // 6. Removals only
  // -----------------------------------------------------------------------
  describe('removals only', () => {
    it('detects lines removed from the end', () => {
      const result = computeDiff('a\nb\nc\nd', 'a\nb')
      expect(result.stats.removed).toBe(2)
      expect(result.stats.added).toBe(0)
      expect(result.stats.unchanged).toBe(2)
    })

    it('detects lines removed from the beginning', () => {
      const result = computeDiff('a\nb\nc\nd', 'c\nd')
      expect(result.stats.removed).toBe(2)
      expect(result.stats.added).toBe(0)
      expect(result.stats.unchanged).toBe(2)
    })

    it('detects lines removed from the middle', () => {
      const result = computeDiff('a\nb\nc', 'a\nc')
      expect(result.stats).toEqual({ added: 0, removed: 1, unchanged: 2 })
      const removed = result.lines.filter((l) => l.type === 'removed')
      expect(removed).toHaveLength(1)
      expect(removed[0].content).toBe('b')
    })
  })

  // -----------------------------------------------------------------------
  // 7. Mixed changes
  // -----------------------------------------------------------------------
  describe('mixed changes', () => {
    it('handles simultaneous additions, removals, and unchanged lines', () => {
      const oldText = 'a\nb\nc\nd'
      const newText = 'a\nB\nc\ne'
      const result = computeDiff(oldText, newText)

      // 'a' and 'c' are unchanged; 'b'->'B' is a remove+add; 'd'->'e' is a remove+add
      expect(result.stats.unchanged).toBe(2)
      expect(result.stats.removed).toBe(2)
      expect(result.stats.added).toBe(2)
    })

    it('preserves content correctly in mixed diff', () => {
      const result = computeDiff('keep\nold\nkeep2', 'keep\nnew\nkeep2')
      const removed = result.lines.filter((l) => l.type === 'removed')
      const added = result.lines.filter((l) => l.type === 'added')
      expect(removed.map((l) => l.content)).toEqual(['old'])
      expect(added.map((l) => l.content)).toEqual(['new'])
    })
  })

  // -----------------------------------------------------------------------
  // 8. Stats accuracy
  // -----------------------------------------------------------------------
  describe('stats accuracy', () => {
    it('stats match the actual line type counts', () => {
      const cases: [string, string][] = [
        ['', 'a\nb'],
        ['a\nb', ''],
        ['a\nb\nc', 'a\nX\nc'],
        ['a\nb\nc\nd\ne', 'a\nc\nf\ne'],
        ['one', 'one'],
      ]

      for (const [oldText, newText] of cases) {
        const result = computeDiff(oldText, newText)
        expect(result.stats.added).toBe(countType(result, 'added'))
        expect(result.stats.removed).toBe(countType(result, 'removed'))
        expect(result.stats.unchanged).toBe(countType(result, 'unchanged'))
      }
    })

    it('total lines in result equals added + removed + unchanged', () => {
      const result = computeDiff('a\nb\nc', 'b\nc\nd')
      const total = result.stats.added + result.stats.removed + result.stats.unchanged
      expect(result.lines).toHaveLength(total)
    })
  })

  // -----------------------------------------------------------------------
  // 9. Line numbers are 1-based and correct
  // -----------------------------------------------------------------------
  describe('line numbers', () => {
    it('unchanged lines have both oldLineNumber and newLineNumber set', () => {
      const result = computeDiff('a\nb\nc', 'a\nb\nc')
      for (const line of result.lines) {
        expect(line.oldLineNumber).not.toBeNull()
        expect(line.newLineNumber).not.toBeNull()
      }
    })

    it('added lines have oldLineNumber = null and newLineNumber set', () => {
      const result = computeDiff('a', 'a\nb')
      const added = result.lines.filter((l) => l.type === 'added')
      expect(added).toHaveLength(1)
      expect(added[0].oldLineNumber).toBeNull()
      expect(added[0].newLineNumber).toBe(2)
    })

    it('removed lines have newLineNumber = null and oldLineNumber set', () => {
      const result = computeDiff('a\nb', 'a')
      const removed = result.lines.filter((l) => l.type === 'removed')
      expect(removed).toHaveLength(1)
      expect(removed[0].newLineNumber).toBeNull()
      expect(removed[0].oldLineNumber).toBe(2)
    })

    it('line numbers are 1-based, not 0-based', () => {
      const result = computeDiff('first', 'first')
      expect(result.lines[0].oldLineNumber).toBe(1)
      expect(result.lines[0].newLineNumber).toBe(1)
    })

    it('old and new line numbers increment independently', () => {
      // old: a, b, c  -> new: a, X, c
      // diff: unchanged(a), removed(b), added(X), unchanged(c)
      const result = computeDiff('a\nb\nc', 'a\nX\nc')
      const oldNums = result.lines
        .filter((l) => l.oldLineNumber !== null)
        .map((l) => l.oldLineNumber)
      const newNums = result.lines
        .filter((l) => l.newLineNumber !== null)
        .map((l) => l.newLineNumber)

      // Old line numbers should be sequential: 1, 2, 3
      expect(oldNums).toEqual([1, 2, 3])
      // New line numbers should be sequential: 1, 2, 3
      expect(newNums).toEqual([1, 2, 3])
    })
  })

  // -----------------------------------------------------------------------
  // 10. Trailing newline normalization
  // -----------------------------------------------------------------------
  describe('trailing newline normalization', () => {
    it('treats "foo\\n" and "foo" identically (no phantom empty line)', () => {
      const withNewline = computeDiff('foo\n', 'foo\n')
      const withoutNewline = computeDiff('foo', 'foo')
      expect(withNewline.lines).toEqual(withoutNewline.lines)
      expect(withNewline.stats).toEqual(withoutNewline.stats)
    })

    it('does not produce a phantom empty line for trailing newline', () => {
      const result = computeDiff('a\nb\n', 'a\nb\n')
      expect(result.lines).toHaveLength(2)
      expect(result.lines.every((l) => l.content !== '')).toBe(true)
    })

    it('normalizes trailing newline when comparing with and without', () => {
      const result = computeDiff('hello\n', 'hello')
      expect(result.stats).toEqual({ added: 0, removed: 0, unchanged: 1 })
    })
  })

  // -----------------------------------------------------------------------
  // 11. Multiline with trailing newlines
  // -----------------------------------------------------------------------
  describe('multiline with trailing newlines', () => {
    it('handles multiline text ending with newline', () => {
      const result = computeDiff('a\nb\nc\n', 'a\nb\nc\n')
      expect(result.lines).toHaveLength(3)
      expect(result.stats).toEqual({ added: 0, removed: 0, unchanged: 3 })
    })

    it('detects changes in multiline text with trailing newlines', () => {
      const result = computeDiff('a\nb\nc\n', 'a\nX\nc\n')
      expect(result.stats.unchanged).toBe(2)
      expect(result.stats.removed).toBe(1)
      expect(result.stats.added).toBe(1)
    })

    it('correctly diffs when only one side has trailing newline', () => {
      const result = computeDiff('a\nb\n', 'a\nb')
      // After normalization both become ['a', 'b'] so they should be identical
      expect(result.stats).toEqual({ added: 0, removed: 0, unchanged: 2 })
    })
  })

  // -----------------------------------------------------------------------
  // 12. Large file threshold (>5000 lines) — linear heuristic
  // -----------------------------------------------------------------------
  describe('large file threshold (linear heuristic)', () => {
    const THRESHOLD = 5_001 // just over the 5000 line limit

    function generateLines(count: number, prefix = 'line'): string {
      return Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`).join('\n')
    }

    it('produces correct results for identical large files', () => {
      const text = generateLines(THRESHOLD)
      const result = computeDiff(text, text)
      expect(result.stats.added).toBe(0)
      expect(result.stats.removed).toBe(0)
      expect(result.stats.unchanged).toBe(THRESHOLD)
    })

    it('detects additions in large files', () => {
      const oldText = generateLines(THRESHOLD)
      const newText = oldText + '\nextra1\nextra2'
      const result = computeDiff(oldText, newText)
      expect(result.stats.added).toBe(2)
      expect(result.stats.removed).toBe(0)
      expect(result.stats.unchanged).toBe(THRESHOLD)
    })

    it('detects removals in large files', () => {
      // Remove the last 3 lines
      const lines = Array.from({ length: THRESHOLD }, (_, i) => `line${i + 1}`)
      const oldText = lines.join('\n')
      const newText = lines.slice(0, -3).join('\n')
      const result = computeDiff(oldText, newText)
      expect(result.stats.removed).toBe(3)
      expect(result.stats.added).toBe(0)
      expect(result.stats.unchanged).toBe(THRESHOLD - 3)
    })

    it('handles completely different large files', () => {
      const oldText = generateLines(THRESHOLD, 'old')
      const newText = generateLines(THRESHOLD, 'new')
      const result = computeDiff(oldText, newText)
      // All lines are different, so all removed + all added
      expect(result.stats.removed).toBe(THRESHOLD)
      expect(result.stats.added).toBe(THRESHOLD)
      expect(result.stats.unchanged).toBe(0)
    })

    it('stats are consistent with actual line counts for large files', () => {
      const oldText = generateLines(THRESHOLD)
      const newLines = Array.from({ length: THRESHOLD }, (_, i) => `line${i + 1}`)
      // Replace every 100th line
      for (let i = 0; i < newLines.length; i += 100) {
        newLines[i] = `modified${i + 1}`
      }
      const newText = newLines.join('\n')
      const result = computeDiff(oldText, newText)
      expect(result.stats.added).toBe(countType(result, 'added'))
      expect(result.stats.removed).toBe(countType(result, 'removed'))
      expect(result.stats.unchanged).toBe(countType(result, 'unchanged'))
    })
  })

  // -----------------------------------------------------------------------
  // 13. Single line differences
  // -----------------------------------------------------------------------
  describe('single line differences', () => {
    it('detects a single line replacement', () => {
      const result = computeDiff('old', 'new')
      expect(result.stats).toEqual({ added: 1, removed: 1, unchanged: 0 })
      expect(result.lines).toHaveLength(2)
      expect(result.lines[0]).toEqual({
        type: 'removed',
        content: 'old',
        oldLineNumber: 1,
        newLineNumber: null,
      })
      expect(result.lines[1]).toEqual({
        type: 'added',
        content: 'new',
        oldLineNumber: null,
        newLineNumber: 1,
      })
    })

    it('detects single line to empty', () => {
      const result = computeDiff('only', '')
      expect(result.stats).toEqual({ added: 0, removed: 1, unchanged: 0 })
    })

    it('detects empty to single line', () => {
      const result = computeDiff('', 'only')
      expect(result.stats).toEqual({ added: 1, removed: 0, unchanged: 0 })
    })

    it('single unchanged line', () => {
      const result = computeDiff('same', 'same')
      expect(result.stats).toEqual({ added: 0, removed: 0, unchanged: 1 })
    })
  })

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles lines that are empty strings', () => {
      const result = computeDiff('a\n\nb', 'a\n\nb')
      expect(result.lines).toHaveLength(3)
      expect(result.stats.unchanged).toBe(3)
      expect(result.lines[1].content).toBe('')
    })

    it('handles text with only newlines', () => {
      const result = computeDiff('\n\n', '\n\n')
      // '\n\n' normalized to '\n' -> split -> ['', '']
      expect(result.stats.unchanged).toBe(2)
    })

    it('preserves order: removals before additions at same position', () => {
      const result = computeDiff('a\nb\nc', 'a\nX\nc')
      const midLines = result.lines.filter((l) => l.type !== 'unchanged')
      // removed 'b' should come before added 'X'
      expect(midLines[0].type).toBe('removed')
      expect(midLines[0].content).toBe('b')
      expect(midLines[1].type).toBe('added')
      expect(midLines[1].content).toBe('X')
    })

    it('handles duplicate lines correctly', () => {
      const result = computeDiff('a\na\na', 'a\na')
      expect(result.stats.unchanged).toBe(2)
      expect(result.stats.removed).toBe(1)
      expect(result.stats.added).toBe(0)
    })
  })
})
