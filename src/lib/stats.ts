/**
 * The statistics the valuation rests on, kept apart from it so each piece can
 * be tested on its own.
 */

/** Median of a list. Null when the list is empty. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * The value below which the given share of the data falls, interpolating
 * between the two neighbouring points.
 */
export function quantile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 1) return sorted[0]
  const position = (sorted.length - 1) * Math.min(Math.max(p, 0), 1)
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower)
}

/**
 * Coefficient of dispersion: the average spread around the median, as a
 * percentage of it. The standard measure of how even a set of ratios is;
 * the IAAO looks for 15 or under on single-family homes.
 */
export function coefficientOfDispersion(values: readonly number[]): number | null {
  const mid = median(values)
  if (mid === null || mid === 0) return null
  const spread = values.reduce((sum, v) => sum + Math.abs(v - mid), 0) / values.length
  return (spread / mid) * 100
}

/**
 * Price-related differential. Above 1 means lower-value properties carry a
 * higher share of their worth than higher-value ones, which is what
 * regressive assessment looks like in the numbers. The IAAO band is
 * 0.98 to 1.03.
 */
export function priceRelatedDifferential(
  ratios: readonly { ratio: number; value: number }[],
): number | null {
  if (ratios.length === 0) return null
  const mean = ratios.reduce((sum, r) => sum + r.ratio, 0) / ratios.length
  const totalValue = ratios.reduce((sum, r) => sum + r.value, 0)
  if (totalValue === 0) return null
  const weighted = ratios.reduce((sum, r) => sum + r.ratio * r.value, 0) / totalValue
  if (weighted === 0) return null
  return mean / weighted
}

/* ------------------------------------------------------------------ *
 * Ordinary least squares
 * ------------------------------------------------------------------ */

export interface Regression {
  /** The intercept, then one coefficient per column of X, in order. */
  coefficients: number[]
  /** Share of the variance the fit accounts for. */
  r2: number
  /** Number of observations the fit was built on. */
  n: number
}

/**
 * Solve a linear system by Gaussian elimination with partial pivoting.
 * Returns null when the matrix is singular.
 */
function solve(matrix: number[][], rhs: number[]): number[] | null {
  const n = rhs.length
  const a = matrix.map((row, i) => [...row, rhs[i]])

  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row
    }
    if (Math.abs(a[pivot][col]) < 1e-12) return null
    ;[a[col], a[pivot]] = [a[pivot], a[col]]

    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = a[row][col] / a[col][col]
      if (factor === 0) continue
      for (let k = col; k <= n; k++) a[row][k] -= factor * a[col][k]
    }
  }

  // Elimination ran above and below the pivot, so the matrix is diagonal.
  return a.map((row, i) => row[n] / row[i])
}

/**
 * Least-squares fit of `y` on `x`, with an intercept added for you.
 *
 * A small ridge term keeps the solution stable when two predictors move
 * together, which they often do here: floor area and lot size, for instance.
 * It biases the coefficients very slightly toward zero, which is the right
 * trade when the alternative is a wild fit on a few dozen sales.
 */
export function leastSquares(
  x: readonly (readonly number[])[],
  y: readonly number[],
  ridge = 1e-6,
): Regression | null {
  const n = y.length
  if (n === 0) return null
  const width = x[0]?.length ?? 0
  const p = width + 1
  if (n <= p) return null

  // Design matrix with a leading 1 for the intercept.
  const design = x.map((row) => [1, ...row])

  const xtx: number[][] = Array.from({ length: p }, () => Array.from({ length: p }, () => 0))
  const xty: number[] = Array.from({ length: p }, () => 0)

  for (let i = 0; i < n; i++) {
    const row = design[i]
    for (let a = 0; a < p; a++) {
      xty[a] += row[a] * y[i]
      for (let b = a; b < p; b++) xtx[a][b] += row[a] * row[b]
    }
  }
  // Mirror the upper triangle; the matrix is symmetric by construction.
  for (let a = 0; a < p; a++) {
    for (let b = 0; b < a; b++) xtx[a][b] = xtx[b][a]
  }
  // Ridge on the slopes only, never on the intercept.
  for (let a = 1; a < p; a++) xtx[a][a] += ridge * n

  const coefficients = solve(xtx, xty)
  if (!coefficients || coefficients.some((c) => !Number.isFinite(c))) return null

  const meanY = y.reduce((sum, v) => sum + v, 0) / n
  let ssRes = 0
  let ssTot = 0
  for (let i = 0; i < n; i++) {
    const predicted = design[i].reduce((sum, v, k) => sum + v * coefficients[k], 0)
    ssRes += (y[i] - predicted) ** 2
    ssTot += (y[i] - meanY) ** 2
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot

  return { coefficients, r2, n }
}

/* ------------------------------------------------------------------ *
 * Geography
 * ------------------------------------------------------------------ */

const EARTH_MILES = 3958.8

/** Great-circle distance in miles between two points. */
export function milesBetween(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * EARTH_MILES * Math.asin(Math.min(1, Math.sqrt(h)))
}
