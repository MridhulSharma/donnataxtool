/**
 * Sales-comparison valuation: what the property was worth on the assessment
 * date, argued from what comparable homes actually sold for.
 *
 * This is the ground a homeowner can win on. Massachusetts assesses at full
 * and fair cash value as of January 1 before the fiscal year, so an
 * overvaluation case is made by showing what similar properties fetched on
 * the open market around that date.
 *
 * The method here is the appraiser's one, with every step on screen:
 *
 *   1. Screen out transfers that are not open-market sales.
 *   2. Derive the adjustments from the neighbourhood's own sales, by
 *      regression, rather than applying rates invented for the purpose.
 *   3. Select comparables close to the subject in class, size, age and
 *      distance, and sold near the valuation date.
 *   4. Adjust each sale to the subject and to the valuation date.
 *   5. Report a RANGE, and call the assessment high only when it sits above
 *      the top of that range.
 *
 * Every adjustment is reported in dollars with the coefficient behind it, so
 * the homeowner, a navigator and an assessor can all check the arithmetic.
 */
import { leastSquares, median, milesBetween, quantile, type Regression } from './stats'
import { CONDITION_RANK, type Property, type Sale } from './types'

/** A sale paired with the property it transferred. */
export interface SaleObservation {
  property: Property
  sale: Sale
  /** Months from the sale to the valuation date. Positive means before it. */
  monthsBefore: number
}

export const TUNING = {
  /** Comparables must be within this share of the subject's floor area. */
  areaTolerance: 0.25,
  /** And within this many years of its year built, when both are known. */
  yearTolerance: 15,
  /** And no further away than this, when both have a location on file. */
  maxMiles: 1,
  /** Sale windows tried in order, in months before the valuation date. */
  windows: [12, 24, 36, 48],
  /** Below this many comparables there is no estimate, only a shortfall. */
  minComps: 3,
  /** Comparables used in the grid once they are ranked. */
  maxComps: 8,
  /** Sales within this many years of the valuation date train the model. */
  trainingYears: 6,
  /** A regression needs at least this many sales before it is trusted. */
  minTraining: 30,
  /** A two-parameter time trend needs far fewer. */
  minTrend: 15,
  /** And must account for at least this share of the variance. */
  minR2: 0.35,
  /** A credible floor-area elasticity sits inside this band. */
  areaElasticity: { min: 0.2, max: 1.3 },
  /** A credible annual market trend sits inside this band. */
  annualTrend: { min: -0.15, max: 0.25 },
} as const

/** One line of the adjustment grid. */
export interface Adjustment {
  label: string
  /** The subject's figure, as text. */
  subject: string
  /** The comparable's figure, as text. */
  comp: string
  /** Dollars added to or taken off the sale price. */
  amount: number
}

export interface AdjustedComp {
  property: Property
  sale: Sale
  monthsBefore: number
  /** Miles from the subject, when both have a location. */
  miles: number | null
  adjustments: Adjustment[]
  /** Sale price after every adjustment. */
  adjustedPrice: number
  /** How far the adjustments moved the price, as a share of it. */
  netAdjustmentShare: number
}

export type ValuationMethod = 'regression-adjusted' | 'time-adjusted' | 'unadjusted'

export interface MarketModel {
  method: ValuationMethod
  /**
   * Implied annual change in value, as a decimal. Null only when even a
   * two-parameter trend could not be estimated credibly.
   */
  annualTrend: number | null
  /** The monthly log change behind that trend, used to adjust a sale. */
  monthlyTrend: number | null
  /** How floor area moves price, as an elasticity. Null when not estimated. */
  areaElasticity: number | null
  /** Dollars per step of condition grade. Null when not estimated. */
  conditionStep: number | null
  fit: Regression | null
  /** Sales the model was trained on. */
  trainingCount: number
  /** Why the model is the shape it is, in a sentence. */
  note: string
}

export interface SalesValuation {
  status: 'valued'
  /** The January 1 the value is as of. */
  valuationDate: string
  fiscalYear: number
  /** Middle of the adjusted sales. */
  indicatedValue: number
  /** The range the adjusted sales support. */
  low: number
  high: number
  /** The assessment being tested. */
  assessedValue: number
  /** Positive when the assessment sits above the top of the range. */
  aboveRange: number
  /** True only when the assessment is above the top of the range. */
  overAssessed: boolean
  /** Estimated tax at stake, when the tax rate can be worked out. */
  taxAtStake: number | null
  comps: AdjustedComp[]
  model: MarketModel
  /** Months of sales the comparables were drawn from. */
  windowMonths: number
  /** Sales set aside by the arm's-length screen, for honesty. */
  excluded: { address: string; date: string; price: number; reason: string }[]
}

export interface NoValuation {
  status: 'insufficient-sales'
  valuationDate: string
  fiscalYear: number
  /** How many comparable sales were found, against how many are needed. */
  found: number
  needed: number
  /** The widest window tried. */
  windowMonths: number
  reason: string
  /** Whatever sales were found, so the reader sees the evidence that exists. */
  nearMisses: AdjustedComp[]
}

export type ValuationResult = SalesValuation | NoValuation

const MS_PER_MONTH = 30.436875 * 86_400_000

function monthsBetween(saleDate: string, valuationDate: string): number {
  return (Date.parse(valuationDate) - Date.parse(saleDate)) / MS_PER_MONTH
}

/** The year the record says the building was last substantially worked on. */
export const effectiveYear = (property: Property): number | null => {
  if (property.remodel && property.remodel > 1000) {
    return property.yr ? Math.max(property.yr, property.remodel) : property.remodel
  }
  return property.yr && property.yr > 1000 ? property.yr : null
}

const conditionRank = (property: Property): number | null =>
  property.cond ? CONDITION_RANK[property.cond] : null

/**
 * Every open-market sale of a given class, paired with its property.
 *
 * Only sales at or before the valuation date are used. A sale after it says
 * what the market did later, which is not what the assessment is measured
 * against.
 */
export function buildObservations(
  pool: readonly Property[],
  salesByPid: ReadonlyMap<string, readonly Sale[]>,
  valuationDate: string,
  landUse: string | null,
): SaleObservation[] {
  const out: SaleObservation[] = []
  for (const property of pool) {
    if (landUse && property.lu !== landUse) continue
    if (!property.la || property.la <= 200) continue
    const sales = salesByPid.get(property.pid)
    if (!sales) continue
    for (const sale of sales) {
      if (!sale.armsLength) continue
      const monthsBefore = monthsBetween(sale.date, valuationDate)
      if (monthsBefore < 0) continue
      out.push({ property, sale, monthsBefore })
    }
  }
  return out
}

/**
 * Derive the adjustment rates from the neighbourhood's own sales.
 *
 * A long window is used for training, because the coefficients need data and
 * a time term is what makes older sales usable. The comparables themselves
 * still come from a tight window; this only decides how to adjust them.
 *
 * The fit is used only if it is credible: enough sales, enough explained
 * variance, and coefficients inside bands a surveyor would recognise. An
 * implausible model is worse than none, because it would move a sale price
 * by thousands for no defensible reason.
 */
/**
 * The market trend on its own: how price per square foot moved, month by
 * month, against the valuation date.
 *
 * Two parameters rather than five, so it survives a sample far too small for
 * the full model. Time is the adjustment that matters most, because a sale
 * two years before the assessment date is otherwise compared as though the
 * market stood still.
 */
function fitTimeTrend(
  observations: readonly SaleObservation[],
): { monthly: number; annual: number; n: number } | null {
  const usable = observations.filter(
    (o) => o.monthsBefore <= TUNING.trainingYears * 12 && o.sale.price > 0 && o.property.la,
  )
  if (usable.length < TUNING.minTrend) return null

  const x = usable.map((o) => [-o.monthsBefore])
  const y = usable.map((o) => Math.log(o.sale.price / (o.property.la as number)))
  const fit = leastSquares(x, y)
  if (!fit) return null

  const monthly = fit.coefficients[1]
  const annual = Math.exp(monthly * 12) - 1
  // A rate outside this band is not a market, it is a small sample.
  if (annual < TUNING.annualTrend.min || annual > TUNING.annualTrend.max) return null
  return { monthly, annual, n: usable.length }
}

export function fitMarketModel(observations: readonly SaleObservation[]): MarketModel {
  const trainingWindow = TUNING.trainingYears * 12
  const usable = observations.filter(
    (o) => o.monthsBefore <= trainingWindow && o.sale.price > 0 && o.property.la,
  )
  const trend = fitTimeTrend(observations)

  if (usable.length < TUNING.minTraining) {
    return {
      method: trend ? 'time-adjusted' : 'unadjusted',
      annualTrend: trend?.annual ?? null,
      monthlyTrend: trend?.monthly ?? null,
      areaElasticity: null,
      conditionStep: null,
      fit: null,
      trainingCount: usable.length,
      note: trend
        ? `Only ${usable.length} open-market sales of this property type were on file within ${TUNING.trainingYears} years, too few to measure how size, age and condition move prices here. Sales are compared on price per square foot and brought forward to the valuation date at ${(trend.annual * 100).toFixed(1)}% a year, measured from ${trend.n} local sales.`
        : `Only ${usable.length} open-market sales of this property type were on file within ${TUNING.trainingYears} years, which is too few to measure how size, age and the market have moved prices. The sales below are compared as they stand.`,
    }
  }

  // log(price) ~ log(area) + age + condition + months before the valuation
  const rows: number[][] = []
  const y: number[] = []
  for (const o of usable) {
    const area = o.property.la
    if (!area || area <= 0) continue
    const saleYear = Number(o.sale.date.slice(0, 4))
    // The same effective year the adjustment uses, so a recorded remodel is
    // not counted one way here and another way there.
    const builtAge = Math.max(0, saleYear - (effectiveYear(o.property) ?? saleYear))
    const condition = conditionRank(o.property) ?? CONDITION_RANK.A
    rows.push([Math.log(area), builtAge, condition, -o.monthsBefore])
    y.push(Math.log(o.sale.price))
  }

  const fit = leastSquares(rows, y)
  if (!fit || fit.r2 < TUNING.minR2) {
    return {
      method: trend ? 'time-adjusted' : 'unadjusted',
      annualTrend: trend?.annual ?? null,
      monthlyTrend: trend?.monthly ?? null,
      areaElasticity: null,
      conditionStep: null,
      fit,
      trainingCount: usable.length,
      note: trend
        ? `A model of size, age and condition fitted to ${usable.length} nearby sales did not explain enough of the variation in price to be relied on. Sales are compared on price per square foot instead, and brought forward to the valuation date at ${(trend.annual * 100).toFixed(1)}% a year, measured from ${trend.n} local sales.`
        : `A model fitted to ${usable.length} nearby sales did not explain enough of the variation in price to be relied on, and no dependable market trend could be measured either, so the sales below are compared on price per square foot as they stand.`,
    }
  }

  // [intercept, log(area), age, condition, time]
  const areaElasticity = fit.coefficients[1]
  const conditionCoefficient = fit.coefficients[3]
  const monthlyTrend = fit.coefficients[4]

  const annualTrend = Math.exp(monthlyTrend * 12) - 1
  const credible =
    areaElasticity >= TUNING.areaElasticity.min &&
    areaElasticity <= TUNING.areaElasticity.max &&
    annualTrend >= TUNING.annualTrend.min &&
    annualTrend <= TUNING.annualTrend.max

  if (!credible) {
    return {
      method: trend ? 'time-adjusted' : 'unadjusted',
      annualTrend: trend?.annual ?? null,
      monthlyTrend: trend?.monthly ?? null,
      areaElasticity: null,
      conditionStep: null,
      fit,
      trainingCount: usable.length,
      note: `A model fitted to ${usable.length} nearby sales produced rates outside the range a valuer would accept, so it has been set aside.${
        trend
          ? ` Sales are compared on price per square foot and brought forward to the valuation date at ${(trend.annual * 100).toFixed(1)}% a year.`
          : ' The sales below are compared as they stand.'
      }`,
    }
  }

  return {
    method: 'regression-adjusted',
    annualTrend,
    monthlyTrend,
    areaElasticity,
    conditionStep: conditionCoefficient,
    fit,
    trainingCount: usable.length,
    note: `Adjustments are measured from ${usable.length} open-market sales of this property type in the area over the last ${TUNING.trainingYears} years. The model accounts for ${Math.round(fit.r2 * 100)}% of the variation in those prices.`,
  }
}

const dollars = (n: number) => Math.round(n)

/** Adjust one sale to the subject and to the valuation date. */
function adjustComp(
  subject: Property,
  observation: SaleObservation,
  model: MarketModel,
): AdjustedComp {
  const { property: comp, sale, monthsBefore } = observation
  const adjustments: Adjustment[] = []
  let price = sale.price

  const miles =
    subject.lat !== null && subject.lon !== null && comp.lat !== null && comp.lon !== null
      ? milesBetween(
          { lat: subject.lat, lon: subject.lon },
          { lat: comp.lat, lon: comp.lon },
        )
      : null

  if (model.method === 'regression-adjusted' && model.fit) {
    const [, areaElasticity, ageCoefficient, conditionCoefficient, monthlyTrend] =
      model.fit.coefficients

    // Time, back to the valuation date.
    if (monthsBefore > 0.5) {
      const factor = Math.exp(monthlyTrend * monthsBefore)
      const amount = price * (factor - 1)
      adjustments.push({
        label: 'Time to January 1',
        subject: 'valuation date',
        comp: `${monthsBefore.toFixed(0)} months earlier`,
        amount: dollars(amount),
      })
      price += amount
    }

    // Floor area.
    if (subject.la && comp.la && subject.la !== comp.la) {
      const factor = Math.exp(areaElasticity * (Math.log(subject.la) - Math.log(comp.la)))
      const amount = price * (factor - 1)
      adjustments.push({
        label: 'Floor area',
        subject: `${subject.la.toLocaleString('en-US')} sq ft`,
        comp: `${comp.la.toLocaleString('en-US')} sq ft`,
        amount: dollars(amount),
      })
      price += amount
    }

    // Age at the valuation date, using any recorded remodel.
    const subjectYear = effectiveYear(subject)
    const compYear = effectiveYear(comp)
    if (subjectYear && compYear && subjectYear !== compYear) {
      const subjectAge = Math.max(0, Number(sale.date.slice(0, 4)) - subjectYear)
      const compAge = Math.max(0, Number(sale.date.slice(0, 4)) - compYear)
      const factor = Math.exp(ageCoefficient * (subjectAge - compAge))
      const amount = price * (factor - 1)
      if (Math.abs(amount) >= 500) {
        adjustments.push({
          label: 'Age and condition of the building',
          subject: `built ${subject.yr ?? '—'}${subject.remodel ? `, remodelled ${subject.remodel}` : ''}`,
          comp: `built ${comp.yr ?? '—'}${comp.remodel ? `, remodelled ${comp.remodel}` : ''}`,
          amount: dollars(amount),
        })
        price += amount
      }
    }

    // Recorded condition grade.
    const subjectCondition = conditionRank(subject)
    const compCondition = conditionRank(comp)
    if (
      subjectCondition !== null &&
      compCondition !== null &&
      subjectCondition !== compCondition
    ) {
      const factor = Math.exp(conditionCoefficient * (subjectCondition - compCondition))
      const amount = price * (factor - 1)
      if (Math.abs(amount) >= 500) {
        adjustments.push({
          label: 'Recorded condition',
          subject: subject.cond ?? '—',
          comp: comp.cond ?? '—',
          amount: dollars(amount),
        })
        price += amount
      }
    }
  } else if (model.method === 'time-adjusted' || model.method === 'unadjusted') {
    // Time first, where a trend could be measured. A sale two years before
    // the assessment date is otherwise treated as though the market had not
    // moved at all, which understates the value of every older comparable.
    if (model.monthlyTrend !== null && monthsBefore > 0.5) {
      const factor = Math.exp(model.monthlyTrend * monthsBefore)
      const amount = price * (factor - 1)
      adjustments.push({
        label: 'Time to January 1',
        subject: 'valuation date',
        comp: `${monthsBefore.toFixed(0)} months earlier`,
        amount: dollars(amount),
      })
      price += amount
    }

    // Then size, at this sale's own price per square foot.
    if (subject.la && comp.la && comp.la > 0 && subject.la !== comp.la) {
      const perSqft = price / comp.la
      const amount = perSqft * subject.la - price

      adjustments.push({
        label: 'Floor area, at this sale’s price per square foot',
        subject: `${subject.la.toLocaleString('en-US')} sq ft`,
        comp: `${comp.la.toLocaleString('en-US')} sq ft`,
        amount: dollars(amount),
      })
      price += amount
    }
  }

  return {
    property: comp,
    sale,
    monthsBefore,
    miles,
    adjustments,
    adjustedPrice: dollars(price),
    netAdjustmentShare: sale.price > 0 ? Math.abs(price - sale.price) / sale.price : 0,
  }
}

/**
 * How alike two properties are, lower being closer. Used only to rank
 * candidates that already passed the filters, so the grid shows the most
 * similar sales rather than an arbitrary eight.
 */
function similarity(subject: Property, candidate: AdjustedComp): number {
  const areaGap =
    subject.la && candidate.property.la
      ? Math.abs(candidate.property.la - subject.la) / subject.la
      : 0.25
  const distance = candidate.miles ?? 0.5
  const recency = candidate.monthsBefore / 24
  // The net adjustment is a measure of how much work it took to make the
  // sale comparable: the less, the better the evidence.
  return areaGap * 2 + distance + recency * 0.75 + candidate.netAdjustmentShare
}

export interface ValuationInput {
  subject: Property
  pool: readonly Property[]
  salesByPid: ReadonlyMap<string, readonly Sale[]>
  valuationDate: string
  fiscalYear: number
}

/** Run the sales comparison. */
export function valueBySales(input: ValuationInput): ValuationResult {
  const { subject, pool, salesByPid, valuationDate, fiscalYear } = input

  const observations = buildObservations(pool, salesByPid, valuationDate, subject.lu)
  const model = fitMarketModel(observations)

  const inBand = (candidate: Property): boolean => {
    if (!subject.la || !candidate.la) return false
    if (candidate.pid === subject.pid) return false
    if (candidate.areaSrc !== subject.areaSrc) return false
    const low = subject.la * (1 - TUNING.areaTolerance)
    const high = subject.la * (1 + TUNING.areaTolerance)
    if (candidate.la < low || candidate.la > high) return false
    if (subject.yr && candidate.yr && Math.abs(candidate.yr - subject.yr) > TUNING.yearTolerance) {
      return false
    }
    if (
      subject.lat !== null &&
      subject.lon !== null &&
      candidate.lat !== null &&
      candidate.lon !== null
    ) {
      const miles = milesBetween(
        { lat: subject.lat, lon: subject.lon },
        { lat: candidate.lat, lon: candidate.lon },
      )
      if (miles > TUNING.maxMiles) return false
    }
    return true
  }

  /** One sale per parcel, the most recent: a house sold twice is one comp. */
  const oneEach = (comps: AdjustedComp[]): AdjustedComp[] => {
    const best = new Map<string, AdjustedComp>()
    for (const comp of comps) {
      const held = best.get(comp.property.pid)
      if (!held || comp.monthsBefore < held.monthsBefore) best.set(comp.property.pid, comp)
    }
    return [...best.values()].sort((a, b) => similarity(subject, a) - similarity(subject, b))
  }

  // Widen the window only as far as it takes to find enough sales, counting
  // parcels rather than transfers.
  let windowMonths: number = TUNING.windows[0]
  let unique: AdjustedComp[] = []
  for (const months of TUNING.windows) {
    windowMonths = months
    unique = oneEach(
      observations
        .filter((o) => o.monthsBefore <= months && inBand(o.property))
        .map((o) => adjustComp(subject, o, model)),
    )
    if (unique.length >= TUNING.minComps) break
  }

  if (unique.length < TUNING.minComps) {
    return {
      status: 'insufficient-sales',
      valuationDate,
      fiscalYear,
      found: unique.length,
      needed: TUNING.minComps,
      windowMonths,
      reason:
        unique.length === 0
          ? 'No open-market sales of a comparable property were recorded near the valuation date.'
          : `Only ${unique.length} comparable ${unique.length === 1 ? 'sale was' : 'sales were'} recorded near the valuation date, and a sound comparison needs at least ${TUNING.minComps}.`,
      nearMisses: unique,
    }
  }

  const comps = unique.slice(0, TUNING.maxComps)
  const prices = comps.map((c) => c.adjustedPrice)
  const indicatedValue = Math.round(median(prices) ?? 0)
  const low = Math.round(quantile(prices, 0.25) ?? indicatedValue)
  const high = Math.round(quantile(prices, 0.75) ?? indicatedValue)

  const assessedValue = subject.tv
  const aboveRange = assessedValue - high
  const overAssessed = aboveRange > 0

  // The effective tax rate is the one the owner is actually billed at.
  const taxAtStake =
    overAssessed && subject.gt && subject.gt > 0 && assessedValue > 0
      ? Math.round((subject.gt / assessedValue) * aboveRange)
      : null

  const excluded: SalesValuation['excluded'] = []
  for (const property of pool) {
    if (!inBand(property)) continue
    for (const sale of salesByPid.get(property.pid) ?? []) {
      if (sale.armsLength || !sale.note) continue
      const monthsBefore = monthsBetween(sale.date, valuationDate)
      if (monthsBefore < 0 || monthsBefore > windowMonths) continue
      excluded.push({
        address: property.addr,
        date: sale.date,
        price: sale.price,
        reason: sale.note,
      })
    }
  }

  return {
    status: 'valued',
    valuationDate,
    fiscalYear,
    indicatedValue,
    low,
    high,
    assessedValue,
    aboveRange,
    overAssessed,
    taxAtStake,
    comps,
    model,
    windowMonths,
    excluded: excluded.slice(0, 6),
  }
}
