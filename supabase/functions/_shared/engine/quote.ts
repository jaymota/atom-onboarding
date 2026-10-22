// The quote engine: turns Jay's choices (QuoteInput) into a finished document
// (QuoteDoc) that both the live preview and the PDF draw from.
import {
  type ModuleId, type GroupId, type Model, type Complexity,
  MODULES, ADD_ONS, SCOPE_ITEMS, TIMELINE_ROWS, ASSUMPTIONS, ADDITIONAL_COSTS, FIXED_TEXT,
} from './content.ts'
import { type Settings } from './settings.ts'
import { fill, formatDate, formatINR, toRoman, weeksToMonthsText } from './format.ts'

export interface Tranche {
  id: string
  name: string
  pct: number
}

export interface CustomItem {
  id: string
  group: GroupId
  text: string
}

export interface CustomRow {
  id: string
  label: string
  value: string
}

export interface QuoteInput {
  date: string // YYYY-MM-DD
  quoteNumber: string
  clientNames: string
  brand: string
  productDescription: string
  variants: number
  modules: Record<ModuleId, boolean>
  /** Standalone services added to the quote (ids from ADD_ONS). */
  addOns: string[]
  complexity: Complexity
  complexityReason?: string
  model: Model
  counts: { prototypes: number; tastings: number; trials: number }
  fee: number | null
  feeConfirmed: boolean
  showGstSummary: boolean
  showRetainerEstimate: boolean
  showPhaseHeadings: boolean
  tranches: Tranche[]
  showAdditionalCosts: boolean
  validityDays: number
  /** Text edits made by Jay, keyed by element id (e.g. "item:m2-1", "subject"). */
  texts: Record<string, string>
  removedItems: string[]
  /** Jay's own order of scope points, per phase (ids). Points not listed keep their place at the end. */
  itemOrder?: Record<string, string[]>
  customItems: CustomItem[]
  timeline: Record<string, { label?: string; start?: number; end?: number }>
  removedTimelineRows: string[]
  /** Explicit tick/untick of assumption clauses (otherwise the model default applies). */
  assumptionsChecked: Record<string, boolean>
  customAssumptions: { id: string; text: string }[]
  /** Jay's own order of the terms (ids). */
  assumptionOrder?: string[]
  removedCosts: string[]
  customCosts: CustomRow[]
}

export interface DocItem {
  id: string
  key: string
  n: number
  text: string
  custom?: boolean
}

export interface DocPhase {
  group: GroupId
  number: number
  title: string
  items: DocItem[]
}

export interface DocTimelineRow {
  id: string
  n: number
  labelKey: string
  label: string
  period: string
  start: number
  end: number
  openEnded: boolean
  unscheduled?: boolean
}

export interface QuoteDoc {
  date: string
  quoteNumber: string
  to: string
  subject: string
  intro: string
  showPhaseHeadings: boolean
  phases: DocPhase[]
  model: Model
  feesText: string
  retainerPayable?: string
  retainerEstimate?: string
  tranchesIntro?: string
  tranches?: { rows: { id: string; n: number; name: string; pct: number; amount: string }[]; totalPct: number; totalAmount: string }
  gstSummary?: { fee: string; gstLabel: string; gst: string; total: string }
  timeline: { rows: DocTimelineRow[]; total: string; totalWeeks: number; monthsText: string }
  costs?: { rows: { id: string; n: number; labelKey: string; valueKey: string; label: string; value: string; custom?: boolean }[] }
  assumptionsIntro: string
  assumptions: { id: string; key: string; roman: string; text: string; custom?: boolean; inMou?: boolean }[]
  validity: string
  mouNote: string
  signoff: { name: string; title: string; company: string }
  warnings: string[]
}

/** Re-order items in place to follow `order` (ids); anything not listed keeps its relative place after. */
function sortByOrder<T extends { id: string }>(items: T[], order?: string[]) {
  if (!order?.length) return
  const pos = (id: string) => {
    const i = order.indexOf(id)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  const original = items.map((it) => it.id)
  items.sort((a, b) => pos(a.id) - pos(b.id) || original.indexOf(a.id) - original.indexOf(b.id))
}

export function perMonth(model: Model): string {
  return model === 'retainer' ? ' per month' : ''
}

/** Variables available inside template text. */
export function quoteVars(input: QuoteInput) {
  return {
    prototypes: input.counts.prototypes,
    tastings: input.counts.tastings,
    trials: input.counts.trials,
    perMonth: perMonth(input.model),
    validityDays: input.validityDays,
  }
}

/** Template wording for an element: Jay's Settings wording, else the built-in text. */
function baseText(settings: Settings, id: string, fallback: string): string {
  return settings.wording[id] || fallback
}

const SUBJECT_WORDS: Record<ModuleId, string> = {
  M1: 'ideation', M2: 'feasibility', M3: 'recipe development', M4: 'scale-up', M5: 'compliance', M6: 'commercialisation',
}

function listJoin(words: string[]): string {
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/** "recipe development, scale-up and commercialisation" */
export function servicesPhrase(input: QuoteInput): string {
  const words = MODULES.filter((m) => input.modules[m.id]).map((m) => SUBJECT_WORDS[m.id])
  for (const a of ADD_ONS) if ((input.addOns ?? []).includes(a.id)) words.push(a.name.toLowerCase().replace('fssai', 'FSSAI'))
  return listJoin(words) || 'services'
}

export function defaultSubject(input: QuoteInput): string {
  const what = [input.variants > 0 ? String(input.variants) : '', input.productDescription.trim()]
    .filter(Boolean)
    .join(' ')
  return `Quotation for ${servicesPhrase(input)} of ${what || '…'}`
}

/** Section heading in the scope, e.g. "Recipe Development & Standardisation". */
export function phaseTitle(_n: number, group: GroupId): string {
  const name = group === 'addons' ? FIXED_TEXT.addonsTitle : MODULES.find((m) => m.id === group)?.name ?? ''
  return name
}

export function defaultTranches(modules: Record<ModuleId, boolean>, tastings: number): Tranche[] {
  const names = ['Project Commencement']
  if (modules.M3) names.push(tastings >= 4 ? 'Second Tasting' : 'First Tasting')
  if (modules.M4) names.push('First Pilot Trial')
  if (modules.M6) names.push('Technology Transfer')
  if (names.length === 1) names.push('Project Completion')
  const base = Math.floor(100 / names.length)
  const extra = 100 - base * names.length
  return names.map((name, i) => ({ id: `tr-${i + 1}`, name, pct: base + (i === 0 ? extra : 0) }))
}

/** Assumption clauses that are ticked by default for this model and module set. */
export function defaultAssumptionChecked(id: string, input: QuoteInput): boolean {
  const def = ASSUMPTIONS.find((a) => a.id === id)
  if (!def) return true
  if (def.requires && !input.modules[def.requires]) return false
  return def.tag === 'both' || def.tag === input.model
}

/** Is this assumption clause available at all (its module is on)? */
export function assumptionAvailable(id: string, input: QuoteInput): boolean {
  const def = ASSUMPTIONS.find((a) => a.id === id)
  return !def?.requires || input.modules[def.requires]
}

/** Week ranges after switching modules off: later rows shift earlier, no gaps. */
export function computeTimeline(input: QuoteInput, settings: Settings) {
  const preset = settings.presets[input.complexity]
  const order: ModuleId[] = MODULES.map((m) => m.id)
  const moduleStart = (m: ModuleId) =>
    Math.min(...TIMELINE_ROWS.filter((r) => r.module === m && preset[r.id]).map((r) => preset[r.id][0]))

  // How many weeks each switched-off module frees up.
  const shiftFor: Partial<Record<ModuleId, number>> = {}
  order.forEach((m, i) => {
    if (input.modules[m]) return
    const next = order.slice(i + 1).find((x) => Number.isFinite(moduleStart(x)))
    shiftFor[m] = next ? Math.max(0, moduleStart(next) - moduleStart(m)) : 0
  })

  const rows: { id: string; start: number; end: number; openEnded: boolean }[] = []
  for (const def of TIMELINE_ROWS) {
    if (!input.modules[def.module] || def.openEnded) continue
    const range = preset[def.id]
    if (!range) continue
    const idx = order.indexOf(def.module)
    const shift = order.slice(0, idx).reduce((sum, m) => sum + (shiftFor[m] ?? 0), 0)
    rows.push({ id: def.id, start: Math.max(1, range[0] - shift), end: Math.max(1, range[1] - shift), openEnded: false })
  }
  return rows
}

export function buildQuoteDoc(input: QuoteInput, settings: Settings): QuoteDoc {
  const vars = quoteVars(input)
  const t = (key: string, fallback: string) => fill(input.texts[key] ?? baseText(settings, key, fallback), vars)
  const warnings: string[] = []

  // ---- Scope of work: one phase per service, numbered automatically; items numbered continuously
  const phases: DocPhase[] = []
  let itemNo = 0
  let phaseNo = 0
  const addOnsOn = ADD_ONS.filter((a) => (input.addOns ?? []).includes(a.id))
  const groups: GroupId[] = [...MODULES.filter((m) => input.modules[m.id]).map((m) => m.id), 'addons']
  for (const group of groups) {
    const items: DocItem[] = []
    if (group === 'addons') {
      for (const a of addOnsOn) {
        if (input.removedItems.includes(a.id)) continue
        const key = `item:${a.id}`
        items.push({ id: a.id, key, n: 0, text: t(key, `**${a.name}:** ${a.scope}`) })
      }
    } else {
      for (const def of SCOPE_ITEMS) {
        if (def.module !== group || input.removedItems.includes(def.id)) continue
        if (def.unless && input.modules[def.unless]) continue
        const key = `item:${def.id}`
        const wording = def.alt && input.modules[def.alt.ifOn] ? def.alt.text : def.text
        items.push({ id: def.id, key, n: 0, text: t(key, wording) })
      }
    }
    for (const c of input.customItems.filter((x) => x.group === group)) {
      items.push({ id: c.id, key: `item:${c.id}`, n: 0, text: fill(input.texts[`item:${c.id}`] ?? c.text, vars), custom: true })
    }
    if (!items.length) continue
    sortByOrder(items, input.itemOrder?.[group])
    if (group !== 'addons') phaseNo += 1
    items.forEach((it) => (it.n = ++itemNo))
    const titleKey = `phase:${group}`
    phases.push({
      group, number: phaseNo, items,
      title: input.texts[titleKey] ?? (group === 'addons' ? baseText(settings, 'phase:addons', FIXED_TEXT.addonsTitle) : phaseTitle(phaseNo, group)),
    })
  }

  // ---- Deliverables and timelines
  const auto = computeTimeline(input, settings)
  const rows: DocTimelineRow[] = []
  for (const def of TIMELINE_ROWS) {
    if (!input.modules[def.module] || input.removedTimelineRows.includes(def.id)) continue
    const a = auto.find((r) => r.id === def.id)
    const ov = input.timeline[def.id] ?? {}
    const start = ov.start ?? a?.start ?? 0
    const end = ov.end ?? a?.end ?? 0
    const labelKey = `tl:${def.id}`
    const label = input.texts[labelKey] ?? baseText(settings, labelKey, def.label)
    rows.push({ id: def.id, n: 0, labelKey, label, period: '', start, end, openEnded: !!def.openEnded })
  }
  // Standalone services: scheduled by hand (weeks optional).
  for (const a of addOnsOn) {
    if (input.removedTimelineRows.includes(a.id)) continue
    const ov = input.timeline[a.id] ?? {}
    const labelKey = `tl:${a.id}`
    rows.push({
      id: a.id, n: 0, labelKey, label: input.texts[labelKey] ?? a.name, period: '',
      start: ov.start ?? 0, end: ov.end ?? 0, openEnded: false, unscheduled: !(ov.start && ov.end),
    })
  }
  const totalWeeks = Math.max(0, ...rows.filter((r) => !r.openEnded && !r.unscheduled).map((r) => r.end))
  rows.forEach((r, i) => {
    r.n = i + 1
    if (r.unscheduled) {
      r.period = input.texts[`tlp:${r.id}`] ?? 'As agreed'
    } else if (r.openEnded) {
      r.start = totalWeeks
      r.period = `Week ${totalWeeks} +`
    } else {
      r.period = `Week ${r.start} - Week ${r.end}`
      if (r.end < r.start) warnings.push(`Timeline row "${r.label}" ends before it starts.`)
    }
  })
  const monthsText = weeksToMonthsText(totalWeeks)
  const total = input.texts['tl:total'] ?? `${totalWeeks} Weeks = ${monthsText.replace('months', 'Months')}`

  // ---- Fees
  const feeStr = input.fee != null ? formatINR(input.fee) : '[fee]'
  if (input.fee == null) warnings.push('Fee is not set yet.')
  else if (!input.feeConfirmed) warnings.push('Fee is still a suggestion — confirm it.')
  const months = input.texts['fees:months'] ?? monthsText
  const feesTemplate = input.model === 'retainer' ? FIXED_TEXT.feesRetainer : FIXED_TEXT.feesMilestone
  const feesKey = input.model === 'retainer' ? 'fees:retainer' : 'fees:milestone'
  const feesText = fill(input.texts[feesKey] ?? baseText(settings, feesKey, feesTemplate), { ...vars, fee: feeStr, months })

  const doc: QuoteDoc = {
    date: formatDate(input.date),
    quoteNumber: input.quoteNumber,
    to: input.texts['to'] ?? `To ${input.clientNames || '…'},`,
    subject: input.texts['subject'] ?? defaultSubject(input),
    intro: t('intro', FIXED_TEXT.intro),
    showPhaseHeadings: input.showPhaseHeadings,
    phases,
    model: input.model,
    feesText,
    timeline: { rows, total, totalWeeks, monthsText },
    assumptionsIntro: input.model === 'retainer'
      ? t('assumptions:retainer', FIXED_TEXT.assumptionsRetainer)
      : t('assumptions:milestone', FIXED_TEXT.assumptionsMilestone),
    assumptions: [],
    validity: t('validity', FIXED_TEXT.validity),
    mouNote: t('mouNote', FIXED_TEXT.mouNote),
    signoff: {
      name: settings.company.signatoryName,
      title: settings.company.signatoryTitle,
      company: settings.company.name,
    },
    warnings,
  }

  const gst = (n: number) => (n * settings.gstRate) / 100

  if (input.model === 'milestone') {
    doc.tranchesIntro = t('tranchesIntro', FIXED_TEXT.tranchesIntro)
    const totalPct = input.tranches.reduce((s, r) => s + (Number(r.pct) || 0), 0)
    if (Math.round(totalPct * 100) !== 10000) warnings.push(`Payment tranches add up to ${totalPct}%, not 100%.`)
    doc.tranches = {
      rows: input.tranches.map((r, i) => ({
        id: r.id,
        n: i + 1,
        name: r.name,
        pct: r.pct,
        amount: input.fee != null ? `₹${formatINR((input.fee * r.pct) / 100)}` : '',
      })),
      totalPct,
      totalAmount: input.fee != null ? `₹${formatINR((input.fee * totalPct) / 100)}` : '',
    }
    if (input.showGstSummary && input.fee != null) {
      doc.gstSummary = {
        fee: `₹${formatINR(input.fee)}`,
        gstLabel: `GST @ ${settings.gstRate}%`,
        gst: `₹${formatINR(gst(input.fee))}`,
        total: `₹${formatINR(input.fee + gst(input.fee))}`,
      }
    }
  } else {
    doc.retainerPayable = t('retainerPayable', FIXED_TEXT.retainerPayable)
    if (input.showRetainerEstimate && input.fee != null) {
      const monthsCount = Math.ceil(totalWeeks / (52 / 12) - 0.05)
      doc.retainerEstimate = fill(input.texts['retainerEstimate'] ?? FIXED_TEXT.retainerEstimate, {
        total: formatINR(input.fee * monthsCount),
        monthsCount,
        fee: formatINR(input.fee),
      })
    }
    if (input.showGstSummary && input.fee != null) {
      doc.gstSummary = {
        fee: `₹${formatINR(input.fee)} per month`,
        gstLabel: `GST @ ${settings.gstRate}%`,
        gst: `₹${formatINR(gst(input.fee))} per month`,
        total: `₹${formatINR(input.fee + gst(input.fee))} per month`,
      }
    }
  }

  // ---- Potential additional costs
  if (input.showAdditionalCosts) {
    const costRows: NonNullable<QuoteDoc['costs']>['rows'] = []
    for (const def of ADDITIONAL_COSTS) {
      if (def.requires && !input.modules[def.requires]) continue
      if (input.removedCosts.includes(def.id)) continue
      const price = settings.costs[def.priceKey]
      const value = `Rs. ${price != null ? formatINR(price) : '____'} ${fill(def.unit, vars)}`
      costRows.push({
        id: def.id,
        n: 0,
        labelKey: `cost:${def.id}`,
        valueKey: `costv:${def.id}`,
        label: t(`cost:${def.id}`, def.label),
        value: input.texts[`costv:${def.id}`] ?? value,
      })
    }
    for (const c of input.customCosts) {
      costRows.push({
        id: c.id, n: 0, labelKey: `cost:${c.id}`, valueKey: `costv:${c.id}`,
        label: input.texts[`cost:${c.id}`] ?? c.label, value: input.texts[`costv:${c.id}`] ?? c.value, custom: true,
      })
    }
    costRows.forEach((r, i) => (r.n = i + 1))
    if (costRows.length) doc.costs = { rows: costRows }
  }

  // ---- Fee assumptions (roman numerals)
  const clauses: QuoteDoc['assumptions'] = []
  for (const def of ASSUMPTIONS) {
    if (!assumptionAvailable(def.id, input)) continue
    const checked = input.assumptionsChecked[def.id] ?? defaultAssumptionChecked(def.id, input)
    if (!checked) continue
    const key = `assume:${def.id}`
    clauses.push({ id: def.id, key, roman: '', text: t(key, `**${def.topic}:** ${def.text}`), inMou: def.inMou !== false })
  }
  for (const c of input.customAssumptions) {
    if (input.assumptionsChecked[c.id] === false) continue
    clauses.push({ id: c.id, key: `assume:${c.id}`, roman: '', text: fill(input.texts[`assume:${c.id}`] ?? c.text, vars), custom: true, inMou: true })
  }
  sortByOrder(clauses, input.assumptionOrder)
  clauses.forEach((c, i) => (c.roman = toRoman(i + 1)))
  doc.assumptions = clauses

  return doc
}

/** A fresh quote with sensible defaults. */
export function newQuoteInput(settings: Settings, opts: Partial<QuoteInput> = {}): QuoteInput {
  const model = opts.model ?? 'milestone'
  const complexity = opts.complexity ?? 'medium'
  const modules = opts.modules ?? { M1: true, M2: true, M3: true, M4: true, M5: true, M6: true }
  const counts = opts.counts ?? { ...settings.counts[model] }
  const suggested = settings.fees[model][complexity]
  return {
    date: opts.date ?? new Date().toISOString().slice(0, 10),
    quoteNumber: opts.quoteNumber ?? '',
    clientNames: opts.clientNames ?? '',
    brand: opts.brand ?? '',
    productDescription: opts.productDescription ?? '',
    variants: opts.variants ?? 1,
    modules,
    addOns: opts.addOns ?? [],
    complexity,
    complexityReason: opts.complexityReason,
    model,
    counts,
    fee: opts.fee ?? suggested,
    feeConfirmed: opts.feeConfirmed ?? false,
    showGstSummary: opts.showGstSummary ?? true,
    showRetainerEstimate: opts.showRetainerEstimate ?? true,
    showPhaseHeadings: opts.showPhaseHeadings ?? model === 'milestone',
    tranches: opts.tranches ?? defaultTranches(modules, counts.tastings),
    showAdditionalCosts: opts.showAdditionalCosts ?? true,
    validityDays: opts.validityDays ?? settings.validityDays,
    texts: opts.texts ?? {},
    removedItems: opts.removedItems ?? [],
    customItems: opts.customItems ?? [],
    timeline: opts.timeline ?? {},
    removedTimelineRows: opts.removedTimelineRows ?? [],
    assumptionsChecked: opts.assumptionsChecked ?? {},
    customAssumptions: opts.customAssumptions ?? [],
    removedCosts: opts.removedCosts ?? [],
    customCosts: opts.customCosts ?? [],
  }
}

/** Short human list of differences between two versions (for "what changed"). */
export function diffQuoteInputs(a: QuoteInput, b: QuoteInput): string[] {
  const out: string[] = []
  const mods = (q: QuoteInput) => MODULES.filter((m) => q.modules[m.id]).map((m) => m.short).join(', ')
  if (mods(a) !== mods(b)) out.push(`Modules: ${mods(a)} → ${mods(b)}`)
  if (JSON.stringify(a.addOns ?? []) !== JSON.stringify(b.addOns ?? [])) out.push('Additional services changed')
  if (a.complexity !== b.complexity) out.push(`Complexity: ${a.complexity} → ${b.complexity}`)
  if (a.model !== b.model) out.push(`Model: ${a.model} → ${b.model}`)
  if (a.fee !== b.fee) out.push(`Fee: ${a.fee ?? '–'} → ${b.fee ?? '–'}`)
  for (const k of ['prototypes', 'tastings', 'trials'] as const) {
    if (a.counts[k] !== b.counts[k]) out.push(`${k}: ${a.counts[k]} → ${b.counts[k]}`)
  }
  if (JSON.stringify(a.tranches) !== JSON.stringify(b.tranches)) out.push('Payment tranches changed')
  if (JSON.stringify(a.texts) !== JSON.stringify(b.texts)) out.push('Wording edited')
  if (JSON.stringify(a.timeline) !== JSON.stringify(b.timeline)) out.push('Timeline edited')
  if (JSON.stringify(a.assumptionsChecked) !== JSON.stringify(b.assumptionsChecked) ||
    JSON.stringify(a.customAssumptions) !== JSON.stringify(b.customAssumptions)) out.push('Fee assumptions changed')
  if (JSON.stringify(a.removedItems) !== JSON.stringify(b.removedItems) ||
    JSON.stringify(a.customItems) !== JSON.stringify(b.customItems)) out.push('Scope items changed')
  return out
}
