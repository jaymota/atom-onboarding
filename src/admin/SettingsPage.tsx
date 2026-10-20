import { useCallback, useEffect, useState } from 'react'
import {
  ADD_ONS, ADDITIONAL_COSTS, ASSUMPTIONS, COMPLEXITY_LABELS, DEFAULT_PRESETS, FIXED_TEXT, SCOPE_ITEMS, TIMELINE_ROWS,
  type Complexity, type Model,
} from '../../supabase/functions/_shared/engine/content.ts'
import { mouTemplateText } from '../../supabase/functions/_shared/engine/mou.ts'
import type { Settings } from '../../supabase/functions/_shared/engine/settings.ts'
import { formatINR } from '../../supabase/functions/_shared/engine/format.ts'
import { supabase, callFn } from '../lib/supabase'
import { istDateTime } from '../lib/status'
import { Alert, Button, Card, Label, TextArea, TextInput, inputClass } from '../components/ui'
import { useSettings } from './AdminLayout'

const TABS = ['Company', 'Fees & prices', 'Timeline presets', 'Default wording', 'Email & signing', 'Security'] as const
type Tab = (typeof TABS)[number]

export default function SettingsPage() {
  const { settings, reload } = useSettings()
  const [tab, setTab] = useState<Tab>('Company')
  const [draft, setDraft] = useState<Settings>(settings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings)

  useEffect(() => setDraft(settings), [settings])

  const save = async () => {
    setSaving(true)
    await supabase.from('settings').update({ data: draft, updated_at: new Date().toISOString() }).eq('id', 1)
    await reload()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Settings</h1>
        {tab !== 'Security' && (
          <Button onClick={save} busy={saving} disabled={!dirty}>{saved ? 'Saved ✓' : dirty ? 'Save changes' : 'Saved'}</Button>
        )}
      </div>
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-neutral-200">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${tab === t ? 'border-atom-teal text-atom-ink' : 'border-transparent text-neutral-500 hover:text-atom-ink'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Company' && <CompanyTab draft={draft} setDraft={setDraft} />}
      {tab === 'Fees & prices' && <FeesTab draft={draft} setDraft={setDraft} />}
      {tab === 'Timeline presets' && <PresetsTab draft={draft} setDraft={setDraft} />}
      {tab === 'Default wording' && <WordingTab draft={draft} setDraft={setDraft} />}
      {tab === 'Email & signing' && <EmailTab draft={draft} setDraft={setDraft} />}
      {tab === 'Security' && <SecurityTab />}
    </div>
  )
}

type TabProps = { draft: Settings; setDraft: (s: Settings) => void }

function CompanyTab({ draft, setDraft }: TabProps) {
  const c = draft.company
  const field = (k: keyof Settings['company'], label: string, wide = false) => (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <Label>{label}</Label>
      {wide ? (
        <TextArea rows={2} value={c[k]} onChange={(e) => setDraft({ ...draft, company: { ...c, [k]: e.target.value } })} />
      ) : (
        <TextInput value={c[k]} onChange={(e) => setDraft({ ...draft, company: { ...c, [k]: e.target.value } })} />
      )}
    </div>
  )
  return (
    <Card title="Shown on every quote, MOU and PDF footer">
      <div className="grid gap-4 sm:grid-cols-2">
        {field('name', 'Business name')}
        {field('entityType', 'Entity type')}
        {field('address', 'Registered address', true)}
        {field('city', 'MOU “Place”')}
        {field('gstin', 'GSTIN')}
        {field('pan', 'PAN')}
        {field('fssai', 'FSSAI')}
        {field('website', 'Website')}
        {field('email', 'Email')}
        {field('phone', 'Phone')}
        {field('signatoryName', 'Signatory name')}
        {field('signatoryTitle', 'Title on quotes')}
        {field('mouSignatoryTitle', 'Title on MOUs')}
        <div>
          <Label>Quote validity (days)</Label>
          <TextInput type="number" value={draft.validityDays} onChange={(e) => setDraft({ ...draft, validityDays: Number(e.target.value) || 30 })} />
        </div>
        <div>
          <Label>GST rate (%)</Label>
          <TextInput type="number" value={draft.gstRate} onChange={(e) => setDraft({ ...draft, gstRate: Number(e.target.value) || 0 })} />
        </div>
      </div>
    </Card>
  )
}

function FeesTab({ draft, setDraft }: TabProps) {
  const money = (v: number | null, onChange: (n: number | null) => void) => (
    <div>
      <input type="number" step={10000} value={v ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} className={inputClass} />
      {v != null && <p className="mt-0.5 text-xs text-neutral-500">₹{formatINR(v)}</p>}
    </div>
  )
  return (
    <div className="space-y-5">
      <Card title="Suggested fees (pre-filled in new quotes as a suggestion you must confirm)">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-500">
              <th className="pb-2" />
              {(['easy', 'medium', 'hard'] as Complexity[]).map((c) => <th key={c} className="pb-2">{COMPLEXITY_LABELS[c]}</th>)}
            </tr>
          </thead>
          <tbody>
            {(['milestone', 'retainer'] as Model[]).map((m) => (
              <tr key={m}>
                <td className="py-1 pr-3 font-medium">{m === 'milestone' ? 'Milestone (total)' : 'Retainer (per month)'}</td>
                {(['easy', 'medium', 'hard'] as Complexity[]).map((c) => (
                  <td key={c} className="py-1 pr-2 align-top">
                    {money(draft.fees[m][c], (n) => setDraft({ ...draft, fees: { ...draft.fees, [m]: { ...draft.fees[m], [c]: n } } }))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Potential additional costs (₹)">
        <div className="grid gap-4 sm:grid-cols-3">
          {ADDITIONAL_COSTS.map((c) => (
            <div key={c.id}>
              <Label>{c.label.replace(/\s*\(.*$/, '')} — {c.unit.replace('{perMonth}', '')}</Label>
              {money(draft.costs[c.priceKey], (n) => setDraft({ ...draft, costs: { ...draft.costs, [c.priceKey]: n } }))}
            </div>
          ))}
        </div>
      </Card>
      <Card title="Default counts">
        <table className="text-sm">
          <thead><tr className="text-left text-xs text-neutral-500"><th /><th className="px-2">Prototypes</th><th className="px-2">Tastings</th><th className="px-2">Pilot trials</th></tr></thead>
          <tbody>
            {(['milestone', 'retainer'] as Model[]).map((m) => (
              <tr key={m}>
                <td className="py-1 pr-3 font-medium">{m === 'milestone' ? 'Milestone (total)' : 'Retainer (per month)'}</td>
                {(['prototypes', 'tastings', 'trials'] as const).map((k) => (
                  <td key={k} className="px-2 py-1">
                    <input type="number" min={1} value={draft.counts[m][k]} className={`${inputClass} w-20`}
                      onChange={(e) => setDraft({ ...draft, counts: { ...draft.counts, [m]: { ...draft.counts[m], [k]: Number(e.target.value) || 1 } } })} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

function PresetsTab({ draft, setDraft }: TabProps) {
  return (
    <Card title="Week ranges with all modules on (switching a module off shifts later rows earlier automatically)">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-500">
              <th className="pb-2">Actionable</th>
              {(['easy', 'medium', 'hard'] as Complexity[]).map((c) => <th key={c} className="pb-2 px-2">{COMPLEXITY_LABELS[c]}</th>)}
            </tr>
          </thead>
          <tbody>
            {TIMELINE_ROWS.filter((r) => !r.openEnded).map((r) => (
              <tr key={r.id} className="border-t border-neutral-100">
                <td className="py-1.5 pr-3">{r.label}</td>
                {(['easy', 'medium', 'hard'] as Complexity[]).map((c) => {
                  const [a, b] = draft.presets[c][r.id] ?? DEFAULT_PRESETS[c][r.id]
                  const put = (i: 0 | 1, v: number) => {
                    const next: [number, number] = i === 0 ? [v, b] : [a, v]
                    setDraft({ ...draft, presets: { ...draft.presets, [c]: { ...draft.presets[c], [r.id]: next } } })
                  }
                  return (
                    <td key={c} className="whitespace-nowrap px-2 py-1.5 text-xs">
                      W<input type="number" min={1} value={a} onChange={(e) => put(0, Number(e.target.value) || 1)} className={`${inputClass} inline w-14 px-1 py-1`} />
                      –<input type="number" min={1} value={b} onChange={(e) => put(1, Number(e.target.value) || 1)} className={`${inputClass} inline w-14 px-1 py-1`} />
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr className="border-t border-neutral-200 font-medium">
              <td className="py-2">Total (all modules)</td>
              {(['easy', 'medium', 'hard'] as Complexity[]).map((c) => (
                <td key={c} className="px-2">{Math.max(...Object.values(draft.presets[c]).map((x) => x[1]))} weeks</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <Button variant="ghost" size="sm" className="mt-3" onClick={() => setDraft({ ...draft, presets: DEFAULT_PRESETS })}>Reset to built-in presets</Button>
    </Card>
  )
}

const MOU_KEYS = [
  'background', 'scopeIntro', 'timelinesIntro', 'feesA_r', 'feesB_r', 'feesC_r', 'feesA_m', 'feesB_m', 'feesC_m', 'suspension', 'thirtyDays',
  'termIntro', 'termClient', 'termClientR1', 'termClientM1', 'termClient2', 'termConsultant', 'termHandover', 'invoicing_r', 'invoicing_m',
  'assumptionsIntro_r', 'assumptionsIntro_m', 'tcA', 'tcB1', 'tcB2', 'tcC', 'tcCa', 'tcCb', 'tcD', 'tcDa', 'tcDb', 'tcDbi', 'tcDbii',
  'tcE', 'tcEa', 'tcEb', 'tcEc', 'tcE2', 'tcF', 'tcFa', 'tcFb', 'tcFc', 'tcF2', 'tcG_r', 'tcG_m', 'tcG2',
]

function WordingTab({ draft, setDraft }: TabProps) {
  const [filter, setFilter] = useState('')
  const groups: { title: string; items: { key: string; label: string; text: string }[] }[] = [
    { title: 'Scope of work items', items: SCOPE_ITEMS.map((s) => ({ key: `item:${s.id}`, label: `${s.module} · ${s.id}`, text: s.text })) },
    { title: 'Other services (scope lines)', items: ADD_ONS.map((a) => ({ key: `item:${a.id}`, label: a.name, text: `**${a.name}:** ${a.scope}` })) },
    { title: 'Terms & assumptions', items: ASSUMPTIONS.map((a) => ({ key: `assume:${a.id}`, label: `${a.topic} · ${a.tag}${a.requires ? ` · needs ${a.requires}` : ''}`, text: `**${a.topic}:** ${a.text}` })) },
    { title: 'Timeline labels', items: TIMELINE_ROWS.map((r) => ({ key: `tl:${r.id}`, label: r.module, text: r.label })) },
    { title: 'Additional cost rows', items: ADDITIONAL_COSTS.map((c) => ({ key: `cost:${c.id}`, label: c.id, text: c.label })) },
    {
      title: 'Fixed quote text',
      items: [
        ['intro', FIXED_TEXT.intro], ['phase:addons', FIXED_TEXT.addonsTitle], ['fees:milestone', FIXED_TEXT.feesMilestone], ['fees:retainer', FIXED_TEXT.feesRetainer],
        ['tranchesIntro', FIXED_TEXT.tranchesIntro], ['retainerPayable', FIXED_TEXT.retainerPayable],
        ['assumptions:milestone', FIXED_TEXT.assumptionsMilestone], ['assumptions:retainer', FIXED_TEXT.assumptionsRetainer],
        ['validity', FIXED_TEXT.validity], ['mouNote', FIXED_TEXT.mouNote],
      ].map(([key, text]) => ({ key, label: key, text })),
    },
    { title: 'MOU clauses', items: MOU_KEYS.map((k) => ({ key: `mou:${k}`, label: k, text: mouTemplateText(k) ?? '' })) },
  ]
  const setWord = (key: string, v: string, def: string) => {
    const wording = { ...draft.wording }
    if (!v.trim() || v === def) delete wording[key]
    else wording[key] = v
    setDraft({ ...draft, wording })
  }
  const q = filter.toLowerCase()
  return (
    <div className="space-y-5">
      <Alert tone="info">
        These are the default words for <b>new</b> quotes and MOUs. Placeholders like <code>{'{tastings}'}</code>, <code>{'{trials}'}</code>, <code>{'{prototypes}'}</code>, <code>{'{perMonth}'}</code>, <code>{'{fee}'}</code> and <code>{'{months}'}</code> are filled in automatically. Use <code>**double stars**</code> for bold.
      </Alert>
      <TextInput placeholder="Search wording…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-sm" />
      {groups.map((g) => {
        const items = g.items.filter((i) => !q || i.text.toLowerCase().includes(q) || (draft.wording[i.key] ?? '').toLowerCase().includes(q))
        if (!items.length) return null
        return (
          <Card key={g.title} title={g.title}>
            <div className="space-y-4">
              {items.map((i) => {
                const custom = i.key in draft.wording
                return (
                  <div key={i.key}>
                    <div className="mb-1 flex items-center justify-between text-xs text-neutral-500">
                      <span>{i.label}{custom && <span className="ml-2 rounded bg-atom-aqua px-1.5 text-neutral-800">your wording</span>}</span>
                      {custom && <button className="underline" onClick={() => setWord(i.key, '', i.text)}>reset to template</button>}
                    </div>
                    <TextArea rows={Math.min(6, Math.ceil((draft.wording[i.key] ?? i.text).length / 110) + 1)} value={draft.wording[i.key] ?? i.text} onChange={(e) => setWord(i.key, e.target.value, i.text)} />
                  </div>
                )
              })}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

function EmailTab({ draft, setDraft }: TabProps) {
  const [test, setTest] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const e = draft.email
  const field = (k: keyof Settings['email'], label: string, help?: string) => (
    <div>
      <Label>{label}</Label>
      <TextInput value={e[k]} onChange={(ev) => setDraft({ ...draft, email: { ...e, [k]: ev.target.value } })} />
      {help && <p className="mt-1 text-xs text-neutral-500">{help}</p>}
    </div>
  )
  return (
    <div className="space-y-5">
      <Card title="Emails">
        <div className="grid gap-4 sm:grid-cols-2">
          {field('fromName', 'Sender name')}
          {field('fromAddress', 'Send from', 'Must be @atomconsulting.in (verified in Resend)')}
          {field('replyTo', 'Replies go to')}
          {field('notifyTo', 'Send my alerts to')}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button variant="secondary" busy={busy} onClick={async () => {
            setBusy(true)
            setTest(null)
            try {
              await callFn('admin-actions', { action: 'test_email' })
              setTest({ tone: 'success', text: `Test email sent to ${e.notifyTo}. Check your inbox (and spam).` })
            } catch (err) {
              setTest({ tone: 'error', text: (err as Error).message })
            } finally {
              setBusy(false)
            }
          }}>Send a test email</Button>
        </div>
        {test && <div className="mt-3"><Alert tone={test.tone}>{test.text}</Alert></div>}
      </Card>
      <Card title="Signing">
        <Label>Link for the “Open BoldSign” button</Label>
        <TextInput value={draft.signingUrl} onChange={(ev) => setDraft({ ...draft, signingUrl: ev.target.value })} />
        <p className="mt-1 text-xs text-neutral-500">If you ever switch to another signing service (e.g. OpenSign), change this link.</p>
      </Card>
    </div>
  )
}

function SecurityTab() {
  const [devices, setDevices] = useState<{ id: string; label: string; ip: string | null; created_at: string; last_used_at: string }[]>([])
  const [logins, setLogins] = useState<{ id: number; kind: string; ip: string | null; user_agent: string | null; location: string | null; created_at: string }[]>([])
  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [newPin2, setNewPin2] = useState('')
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [{ data: d }, { data: l }] = await Promise.all([
      supabase.from('trusted_devices').select('*').order('last_used_at', { ascending: false }),
      supabase.from('login_events').select('*').order('created_at', { ascending: false }).limit(40),
    ])
    setDevices(d ?? [])
    setLogins(l ?? [])
  }, [])

  useEffect(() => { void load() }, [load])

  const changePin = async () => {
    if (newPin !== newPin2) return setMsg({ tone: 'error', text: 'The new PINs don’t match.' })
    setBusy(true)
    setMsg(null)
    try {
      await callFn('admin-auth', { action: 'change_pin', oldPin, newPin })
      setMsg({ tone: 'success', text: 'PIN changed. We emailed you a confirmation.' })
      setOldPin(''); setNewPin(''); setNewPin2('')
    } catch (e) {
      setMsg({ tone: 'error', text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const KIND: Record<string, string> = {
    login_success: '✅ Logged in', login_failed: '❌ Wrong PIN', locked: '🔒 Locked after wrong PINs', new_device_code_sent: '📧 New device — code emailed',
    device_trusted: '✅ New device confirmed', device_code_failed: '❌ Wrong device code', pin_set: '🔑 PIN set', pin_reset: '🔑 PIN reset',
    pin_reset_requested: '📧 PIN reset requested', pin_changed: '🔑 PIN changed', change_pin_failed: '❌ Wrong current PIN', logout_everywhere: '🚪 Logged out everywhere',
  }
  const pinInput = (v: string, set: (s: string) => void, label: string) => (
    <div>
      <Label>{label}</Label>
      <TextInput type="password" inputMode="numeric" value={v} onChange={(e) => set(e.target.value.replace(/\D/g, '').slice(0, 12))} />
    </div>
  )

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Change PIN">
        <div className="space-y-3">
          {pinInput(oldPin, setOldPin, 'Current PIN')}
          {pinInput(newPin, setNewPin, 'New PIN (6–12 digits)')}
          {pinInput(newPin2, setNewPin2, 'New PIN again')}
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          <Button onClick={changePin} busy={busy} disabled={oldPin.length < 6 || newPin.length < 6}>Change PIN</Button>
        </div>
      </Card>

      <Card title="Trusted devices" actions={
        <Button size="sm" variant="danger" onClick={async () => {
          if (!confirm('Log out on every device (including this one)?')) return
          await callFn('admin-auth', { action: 'logout_everywhere' })
          await supabase.auth.signOut({ scope: 'local' })
        }}>Log out everywhere</Button>
      }>
        {devices.length === 0 ? <p className="text-sm text-neutral-500">None.</p> : (
          <ul className="divide-y divide-neutral-100 text-sm">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {d.label}
                  <span className="block text-xs text-neutral-500">Last used {istDateTime(d.last_used_at)} · IP {d.ip ?? '—'}</span>
                </span>
                <Button size="sm" variant="ghost" onClick={async () => { await supabase.from('trusted_devices').delete().eq('id', d.id); await load() }}>Remove</Button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-neutral-500">A removed device will need the emailed code again next time.</p>
      </Card>

      <Card title="Recent logins and failed attempts" className="lg:col-span-2">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-neutral-500"><th className="pb-2">When (IST)</th><th className="pb-2">What</th><th className="pb-2">IP</th><th className="pb-2">Device</th></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {logins.map((l) => (
                <tr key={l.id}>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{istDateTime(l.created_at)}</td>
                  <td className="pr-3">{KIND[l.kind] ?? l.kind}</td>
                  <td className="pr-3 text-xs">{l.ip}{l.location ? ` (${l.location})` : ''}</td>
                  <td className="max-w-xs truncate text-xs text-neutral-500" title={l.user_agent ?? ''}>{l.user_agent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
