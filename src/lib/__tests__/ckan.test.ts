import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { datastoreSearchAll, fiscalYearOf } from '../ckan'
import { indexRecord, parseNumber, pickField } from '../fields'
import { mapRow } from '../live'

describe('finding the right fiscal year table', () => {
  it('reads the year out of whatever carries it', () => {
    const at = new Date('2026-11-15')
    expect(fiscalYearOf({ id: 'a', name: 'fy2026-property-assessment-data_rev.csv' }, at)).toBe(
      2026,
    )
    // Two years in the name: the assessment year, not the export date.
    expect(
      fiscalYearOf({ id: 'b', name: 'fy2025-property-assessment-data_12_30_2024.csv' }, at),
    ).toBe(2025)
    expect(fiscalYearOf({ id: 'c', url: 'https://example.org/data2021-full.csv' }, at)).toBe(2021)
  })

  it('falls back to the created date when no year is in the name', () => {
    const at = new Date('2026-11-15')
    expect(
      fiscalYearOf({ id: 'd', name: 'fy19fullpropassess.csv', created: '2018-07-02' }, at),
    ).toBe(2018)
  })

  it('ignores a year too far in the future to be real', () => {
    const at = new Date('2026-11-15')
    expect(fiscalYearOf({ id: 'e', name: 'archive-2099-backup.csv', created: '2020-01-01' }, at)).toBe(
      2020,
    )
  })
})

describe('reading a record whose columns have drifted', () => {
  it('finds a field under any of its known spellings', () => {
    const index = indexRecord({ AV_TOTAL: '193,800' })
    expect(parseNumber(pickField(index, ['TOTAL_VALUE', 'AV_TOTAL']))).toBe(193_800)
  })

  it('survives a stray space in a column name', () => {
    const index = indexRecord({ 'LIVING _AREA': ' 1,410 ' })
    expect(parseNumber(pickField(index, ['LIVING_AREA']))).toBe(1410)
  })

  it('matches a year-stamped column by shape', () => {
    const index = indexRecord({ FY2004_TOTAL: ' $210,000.00 ' })
    expect(parseNumber(pickField(index, ['TOTAL_VALUE'], /^FY\d+TOTAL$/))).toBe(210_000)
  })

  it('maps a row into the shape the rest of the app uses', () => {
    const property = mapRow(
      {
        PID: '0101234000',
        ST_NUM: '3',
        ST_NAME: 'WESTFORD ST',
        CITY: 'ALLSTON',
        ZIP_CODE: '02134',
        LU: 'R1',
        LU_DESC: 'SINGLE FAM DWELLING',
        LIVING_AREA: '1,410',
        YR_BUILT: '1911',
        TOTAL_VALUE: '$902,600',
        GROSS_TAX: '11,192',
      },
      2026,
    )
    expect(property).not.toBeNull()
    expect(property!.tv).toBe(902_600)
    expect(property!.la).toBe(1410)
    expect(property!.areaSrc).toBe('living')
    expect(property!.addr).toBe('3 WESTFORD ST, ALLSTON')
    expect(property!.fy).toBe(2026)
  })

  it('falls back to gross area and remembers that it did', () => {
    const property = mapRow(
      { PID: '1', ST_NAME: 'A ST', TOTAL_VALUE: '100000', LIVING_AREA: '0', GROSS_AREA: '2000' },
      2026,
    )
    expect(property!.areaSrc).toBe('gross')
    expect(property!.la).toBe(2000)
  })

  it('refuses a record with no value, id or address', () => {
    expect(mapRow({ ST_NAME: 'A ST', TOTAL_VALUE: '100000' }, 2026)).toBeNull()
    expect(mapRow({ PID: '1', ST_NAME: 'A ST', TOTAL_VALUE: '0' }, 2026)).toBeNull()
  })
})

describe('fetching a whole cohort', () => {
  const page = (records: unknown[], total: number) => ({
    ok: true,
    json: async () => ({ success: true, result: { total, fields: [{ id: 'PID' }], records } }),
  })

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('pages until the match is exhausted', async () => {
    // A truncated cohort is biased rather than small: row order follows the
    // parcel id, which runs ward by ward.
    const rows = Array.from({ length: 12 }, (_, i) => ({ PID: String(i) }))
    const fetchMock = vi.fn(async (url: URL | string) => {
      const offset = Number(new URL(String(url)).searchParams.get('offset') ?? 0)
      return page(rows.slice(offset, offset + 5), rows.length)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await datastoreSearchAll(
      { resourceId: 'r' },
      { pageSize: 5, maxRecords: 100 },
    )
    expect(result.records).toHaveLength(12)
    expect(result.complete).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('says so when it had to stop short', async () => {
    const fetchMock = vi.fn(async () =>
      page(Array.from({ length: 5 }, (_, i) => ({ PID: String(i) })), 10_000),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await datastoreSearchAll({ resourceId: 'r' }, { pageSize: 5, maxRecords: 10 })
    expect(result.complete).toBe(false)
  })

  it('turns a failed request into a sentence a resident can act on', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 503, json: async () => ({}) }))
    await expect(datastoreSearchAll({ resourceId: 'r' }, { maxRecords: 10 })).rejects.toThrow(
      /City of Boston/,
    )
  })
})
