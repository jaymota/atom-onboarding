// Public actions anyone can call: the intake form, the client quote page and
// the "complete your details" page. Each one only touches the single record
// that its long random link token points to.
import {
  adminDb, adminLink, clientIp, cors, json, loadSettings, logEvent, notifyAdmin, rateLimit,
} from '../_shared/server.ts'
import {
  type Answers, clientDetailsFromAnswers, draftFromIntake, normaliseAnswers, str, validateIntake,
  REQUIRED_MOU_FIELDS, type ClientDetails,
} from '../_shared/engine/intake.ts'
import type { MouInput } from '../_shared/engine/mou.ts'

const OPEN_QUOTE = ['sent', 'changes_requested', 'accepted']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  if (req.method !== 'POST') return json(req, { error: 'Not allowed' }, 405)

  const db = adminDb()
  const ip = clientIp(req)
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch { /* empty */ }
  const action = String(body.action ?? '')
  const token = typeof body.token === 'string' && body.token.length >= 30 ? body.token : ''

  switch (action) {
    // ---------------------------------------------------------------- intake form
    case 'submit_intake': {
      // Honeypot: real people never fill this hidden field.
      if (typeof body.website2 === 'string' && body.website2.trim()) return json(req, { ok: true })
      const started = Number(body.startedAt)
      if (Number.isFinite(started) && Date.now() - started < 4000) return json(req, { ok: true })

      if (!(await rateLimit(db, `intake:${ip}`, 5, 60)) || !(await rateLimit(db, 'intake:all', 60, 24 * 60))) {
        return json(req, { error: 'Too many submissions. Please try again later or email jay@atomconsulting.in.' }, 429)
      }

      const answers = normaliseAnswers((body.answers ?? {}) as Answers)
      const errors = validateIntake(answers)
      if (Object.keys(errors).length) return json(req, { error: 'Please check the highlighted answers.', errors }, 400)

      const settings = await loadSettings(db)
      const details = clientDetailsFromAnswers(answers)
      const { data: client, error } = await db.from('clients').insert({
        status: 'quote_draft',
        source: 'form',
        name: str(answers, 'fullName'),
        email: str(answers, 'email'),
        phone: str(answers, 'phone'),
        brand: str(answers, 'brandName'),
        answers,
        details,
      }).select('id').single()
      if (error || !client) {
        console.error(error)
        return json(req, { error: 'Sorry, something went wrong. Please try again.' }, 500)
      }

      const input = draftFromIntake(answers, settings)
      const { data: quote } = await db.from('quotes').insert({ client_id: client.id, input, status: 'draft' }).select('id').single()
      if (quote) await db.from('quote_versions').insert({ quote_id: quote.id, version: 1, input, reason: 'Auto-drafted from the intake form' })
      await logEvent(db, client.id, 'form_submitted', { ip })

      await notifyAdmin(db, `New enquiry: ${str(answers, 'brandName')} (${str(answers, 'fullName')})`, [
        `${str(answers, 'fullName')}, ${str(answers, 'designation')} at ${str(answers, 'legalName')}`,
        `Email: ${str(answers, 'email')} · Phone: ${str(answers, 'phone')}`,
        `Product: ${answers.variants} × ${str(answers, 'productShort')} (${str(answers, 'category')})`,
        `Engagement: ${str(answers, 'engagement') || '—'} · Budget: ${str(answers, 'budget') || '—'}`,
        `A draft quote has been created (suggested complexity: ${input.complexity}, ${input.complexityReason}).`,
      ], quote ? adminLink(`/quote/${quote.id}`) : adminLink(`/client/${client.id}`))

      return json(req, { ok: true })
    }

    // ---------------------------------------------------------------- client quote page
    case 'get_quote': {
      if (!token) return json(req, { error: 'This link is not valid.' }, 404)
      const { data: q } = await db.from('quotes')
        .select('id, client_id, status, doc, expires_at, first_viewed_at, view_count, accepted_at, accepted_by, client_comment, pdf_path, number, input')
        .eq('share_token', token).maybeSingle()
      if (!q || !OPEN_QUOTE.includes(q.status) || !q.doc) {
        return json(req, { error: 'This link is no longer active. Please contact Atom Consultancy for an updated quote.' }, 404)
      }
      const expired = q.status !== 'accepted' && !!q.expires_at && Date.parse(q.expires_at) < Date.now()

      if (!body.preview) {
        await db.from('quotes').update({
          view_count: (q.view_count ?? 0) + 1,
          first_viewed_at: q.first_viewed_at ?? new Date().toISOString(),
        }).eq('id', q.id)
        if (!q.first_viewed_at) {
          await logEvent(db, q.client_id, 'quote_viewed', { ip })
          const { data: c } = await db.from('clients').select('brand, name').eq('id', q.client_id).single()
          await notifyAdmin(db, `Quote viewed: ${c?.brand ?? ''}`, [`${c?.name ?? 'The client'} opened quote ${q.number}.`], adminLink(`/client/${q.client_id}`))
        }
      }

      let pdfUrl: string | null = null
      if (q.pdf_path) {
        const { data } = await db.storage.from('documents').createSignedUrl(q.pdf_path, 3600, {
          download: `Atom_Quote_${String(q.input?.brand ?? 'Client').replace(/[^A-Za-z0-9]+/g, '_')}.pdf`,
        })
        pdfUrl = data?.signedUrl ?? null
      }
      return json(req, {
        doc: q.doc,
        number: q.number,
        status: q.status,
        expired,
        expiresAt: q.expires_at,
        acceptedAt: q.accepted_at,
        acceptedBy: q.accepted_by,
        comment: q.client_comment,
        pdfUrl,
      })
    }

    case 'respond_quote': {
      if (!token) return json(req, { error: 'This link is not valid.' }, 404)
      if (!(await rateLimit(db, `respond:${ip}`, 10, 60))) return json(req, { error: 'Too many requests.' }, 429)
      const { data: q } = await db.from('quotes').select('*').eq('share_token', token).maybeSingle()
      if (!q || !['sent', 'changes_requested'].includes(q.status)) {
        return json(req, { error: 'This quote can no longer be changed.' }, 400)
      }
      if (q.expires_at && Date.parse(q.expires_at) < Date.now()) {
        return json(req, { error: 'This quote has expired. Please contact us for an updated quote.' }, 400)
      }
      const name = String(body.name ?? '').trim().slice(0, 120)
      const comment = String(body.comment ?? '').trim().slice(0, 4000)
      const { data: client } = await db.from('clients').select('*').eq('id', q.client_id).single()

      if (body.response === 'accept') {
        if (!name) return json(req, { error: 'Please type your full name to accept.' }, 400)
        const now = new Date().toISOString()
        await db.from('quotes').update({ status: 'accepted', accepted_at: now, accepted_by: name, client_comment: comment || null }).eq('id', q.id)

        // Draft the MOU straight away from the accepted quote + client details.
        const settings = await loadSettings(db)
        const mouInput: MouInput = {
          quote: q.input,
          client: { ...clientDetailsFromAnswers({}), ...(client?.details ?? {}) },
          texts: {},
          effectiveDate: null,
          place: settings.company.city || 'Mumbai, Maharashtra',
        }
        const { data: mou } = await db.from('mous').insert({ client_id: q.client_id, quote_id: q.id, input: mouInput }).select('id').single()
        if (mou) await db.from('mou_versions').insert({ mou_id: mou.id, version: 1, input: mouInput, reason: 'Drafted from the accepted quote' })
        await db.from('clients').update({ status: 'mou_draft' }).eq('id', q.client_id)
        await logEvent(db, q.client_id, 'quote_accepted', { name, ip, comment })
        await notifyAdmin(db, `🎉 Quote accepted: ${client?.brand ?? ''}`, [
          `${name} accepted quote ${q.number}.`,
          comment ? `Their note: “${comment}”` : '',
          'A draft MOU is ready for your review.',
        ].filter(Boolean), mou ? adminLink(`/mou/${mou.id}`) : adminLink(`/client/${q.client_id}`))
        return json(req, { ok: true, status: 'accepted' })
      }

      if (body.response === 'changes') {
        if (!comment) return json(req, { error: 'Please tell us what you would like changed.' }, 400)
        await db.from('quotes').update({ status: 'changes_requested', client_comment: comment }).eq('id', q.id)
        await db.from('clients').update({ status: 'changes_requested' }).eq('id', q.client_id)
        await logEvent(db, q.client_id, 'changes_requested', { name, comment, ip })
        await notifyAdmin(db, `Changes requested: ${client?.brand ?? ''}`, [
          `${name || client?.name || 'The client'} asked for changes to quote ${q.number}:`,
          `“${comment}”`,
        ], adminLink(`/quote/${q.id}`))
        return json(req, { ok: true, status: 'changes_requested' })
      }
      return json(req, { error: 'Unknown response.' }, 400)
    }

    // ---------------------------------------------------------------- "complete your details"
    case 'get_details': {
      if (!token) return json(req, { error: 'This link is not valid.' }, 404)
      const { data: m } = await db.from('mous').select('id, client_id, details_token_expires, input').eq('details_token', token).maybeSingle()
      if (!m || (m.details_token_expires && Date.parse(m.details_token_expires) < Date.now())) {
        return json(req, { error: 'This link has expired. Please contact Atom Consultancy.' }, 404)
      }
      const { data: c } = await db.from('clients').select('brand, details').eq('id', m.client_id).single()
      const details = { ...(m.input?.client ?? {}), ...(c?.details ?? {}) } as ClientDetails
      const fields = REQUIRED_MOU_FIELDS.map((f) => ({ key: f.key, label: f.label, value: String(details[f.key] ?? '') }))
      return json(req, { brand: c?.brand, fields })
    }

    case 'submit_details': {
      if (!token) return json(req, { error: 'This link is not valid.' }, 404)
      if (!(await rateLimit(db, `details:${ip}`, 10, 60))) return json(req, { error: 'Too many requests.' }, 429)
      const { data: m } = await db.from('mous').select('*').eq('details_token', token).maybeSingle()
      if (!m || (m.details_token_expires && Date.parse(m.details_token_expires) < Date.now())) {
        return json(req, { error: 'This link has expired.' }, 404)
      }
      const incoming = (body.details ?? {}) as Record<string, unknown>
      const clean: Partial<ClientDetails> = {}
      for (const f of REQUIRED_MOU_FIELDS) {
        const v = incoming[f.key]
        if (typeof v === 'string' && v.trim()) (clean as Record<string, string>)[f.key] = v.trim().slice(0, 500)
      }
      const { data: c } = await db.from('clients').select('details, brand').eq('id', m.client_id).single()
      const details = { ...(c?.details ?? {}), ...clean }
      await db.from('clients').update({ details }).eq('id', m.client_id)
      const input = { ...m.input, client: { ...(m.input?.client ?? {}), ...clean } }
      await db.from('mous').update({ input, details_token: null }).eq('id', m.id)
      await logEvent(db, m.client_id, 'details_completed', { fields: Object.keys(clean) })
      await notifyAdmin(db, `Details completed: ${c?.brand ?? ''}`, ['The client filled in their missing details for the MOU.'], adminLink(`/mou/${m.id}`))
      return json(req, { ok: true })
    }

    default:
      return json(req, { error: 'Unknown action' }, 400)
  }
})
