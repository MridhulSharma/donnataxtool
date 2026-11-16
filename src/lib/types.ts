/** Where a record came from. */
export type Source = 'local' | 'live'

/**
 * Which column the floor area came from. Living area and gross area are
 * different measurements, so a comparison must never mix them.
 */
export type AreaSource = 'living' | 'gross'

/** Condition grade as the assessor records it, worst to best. */
export type Condition = 'P' | 'F' | 'A' | 'G' | 'VG' | 'E'

export const CONDITION_LABEL: Record<Condition, string> = {
  P: 'Poor',
  F: 'Fair',
  A: 'Average',
  G: 'Good',
  VG: 'Very good',
  E: 'Excellent',
}

/** Ordered worst to best, so two grades can be compared. */
export const CONDITION_RANK: Record<Condition, number> = {
  P: 0,
  F: 1,
  A: 2,
  G: 3,
  VG: 4,
  E: 5,
}

/** A recorded transfer of the property. */
export interface Sale {
  /** ISO calendar date. */
  date: string
  price: number
  /** Deed type as recorded, e.g. DEED, UNIT DEED, FORCLOSURE DEED. */
  docType: string | null
  /**
   * Whether this looks like an open-market sale between unrelated parties.
   * Nominal transfers, foreclosures and master deeds are not.
   */
  armsLength: boolean
  /** Why it was or was not treated as arm's length, for the reader. */
  note: string | null
}

/** A building permit on the parcel. */
export interface Permit {
  date: string
  workType: string | null
  description: string | null
  declaredValue: number | null
  squareFeet: number | null
}

/**
 * The one shape every property takes, whichever source it came from.
 * Short keys in the stored payload are widened into this on load.
 */
export interface Property {
  /** Parcel ID. */
  pid: string
  /** Street address, without the state and ZIP. */
  addr: string
  zip: string | null
  /** Floor area, sq ft. */
  la: number | null
  /** Which measurement `la` is. Null when there is no area on file. */
  areaSrc: AreaSource | null
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
  /** Residential exemption: 1 applied, 0 not, null unknown. */
  ex: 0 | 1 | null
  /** Land-use code, e.g. R1. Comparisons are made within a class. */
  lu: string | null
  /** Land-use description, e.g. "SINGLE FAM DWELLING". */
  luDesc: string | null
  /**
   * The fiscal year this assessment is for. Every figure shown to a user
   * carries it: filing against the wrong year's value is a wasted application.
   */
  fy: number
  src: Source

  /* Enrichment available for records held locally. Null elsewhere. */
  /** Lot size, sq ft. */
  lot: number | null
  cond: Condition | null
  /** Year last remodelled, when the record has one. */
  remodel: number | null
  beds: number | null
  /** Full baths plus half baths counted as a half. */
  baths: number | null
  /** Residential units on the parcel. */
  units: number | null
  lat: number | null
  lon: number | null
  /** The assessor's record suggests the owner lives here. */
  ownerOcc: 0 | 1 | null
}

/** The compact on-disk row written by scripts/extract.mjs. */
export interface CompactRow {
  p: string
  a: string
  z: string | null
  la: number | null
  /** 0 living area, 1 gross area. */
  as: 0 | 1 | null
  yr: number | null
  lv: number | null
  bv: number | null
  tv: number
  gt: number | null
  ex: 0 | 1 | null
  lu: string | null
  lot: number | null
  cd: Condition | null
  rm: number | null
  bd: number | null
  bt: number | null
  u: number | null
  /** Latitude. */
  y: number | null
  /** Longitude. */
  x: number | null
  oo: 0 | 1 | null
}

/** The payload written by scripts/extract.mjs. */
export interface LocalPayload {
  /** Fiscal year every assessed value in this file belongs to. */
  fy: number
  /** Assessment date for that fiscal year, ISO. Values are as of this date. */
  valuationDate: string
  /** When the file was generated. */
  generated: string
  /** The ZIP codes covered. */
  zips: string[]
  /** Land-use code to description, so the strings are stored once. */
  luDesc: Record<string, string>
  parcels: CompactRow[]
}

/** A single arm's-length-screened sale row in the sales payload. */
export interface CompactSale {
  p: string
  d: string
  v: number
  t: string | null
  /** 1 when the screen treated it as an open-market sale. */
  al: 0 | 1
  n: string | null
}

export interface SalesPayload {
  fy: number
  valuationDate: string
  sales: CompactSale[]
}

/** Per-parcel detail, loaded only when a property is actually opened. */
export interface ParcelDetail {
  /** Assessment history, [fiscal year, assessed value], newest first. */
  h: [number, number][]
  /** Recent permits. */
  pm: {
    d: string
    w: string | null
    x: string | null
    v: number | null
    s: number | null
  }[]
}

export type DetailPayload = Record<string, ParcelDetail>
