import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { buildMouDoc, type MouInput } from '../../supabase/functions/_shared/engine/mou.ts'
import { EMPTY_CLIENT, REQUIRED_MOU_FIELDS, type ClientDetails } from '../../supabase/functions/_shared/engine/intake.ts'
import { supabase, callFn } from '../lib/supabase'
import { MOU_STATUS_LABEL, istDateTime } from '../lib/status'
import { downloadBlob, mouPdfBlob, safeName } from '../pdf/generate'
import { MouPreview } from '../components/MouPreview'
import { Alert, Badge, Button, Card, Label, Modal, PageSpinner, TextInput } from '../components/ui'
import { useSettings } from './AdminLayout'

interface MouRow {
  id: string
  client_id: string
  quote_id: string | null
  status: string
  version: number
  input: MouInput
  approved_at: string | null
  sent_at: string | null
  signed_at: string | null
  pdf_path: string | null
  signed_pdf_path: string | null
}

export default function MouEditor() {
  const { id = '' } = useParams()
  const { settings } = useSettings()
  const [mou, setMou] = useState<MouRow | null>(null)
  const [input, setInput] = useState<MouInput | null>(null)
  const [clientEmail, setClientEmail] = useState('')
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'error' | 'success' | 'info'; text: string } | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsTo, setDetailsTo] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const lastSaved = useRef('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('mous').select('*').eq('id', id).single()
    if (!data) return
    const row = data as MouRow
    row.input = { ...row.input, client: { ...EMPTY_CLIENT, ...(row.input.client ?? {}) } }
    setMou(row)
    setInput(row.input)
    lastSaved.current = JSON.stringify(row.input)
    const { data: c } = await supabase.from('clients').select('email, details').eq('id', row.client_id).single()
    setClientEmail(String(c?.details?.signatoryEmail || c?.email || ''))
  }, [id])

  useEffect(() => { void load() }, [load])

  // Autosave
  useEffect(() => {
    if (!input || !mou) return
    const json = JSON.stringify(input)
    if (json === lastSaved.current) return
    setSaveState('unsaved')
    const t = setTimeout(async () => {
      setSaveState('saving')
      const patch: Record<string, unknown> = { input }
      if (mou.status === 'approved') patch.status = 'draft'
      await supabase.from('mous').update(patch).eq('id', mou.id)
      // Keep the client's record up to date too.
      await supabase.from('clients').update({ details: input.client }).eq('id', mou.client_id)
      lastSaved.current = json
      if (patch.status) setMou((m) => (m ? { ...m, status: 'draft' } : m))
      setSaveState('saved')
    }, 900)
    return () => clearTimeout(t)
  }, [input, mou])

  const doc = useMemo(() => (input ? buildMouDoc(input, settings) : null), [input, settings])

  if (!mou || !input || !doc) return <PageSpinner />

  const locked = ['sent_for_signature', 'signed_by_client', 'signed'].includes(mou.status)
  const setClient = (patch: Partial<ClientDetails>) => setInput((i) => (i ? { ...i, client: { ...i.client, ...patch } } : i))
  const setText = (k: string, v: string) => setInput((i) => (i ? { ...i, texts: { ...i.texts, [k]: v } } : i))
  const resetText = (k: string) =>
    setInput((i) => {
      if (!i) return i
      const texts = { ...i.texts }
      delete texts[k]
      return { ...i, texts }
    })

  const fileName = `Atom_MOU_${safeName(input.client.brandName || input.client.legalName || input.quote.brand)}.pdf`

  const approve = async () => {
    if (doc.missing.length) return setMessage({ tone: 'error', text: `Please fill in: ${doc.missing.join(', ')}.` })
    setBusy('approve')
    setMessage(null)
    try {
      const version = mou.version + (mou.approved_at ? 1 : 0)
      const blob = await mouPdfBlob(doc, settings.company)
      const path = `mous/${mou.id}/v${version}.pdf`
      const { error } = await supabase.storage.from('documents').upload(path, blob, { contentType: 'application/pdf', upsert: true })
      if (error) throw error
      await supabase.from('mou_versions').upsert({ mou_id: mou.id, version, input, reason: 'Approved' }, { onConflict: 'mou_id,version' })
      await supabase.from('mous').update({ status: 'approved', approved_at: new Date().toISOString(), pdf_path: path, version }).eq('id', mou.id)
      await supabase.from('events').insert({ client_id: mou.client_id, kind: 'mou_approved', detail: { version } })
      setMessage({ tone: 'success', text: 'MOU approved. Now download it and send it for signature (step 3).' })
      await load()
    } catch (e) {
      setMessage({ tone: 'error', text: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  const download = async () => {
    setBusy('download')
    try {
      if (mou.status !== 'draft' && mou.pdf_path) {
        const { data } = await supabase.storage.from('documents').download(mou.pdf_path)
        if (data) return downloadBlob(data, fileName)
      }
      downloadBlob(await mouPdfBlob(doc, settings.company), fileName)
    } finally {
      setBusy(null)
    }
  }

  const markSent = async () => {
    await supabase.from('mous').update({ status: 'sent_for_signature', sent_at: new Date().toISOString() }).eq('id', mou.id)
    await supabase.from('clients').update({ status: 'mou_sent' }).eq('id', mou.client_id)
    await supabase.from('events').insert({ client_id: mou.client_id, kind: 'mou_sent', detail: { via: 'BoldSign' } })
    await load()
  }

  const markClientSigned = async () => {
    await supabase.from('mous').update({ status: 'signed_by_client' }).eq('id', mou.id)
    await supabase.from('clients').update({ status: 'signed_by_client' }).eq('id', mou.client_id)
    await load()
  }

  const uploadSigned = async (file: File) => {
    setBusy('upload')
    try {
      const path = `mous/${mou.id}/signed-${Date.now()}.pdf`
      const { error } = await supabase.storage.from('documents').upload(path, file, { contentType: 'application/pdf' })
      if (error) throw error
      await supabase.from('mous').update({ status: 'signed', signed_pdf_path: path, signed_at: new Date().toISOString() }).eq('id', mou.id)
      await supabase.from('clients').update({ status: 'fully_signed' }).eq('id', mou.client_id)
      await supabase.from('events').insert({ client_id: mou.client_id, kind: 'mou_signed', detail: {} })
      setMessage({ tone: 'success', text: 'Signed MOU saved. 🎉 The client is now “Fully signed”.' })
      await load()
    } catch (e) {
      setMessage({ tone: 'error', text: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  const downloadSigned = async () => {
    if (!mou.signed_pdf_path) return
    const { data } = await supabase.storage.from('documents').download(mou.signed_pdf_path)
    if (data) downloadBlob(data, fileName.replace('.pdf', '_SIGNED.pdf'))
  }

  const sendDetailsLink = async () => {
    setBusy('details')
    try {
      await callFn('admin-actions', { action: 'send_details_link', mouId: mou.id, to: detailsTo })
      setDetailsOpen(false)
      setMessage({ tone: 'success', text: `We emailed ${detailsTo} a link to complete their details. You'll get an email when they do.` })
    } catch (e) {
      setMessage({ tone: 'error', text: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  const step = (n: number, title: string, done: boolean) => (
    <span className="flex items-center gap-2">
      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-emerald-500 text-white' : 'bg-neutral-200'}`}>{done ? '✓' : n}</span>
      {title}
    </span>
  )

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link to={`/admin/client/${mou.client_id}`} className="text-sm text-neutral-500 hover:text-atom-teal">← {input.client.brandName || input.quote.brand || 'Client'}</Link>
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold">
            MOU
            <Badge>{MOU_STATUS_LABEL[mou.status] ?? mou.status}</Badge>
            <span className="text-xs font-normal text-neutral-400">{saveState === 'saving' ? 'Saving…' : saveState === 'unsaved' ? 'Unsaved changes' : 'All changes saved'}</span>
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {mou.quote_id && <Link to={`/admin/quote/${mou.quote_id}`} className="rounded-md px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100">View accepted quote</Link>}
          <Button variant="secondary" onClick={download} busy={busy === 'download'}>Download PDF</Button>
        </div>
      </div>

      {message && <div className="mb-4"><Alert tone={message.tone}>{message.text}</Alert></div>}

      <div className="grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card title={step(1, 'Check the client details', doc.missing.length === 0)}>
            {doc.missing.length > 0 && (
              <div className="mb-3 space-y-2">
                <Alert tone="warn">Missing: {doc.missing.join(', ')}. Fill them in below, or ask the client.</Alert>
                <Button size="sm" variant="secondary" onClick={() => { setDetailsTo(clientEmail); setDetailsOpen(true) }}>Email the client a “complete your details” link</Button>
              </div>
            )}
            <fieldset disabled={locked} className="space-y-3">
              {REQUIRED_MOU_FIELDS.map((f) => (
                <div key={f.key}>
                  <Label>{f.label}</Label>
                  <TextInput
                    value={String(input.client[f.key] ?? '')}
                    onChange={(e) => setClient({ [f.key]: e.target.value })}
                    className={!String(input.client[f.key] ?? '').trim() ? 'border-amber-400 bg-amber-50' : ''}
                  />
                </div>
              ))}
              <div>
                <Label>FSSAI (optional)</Label>
                <TextInput value={input.client.fssai} onChange={(e) => setClient({ fssai: e.target.value })} />
              </div>
              <div>
                <Label>Product for the Background clause</Label>
                <TextInput value={input.client.productShort} onChange={(e) => setClient({ productShort: e.target.value })} />
              </div>
              <div>
                <Label>Place</Label>
                <TextInput value={input.place} onChange={(e) => setInput({ ...input, place: e.target.value })} />
              </div>
            </fieldset>
          </Card>

          <Card title={step(2, 'Review and approve', !!mou.approved_at && mou.status !== 'draft')}>
            {doc.hasNewClauses && (
              <div className="mb-3">
                <Alert tone="warn">
                  This is a <b>milestone</b> MOU. Your Master MOU was written for a retainer, so the Fees, Termination, Invoicing and Clause G wording is new.
                  It's tagged <b>“NEW: please have your lawyer review”</b> in the preview (only you see the tags).
                </Alert>
              </div>
            )}
            <p className="mb-3 text-sm text-neutral-600">Click any text in the MOU to edit it. The Effective Date is left as “the date of the last signature”, so it is set automatically when both of you have signed.</p>
            {mou.status === 'draft' ? (
              <Button onClick={approve} busy={busy === 'approve'} className="w-full">Approve MOU</Button>
            ) : (
              <p className="text-sm text-emerald-700">Approved {istDateTime(mou.approved_at)}{locked ? '' : ' — editing will un-approve it.'}</p>
            )}
          </Card>

          <Card title={step(3, 'Sign with BoldSign (free)', mou.status === 'signed')}>
            {mou.status === 'draft' ? (
              <p className="text-sm text-neutral-500">Approve the MOU first.</p>
            ) : (
              <div className="space-y-3 text-sm">
                <ol className="list-decimal space-y-1 pl-5 text-neutral-700">
                  <li><button className="text-atom-teal underline" onClick={download}>Download the final MOU PDF</button>.</li>
                  <li>Open BoldSign → <b>Send document</b> → upload the PDF.</li>
                  <li>Add signers: <b>{input.client.signatoryName || 'client signatory'}</b> ({input.client.signatoryEmail || 'email'}) first, then <b>you</b>.</li>
                  <li>Drag a <b>Signature</b> and a <b>Date signed</b> field onto each signature box on the last page → <b>Send</b>.</li>
                </ol>
                <a href={settings.signingUrl} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center rounded-md bg-atom-ink px-4 py-2 font-medium text-white hover:bg-neutral-800">
                  Open BoldSign ↗
                </a>
                {mou.status === 'approved' && <Button variant="secondary" className="w-full" onClick={markSent}>I've sent it for signature</Button>}
                {mou.status === 'sent_for_signature' && (
                  <>
                    <p className="text-xs text-neutral-500">Sent {istDateTime(mou.sent_at)}.</p>
                    <Button variant="secondary" className="w-full" onClick={markClientSigned}>The client has signed</Button>
                  </>
                )}
                {['sent_for_signature', 'signed_by_client'].includes(mou.status) && (
                  <>
                    <p className="text-xs text-neutral-600">When both have signed, BoldSign emails you the completed PDF (with its audit trail). Upload it here to keep it with the client:</p>
                    <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && uploadSigned(e.target.files[0])} />
                    <Button className="w-full" onClick={() => fileRef.current?.click()} busy={busy === 'upload'}>Upload the signed PDF</Button>
                  </>
                )}
                {mou.status === 'signed' && (
                  <>
                    <Alert tone="success">Fully signed {istDateTime(mou.signed_at)}.</Alert>
                    <Button variant="secondary" className="w-full" onClick={downloadSigned}>Download signed MOU</Button>
                  </>
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="min-w-0">
          <MouPreview
            doc={doc}
            company={settings.company}
            admin
            editing={locked ? undefined : {
              onText: setText,
              onReset: resetText,
              isEdited: (k) => k in input.texts,
            }}
          />
          {Object.keys(input.texts).length > 0 && !locked && (
            <p className="mt-2 text-xs text-neutral-500">
              You've edited {Object.keys(input.texts).length} clause(s).{' '}
              <button className="underline" onClick={() => setInput({ ...input, texts: {} })}>Reset all to template wording</button>
            </p>
          )}
        </div>
      </div>

      <Modal open={detailsOpen} onClose={() => setDetailsOpen(false)} title="Ask the client to complete their details">
        <p className="text-sm text-neutral-600">We'll email a private link where they can enter: {REQUIRED_MOU_FIELDS.map((f) => f.label).join(', ')}.</p>
        <div className="mt-4">
          <Label>Send to</Label>
          <TextInput value={detailsTo} onChange={(e) => setDetailsTo(e.target.value)} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDetailsOpen(false)}>Cancel</Button>
          <Button onClick={sendDetailsLink} busy={busy === 'details'} disabled={!detailsTo.trim()}>Send link</Button>
        </div>
      </Modal>
    </div>
  )
}
