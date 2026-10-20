import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ALL_FIELDS, EMPTY_CLIENT, REQUIRED_MOU_FIELDS, suggestComplexity, type Answers, type ClientDetails } from '../../supabase/functions/_shared/engine/intake.ts'
import { newQuoteInput } from '../../supabase/functions/_shared/engine/quote.ts'
import { supabase } from '../lib/supabase'
import { CLIENT_STATUSES, MOU_STATUS_LABEL, QUOTE_STATUS_LABEL, istDateTime, statusInfo } from '../lib/status'
import { Alert, Badge, Button, Card, Label, Modal, PageSpinner, Select, TextInput } from '../components/ui'
import { useSettings } from './AdminLayout'

interface Client {
  id: string
  created_at: string
  status: string
  lost_reason: string | null
  source: string
  name: string
  email: string
  phone: string
  brand: string
  answers: Answers
  details: Partial<ClientDetails>
}

const DETAIL_FIELDS: { key: keyof ClientDetails; label: string; wide?: boolean }[] = [
  { key: 'legalName', label: 'Legal entity name' },
  { key: 'brandName', label: 'Brand name' },
  { key: 'entityType', label: 'Entity type' },
  { key: 'address', label: 'Registered address', wide: true },
  { key: 'billingAddress', label: 'Billing address (if different)', wide: true },
  { key: 'gstin', label: 'GSTIN' },
  { key: 'pan', label: 'PAN' },
  { key: 'fssai', label: 'FSSAI' },
  { key: 'signatoryName', label: 'Signatory name' },
  { key: 'signatoryTitle', label: 'Signatory title' },
  { key: 'signatoryEmail', label: 'Signatory email' },
  { key: 'contactName', label: 'Contact name' },
  { key: 'contactEmail', label: 'Contact email' },
  { key: 'contactPhone', label: 'Contact phone' },
  { key: 'billingContactName', label: 'Billing contact' },
  { key: 'billingEmail', label: 'Billing email' },
  { key: 'productShort', label: 'Product (short)' },
]

const EVENT_LABEL: Record<string, string> = {
  form_submitted: 'Filled in the intake form',
  quote_approved: 'You approved the quote',
  quote_sent: 'Quote emailed to client',
  quote_link_shared: 'Quote link shared',
  quote_viewed: 'Client opened the quote',
  quote_accepted: 'Client accepted the quote',
  changes_requested: 'Client asked for changes',
  mou_approved: 'You approved the MOU',
  mou_sent: 'MOU sent for signature',
  mou_signed: 'Signed MOU uploaded',
  details_link_sent: '“Complete your details” link sent',
  details_completed: 'Client completed their details',
  status_changed: 'Status changed',
}

export default function ClientPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { settings } = useSettings()
  const [client, setClient] = useState<Client | null>(null)
  const [details, setDetails] = useState<ClientDetails>(EMPTY_CLIENT)
  const [quotes, setQuotes] = useState<{ id: string; number: string | null; status: string; version: number; updated_at: string }[]>([])
  const [mous, setMous] = useState<{ id: string; status: string; updated_at: string }[]>([])
  const [events, setEvents] = useState<{ id: number; kind: string; detail: Record<string, unknown>; created_at: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [lostOpen, setLostOpen] = useState(false)
  const [lostReason, setLostReason] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)

  const load = useCallback(async () => {
    const [{ data: c }, { data: q }, { data: m }, { data: e }] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('quotes').select('id, number, status, version, updated_at').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('mous').select('id, status, updated_at').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('events').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(50),
    ])
    if (c) {
      setClient(c as Client)
      setDetails({ ...EMPTY_CLIENT, ...(c.details ?? {}) })
    }
    setQuotes(q ?? [])
    setMous(m ?? [])
    setEvents(e ?? [])
  }, [id])

  useEffect(() => { void load() }, [load])

  if (!client) return <PageSpinner />

  const setStatus = async (status: string, lost_reason: string | null = null) => {
    await supabase.from('clients').update({ status, lost_reason }).eq('id', client.id)
    await supabase.from('events').insert({ client_id: client.id, kind: 'status_changed', detail: { status, lost_reason } })
    await load()
  }

  const saveDetails = async () => {
    setSaving(true)
    await supabase.from('clients').update({
      details, brand: details.brandName || client.brand, name: details.contactName || client.name, email: details.contactEmail || client.email, phone: details.contactPhone || client.phone,
    }).eq('id', client.id)
    // Keep draft MOUs in step with the latest details.
    const { data: drafts } = await supabase.from('mous').select('id, input').eq('client_id', client.id).eq('status', 'draft')
    for (const d of drafts ?? []) {
      await supabase.from('mous').update({ input: { ...d.input, client: details } }).eq('id', d.id)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    await load()
  }

  const newQuote = async () => {
    const { complexity, reason } = suggestComplexity(details.variants || 1, '')
    const input = newQuoteInput(settings, {
      clientNames: client.name, brand: client.brand, productDescription: details.productShort, variants: details.variants || 1, complexity, complexityReason: reason,
    })
    const { data } = await supabase.from('quotes').insert({ client_id: client.id, input }).select('id').single()
    if (data) navigate(`/admin/quote/${data.id}`)
  }

  const remove = async () => {
    await supabase.from('clients').delete().eq('id', client.id)
    navigate('/admin')
  }

  const missing = REQUIRED_MOU_FIELDS.filter((f) => !String(details[f.key] ?? '').trim())
  const st = statusInfo(client.status)
  const answers = client.answers ?? {}
  const answerKeys = ALL_FIELDS.filter((f) => f.type !== 'notice' && answers[f.id] !== undefined && answers[f.id] !== '')
  const show = (v: unknown) => (Array.isArray(v) ? v.join(', ') : v === true ? 'Yes' : v === false ? 'No' : String(v))

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link to="/admin" className="text-sm text-neutral-500 hover:text-atom-red">← All clients</Link>
          <h1 className="text-2xl font-semibold">{client.brand || '(no brand)'}</h1>
          <p className="text-sm text-neutral-600">{client.name} · {client.email} · {client.phone}</p>
          <p className="text-xs text-neutral-400">Added {istDateTime(client.created_at)} · {client.source === 'form' ? 'from the website form' : client.source === 'import' ? 'imported from Google Form' : 'added by hand'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={st.tone}>{st.label}</Badge>
          <Select
            value={client.status}
            onChange={(e) => (e.target.value === 'lost' ? setLostOpen(true) : void setStatus(e.target.value))}
            className="w-56"
            options={CLIENT_STATUSES.map((s) => ({ value: s.id, label: `Set status: ${s.label}` }))}
          />
        </div>
      </div>
      {client.status === 'lost' && client.lost_reason && <Alert tone="error">Not proceeding: {client.lost_reason}</Alert>}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Quotes" actions={<Button size="sm" variant="secondary" onClick={newQuote}>+ New quote</Button>}>
            {quotes.length === 0 ? <p className="text-sm text-neutral-500">No quotes yet.</p> : (
              <ul className="divide-y divide-neutral-100">
                {quotes.map((q) => (
                  <li key={q.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span>{q.number ?? 'Unnumbered draft'} <span className="text-neutral-400">· v{q.version}</span></span>
                    <span className="flex items-center gap-3">
                      <Badge>{QUOTE_STATUS_LABEL[q.status] ?? q.status}</Badge>
                      <Link to={`/admin/quote/${q.id}`} className="font-medium text-atom-red hover:underline">Open</Link>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="MOU">
            {mous.length === 0 ? <p className="text-sm text-neutral-500">The MOU is drafted automatically when the client accepts a quote.</p> : (
              <ul className="divide-y divide-neutral-100">
                {mous.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span>MOU · updated {istDateTime(m.updated_at)}</span>
                    <span className="flex items-center gap-3">
                      <Badge>{MOU_STATUS_LABEL[m.status] ?? m.status}</Badge>
                      <Link to={`/admin/mou/${m.id}`} className="font-medium text-atom-red hover:underline">Open</Link>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Company & billing details" actions={<Button size="sm" onClick={saveDetails} busy={saving}>{saved ? 'Saved ✓' : 'Save'}</Button>}>
            {missing.length > 0 && <div className="mb-3"><Alert tone="warn">Needed for the MOU: {missing.map((m) => m.label).join(', ')}</Alert></div>}
            <div className="grid gap-3 sm:grid-cols-2">
              {DETAIL_FIELDS.map((f) => (
                <div key={f.key} className={f.wide ? 'sm:col-span-2' : ''}>
                  <Label>{f.label}</Label>
                  <TextInput
                    value={String(details[f.key] ?? '')}
                    onChange={(e) => setDetails({ ...details, [f.key]: e.target.value })}
                    className={REQUIRED_MOU_FIELDS.some((r) => r.key === f.key) && !String(details[f.key] ?? '').trim() ? 'border-amber-400 bg-amber-50' : ''}
                  />
                </div>
              ))}
            </div>
          </Card>

          {answerKeys.length > 0 && (
            <Card title="Intake form answers">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {answerKeys.map((f) => (
                  <div key={f.id} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                    <dt className="text-xs text-neutral-500">{f.label}</dt>
                    <dd className="whitespace-pre-wrap">{show(answers[f.id])}{answers[`${f.id}_other`] ? ` — ${show(answers[`${f.id}_other`])}` : ''}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
          {answerKeys.length === 0 && Object.keys(answers).length > 0 && (
            <Card title="Imported answers">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {Object.entries(answers).map(([k, v]) => (
                  <div key={k}><dt className="text-xs text-neutral-500">{k}</dt><dd>{show(v)}</dd></div>
                ))}
              </dl>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card title="Activity">
            {events.length === 0 ? <p className="text-sm text-neutral-500">Nothing yet.</p> : (
              <ol className="space-y-3 text-sm">
                {events.map((e) => (
                  <li key={e.id} className="border-l-2 border-atom-red/30 pl-3">
                    <p>{EVENT_LABEL[e.kind] ?? e.kind}{e.kind === 'status_changed' ? `: ${statusInfo(String(e.detail.status)).label}` : ''}</p>
                    {typeof e.detail.comment === 'string' && e.detail.comment && <p className="text-xs italic text-neutral-600">“{e.detail.comment}”</p>}
                    <p className="text-xs text-neutral-400">{istDateTime(e.created_at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>Delete this client</Button>
        </div>
      </div>

      <Modal open={lostOpen} onClose={() => setLostOpen(false)} title="Mark as lost / not proceeding">
        <Label>Reason</Label>
        <TextInput value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="e.g. budget, went with another consultant, postponed" autoFocus />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setLostOpen(false)}>Cancel</Button>
          <Button onClick={async () => { await setStatus('lost', lostReason || null); setLostOpen(false) }}>Save</Button>
        </div>
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete this client?">
        <p className="text-sm">This permanently deletes {client.brand}, their quotes, MOUs and activity. It can't be undone. If they just aren't going ahead, use “Lost / Not proceeding” instead.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={remove}>Delete permanently</Button>
        </div>
      </Modal>
    </div>
  )
}
