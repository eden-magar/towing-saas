export interface OverlapPosition {
  columnIndex: number
  totalColumns: number
  /** Columns this block may stretch across (≥1), capped at totalColumns - columnIndex. */
  span: number
}

export interface OverlapLayoutItem {
  id: string
  startMs: number
  endMs: number
}

/** Strict interval overlap: touching edges (end === start) do NOT overlap. */
function intervalsOverlap(
  a: Pick<OverlapLayoutItem, 'startMs' | 'endMs'>,
  b: Pick<OverlapLayoutItem, 'startMs' | 'endMs'>,
): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs
}

/**
 * Google Calendar–style side-by-side columns for overlapping intervals.
 *
 * Operates on millisecond timestamps only (pure logic, no React/DOM).
 *
 * Worked examples (all times in ms for brevity):
 *
 * (a) Two overlapping → 2 columns
 *     A [0, 100), B [50, 150) → A col 0, B col 1, totalColumns 2
 *
 * (b) A–B overlap, B–C overlap, A–C do not (chain cluster) → 2 columns
 *     A [0, 100), B [50, 150), C [100, 200)
 *     Cluster {A,B,C}; A col 0, B col 1, C col 0 (C stacks under A), totalColumns 2
 *
 * (c) Two consecutive (end === start) → stack vertically, 1 column each
 *     A [0, 100), B [100, 200) → separate clusters; A {0,1}, B {0,1}
 *
 * (d) One long tow overlapping three short consecutive ones → 2 columns
 *     L [0, 300), S1 [50, 100), S2 [100, 150), S3 [150, 200)
 *     Cluster {L,S1,S2,S3}; L col 0, S1 col 1, S2 col 1 (under S1), S3 col 1 (under S2), totalColumns 2
 *
 * Span examples (expand-to-fill free space on the right):
 * (e) Lone block in cluster → columnIndex 0, totalColumns 1, span 1 (full lane width)
 * (f) A [0, 200) col 0, B [200, 300) col 0 — no overlap; A span 1 (B occupies col 0 later but not during A)
 * (g) A [0, 150) col 0, B [50, 100) col 1 — A span 1 (col 1 blocked during A); B span 1
 * (h) A [0, 150) col 0, B [150, 200) col 1 — A span 2 (col 1 free for all of A's range), B span 1
 */
export function getOverlapLayout(items: OverlapLayoutItem[]): Map<string, OverlapPosition> {
  const result = new Map<string, OverlapPosition>()
  if (items.length === 0) {
    return result
  }

  const sorted = [...items].sort((a, b) => {
    if (a.startMs !== b.startMs) {
      return a.startMs - b.startMs
    }
    return b.endMs - a.endMs
  })

  const clusters: OverlapLayoutItem[][] = []
  let currentCluster: OverlapLayoutItem[] = []
  let clusterMaxEnd = -Infinity

  for (const item of sorted) {
    if (currentCluster.length === 0 || item.startMs < clusterMaxEnd) {
      currentCluster.push(item)
      clusterMaxEnd = Math.max(clusterMaxEnd, item.endMs)
    } else {
      clusters.push(currentCluster)
      currentCluster = [item]
      clusterMaxEnd = item.endMs
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster)
  }

  for (const cluster of clusters) {
    const columns: OverlapLayoutItem[][] = []

    for (const item of cluster) {
      let placed = false
      for (let col = 0; col < columns.length; col++) {
        const lastInColumn = columns[col][columns[col].length - 1]
        if (!intervalsOverlap(item, lastInColumn)) {
          columns[col].push(item)
          placed = true
          break
        }
      }
      if (!placed) {
        columns.push([item])
      }
    }

    const totalColumns = columns.length
    const columnById = new Map<string, number>()
    for (let col = 0; col < columns.length; col++) {
      for (const item of columns[col]) {
        columnById.set(item.id, col)
      }
    }

    for (const item of cluster) {
      const columnIndex = columnById.get(item.id)!
      let span = 1
      for (let col = columnIndex + 1; col < totalColumns; col++) {
        const blocked = cluster.some(
          (other) =>
            columnById.get(other.id) === col && intervalsOverlap(item, other),
        )
        if (blocked) break
        span++
      }
      result.set(item.id, { columnIndex, totalColumns, span })
    }
  }

  return result
}
