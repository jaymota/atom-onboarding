// Admin-only actions that need the server (sending email with attachments).
import {
  SITE_URL, adminDb, cors, emailLayout, escapeHtml, json, loadSettings, logEvent, randomToken,
  requireAdmin, sendEmail,
} from '../_shared/server.ts'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

function paragraphs(text: string): string {
  return text.split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  if (req.method !== 'POST') return json(req, { error: 'Not allowed' }, 405)
  const uid = await requireAdmin(req)
  if (!uid) return json(req, { error: 'Please log in again.' }, 401)

  const db = adminDb()
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const settings = await loadSettings(db)
  const recipients = (v: unknown) =>
    (Array.isArray(v) ? v : String(v ?? '').split(/[,;\s]+/)).map((x) => String(x).trim()).filter((x) => EMAIL_RE.test(x)).slice(0, 10)

  switch (body.action) {
    case 'send_quote': {
      const { data: q } = await db.from('quotes').select('*').eq('id', body.quoteId).maybeSingle()
      if (!q) return json(req, { error: 'Quote not found.' }, 404)
      if (!['approved', 'sent'].includes(q.status) || !q.doc) return json(req, { error: 'Please approve the quote before sharing it.' }, 400)
      if (!q.pdf_path) return json(req, { error: 'The PDF has not been saved yet.' }, 400)
      const to = recipients(body.to)
      if (!to.length) return json(req, { error: 'Please enter at least one valid email address.' }, 400)

      const { data: file, error: dlErr } = await db.storage.from('documents').download(q.pdf_path)
      if (dlErr || !file) return json(req, { error: 'Could not read the PDF.' }, 500)
      const pdf = new Uint8Array(await file.arrayBuffer())

      const token = q.share_token ?? randomToken(32)
      const validity = Number(q.input?.validityDays) || settings.validityDays
      const expires = new Date(Date.now() + validity * 86400_000).toISOString()
      const link = `${SITE_URL}/#/q/${token}`
      const brand = String(q.input?.brand ?? 'Client').replace(/[^A-Za-z0-9]+/g, '_')
      const date = String(q.input?.date ?? '').split('-').reverse().join('-')

      const sent = await sendEmail(settings, {
        to,
        cc: recipients(body.cc),
        subject: String(body.subject ?? 'Your quotation from Atom Consultancy').slice(0, 200),
        html: emailLayout(
          String(body.subject ?? 'Your quotation'),
          paragraphs(String(body.message ?? '')),
          { label: 'View & accept your quote online', url: link },
        ),
        attachments: [{ filename: `Atom_Quote_${brand}_${date}.pdf`, content: toBase64(pdf) }],
      })
      if (!sent.ok) return json(req, { error: sent.error }, 502)

      await db.from('quotes').update({
        status: 'sent', share_token: token, expires_at: expires, sent_at: new Date().toISOString(),
      }).eq('id', q.id)
      await db.from('clients').update({ status: 'quote_sent' }).eq('id', q.client_id)
      await logEvent(db, q.client_id, 'quote_sent', { to, number: q.number })
      return json(req, { ok: true, link })
    }

    case 'share_link': {
      // Creates the client link without emailing (for Copy link / WhatsApp).
      const { data: q } = await db.from('quotes').select('*').eq('id', body.quoteId).maybeSingle()
      if (!q) return json(req, { error: 'Quote not found.' }, 404)
      if (!['approved', 'sent'].includes(q.status) || !q.doc) return json(req, { error: 'Please approve the quote first.' }, 400)
      const token = q.share_token ?? randomToken(32)
      const validity = Number(q.input?.validityDays) || settings.validityDays
      const patch: Record<string, unknown> = { share_token: token }
      if (q.status === 'approved') {
        Object.assign(patch, { status: 'sent', sent_at: new Date().toISOString(), expires_at: new Date(Date.now() + validity * 86400_000).toISOString() })
        await db.from('clients').update({ status: 'quote_sent' }).eq('id', q.client_id)
        await logEvent(db, q.client_id, 'quote_link_shared', { number: q.number })
      }
      await db.from('quotes').update(patch).eq('id', q.id)
      return json(req, { ok: true, link: `${SITE_URL}/#/q/${token}` })
    }

    case 'send_details_link': {
      const { data: m } = await db.from('mous').select('id, client_id').eq('id', body.mouId).maybeSingle()
      if (!m) return json(req, { error: 'MOU not found.' }, 404)
      const to = recipients(body.to)
      if (!to.length) return json(req, { error: 'Please enter a valid email address.' }, 400)
      const token = randomToken(32)
      await db.from('mous').update({ details_token: token, details_token_expires: new Date(Date.now() + 14 * 86400_000).toISOString() }).eq('id', m.id)
      const link = `${SITE_URL}/#/details/${token}`
      const sent = await sendEmail(settings, {
        to,
        subject: 'Atom Consultancy: please complete your company details',
        html: emailLayout('A few details for your agreement', paragraphs(
          'Thank you for accepting our quotation. To prepare your agreement (MOU), we need a few company details.\n\nPlease enter them exactly as they appear on your registration documents.',
        ), { label: 'Complete your details', url: link }),
      })
      if (!sent.ok) return json(req, { error: sent.error }, 502)
      await logEvent(db, m.client_id, 'details_link_sent', { to })
      return json(req, { ok: true, link })
    }

    case 'test_email': {
      const sent = await sendEmail(settings, {
        to: [settings.email.notifyTo],
        subject: 'Test email from your onboarding platform',
        html: emailLayout('It works! 🎉', '<p>Emails from onboarding.atomconsulting.in are being delivered.</p>'),
      })
      return json(req, sent, sent.ok ? 200 : 502)
    }

    default:
      return json(req, { error: 'Unknown action' }, 400)
  }
})
