import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Papa from 'papaparse'
import { newQuoteInput } from '../../supabase/functions/_shared/engine/quote.ts'
import { EMPTY_CLIENT, suggestComplexity } from '../../supabase/functions/_shared/engine/intake.ts'
import { supabase } from '../lib/supabase'
import { CLIENT_STATUSES, QUOTE_STATUS_LABEL, istDate, statusInfo } from '../lib/status'
import { Alert, Badge, Button, EmptyState, Label, Modal, PageSpinner, Select, TextInput } from '../components/ui'
import { useSettings } from './AdminLayout'

interface Row {
  id: string
  created_at: string
  updated_at: string
  status: string
  name: string
  email: string
  brand: string
  source: string
  lost_reason: string | null
  quotes: { id: string; status: string; number: string | null; updated_at: string }[]
  mous: { id: string; status: string }[]
}

export default function Dashboard() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [filter, setFilter] = useState('active')
  const [search, setSearch] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, created_at, updated_at, status, name, email, brand, source, lost_reason, quotes(id, status, number, updated_at), mous(id, status)')
      .order('created_at', { ascending: false })
    setRows((data as Row[]) ?? [])
  }, [])

  useEffect(() => { void load() }, [load])

  const shown = useMemo(() => {
    if (!rows) return []
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (filter === 'active' && ['lost', 'project_started'].includes(r.status)) return false
      if (filter !== 'active' && filter !== 'all' && r.status !== filter) return false
      if (q && !`${r.name} ${r.brand} ${r.email}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, filter, search])

  const stats = useMemo(() => {
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const thisMonth = (rows ?? []).filter((r) => new Date(r.created_at) >= monthStart)
    const all = rows ?? []
    const after = (ids: string[]) => all.filter((r) => ids.includes(r.status)).length
    return [
      { label: 'Enquiries this month', value: thisMonth.length },
      { label: 'Waiting on you', value: after(['new_enquiry', 'quote_draft', 'changes_requested', 'quote_accepted', 'mou_draft']) },
      { label: 'Quotes out with clients', value: after(['quote_sent']) },
      { label: 'Signed / started', value: after(['fully_signed', 'project_started']) },
    ]
  }, [rows])

  if (!rows) return <PageSpinner />

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Clients</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>Import Google Form CSV</Button>
          <Button onClick={() => setNewOpen(true)}>+ New quote</Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-neutral-200 bg-white p-4">
            <p className="text-2xl font-semibold">{s.value}</p>
            <p className="text-xs text-neutral-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <TextInput placeholder="Search name, brand or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="sm:max-w-xs"
          options={[{ value: 'active', label: 'All active' }, { value: 'all', label: 'Everything' }, ...CLIENT_STATUSES.map((s) => ({ value: s.id, label: s.label }))]}
        />
      </div>

      <div className="mt-4">
        {shown.length === 0 ? (
          <EmptyState title="No clients here yet">
            When someone fills in the form at onboarding.atomconsulting.in, they'll appear here with a draft quote ready.
          </EmptyState>
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="hidden bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 sm:table-header-group">
                <tr>
                  <th className="px-4 py-2">Client</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Latest quote</th>
                  <th className="px-4 py-2">Received</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {shown.map((r) => {
                  const q = [...r.quotes].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]
                  const st = statusInfo(r.status)
                  return (
                    <tr key={r.id} className="flex flex-col gap-1 px-4 py-3 hover:bg-neutral-50 sm:table-row sm:px-0">
                      <td className="sm:px-4 sm:py-3">
                        <Link to={`/admin/client/${r.id}`} className="font-medium hover:text-atom-red">{r.brand || '(no brand)'}</Link>
                        <p className="text-xs text-neutral-500">{r.name}{r.source === 'import' ? ' · imported' : ''}</p>
                      </td>
                      <td className="sm:px-4 sm:py-3">
                        <Badge tone={st.tone}>{st.label}</Badge>
                        {r.status === 'lost' && r.lost_reason && <p className="mt-1 text-xs text-neutral-500">{r.lost_reason}</p>}
                      </td>
                      <td className="text-xs text-neutral-600 sm:px-4 sm:py-3">
                        {q ? <>{q.number ?? 'Unnumbered draft'} · {QUOTE_STATUS_LABEL[q.status] ?? q.status}</> : '—'}
                      </td>
                      <td className="text-xs text-neutral-500 sm:px-4 sm:py-3">{istDate(r.created_at)}</td>
                      <td className="sm:px-4 sm:py-3 sm:text-right">
                        {q && <Link to={`/admin/quote/${q.id}`} className="text-sm font-medium text-atom-red hover:underline">Open quote →</Link>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NewQuoteModal open={newOpen} onClose={() => setNewOpen(false)} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onDone={load} />
    </div>
  )
}

function NewQuoteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings } = useSettings()
  const navigate = useNavigate()
  const [f, setF] = useState({ name: '', email: '', brand: '', legalName: '', product: '', variants: '1' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const create = async () => {
    setBusy(true)
    setError('')
    const variants = Math.max(1, Number(f.variants) || 1)
    const details = { ...EMPTY_CLIENT, contactName: f.name, contactEmail: f.email, brandName: f.brand, legalName: f.legalName, productShort: f.product, variants }
    const { data: client, error: e1 } = await supabase.from('clients')
      .insert({ status: 'quote_draft', source: 'manual', name: f.name, email: f.email, brand: f.brand, details })
      .select('id').single()
    if (e1 || !client) {
      setBusy(false)
      return setError(e1?.message ?? 'Could not create the client.')
    }
    const { complexity, reason } = suggestComplexity(variants, '')
    const input = newQuoteInput(settings, {
      clientNames: f.name, brand: f.brand, productDescription: f.product, variants, complexity, complexityReason: reason,
    })
    const { data: quote, error: e2 } = await supabase.from('quotes').insert({ client_id: client.id, input }).select('id').single()
    setBusy(false)
    if (e2 || !quote) return setError(e2?.message ?? 'Could not create the quote.')
    onClose()
    navigate(`/admin/quote/${quote.id}`)
  }

  const field = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <Label>{label}</Label>
      <TextInput value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} />
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} title="New quote">
      <div className="grid gap-4 sm:grid-cols-2">
        {field('name', 'Client name(s) for “To …”', { placeholder: 'Raunaq Roy & Neeraj Roy' })}
        {field('email', 'Client email', { type: 'email' })}
        {field('brand', 'Brand name')}
        {field('legalName', 'Legal entity name (optional)')}
        <div className="sm:col-span-2">{field('product', 'Product, in a few words', { placeholder: 'sugar free sweet flavoured popped chips' })}</div>
        {field('variants', 'Number of variants / SKUs', { type: 'number', min: 1 })}
      </div>
      {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={create} busy={busy} disabled={!f.name.trim() || !f.brand.trim()}>Create & open builder</Button>
      </div>
    </Modal>
  )
}

/** Brings old Google Form responses in as clients ("New enquiry"). */
function ImportModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const pick = (row: Record<string, string>, ...needles: string[]) => {
    const key = Object.keys(row).find((k) => needles.some((n) => k.toLowerCase().includes(n)))
    return key ? String(row[key] ?? '').trim() : ''
  }

  const onFile = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        setRows(res.data)
        setMessage(`Found ${res.data.length} responses.`)
      },
    })
  }

  const doImport = async () => {
    setBusy(true)
    const records = rows.map((r) => {
      const ts = Date.parse(pick(r, 'timestamp'))
      return {
        status: 'new_enquiry',
        source: 'import',
        name: pick(r, 'your name', 'name'),
        email: pick(r, 'email'),
        phone: pick(r, 'phone'),
        brand: pick(r, 'company', 'brand'),
        answers: r,
        details: { ...EMPTY_CLIENT, contactName: pick(r, 'your name', 'name'), contactEmail: pick(r, 'email'), contactPhone: pick(r, 'phone'), brandName: pick(r, 'company', 'brand') },
        ...(Number.isFinite(ts) ? { created_at: new Date(ts).toISOString() } : {}),
      }
    })
    const { error } = await supabase.from('clients').insert(records)
    setBusy(false)
    if (error) return setMessage(`Import failed: ${error.message}`)
    setMessage(`Imported ${records.length} clients.`)
    setRows([])
    onDone()
  }

  return (
    <Modal open={open} onClose={onClose} title="Import from Google Form">
      <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-neutral-600">
        <li>Open your Google Form → <b>Responses</b> → the green Sheets icon.</li>
        <li>In the sheet: <b>File → Download → Comma-separated values (.csv)</b>.</li>
        <li>Choose that file below.</li>
      </ol>
      <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} className="text-sm" />
      {message && <div className="mt-4"><Alert tone="info">{message}</Alert></div>}
      {rows.length > 0 && (
        <div className="mt-3 max-h-48 overflow-auto rounded border border-neutral-200 text-xs">
          {rows.slice(0, 20).map((r, i) => (
            <div key={i} className="border-b border-neutral-100 px-2 py-1">{pick(r, 'your name', 'name')} · {pick(r, 'company', 'brand')} · {pick(r, 'email')}</div>
          ))}
        </div>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Close</Button>
        <Button onClick={doImport} busy={busy} disabled={!rows.length}>Import {rows.length || ''} clients</Button>
      </div>
    </Modal>
  )
}
