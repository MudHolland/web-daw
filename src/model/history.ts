export type History<T> = {
  push(current: T, kind: string): void
  undo(current: T): T | null
  redo(current: T): T | null
  clear(): void
  canUndo(): boolean
  canRedo(): boolean
}

const MERGE_MS = 480

export function createHistory<T>(limit = 80): History<T> {
  let past: T[] = []
  let future: T[] = []
  let lastKind = ''
  let lastAt = 0

  return {
    push(current, kind) {
      const now = performance.now()
      const merge = kind.startsWith('live:') && kind === lastKind && now - lastAt < MERGE_MS
      lastKind = kind
      lastAt = now
      if (merge) return
      past.push(current)
      if (past.length > limit) past.shift()
      future = []
    },
    undo(current) {
      const prev = past.pop()
      if (!prev) return null
      future.push(current)
      lastKind = ''
      return prev
    },
    redo(current) {
      const next = future.pop()
      if (!next) return null
      past.push(current)
      lastKind = ''
      return next
    },
    clear() {
      past = []
      future = []
      lastKind = ''
      lastAt = 0
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
  }
}
