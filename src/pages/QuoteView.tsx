import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { QuoteDoc } from '../../supabase/functions/_shared/engine/quote.ts'
import { DEFAULT_SETTINGS } from '../../supabase/functions/_shared/engine/settings.ts'
import { callFn } from '../lib/supabase'
import { istDate, istDateTime } from '../lib/status'
import { QuotePreview } from '../components/QuotePreview'
import { Alert, Button, Label, Modal, PageSpinner, TextArea, TextInput } from '../components/ui'
import { PublicShell } from './PublicShell'

interface QuoteResponse {
  doc: QuoteDoc & { company?: typeof DEFAULT_SETTINGS.company }
  number: string
  status: string
  expired: boolean
  expiresAt: string | null
  acceptedAt: string | null
  acceptedBy: string | null
  comment: string | null
  pdfUrl: string | null
}

export default function QuoteView() {
  const { token = '' } = useParams()
  const [data, setData] = useState<QuoteResponse | null>(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'accept' | 'changes' | null>(null)
  const [name, setName] = useState('')
  const [comment, setComment] = useState('')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [detailsToken, setDetailsToken] = useState<string | null>(null)

  const load = () =>
    callFn<QuoteResponse>('public', { action: 'get_quote', token })
      .then(setData)
      .catch((e) => setError(e.message))

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const respond = async () => {
    setBusy(true)
    setFormError('')
    try {
      const r = await callFn<{ detailsToken?: string | null }>('public', { action: 'respond_quote', token, response: mode === 'accept' ? 'accept' : 'changes', name, comment })
      if (r.detailsToken) setDetailsToken(r.detailsToken)
      setMode(null)
      await callFn<QuoteResponse>('public', { action: 'get_quote', token, preview: true }).then(setData)
    } catch (e) {
      setFormError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-lg py-20 text-center">
          <h1 className="text-xl font-semibold">This link isn't available</h1>
          <p className="mt-3 text-neutral-600">{error}</p>
          <p className="mt-6 text-sm">Email <a className="text-atom-teal underline" href="mailto:jay@atomconsulting.in">jay@atomconsulting.in</a></p>
        </div>
      </PublicShell>
    )
  }
  if (!data) return <PublicShell><PageSpinner /></PublicShell>

  const company = { ...DEFAULT_SETTINGS.company, ...(data.doc.company ?? {}) }
  const canRespond = !data.expired && ['sent', 'changes_requested'].includes(data.status)

  return (
    <PublicShell>
      <div className="mx-auto max-w-4xl py-6 sm:py-10">
        <div className="mb-5 flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-atom-teal">Your quotation</p>
            <h1 className="font-semibold">{data.number}</h1>
            {data.expiresAt && data.status !== 'accepted' && (
              <p className="text-xs text-neutral-500">Valid until {istDate(data.expiresAt)}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {data.pdfUrl && (
              <a href={data.pdfUrl} className="inline-flex items-center rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:border-atom-ink">
                ⬇ Download PDF
              </a>
            )}
            {canRespond && (
              <>
                <Button variant="secondary" onClick={() => { setMode('changes'); setFormError('') }}>Request changes</Button>
                <Button onClick={() => { setMode('accept'); setFormError('') }}>Accept quote</Button>
              </>
            )}
          </div>
        </div>

        {data.status === 'accepted' && (
          detailsToken ? (
            <div className="mb-5 rounded-lg border border-atom-teal/30 bg-atom-aqua/40 p-5">
              <p className="font-semibold">✓ Thank you, quote accepted!</p>
              <p className="mt-1 text-sm text-neutral-700">
                Next step: add your company &amp; billing details so we can prepare your agreement (MOU) and invoices. It takes about 3 minutes.
                We've also emailed you this link.
              </p>
              <a href={`#/details/${detailsToken}`} className="mt-3 inline-flex rounded-md bg-atom-teal px-5 py-2.5 font-medium text-white hover:bg-atom-teal/90">
                Add company details →
              </a>
            </div>
          ) : (
            <div className="mb-5"><Alert tone="success">✓ Accepted by {data.acceptedBy} on {istDateTime(data.acceptedAt)}. Thank you! We'll be in touch about your agreement (MOU).</Alert></div>
          )
        )}
        {data.status === 'changes_requested' && (
          <div className="mb-5"><Alert tone="warn">You asked for changes: “{data.comment}”. We'll send an updated quote soon. You can still accept this version if you prefer.</Alert></div>
        )}
        {data.expired && (
          <div className="mb-5"><Alert tone="error">This quotation has expired. Please contact us for an updated one.</Alert></div>
        )}

        <div className="overflow-x-auto">
          <QuotePreview doc={data.doc} company={company} />
        </div>

        {canRespond && (
          <div className="sticky bottom-0 mt-6 flex justify-center gap-2 border-t border-neutral-200 bg-neutral-50/95 py-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent">
            <Button variant="secondary" onClick={() => setMode('changes')}>Request changes</Button>
            <Button size="lg" onClick={() => setMode('accept')}>Accept quote</Button>
          </div>
        )}
      </div>

      <Modal open={mode === 'accept'} onClose={() => setMode(null)} title="Accept this quotation">
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            By accepting, you approve the scope of work and fees in quotation {data.number}. We'll then prepare the agreement (MOU) for signature.
          </p>
          <div>
            <Label required>Your full name</Label>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div>
            <Label>Anything to add? (optional)</Label>
            <TextArea value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 accent-atom-teal" />
            I confirm I am authorised to accept this quotation on behalf of my company.
          </label>
          {formError && <Alert tone="error">{formError}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
            <Button onClick={respond} busy={busy} disabled={!name.trim() || !agree}>Accept quote</Button>
          </div>
        </div>
      </Modal>

      <Modal open={mode === 'changes'} onClose={() => setMode(null)} title="Request changes">
        <div className="space-y-4">
          <div>
            <Label>Your name</Label>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label required>What would you like changed?</Label>
            <TextArea rows={5} value={comment} onChange={(e) => setComment(e.target.value)} autoFocus />
          </div>
          {formError && <Alert tone="error">{formError}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
            <Button onClick={respond} busy={busy} disabled={!comment.trim()}>Send request</Button>
          </div>
        </div>
      </Modal>
    </PublicShell>
  )
}
