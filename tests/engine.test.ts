import { describe, expect, it } from 'vitest'
import { amountInWords, formatINR, weeksToMonthsText, financialYear } from '../supabase/functions/_shared/engine/format.ts'
import { buildQuoteDoc, newQuoteInput } from '../supabase/functions/_shared/engine/quote.ts'
import { DEFAULT_SETTINGS, type Settings } from '../supabase/functions/_shared/engine/settings.ts'

// Test-only prices (real ones live in the private database).
const settings: Settings = {
  ...DEFAULT_SETTINGS,
  costs: { extraTasting: 25000, extraFlavour: 100000, extraTrial: 50000 },
}

describe('Indian formatting', () => {
  it('formats numbers', () => {
    expect(formatINR(900000)).toBe('9,00,000')
    expect(formatINR(1000000)).toBe('10,00,000')
    expect(formatINR(150000)).toBe('1,50,000')
    expect(formatINR(162000)).toBe('1,62,000')
    expect(formatINR(12345678)).toBe('1,23,45,678')
    expect(formatINR(999)).toBe('999')
  })
  it('writes amounts in words', () => {
    expect(amountInWords(900000)).toBe('Indian Rupees Nine Lakh only')
    expect(amountInWords(150000)).toBe('Indian Rupees One Lakh Fifty Thousand only')
    expect(amountInWords(1062000)).toBe('Indian Rupees Ten Lakh Sixty Two Thousand only')
    expect(amountInWords(12500000)).toBe('Indian Rupees One Crore Twenty Five Lakh only')
  })
  it('converts weeks to months', () => {
    expect(weeksToMonthsText(28)).toBe('6 - 7 months')
    expect(weeksToMonthsText(32)).toBe('7 - 8 months')
    expect(weeksToMonthsText(36)).toBe('8 - 9 months')
    expect(weeksToMonthsText(48)).toBe('11 - 12 months')
  })
  it('financial year', () => {
    expect(financialYear('2026-10-16')).toBe('2026-27')
    expect(financialYear('2027-03-31')).toBe('2026-27')
    expect(financialYear('2027-04-01')).toBe('2027-28')
  })
})

describe('Test case 1: El Chico (milestone, no ideation, 3 variants, ₹9,00,000)', () => {
  const input = newQuoteInput(settings, {
    clientNames: 'Raunaq Roy & Neeraj Roy', productDescription: 'sugar free sweet flavoured popped chips', variants: 3,
    modules: { M1: false, M2: true, M3: true, M4: true, M5: true, M6: false },
    complexity: 'medium', model: 'milestone', counts: { prototypes: 3, tastings: 3, trials: 2 }, fee: 900000, feeConfirmed: true,
  })
  const doc = buildQuoteDoc(input, settings)
  it('numbers phases from 1 and items continuously', () => {
    expect(doc.phases.map((p) => p.title)).toEqual(['Phase 1', 'Phase 2', 'Phase 3'])
    expect(doc.phases.flatMap((p) => p.items).length).toBe(13)
    expect(doc.phases[0].items[2].text).toMatch(/^Identify potential contract manufacturers/)
    expect(doc.phases[1].items[0].n).toBe(7)
  })
  it('subject has no ideation', () => {
    expect(doc.subject).toBe('Quotation for services related to prototyping, development and commercialization of 3 sugar free sweet flavoured popped chips')
  })
  it('shifts the timeline earlier without gaps', () => {
    expect(doc.timeline.rows[0]).toMatchObject({ label: 'Phase 1 - Literature Review, Market Analysis & BOM Development', period: 'Week 1 - Week 7' })
    expect(doc.timeline.totalWeeks).toBe(32)
    expect(doc.timeline.total).toBe('32 Weeks = 7 - 8 Months')
  })
  it('fees, tranches and GST', () => {
    expect(doc.feesText).toBe('The fees for this project will be **INR 9,00,000 + GST,** the target timeline to achieve all the above would be **7 - 8 months.**')
    expect(doc.tranches!.rows.map((r) => [r.name, r.pct, r.amount])).toEqual([
      ['Project Commencement', 25, '₹2,25,000'], ['First Tasting', 25, '₹2,25,000'],
      ['First Pilot Trial', 25, '₹2,25,000'], ['Knowledge Transfer', 25, '₹2,25,000'],
    ])
    expect(doc.gstSummary).toEqual({ fee: '₹9,00,000', gstLabel: 'GST @ 18%', gst: '₹1,62,000', total: '₹10,62,000' })
    expect(doc.warnings).toEqual([])
  })
  it('assumptions match the counts and skip prototypes', () => {
    const texts = doc.assumptions.map((a) => a.text)
    expect(texts).toContain('The tabletop trials are limited to 3 tastings, every tasting after that will be billed additionally;')
    expect(texts).toContain('The contract manufacturing trials are limited to 2 trials, every trial after that will be billed additionally;')
    expect(texts.some((x) => x.includes('Rapid prototyping'))).toBe(false)
    expect(doc.assumptions[1].roman).toBe('ii')
    expect(doc.costs!.rows[0].value).toBe('Rs. 25,000 per tasting per flavour')
  })
})

describe('Test case 2: Gut health (milestone, ideation, 2 products, ₹10,00,000)', () => {
  const input = newQuoteInput(settings, {
    clientNames: 'Apurva Shah', productDescription: 'laxative/gut health products', variants: 2,
    complexity: 'medium', model: 'milestone', counts: { prototypes: 4, tastings: 4, trials: 3 }, fee: 1000000, feeConfirmed: true,
  })
  const doc = buildQuoteDoc(input, settings)
  it('has 4 phases with ideation first', () => {
    expect(doc.phases.length).toBe(4)
    expect(doc.phases[0].items[1].text).toBe('Create up to 4 rapid prototypes of initial product concepts to understand product directions.')
    expect(doc.subject).toContain('ideation, prototyping, development')
  })
  it('uses Second Tasting with 4 tastings', () => {
    expect(doc.tranches!.rows[1].name).toBe('Second Tasting')
  })
  it('includes the prototype clause and full timeline', () => {
    expect(doc.assumptions.map((a) => a.text)).toContain('Rapid prototyping is limited to 4 product prototypes;')
    expect(doc.timeline.total).toBe('36 Weeks = 8 - 9 Months')
    expect(doc.gstSummary!.total).toBe('₹11,80,000')
  })
})

describe('Test case 3: Wafer snacks (retainer ₹1,50,000/month, all modules + advisory)', () => {
  const input = newQuoteInput(settings, {
    clientNames: 'Test Client', productDescription: 'wafer based snacks', variants: 5,
    modules: { M1: true, M2: true, M3: true, M4: true, M5: true, M6: true },
    complexity: 'medium', model: 'retainer', fee: 150000, feeConfirmed: true,
  })
  const doc = buildQuoteDoc(input, settings)
  it('uses per-month wording', () => {
    expect(doc.feesText).toContain('INR 1,50,000 + GST per month')
    expect(doc.phases.flatMap((p) => p.items).find((i) => i.id === 'm3-3')!.text).toContain('2 tasting sessions per month')
    expect(doc.assumptionsIntro).toContain('Monthly Retainer Fee')
    expect(doc.tranches).toBeUndefined()
    expect(doc.retainerEstimate).toBe('Estimated total fees: INR 13,50,000 + GST (9 months × INR 1,50,000).')
  })
  it('adds the advisory row at the end', () => {
    const last = doc.timeline.rows.at(-1)!
    expect(last.period).toBe('Week 36 +')
    expect(last.label).toBe('Phase 4 - Advisory Services for Commercial Batches')
    expect(doc.phases.flatMap((p) => p.items).length).toBe(17)
  })
  it('ticks retainer-only clauses', () => {
    const ids = doc.assumptions.map((a) => a.id)
    expect(ids).toContain('a-rentals')
    expect(ids).not.toContain('a-termination')
  })
})
