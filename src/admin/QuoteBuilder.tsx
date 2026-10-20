import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ASSUMPTIONS, ADDITIONAL_COSTS, COMPLEXITY_LABELS, GROUPS, MODULES, MODULE_HINTS, SCOPE_ITEMS, TIMELINE_ROWS,
  TEMPLATE_FIXES, type Complexity, type GroupId, type Model, type ModuleId,
} from '../../supabase/functions/_shared/engine/content.ts'
import {
  type QuoteInput, assumptionAvailable, buildQuoteDoc, computeTimeline, defaultAssumptionChecked, defaultTranches,
  diffQuoteInputs, quoteVars,
} from '../../supabase/functions/_shared/engine/quote.ts'
import { ALL_FIELDS, type Answers } from '../../supabase/functions/_shared/engine/intake.ts'
import { amountInWords, fill, formatINR } from '../../supabase/functions/_shared/engine/format.ts'
import { supabase, callFn } from '../lib/supabase'
import { QUOTE_STATUS_LABEL, istDateTime } from '../lib/status'
import { downloadBlob, fileDate, quotePdfBlob, safeName } from '../pdf/generate'
import { QuotePreview } from '../components/QuotePreview'
import {
  Alert, Badge, Button, Label, Modal, PageSpinner, Select, TextArea, TextInput, Toggle, inputClass,
} from '../components/ui'
import { useSettings } from './AdminLayout'

interface QuoteRow {
  id: string
  client_id: string
  status: string
  version: number
  number: string | null
  input: QuoteInput
  share_token: string | null
  client_comment: string | null
  sent_at: string | null
  expires_at: string | null
  first_viewed_at: string | null
  view_count: number
  pdf_path: string | null
}

interface VersionRow {
  id: string
  version: number
  input: QuoteInput
  reason: string
  created_at: string
}

interface ClientRow {
  id: string
  name: string
  email: string
  phone: string
  brand: string
  answers: Answers
  details: Record<string, unknown>
}

let idCounter = 0
const uid = (p: string) => `${p}-${Date.now().toString(36)}${(idCounter++).toString(36)}`

export default function QuoteBuilder() {
  const { id = '' } = useParams()
  const { settings } = useSettings()
  const [quote, setQuote] = useState<QuoteRow | null>(null)
  const [input, setInput] = useState<QuoteInput | null>(null)
  const [client, setClient] = useState<ClientRow | null>(null)
  const [versions, setVersions] = useState<VersionRow[]>([])
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved')
  const [panel, setPanel] = useState<'none' | 'intake' | 'history'>('none')
  const [readyOpen, setReadyOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [approving, setApproving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [message, setMessage] = useState<{ tone: 'error' | 'success' | 'warn'; text: string } | null>(null)
  const loaded = useRef(false)

  const load = useCallback(async () => {
    const { data: q } = await supabase.from('quotes').select('*').eq('id', id).single()
    if (!q) return
    setQuote(q as QuoteRow)
    setInput(q.input as QuoteInput)
    const [{ data: c }, { data: v }] = await Promise.all([
      supabase.from('clients').select('id, name, email, phone, brand, answers, details').eq('id', q.client_id).single(),
      supabase.from('quote_versions').select('*').eq('quote_id', id).order('version', { ascending: false }),
    ])
    setClient(c as ClientRow)
    setVersions((v as VersionRow[]) ?? [])
    loaded.current = true
  }, [id])

  useEffect(() => { void load() }, [load])

  // Autosave (about 1 second after the last change).
  const lastSaved = useRef<string>('')
  useEffect(() => {
    if (!input || !quote) return
    const json = JSON.stringify(input)
    if (!lastSaved.current) {
      lastSaved.current = json
      return
    }
    if (json === lastSaved.current) return
    setSaveState('unsaved')
    const t = setTimeout(async () => {
      setSaveState('saving')
      const patch: Record<string, unknown> = { input }
      if (quote.status === 'approved') patch.status = 'draft'
      const { error } = await supabase.from('quotes').update(patch).eq('id', quote.id)
      if (error) return setSaveState('error')
      lastSaved.current = json
      if (patch.status) setQuote((q) => (q ? { ...q, status: 'draft' } : q))
      setSaveState('saved')
    }, 900)
    return () => clearTimeout(t)
  }, [input, quote])

  const doc = useMemo(() => (input ? buildQuoteDoc(input, settings) : null), [input, settings])
  const lastApproved = versions[0]
  const dirty = !!input && (!lastApproved || JSON.stringify(lastApproved.input) !== JSON.stringify(input))
  const locked = quote?.status === 'accepted'

  if (!quote || !input || !doc) return <PageSpinner />

  const set = (patch: Partial<QuoteInput>) => setInput((i) => (i ? { ...i, ...patch } : i))
  const setText = (key: string, value: string) => setInput((i) => (i ? { ...i, texts: { ...i.texts, [key]: value } } : i))
  const resetText = (key: string) =>
    setInput((i) => {
      if (!i) return i
      const texts = { ...i.texts }
      delete texts[key]
      return { ...i, texts }
    })

  const setModule = (m: ModuleId, on: boolean) => {
    const modules = { ...input.modules, [m]: on }
    // Keep Jay's own tranches; otherwise follow the modules.
    const untouched = JSON.stringify(input.tranches) === JSON.stringify(defaultTranches(input.modules, input.counts.tastings))
    set({ modules, tranches: untouched ? defaultTranches(modules, input.counts.tastings) : input.tranches })
  }

  const setComplexity = (c: Complexity) => {
    const suggested = settings.fees[input.model][c]
    set({ complexity: c, timeline: {}, ...(input.feeConfirmed ? {} : { fee: suggested }) })
  }

  const setModel = (m: Model) => {
    if (m === input.model) return
    const suggested = settings.fees[m][input.complexity]
    const counts = { ...settings.counts[m], prototypes: input.counts.prototypes }
    set({
      model: m,
      counts,
      showPhaseHeadings: m === 'milestone',
      assumptionsChecked: {},
      tranches: defaultTranches(input.modules, counts.tastings),
      ...(input.feeConfirmed ? {} : { fee: suggested }),
    })
  }

  const approve = async () => {
    setMessage(null)
    const blocking = doc.warnings.filter((w) => !w.startsWith('Fee is still'))
    if (input.fee == null) return setMessage({ tone: 'error', text: 'Please enter the fee before approving.' })
    if (!input.feeConfirmed) return setMessage({ tone: 'error', text: 'Please confirm the fee (tick “I’ve confirmed this fee”) before approving.' })
    if (blocking.length) return setMessage({ tone: 'error', text: blocking.join(' ') })
    setApproving(true)
    try {
      let number = quote.number
      if (!number) {
        const { data, error } = await supabase.rpc('next_quote_number', { on_date: input.date })
        if (error) throw error
        number = data as string
      }
      const finalInput = { ...input, quoteNumber: number }
      const finalDoc = buildQuoteDoc(finalInput, settings)
      const version = (versions[0]?.version ?? 0) + 1
      const blob = await quotePdfBlob(finalDoc, settings.company)
      const path = `quotes/${quote.id}/v${version}.pdf`
      const { error: upErr } = await supabase.storage.from('documents').upload(path, blob, { contentType: 'application/pdf', upsert: true })
      if (upErr) throw upErr
      await supabase.from('quote_versions').insert({ quote_id: quote.id, version, input: finalInput, reason: 'Approved' })
      const { error } = await supabase.from('quotes').update({
        status: 'approved', input: finalInput, doc: { ...finalDoc, company: settings.company }, pdf_path: path,
        approved_at: new Date().toISOString(), version, number,
      }).eq('id', quote.id)
      if (error) throw error
      await supabase.from('events').insert({ client_id: quote.client_id, kind: 'quote_approved', detail: { number, version } })
      lastSaved.current = JSON.stringify(finalInput)
      await load()
      setReadyOpen(true)
    } catch (e) {
      setMessage({ tone: 'error', text: `Could not approve: ${(e as Error).message}` })
    } finally {
      setApproving(false)
    }
  }

  const downloadPdf = async () => {
    setDownloading(true)
    try {
      const blob = await quotePdfBlob(doc, settings.company)
      downloadBlob(blob, `Atom_Quote_${safeName(input.brand)}_${fileDate(input.date)}.pdf`)
    } finally {
      setDownloading(false)
    }
  }

  const statusLabel = dirty && quote.status !== 'draft' && !locked ? 'Edited since approval' : QUOTE_STATUS_LABEL[quote.status] ?? quote.status
  const canShare = !dirty && ['approved', 'sent'].includes(quote.status)

  return (
    <div>
      {/* Top bar */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link to={`/admin/client/${quote.client_id}`} className="text-sm text-neutral-500 hover:text-atom-red">← {client?.brand || 'Client'}</Link>
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold">
            Quote {quote.number ?? '(draft — numbered on approval)'}
            <Badge tone={quote.status === 'accepted' ? 'bg-emerald-100 text-emerald-800' : dirty ? 'bg-amber-100 text-amber-800' : 'bg-neutral-100 text-neutral-700'}>{statusLabel}</Badge>
            <span className="text-xs font-normal text-neutral-400">
              {saveState === 'saving' ? 'Saving…' : saveState === 'unsaved' ? 'Unsaved changes' : saveState === 'error' ? '⚠ Could not save' : 'All changes saved'}
            </span>
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setPanel(panel === 'intake' ? 'none' : 'intake')}>Intake answers</Button>
          <Button variant="ghost" onClick={() => setPanel(panel === 'history' ? 'none' : 'history')}>Versions ({versions.length})</Button>
          <Button variant="secondary" onClick={downloadPdf} busy={downloading}>Download PDF</Button>
          {canShare ? (
            <Button onClick={() => setShareOpen(true)}>Share with client</Button>
          ) : !locked ? (
            <Button onClick={approve} busy={approving}>Approve</Button>
          ) : null}
        </div>
      </div>

      {message && <div className="mb-4"><Alert tone={message.tone}>{message.text}</Alert></div>}
      {locked && <div className="mb-4"><Alert tone="success">The client accepted this quote. It is now locked. Continue on the client page to review the MOU.</Alert></div>}
      {quote.status === 'changes_requested' && quote.client_comment && (
        <div className="mb-4">
          <Alert tone="warn">
            <b>The client asked for changes:</b> “{quote.client_comment}”
            {lastApproved && diffQuoteInputs(lastApproved.input, input).length > 0 && (
              <span className="mt-1 block text-xs">Your changes since v{lastApproved.version}: {diffQuoteInputs(lastApproved.input, input).join(' · ')}</span>
            )}
            <span className="mt-1 block text-xs">Edit below, then Approve and Share again — the client's link will show the new version.</span>
          </Alert>
        </div>
      )}
      {quote.sent_at && (
        <p className="mb-3 text-xs text-neutral-500">
          Sent {istDateTime(quote.sent_at)} · {quote.first_viewed_at ? `Viewed ${quote.view_count}× (first ${istDateTime(quote.first_viewed_at)})` : 'Not viewed yet'}
          {quote.expires_at && ` · Link expires ${istDateTime(quote.expires_at)}`}
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        {/* Controls */}
        <fieldset disabled={locked} className="space-y-4 xl:max-h-[calc(100svh-150px)] xl:overflow-y-auto xl:pr-1">
          <Controls
            input={input}
            set={set}
            setModule={setModule}
            setComplexity={setComplexity}
            setModel={setModel}
            resetText={resetText}
          />
        </fieldset>

        {/* Live preview */}
        <div className="min-w-0">
          {doc.warnings.length > 0 && (
            <div className="mb-3"><Alert tone="warn">{doc.warnings.join(' ')}</Alert></div>
          )}
          <p className="mb-2 text-xs text-neutral-500">Click any text in the quote to edit it. Edited text is underlined with dots.</p>
          <QuotePreview
            doc={doc}
            company={settings.company}
            editing={locked ? undefined : {
              onText: setText,
              onReset: resetText,
              isEdited: (k) => k in input.texts,
              onRemoveItem: (itemId) =>
                itemId.startsWith('ci-')
                  ? set({ customItems: input.customItems.filter((c) => c.id !== itemId) })
                  : set({ removedItems: [...input.removedItems, itemId] }),
            }}
          />
        </div>
      </div>

      {/* Side panels */}
      {panel !== 'none' && (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto border-l border-neutral-200 bg-white p-5 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{panel === 'intake' ? 'What the client told us' : 'Version history'}</h2>
            <button onClick={() => setPanel('none')} className="rounded p-1 text-neutral-500 hover:bg-neutral-100">✕</button>
          </div>
          {panel === 'intake' ? <IntakePanel client={client} /> : (
            <div className="space-y-3">
              {versions.length === 0 && <p className="text-sm text-neutral-500">No versions yet. A version is saved each time you approve.</p>}
              {versions.map((v) => {
                const changes = diffQuoteInputs(v.input, input)
                return (
                  <div key={v.id} className="rounded-md border border-neutral-200 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <b>v{v.version}</b>
                      <span className="text-xs text-neutral-500">{istDateTime(v.created_at)}</span>
                    </div>
                    <p className="text-xs text-neutral-500">{v.reason}</p>
                    <p className="mt-1 text-xs">{changes.length ? `Differences from now: ${changes.join(' · ')}` : 'Same as the current quote'}</p>
                    {changes.length > 0 && !locked && (
                      <Button size="sm" variant="secondary" className="mt-2" onClick={() => { setInput(v.input); setPanel('none') }}>Restore this version</Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <ReadyModal
        open={readyOpen}
        onClose={() => setReadyOpen(false)}
        onShare={() => { setReadyOpen(false); setShareOpen(true) }}
        onDownload={downloadPdf}
        downloading={downloading}
        number={quote.number ?? ''}
      />
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        quote={quote}
        client={client}
        brand={input.brand}
        onSent={load}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ controls */

function Section({ title, children, defaultOpen = true, right }: { title: string; children: ReactNode; defaultOpen?: boolean; right?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="rounded-lg border border-neutral-200 bg-white">
      <header className="flex w-full items-center justify-between gap-2 px-4 py-3">
        <button type="button" onClick={() => setOpen(!open)} className="flex flex-1 items-center gap-2 text-left text-sm font-semibold">
          <span className={`text-neutral-400 transition ${open ? 'rotate-90' : ''}`}>▸</span>
          {title}
        </button>
        {right}
      </header>
      {open && <div className="space-y-3 border-t border-neutral-100 px-4 py-4">{children}</div>}
    </section>
  )
}

function NumberField({ label, value, onChange, min = 0, suffix }: { label: string; value: number; onChange: (n: number) => void; min?: number; suffix?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input type="number" min={min} value={value} onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))} className={`${inputClass} w-24`} />
        {suffix && <span className="text-xs text-neutral-500">{suffix}</span>}
      </div>
    </div>
  )
}

function Controls({ input, set, setModule, setComplexity, setModel, resetText }: {
  input: QuoteInput
  set: (p: Partial<QuoteInput>) => void
  setModule: (m: ModuleId, on: boolean) => void
  setComplexity: (c: Complexity) => void
  setModel: (m: Model) => void
  resetText: (k: string) => void
}) {
  const { settings } = useSettings()
  const [hint, setHint] = useState<ModuleId | null>(null)
  const [newItem, setNewItem] = useState<{ group: GroupId; text: string }>({ group: 'development', text: '' })
  const [newClause, setNewClause] = useState('')
  const [newCost, setNewCost] = useState({ label: '', value: '' })
  const suggested = settings.fees[input.model][input.complexity]
  const tranchesTotal = input.tranches.reduce((s, t) => s + (Number(t.pct) || 0), 0)
  const autoTimeline = computeTimeline(input, settings)
  const vars = quoteVars(input)

  return (
    <>
      <Section title="1. Client & product">
        <div>
          <Label>Addressed to (“To …”)</Label>
          <TextInput value={input.clientNames} onChange={(e) => set({ clientNames: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Brand</Label>
            <TextInput value={input.brand} onChange={(e) => set({ brand: e.target.value })} />
          </div>
          <div>
            <Label>Date</Label>
            <TextInput type="date" value={input.date} onChange={(e) => set({ date: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-[1fr_90px] gap-3">
          <div>
            <Label>Product description (for the subject)</Label>
            <TextInput value={input.productDescription} onChange={(e) => set({ productDescription: e.target.value })} />
          </div>
          <div>
            <Label>Variants</Label>
            <TextInput type="number" min={1} value={input.variants} onChange={(e) => set({ variants: Math.max(1, Number(e.target.value) || 1) })} />
          </div>
        </div>
        <NumberField label="Quote valid for" value={input.validityDays} min={1} suffix="days" onChange={(n) => set({ validityDays: n })} />
        {'subject' in input.texts && (
          <button type="button" className="text-xs text-atom-red underline" onClick={() => resetText('subject')}>Subject was edited by hand — reset to automatic</button>
        )}
      </Section>

      <Section title="2. Where does the project start?">
        <div className="grid gap-2">
          {[
            { on: true, title: 'Phase 1 = Ideation & Rapid Prototyping', hint: 'Client needs us to figure out the product format' },
            { on: false, title: 'Phase 1 = Literature Review & Competitive Analysis', hint: 'Client already knows what product they want' },
          ].map((o) => (
            <label key={String(o.on)} className={`flex cursor-pointer gap-3 rounded-md border px-3 py-2 text-sm ${input.modules.M1 === o.on ? 'border-atom-red bg-atom-red/5' : 'border-neutral-200'}`}>
              <input type="radio" checked={input.modules.M1 === o.on} onChange={() => setModule('M1', o.on)} className="mt-1 accent-atom-red" />
              <span><b className="font-medium">{o.title}</b><span className="block text-xs text-neutral-500">{o.hint}</span></span>
            </label>
          ))}
        </div>
        {input.modules.M1 && (
          <Toggle
            checked={input.counts.prototypes >= 10}
            onChange={(v) => set({ counts: { ...input.counts, prototypes: v ? 10 : settings.counts[input.model].prototypes } })}
            label="Rapid prototyping is the main service"
            hint="Uses 10 prototypes instead of the usual 3"
          />
        )}
      </Section>

      <Section title="3. Service modules">
        {MODULES.map((m) => (
          <div key={m.id}>
            <div className="flex items-start justify-between gap-2">
              <Toggle checked={input.modules[m.id]} onChange={(v) => setModule(m.id, v)} label={m.name} />
              <button type="button" onClick={() => setHint(hint === m.id ? null : m.id)} className="shrink-0 text-xs text-neutral-500 underline">
                {hint === m.id ? 'hide' : "what's included"}
              </button>
            </div>
            {hint === m.id && (
              <ul className="mt-2 ml-12 list-disc space-y-0.5 pl-4 text-xs text-neutral-600">
                {MODULE_HINTS[m.id].map((h) => <li key={h}>{h}</li>)}
              </ul>
            )}
          </div>
        ))}
        <Toggle checked={input.showPhaseHeadings} onChange={(v) => set({ showPhaseHeadings: v })} label="Show “Phase 1, Phase 2…” headings in the scope" />
      </Section>

      <Section title="4. Complexity & model">
        <div>
          <Label>Project complexity</Label>
          <div className="grid grid-cols-3 gap-2">
            {(['easy', 'medium', 'hard'] as Complexity[]).map((c) => (
              <button key={c} type="button" onClick={() => setComplexity(c)}
                className={`rounded-md border px-2 py-2 text-sm font-medium ${input.complexity === c ? 'border-atom-red bg-atom-red text-white' : 'border-neutral-300 hover:border-atom-ink'}`}>
                {COMPLEXITY_LABELS[c]}
              </button>
            ))}
          </div>
          {input.complexityReason && <p className="mt-1 text-xs text-neutral-500">Suggested because: {input.complexityReason}</p>}
        </div>
        <div>
          <Label>Commercial model</Label>
          <div className="grid grid-cols-2 gap-2">
            {(['milestone', 'retainer'] as Model[]).map((m) => (
              <button key={m} type="button" onClick={() => setModel(m)}
                className={`rounded-md border px-2 py-2 text-sm font-medium ${input.model === m ? 'border-atom-ink bg-atom-ink text-white' : 'border-neutral-300 hover:border-atom-ink'}`}>
                {m === 'milestone' ? 'Milestone (fixed fee)' : 'Monthly retainer'}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {input.modules.M1 && <NumberField label="Prototypes" value={input.counts.prototypes} min={1} onChange={(n) => set({ counts: { ...input.counts, prototypes: n } })} />}
          {input.modules.M3 && <NumberField label={input.model === 'retainer' ? 'Tastings / month' : 'Tastings'} value={input.counts.tastings} min={1} onChange={(n) => set({ counts: { ...input.counts, tastings: n } })} />}
          {input.modules.M4 && <NumberField label={input.model === 'retainer' ? 'Trials / month' : 'Pilot trials'} value={input.counts.trials} min={1} onChange={(n) => set({ counts: { ...input.counts, trials: n } })} />}
        </div>
      </Section>

      <Section title="5. Fees">
        <div>
          <Label>{input.model === 'retainer' ? 'Monthly fee (₹, + GST)' : 'Project fee (₹, + GST)'}</Label>
          <input
            type="number"
            min={0}
            step={10000}
            value={input.fee ?? ''}
            onChange={(e) => set({ fee: e.target.value === '' ? null : Number(e.target.value), feeConfirmed: false })}
            className={`${inputClass} ${input.feeConfirmed ? '' : 'text-neutral-400 italic'}`}
          />
          {input.fee != null && <p className="mt-1 text-xs text-neutral-500">₹{formatINR(input.fee)} · {amountInWords(input.fee)}</p>}
          {suggested != null && input.fee !== suggested && (
            <button type="button" className="mt-1 text-xs text-atom-red underline" onClick={() => set({ fee: suggested, feeConfirmed: false })}>
              Use suggestion: ₹{formatINR(suggested)}
            </button>
          )}
          <label className={`mt-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${input.feeConfirmed ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
            <input type="checkbox" checked={input.feeConfirmed} onChange={(e) => set({ feeConfirmed: e.target.checked })} className="accent-atom-red" />
            {input.feeConfirmed ? 'Fee confirmed' : 'I’ve confirmed this fee (it’s only a suggestion until you tick this)'}
          </label>
        </div>
        <Toggle checked={input.showGstSummary} onChange={(v) => set({ showGstSummary: v })} label="Show GST and grand total" />
        {input.model === 'retainer' && (
          <Toggle checked={input.showRetainerEstimate} onChange={(v) => set({ showRetainerEstimate: v })} label="Show estimated total (monthly × months)" />
        )}

        {input.model === 'milestone' && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label>Payment tranches</Label>
              <button type="button" className="text-xs text-neutral-500 underline" onClick={() => set({ tranches: defaultTranches(input.modules, input.counts.tastings) })}>reset</button>
            </div>
            <div className="space-y-2">
              {input.tranches.map((t, i) => (
                <div key={t.id} className="flex gap-2">
                  <TextInput value={t.name} onChange={(e) => set({ tranches: input.tranches.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                  <div className="flex w-24 items-center gap-1">
                    <input type="number" value={t.pct} onChange={(e) => set({ tranches: input.tranches.map((x, j) => (j === i ? { ...x, pct: Number(e.target.value) || 0 } : x)) })} className={`${inputClass} px-2`} />
                    <span className="text-xs">%</span>
                  </div>
                  <button type="button" onClick={() => set({ tranches: input.tranches.filter((_, j) => j !== i) })} className="px-1 text-neutral-400 hover:text-red-600">✕</button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <Button size="sm" variant="secondary" onClick={() => set({ tranches: [...input.tranches, { id: uid('tr'), name: 'New milestone', pct: 0 }] })}>+ Add tranche</Button>
              <span className={`text-sm font-medium ${Math.round(tranchesTotal) === 100 ? 'text-emerald-700' : 'text-red-600'}`}>
                Total {tranchesTotal}% {Math.round(tranchesTotal) !== 100 && '⚠ should be 100%'}
              </span>
            </div>
          </div>
        )}
      </Section>

      <Section title="6. Timeline (weeks)" defaultOpen={false} right={
        Object.keys(input.timeline).length > 0 ? <button type="button" className="text-xs text-neutral-500 underline" onClick={() => set({ timeline: {} })}>reset to preset</button> : null
      }>
        <p className="text-xs text-neutral-500">Filled from the {COMPLEXITY_LABELS[input.complexity]} preset. Change any week; edit labels by clicking them in the preview.</p>
        {TIMELINE_ROWS.filter((r) => input.modules[r.module] && !r.openEnded).map((r) => {
          const auto = autoTimeline.find((a) => a.id === r.id)
          const ov = input.timeline[r.id] ?? {}
          const setRange = (k: 'start' | 'end', n: number) => set({ timeline: { ...input.timeline, [r.id]: { ...ov, [k]: n } } })
          return (
            <div key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-2 text-sm">
              <span className="text-xs">{r.label}</span>
              <span className="flex items-center gap-1 text-xs">
                W<input type="number" min={1} value={ov.start ?? auto?.start ?? 1} onChange={(e) => setRange('start', Number(e.target.value) || 1)} className={`${inputClass} w-16 px-2 py-1`} />
                –W<input type="number" min={1} value={ov.end ?? auto?.end ?? 1} onChange={(e) => setRange('end', Number(e.target.value) || 1)} className={`${inputClass} w-16 px-2 py-1`} />
              </span>
            </div>
          )
        })}
      </Section>

      <Section title="7. Scope items" defaultOpen={false}>
        <p className="text-xs text-neutral-500">Click an item in the preview to reword it, or hover and press ✕ to remove it.</p>
        {input.removedItems.length > 0 && (
          <div>
            <Label>Removed items</Label>
            <ul className="space-y-1 text-xs">
              {input.removedItems.map((rid) => {
                const def = SCOPE_ITEMS.find((s) => s.id === rid)
                return (
                  <li key={rid} className="flex items-start justify-between gap-2 rounded bg-neutral-50 px-2 py-1">
                    <span className="line-through">{def ? fill(def.text, vars) : rid}</span>
                    <button type="button" className="shrink-0 text-atom-red underline" onClick={() => set({ removedItems: input.removedItems.filter((x) => x !== rid) })}>restore</button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        <div>
          <Label>Add your own item</Label>
          <Select value={newItem.group} onChange={(e) => setNewItem({ ...newItem, group: e.target.value as GroupId })} options={GROUPS.map((g) => ({
            value: g, label: { ideation: 'Ideation phase', development: 'Development phase', scaleup: 'Scale-up / pilot phase', handover: 'Packaging & handover phase' }[g],
          }))} />
          <TextArea className="mt-2" value={newItem.text} onChange={(e) => setNewItem({ ...newItem, text: e.target.value })} placeholder="Describe the extra deliverable…" />
          <Button size="sm" className="mt-2" disabled={!newItem.text.trim()} onClick={() => {
            set({ customItems: [...input.customItems, { id: uid('ci'), group: newItem.group, text: newItem.text.trim() }] })
            setNewItem({ ...newItem, text: '' })
          }}>+ Add item</Button>
        </div>
      </Section>

      <Section title="8. Potential additional costs" defaultOpen={false}>
        <Toggle checked={input.showAdditionalCosts} onChange={(v) => set({ showAdditionalCosts: v })} label="Include this table" />
        {input.showAdditionalCosts && (
          <>
            {ADDITIONAL_COSTS.filter((c) => !c.requires || input.modules[c.requires]).map((c) => {
              const removed = input.removedCosts.includes(c.id)
              return (
                <Toggle key={c.id} checked={!removed} label={fill(c.label, vars)}
                  onChange={(on) => set({ removedCosts: on ? input.removedCosts.filter((x) => x !== c.id) : [...input.removedCosts, c.id] })} />
              )
            })}
            {input.customCosts.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                <span>{c.label} — {c.value}</span>
                <button type="button" className="text-neutral-400 hover:text-red-600" onClick={() => set({ customCosts: input.customCosts.filter((x) => x.id !== c.id) })}>✕</button>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_140px] gap-2">
              <TextInput placeholder="Area of work" value={newCost.label} onChange={(e) => setNewCost({ ...newCost, label: e.target.value })} />
              <TextInput placeholder="Rs. 10,000 per…" value={newCost.value} onChange={(e) => setNewCost({ ...newCost, value: e.target.value })} />
            </div>
            <Button size="sm" variant="secondary" disabled={!newCost.label.trim()} onClick={() => {
              set({ customCosts: [...input.customCosts, { id: uid('cc'), ...newCost }] })
              setNewCost({ label: '', value: '' })
            }}>+ Add row</Button>
          </>
        )}
      </Section>

      <Section title="9. Fee assumptions" defaultOpen={false}>
        <p className="text-xs text-neutral-500">Pre-ticked for a {input.model} quote. Click a clause in the preview to reword it.</p>
        {ASSUMPTIONS.filter((a) => assumptionAvailable(a.id, input)).map((a) => {
          const checked = input.assumptionsChecked[a.id] ?? defaultAssumptionChecked(a.id, input)
          const text = input.texts[`assume:${a.id}`] ?? fill(settings.wording[`assume:${a.id}`] || a.text, vars)
          return (
            <label key={a.id} className="flex cursor-pointer items-start gap-2 text-xs">
              <input type="checkbox" checked={checked} onChange={(e) => set({ assumptionsChecked: { ...input.assumptionsChecked, [a.id]: e.target.checked } })} className="mt-0.5 accent-atom-red" />
              <span className={checked ? '' : 'text-neutral-400'}>
                {text}
                {a.tag !== 'both' && <span className="ml-1 rounded bg-neutral-100 px-1 text-[10px] text-neutral-500">{a.tag} default</span>}
              </span>
            </label>
          )
        })}
        {input.customAssumptions.map((c) => (
          <div key={c.id} className="flex items-start gap-2 text-xs">
            <input type="checkbox" checked={input.assumptionsChecked[c.id] !== false} onChange={(e) => set({ assumptionsChecked: { ...input.assumptionsChecked, [c.id]: e.target.checked } })} className="mt-0.5 accent-atom-red" />
            <span className="flex-1">{input.texts[`assume:${c.id}`] ?? c.text}</span>
            <button type="button" className="text-neutral-400 hover:text-red-600" onClick={() => set({ customAssumptions: input.customAssumptions.filter((x) => x.id !== c.id) })}>✕</button>
          </div>
        ))}
        <TextArea value={newClause} onChange={(e) => setNewClause(e.target.value)} placeholder="Add your own clause…" />
        <Button size="sm" variant="secondary" disabled={!newClause.trim()} onClick={() => {
          set({ customAssumptions: [...input.customAssumptions, { id: uid('ca'), text: newClause.trim() }] })
          setNewClause('')
        }}>+ Add clause</Button>
      </Section>

      <Section title="Typos fixed from the old templates" defaultOpen={false}>
        <ul className="list-disc space-y-1 pl-5 text-xs text-neutral-600">{TEMPLATE_FIXES.map((f) => <li key={f}>{f}</li>)}</ul>
      </Section>
    </>
  )
}

/* ------------------------------------------------------------------ panels & modals */

function IntakePanel({ client }: { client: ClientRow | null }) {
  if (!client) return null
  const answers = client.answers ?? {}
  const keys = Object.keys(answers)
  if (!keys.length) return <p className="text-sm text-neutral-500">No form answers for this client (added by hand).</p>
  const known = ALL_FIELDS.filter((f) => f.type !== 'notice' && answers[f.id] !== undefined && answers[f.id] !== '')
  const show = (v: unknown) => (Array.isArray(v) ? v.join(', ') : v === true ? 'Yes' : v === false ? 'No' : String(v))
  return (
    <dl className="space-y-3 text-sm">
      {(known.length ? known.map((f) => ({ k: f.id, label: f.label })) : keys.map((k) => ({ k, label: k }))).map(({ k, label }) => (
        <div key={k}>
          <dt className="text-xs text-neutral-500">{label}</dt>
          <dd className="whitespace-pre-wrap">{show(answers[k])}{answers[`${k}_other`] ? ` — ${show(answers[`${k}_other`])}` : ''}</dd>
        </div>
      ))}
    </dl>
  )
}

function ReadyModal({ open, onClose, onShare, onDownload, downloading, number }: {
  open: boolean; onClose: () => void; onShare: () => void; onDownload: () => void; downloading: boolean; number: string
}) {
  return (
    <Modal open={open} onClose={onClose} title={`Quote ${number} is ready`}>
      <p className="mb-5 text-sm text-neutral-600">Approved and saved. What would you like to do?</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <button onClick={onShare} className="rounded-lg bg-atom-red px-4 py-6 text-center font-semibold text-white hover:bg-atom-red/90">
          <span className="block text-2xl">✉</span>Share with client
        </button>
        <button onClick={onClose} className="rounded-lg border border-neutral-300 px-4 py-6 text-center font-semibold hover:border-atom-ink">
          <span className="block text-2xl">✎</span>Edit
        </button>
        <button onClick={onDownload} disabled={downloading} className="rounded-lg border border-neutral-300 px-4 py-6 text-center font-semibold hover:border-atom-ink disabled:opacity-50">
          <span className="block text-2xl">⬇</span>{downloading ? 'Preparing…' : 'Download PDF'}
        </button>
      </div>
    </Modal>
  )
}

function ShareModal({ open, onClose, quote, client, brand, onSent }: {
  open: boolean; onClose: () => void; quote: QuoteRow; client: ClientRow | null; brand: string; onSent: () => Promise<void>
}) {
  const first = (client?.name ?? '').split(/[ &]/)[0]
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!open) return
    const signatory = String(client?.details?.signatoryEmail ?? '')
    setTo([client?.email, signatory].filter((x, i, a) => x && a.indexOf(x) === i).join(', '))
    setSubject(`Quotation from Atom Consultancy – ${brand}`)
    setMessage(`Dear ${first || 'Sir/Madam'},\n\nThank you for considering Atom Consultancy for your product development. Please find attached our quotation ${quote.number ?? ''} with the proposed scope of work, timelines and fees.\n\nYou can also view it online and accept it, or request changes, using the button below.\n\nWe look forward to working with you.\n\nWarm regards,\nJay Mota\nFounder, Atom Consultancy\n+91 93723 15541`)
    setResult(null)
  }, [open, client, brand, first, quote.number])

  const send = async () => {
    setBusy(true)
    setResult(null)
    try {
      await callFn('admin-actions', { action: 'send_quote', quoteId: quote.id, to, cc, subject, message })
      setResult({ tone: 'success', text: 'Sent! The client will get the PDF and a link to view and accept it.' })
      await onSent()
    } catch (e) {
      setResult({ tone: 'error', text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const getLink = async () => {
    const r = await callFn<{ link: string }>('admin-actions', { action: 'share_link', quoteId: quote.id })
    await onSent()
    return r.link
  }

  const copyLink = async () => {
    try {
      const link = await getLink()
      await navigator.clipboard.writeText(link)
      setResult({ tone: 'success', text: 'Link copied. Paste it anywhere.' })
    } catch (e) {
      setResult({ tone: 'error', text: (e as Error).message })
    }
  }

  const whatsapp = async () => {
    const win = window.open('', '_blank')
    try {
      const link = await getLink()
      const phone = (client?.phone ?? '').replace(/\D/g, '').replace(/^0/, '')
      const num = phone.length === 10 ? `91${phone}` : phone
      const text = `Hi ${first || ''}, here is your quotation from Atom Consultancy for ${brand}: ${link}`
      const url = `https://wa.me/${num}?text=${encodeURIComponent(text)}`
      if (win) win.location.href = url
      else window.location.href = url
    } catch (e) {
      win?.close()
      setResult({ tone: 'error', text: (e as Error).message })
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Share with client" wide>
      <div className="space-y-3">
        <div>
          <Label>To (separate several emails with commas)</Label>
          <TextInput value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <Label>CC (optional)</Label>
          <TextInput value={cc} onChange={(e) => setCc(e.target.value)} placeholder="jay@atomconsulting.in" />
        </div>
        <div>
          <Label>Subject</Label>
          <TextInput value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div>
          <Label>Message</Label>
          <TextArea rows={10} value={message} onChange={(e) => setMessage(e.target.value)} />
          <p className="mt-1 text-xs text-neutral-500">The PDF is attached automatically, with a red “View & accept your quote online” button under your message.</p>
        </div>
        {result && <Alert tone={result.tone}>{result.text}</Alert>}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            <Button variant="secondary" onClick={copyLink}>Copy link</Button>
            <Button variant="secondary" onClick={whatsapp}>Share on WhatsApp</Button>
          </div>
          <Button onClick={send} busy={busy} disabled={!to.trim()}>Send email</Button>
        </div>
      </div>
    </Modal>
  )
}
