/** Where a record came from. Comps are only ever drawn from the same source. */
export type Source = 'local' | 'live'

/**
 * The one shape every property takes, whichever source it came from.
 * Short keys are deliberate: the embedded payload stores thousands of these.
 */
export interface Property {
  /** Parcel ID. */
  pid: string
  /** Street address, without the state and ZIP. */
  addr: string
  /** Living area, sq ft. */
  la: number | null
  /** Year built. */
  yr: number | null
  /** Assessed land value. */
  lv: number | null
  /** Assessed building value. */
  bv: number | null
  /** Total assessed value. */
  tv: number
  /** Gross annual tax. */
  gt: number | null
  /** Last sale price. */
  sp: number | null
  /** Last sale date, ISO-ish calendar date. */
  sd: string | null
  /** Residential exemption: 1 applied, 0 not, null unknown. */
  ex: 0 | 1 | null
  /** Owner of record. */
  o: string | null
  /** Land-use description, e.g. "SINGLE FAM DWELLING". */
  lu: string | null
  src: Source
  /**
   * ZIP, kept so a live subject can fetch its own comp pool. Not displayed.
   */
  zip?: string | null
}

/** The compact on-disk row written by scripts/extract.mjs. */
export interface CompactRow {
  p: string | null
  a: string
  la: number | null
  yr: number | null
  lv: number | null
  bv: number | null
  tv: number
  gt: number | null
  sp: number | null
  sd: string | null
  ex: 0 | 1 | null
  o: string | null
  lu: string | null
}
