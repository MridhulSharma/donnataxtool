/**
 * Access to the generated payloads.
 *
 * Each file is fetched on its own, and only when something needs it, so the
 * first paint is not held up by data the reader has not asked for yet:
 *
 *   parcels   the records behind search and comparison
 *   sales     transfers, read when a valuation is run
 *   details   history and permits, read when a property is opened
 */
import type {
  CompactRow,
  CompactSale,
  Condition,
  DetailPayload,
  LocalPayload,
  ParcelDetail,
  Property,
  Sale,
  SalesPayload,
} from '../lib/types'

/** Describes the dataset itself, so every figure can be labelled with it. */
export interface Vintage {
  /** Fiscal year of the assessed values. */
  fy: number
  /** The January 1 the values are as of, ISO. */
  valuationDate: string
  /** When the extract was generated. */
  generated: string
  zips: string[]
}

interface Local {
  vintage: Vintage
  records: Property[]
  byPid: Map<string, Property>
}

function widen(row: CompactRow, fy: number, luDesc: Record<string, string>): Property {
  return {
    pid: row.p,
    addr: row.a,
    zip: row.z,
    la: row.la,
    areaSrc: row.as === null ? null : row.as === 1 ? 'gross' : 'living',
    yr: row.yr,
    lv: row.lv,
    bv: row.bv,
    tv: row.tv,
    gt: row.gt,
    ex: row.ex,
    lu: row.lu,
    luDesc: row.lu ? (luDesc[row.lu] ?? null) : null,
    fy,
    src: 'local',
    lot: row.lot,
    cond: row.cd as Condition | null,
    remodel: row.rm,
    beds: row.bd,
    baths: row.bt,
    units: row.u,
    lat: row.y,
    lon: row.x,
    ownerOcc: row.oo,
  }
}

let localPromise: Promise<Local> | null = null

/** The records held locally, widened once and cached for the session. */
export function loadLocal(): Promise<Local> {
  localPromise ??= import('./parcels.json')
    .then((module) => {
      const payload = (module.default ?? module) as unknown as LocalPayload
      const records = payload.parcels.map((row) => widen(row, payload.fy, payload.luDesc))
      return {
        vintage: {
          fy: payload.fy,
          valuationDate: payload.valuationDate,
          generated: payload.generated,
          zips: payload.zips,
        },
        records,
        byPid: new Map(records.map((record) => [record.pid, record])),
      }
    })
    .catch((error: unknown) => {
      // Let a later call try again rather than caching the failure forever.
      localPromise = null
      throw error
    })
  return localPromise
}

let salesPromise: Promise<Map<string, Sale[]>> | null = null

/** Every recorded transfer, by parcel, newest first. */
export function loadSales(): Promise<Map<string, Sale[]>> {
  salesPromise ??= import('./sales.json')
    .then((module) => {
      const payload = (module.default ?? module) as unknown as SalesPayload
      const byPid = new Map<string, Sale[]>()
      for (const row of payload.sales as CompactSale[]) {
        const list = byPid.get(row.p)
        const sale: Sale = {
          date: row.d,
          price: row.v,
          docType: row.t,
          armsLength: row.al === 1,
          note: row.n,
        }
        if (list) list.push(sale)
        else byPid.set(row.p, [sale])
      }
      return byPid
    })
    .catch((error: unknown) => {
      salesPromise = null
      throw error
    })
  return salesPromise
}

let detailPromise: Promise<DetailPayload> | null = null

/** Assessment history and permits for one parcel. */
export function loadDetail(pid: string): Promise<ParcelDetail | null> {
  detailPromise ??= import('./details.json')
    .then((module) => (module.default ?? module) as unknown as DetailPayload)
    .catch((error: unknown) => {
      detailPromise = null
      throw error
    })
  return detailPromise.then((all) => all[pid] ?? null)
}
