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

/** A line Jay added by hand to one of the document's lists. */
export interface AddedLine {
  id: string
  text: string
  /** Second column (costs) */
  value?: string
}

/**
 * Lists in the document that can be edited the same way (edit, move, remove, add, restore):
 *   `scope:<group>` scope points of one service · `timeline` · `costs` · `terms` · `sections`
 */
export type ListKey = string

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
  showPhaseHeadings: boolean
  tranches: Tranche[]
  validityDays: number
  /** Week overrides for timeline rows, by row id. */
  timeline: Record<string, { start?: number; end?: number }>

  // ---- One editing system for every line in the document
  /** Text edits, keyed by line key (e.g. "item:m2-1", "subject", "tl:t-cm"). */
  texts: Record<string, string>
  /** Keys of anything removed (points, rows, terms, single lines, whole sections like "sec:costs"). */
  hidden: string[]
  /** Lines that are hidden by default (e.g. retainer-only terms on a milestone quote) but Jay switched on. */
  shown: string[]
  /** Jay's own order per list (ids); anything not listed keeps its place after. */
  order: Record<ListKey, string[]>
  /** Lines Jay added, per list. */
  added: Record<ListKey, AddedLine[]>
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
  listKey: ListKey
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

export interface DocLine {
  key: string
  text: string
}

export type SectionKey = 'scope' | 'fees' | 'timeline' | 'costs' | 'terms' | 'closing'

export const SECTION_TITLES: Record<SectionKey, string> = {
  scope: 'Scope of Work',
  fees: 'Fees',
  timeline: 'Deliverables and timelines',
  costs: 'Potential Additional Costs',
  terms: 'Terms & Assumptions',
  closing: 'Validity and next steps',
}

export interface QuoteDoc {
  date: string
  quoteNumber: string
  to: string
  subject: string
  /** Visible sections, in Jay's order. */
  sections: SectionKey[]
  intro: string
  showPhaseHeadings: boolean
  phases: DocPhase[]
  model: Model
  feesText: string
  /** Extra fee lines (retainer "payable monthly", estimate). */
  feeLines: DocLine[]
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
  /** Everything removed from this quote, so it can be restored. */
  removed: { key: string; label: string; kind: string }[]
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

/** Single lines that can be removed, and their friendly names. */
export const LINE_LABELS: Record<string, string> = {
  intro: 'Scope intro sentence',
  retainerPayable: '“Payable at the start of every month” line',
  retainerEstimate: 'Estimated total fees line',
  tranchesIntro: 'Tranches intro sentence',
  gstSummary: 'GST and total summary',
  termsIntro: 'Terms intro sentence',
  validity: 'Validity line',
  mouNote: 'MOU note',
}

const DEFAULT_SECTIONS: SectionKey[] = ['scope', 'fees', 'timeline', 'costs', 'terms', 'closing']

const plain = (text: string, max = 80) => {
  const t = text.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

/**
 * Brings quotes saved by older versions of the platform into the current shape
 * (they had separate lists for removed items, custom items, ticked terms, etc.).
 */
export function upgradeQuoteInput(raw: QuoteInput): QuoteInput {
  const r = raw as QuoteInput & Record<string, unknown>
  if (Array.isArray(r.hidden) && r.order && r.added && Array.isArray(r.shown)) return raw
  const hidden = new Set<string>(Array.isArray(r.hidden) ? r.hidden : [])
  const shown = new Set<string>(Array.isArray(r.shown) ? r.shown : [])
  const order: Record<string, string[]> = { ...((r.order as Record<string, string[]>) ?? {}) }
  const added: Record<string, AddedLine[]> = { ...((r.added as Record<string, AddedLine[]>) ?? {}) }
  const push = (k: string, line: AddedLine) => (added[k] = [...(added[k] ?? []), line])
  const timeline = { ...((r.timeline as QuoteInput['timeline']) ?? {}) }

  for (const id of (r.removedItems as string[]) ?? []) hidden.add(id)
  for (const [g, ids] of Object.entries((r.itemOrder as Record<string, string[]>) ?? {})) order[`scope:${g}`] = ids
  for (const c of (r.customItems as { id: string; group: string; text: string }[]) ?? []) push(`scope:${c.group}`, { id: c.id, text: c.text })
  for (const id of (r.removedTimelineRows as string[]) ?? []) hidden.add(id)
  for (const c of (r.customTimeline as { id: string; label: string; start?: number; end?: number }[]) ?? []) {
    push('timeline', { id: c.id, text: c.label })
    if (c.start || c.end) timeline[c.id] = { start: c.start, end: c.end, ...(timeline[c.id] ?? {}) }
  }
  for (const [id, on] of Object.entries((r.assumptionsChecked as Record<string, boolean>) ?? {})) (on ? shown : hidden).add(id)
  for (const c of (r.customAssumptions as { id: string; text: string }[]) ?? []) push('terms', { id: c.id, text: c.text })
  if (Array.isArray(r.assumptionOrder) && r.assumptionOrder.length) order.terms = r.assumptionOrder as string[]
  for (const id of (r.removedCosts as string[]) ?? []) hidden.add(id)
  for (const c of (r.customCosts as { id: string; label: string; value: string }[]) ?? []) push('costs', { id: c.id, text: c.label, value: c.value })
  for (const k of (r.hiddenLines as string[]) ?? []) hidden.add(k)
  if (r.showGstSummary === false) hidden.add('gstSummary')
  if (r.showRetainerEstimate === false) hidden.add('retainerEstimate')
  if (r.showAdditionalCosts === false) hidden.add('sec:costs')

  const out = { ...r } as Record<string, unknown>
  for (const k of ['removedItems', 'itemOrder', 'customItems', 'removedTimelineRows', 'customTimeline', 'assumptionsChecked',
    'customAssumptions', 'assumptionOrder', 'removedCosts', 'customCosts', 'hiddenLines', 'showGstSummary',
    'showRetainerEstimate', 'showAdditionalCosts']) delete out[k]
  return {
    ...(out as unknown as QuoteInput),
    addOns: r.addOns ?? [],
    texts: r.texts ?? {},
    timeline,
    hidden: [...hidden],
    shown: [...shown],
    order,
    added,
  }
}

export function buildQuoteDoc(rawInput: QuoteInput, settings: Settings): QuoteDoc {
  const input = upgradeQuoteInput(rawInput)
  const vars = quoteVars(input)
  const t = (key: string, fallback: string) => fill(input.texts[key] ?? baseText(settings, key, fallback), vars)
  const warnings: string[] = []
  const removed: QuoteDoc['removed'] = []

  // One rule for every line: hidden if Jay removed it, or hidden by default and not switched on.
  const hiddenSet = new Set(input.hidden)
  const shownSet = new Set(input.shown)
  const defaultHidden = new Set<string>()
  const isHidden = (key: string) => hiddenSet.has(key) || (defaultHidden.has(key) && !shownSet.has(key))

  /** Order a list, take out removed lines (remembering them for "restore"), return what's left. */
  function arrange<T extends { id: string }>(listKey: ListKey, items: T[], kind: string, label: (x: T) => string): T[] {
    sortByOrder(items, input.order[listKey])
    const out: T[] = []
    for (const it of items) {
      if (isHidden(it.id)) removed.push({ key: it.id, label: label(it), kind })
      else out.push(it)
    }
    return out
  }
  /** A single line: its text, or '' if removed. */
  const line = (key: string, text: string) => {
    if (!isHidden(key)) return text
    removed.push({ key, label: LINE_LABELS[key] ?? key, kind: 'Line' })
    return ''
  }

  // ---- Scope of work: one heading per service; points numbered continuously
  const phases: DocPhase[] = []
  let itemNo = 0
  let phaseNo = 0
  const addOnsOn = ADD_ONS.filter((a) => input.addOns.includes(a.id))
  const groups: GroupId[] = [...MODULES.filter((m) => input.modules[m.id]).map((m) => m.id), 'addons']
  for (const group of groups) {
    const listKey = `scope:${group}`
    let items: DocItem[] = []
    if (group === 'addons') {
      for (const a of addOnsOn) items.push({ id: a.id, key: `item:${a.id}`, n: 0, text: t(`item:${a.id}`, `**${a.name}:** ${a.scope}`) })
    } else {
      for (const def of SCOPE_ITEMS) {
        if (def.module !== group) continue
        if (def.unless && input.modules[def.unless]) continue
        const wording = def.alt && input.modules[def.alt.ifOn] ? def.alt.text : def.text
        items.push({ id: def.id, key: `item:${def.id}`, n: 0, text: t(`item:${def.id}`, wording) })
      }
    }
    for (const c of input.added[listKey] ?? []) {
      items.push({ id: c.id, key: `item:${c.id}`, n: 0, text: fill(input.texts[`item:${c.id}`] ?? c.text, vars), custom: true })
    }
    items = arrange(listKey, items, 'Scope point', (x) => plain(x.text))
    if (!items.length) continue
    if (group !== 'addons') phaseNo += 1
    items.forEach((it) => (it.n = ++itemNo))
    phases.push({
      group, listKey, number: phaseNo, items,
      title: input.texts[`phase:${group}`] ?? (group === 'addons' ? baseText(settings, 'phase:addons', FIXED_TEXT.addonsTitle) : phaseTitle(phaseNo, group)),
    })
  }

  // ---- Deliverables and timelines
  const auto = computeTimeline(input, settings)
  let rows: DocTimelineRow[] = []
  const row = (id: string, label: string, start: number, end: number, openEnded = false): DocTimelineRow => ({
    id, n: 0, labelKey: `tl:${id}`, label, period: '', start, end, openEnded, unscheduled: !openEnded && !(start && end),
  })
  for (const def of TIMELINE_ROWS) {
    if (!input.modules[def.module]) continue
    const a = auto.find((x) => x.id === def.id)
    const ov = input.timeline[def.id] ?? {}
    rows.push(row(def.id, input.texts[`tl:${def.id}`] ?? baseText(settings, `tl:${def.id}`, def.label), ov.start ?? a?.start ?? 0, ov.end ?? a?.end ?? 0, !!def.openEnded))
  }
  // Rows Jay added go before the open-ended "Commercial Run Support" row; standalone services after it.
  const custom = (input.added.timeline ?? []).map((c) => row(c.id, input.texts[`tl:${c.id}`] ?? c.text, input.timeline[c.id]?.start ?? 0, input.timeline[c.id]?.end ?? 0))
  const openIdx = rows.findIndex((r) => r.openEnded)
  rows.splice(openIdx === -1 ? rows.length : openIdx, 0, ...custom)
  for (const a of addOnsOn) rows.push(row(a.id, input.texts[`tl:${a.id}`] ?? a.name, input.timeline[a.id]?.start ?? 0, input.timeline[a.id]?.end ?? 0))
  rows = arrange('timeline', rows, 'Timeline row', (x) => x.label)

  const totalWeeks = Math.max(0, ...rows.filter((r) => !r.openEnded && !r.unscheduled).map((r) => r.end))
  rows.forEach((r, i) => {
    r.n = i + 1
    const typed = input.texts[`tlp:${r.id}`]
    if (typed) r.period = typed
    else if (r.unscheduled) r.period = 'As agreed'
    else if (r.openEnded) {
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
  const feesKey = input.model === 'retainer' ? 'fees:retainer' : 'fees:milestone'
  const feesTemplate = input.model === 'retainer' ? FIXED_TEXT.feesRetainer : FIXED_TEXT.feesMilestone
  const feesText = fill(input.texts[feesKey] ?? baseText(settings, feesKey, feesTemplate), { ...vars, fee: feeStr, months })
  const gst = (n: number) => (n * settings.gstRate) / 100
  const per = input.model === 'retainer' ? ' per month' : ''

  const feeLines: DocLine[] = []
  let tranches: QuoteDoc['tranches']
  let tranchesIntro: string | undefined
  if (input.model === 'milestone') {
    tranchesIntro = line('tranchesIntro', t('tranchesIntro', FIXED_TEXT.tranchesIntro))
    const totalPct = input.tranches.reduce((sum, r) => sum + (Number(r.pct) || 0), 0)
    if (Math.round(totalPct * 100) !== 10000) warnings.push(`Payment tranches add up to ${totalPct}%, not 100%.`)
    tranches = {
      rows: input.tranches.map((r, i) => ({
        id: r.id, n: i + 1, name: r.name, pct: r.pct,
        amount: input.fee != null ? `₹${formatINR((input.fee * r.pct) / 100)}` : '',
      })),
      totalPct,
      totalAmount: input.fee != null ? `₹${formatINR((input.fee * totalPct) / 100)}` : '',
    }
  } else {
    const payable = line('retainerPayable', t('retainerPayable', FIXED_TEXT.retainerPayable))
    if (payable) feeLines.push({ key: 'retainerPayable', text: `**${payable}**` })
    if (input.fee != null) {
      const monthsCount = Math.ceil(totalWeeks / (52 / 12) - 0.05)
      const estimate = line('retainerEstimate', fill(input.texts['retainerEstimate'] ?? FIXED_TEXT.retainerEstimate, {
        total: formatINR(input.fee * monthsCount), monthsCount, fee: formatINR(input.fee),
      }))
      if (estimate) feeLines.push({ key: 'retainerEstimate', text: estimate })
    }
  }
  const gstSummary = input.fee != null && line('gstSummary', 'gst')
    ? {
      fee: `₹${formatINR(input.fee)}${per}`,
      gstLabel: `GST @ ${settings.gstRate}%`,
      gst: `₹${formatINR(gst(input.fee))}${per}`,
      total: `₹${formatINR(input.fee + gst(input.fee))}${per}`,
    }
    : undefined

  // ---- Potential additional costs
  let costRows: NonNullable<QuoteDoc['costs']>['rows'] = []
  for (const def of ADDITIONAL_COSTS) {
    if (def.requires && !input.modules[def.requires]) continue
    const price = settings.costs[def.priceKey]
    costRows.push({
      id: def.id, n: 0, labelKey: `cost:${def.id}`, valueKey: `costv:${def.id}`,
      label: t(`cost:${def.id}`, def.label),
      value: input.texts[`costv:${def.id}`] ?? `Rs. ${price != null ? formatINR(price) : '____'} ${fill(def.unit, vars)}`,
    })
  }
  for (const c of input.added.costs ?? []) {
    costRows.push({
      id: c.id, n: 0, labelKey: `cost:${c.id}`, valueKey: `costv:${c.id}`,
      label: input.texts[`cost:${c.id}`] ?? c.text, value: input.texts[`costv:${c.id}`] ?? c.value ?? '', custom: true,
    })
  }
  costRows = arrange('costs', costRows, 'Cost row', (x) => plain(x.label))
  costRows.forEach((r, i) => (r.n = i + 1))

  // ---- Terms & assumptions: the ones for the other commercial model start hidden
  let clauses: QuoteDoc['assumptions'] = []
  for (const def of ASSUMPTIONS) {
    if (def.requires && !input.modules[def.requires]) continue
    if (def.tag !== 'both' && def.tag !== input.model) defaultHidden.add(def.id)
    const key = `assume:${def.id}`
    clauses.push({ id: def.id, key, roman: '', text: t(key, `**${def.topic}:** ${def.text}`), inMou: def.inMou !== false })
  }
  for (const c of input.added.terms ?? []) {
    clauses.push({ id: c.id, key: `assume:${c.id}`, roman: '', text: fill(input.texts[`assume:${c.id}`] ?? c.text, vars), custom: true, inMou: true })
  }
  clauses = arrange('terms', clauses, 'Term', (x) => plain(x.text))
  const other = input.model === 'milestone' ? 'retainer' : 'milestone'
  for (const r of removed) if (defaultHidden.has(r.key) && !hiddenSet.has(r.key)) r.kind = `Optional (${other} term)`
  clauses.forEach((c, i) => (c.roman = toRoman(i + 1)))

  // ---- Sections (can be moved and removed like everything else)
  const sectionItems = DEFAULT_SECTIONS.map((id) => ({ id }))
  sortByOrder(sectionItems, input.order.sections)
  const sections: SectionKey[] = []
  for (const { id } of sectionItems) {
    if (id === 'costs' && !costRows.length) continue
    if (isHidden(`sec:${id}`)) removed.push({ key: `sec:${id}`, label: SECTION_TITLES[id], kind: 'Section' })
    else sections.push(id)
  }

  return {
    date: formatDate(input.date),
    quoteNumber: input.quoteNumber,
    to: input.texts['to'] ?? `To ${input.clientNames || '…'},`,
    subject: input.texts['subject'] ?? defaultSubject(input),
    sections,
    intro: line('intro', t('intro', FIXED_TEXT.intro)),
    showPhaseHeadings: input.showPhaseHeadings,
    phases,
    model: input.model,
    feesText,
    feeLines,
    tranchesIntro,
    tranches,
    gstSummary,
    timeline: { rows, total, totalWeeks, monthsText },
    costs: costRows.length ? { rows: costRows } : undefined,
    assumptionsIntro: line('termsIntro', input.model === 'retainer'
      ? t('assumptions:retainer', FIXED_TEXT.assumptionsRetainer)
      : t('assumptions:milestone', FIXED_TEXT.assumptionsMilestone)),
    assumptions: clauses,
    validity: line('validity', t('validity', FIXED_TEXT.validity)),
    mouNote: line('mouNote', t('mouNote', FIXED_TEXT.mouNote)),
    signoff: {
      name: settings.company.signatoryName,
      title: settings.company.signatoryTitle,
      company: settings.company.name,
    },
    removed,
    warnings,
  }
}

/** A fresh quote with sensible defaults. */
export function newQuoteInput(settings: Settings, opts: Partial<QuoteInput> = {}): QuoteInput {
  const model = opts.model ?? 'milestone'
  const complexity = opts.complexity ?? 'medium'
  const modules = opts.modules ?? { M1: true, M2: true, M3: true, M4: true, M5: true, M6: true }
  const counts = opts.counts ?? { ...settings.counts[model] }
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
    fee: opts.fee ?? settings.fees[model][complexity],
    feeConfirmed: opts.feeConfirmed ?? false,
    showPhaseHeadings: opts.showPhaseHeadings ?? model === 'milestone',
    tranches: opts.tranches ?? defaultTranches(modules, counts.tastings),
    validityDays: opts.validityDays ?? settings.validityDays,
    timeline: opts.timeline ?? {},
    texts: opts.texts ?? {},
    hidden: opts.hidden ?? [],
    shown: opts.shown ?? [],
    order: opts.order ?? {},
    added: opts.added ?? {},
  }
}

/** Short human list of differences between two versions (for "what changed"). */
export function diffQuoteInputs(rawA: QuoteInput, rawB: QuoteInput): string[] {
  const a = upgradeQuoteInput(rawA)
  const b = upgradeQuoteInput(rawB)
  const out: string[] = []
  const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y)
  const mods = (q: QuoteInput) => MODULES.filter((m) => q.modules[m.id]).map((m) => m.short).join(', ')
  if (mods(a) !== mods(b)) out.push(`Services: ${mods(a)} → ${mods(b)}`)
  if (!same(a.addOns, b.addOns)) out.push('Other services changed')
  if (a.complexity !== b.complexity) out.push(`Complexity: ${a.complexity} → ${b.complexity}`)
  if (a.model !== b.model) out.push(`Model: ${a.model} → ${b.model}`)
  if (a.fee !== b.fee) out.push(`Fee: ${a.fee ?? '–'} → ${b.fee ?? '–'}`)
  for (const k of ['prototypes', 'tastings', 'trials'] as const) {
    if (a.counts[k] !== b.counts[k]) out.push(`${k}: ${a.counts[k]} → ${b.counts[k]}`)
  }
  if (!same(a.tranches, b.tranches)) out.push('Payment tranches changed')
  if (!same(a.timeline, b.timeline)) out.push('Timeline weeks changed')
  if (!same(a.texts, b.texts)) out.push('Wording edited')
  if (!same(a.hidden, b.hidden) || !same(a.shown, b.shown)) out.push('Lines removed or restored')
  if (!same(a.order, b.order)) out.push('Order changed')
  if (!same(a.added, b.added)) out.push('Lines added')
  return out
}
