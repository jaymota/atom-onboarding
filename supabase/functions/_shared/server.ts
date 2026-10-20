// Helpers shared by the Edge Functions (server side only).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { mergeSettings, type Settings } from './engine/settings.ts'

export const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
export const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://onboarding.atomconsulting.in'
export const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') ?? 'jay@atomconsulting.in'

const ALLOWED_ORIGINS = [
  'https://onboarding.atomconsulting.in',
  'http://onboarding.atomconsulting.in',
  'http://localhost:5173',
  'http://localhost:5174',
]

export function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), 'Content-Type': 'application/json' },
  })
}

/** Full-access database client. Never expose this key to the browser. */
export function adminDb(): SupabaseClient {
  return createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Normal (anon) client — used to sign the admin in after the PIN check. */
export function anonDb(): SupabaseClient {
  return createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') ?? ''
  return (fwd.split(',')[0] || req.headers.get('x-real-ip') || 'unknown').trim().slice(0, 64)
}

export function roughLocation(req: Request): string {
  const country = req.headers.get('cf-ipcountry') ?? req.headers.get('x-country') ?? ''
  const city = req.headers.get('cf-ipcity') ?? ''
  return [city, country].filter(Boolean).join(', ')
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function randomToken(bytes = 32): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes))
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function randomCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000
  return String(n).padStart(6, '0')
}

export async function loadSettings(db: SupabaseClient): Promise<Settings> {
  const { data } = await db.from('settings').select('data').eq('id', 1).maybeSingle()
  return mergeSettings(data?.data)
}

/** Returns true if the bucket has fewer than `max` hits in the window (and records this hit). */
export async function rateLimit(db: SupabaseClient, bucket: string, max: number, windowMinutes: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString()
  const { count } = await db.from('rate_hits').select('id', { count: 'exact', head: true })
    .eq('bucket', bucket).gte('created_at', since)
  if ((count ?? 0) >= max) return false
  await db.from('rate_hits').insert({ bucket })
  return true
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

/** Branded email wrapper. `bodyHtml` must already be escaped. */
export function emailLayout(title: string, bodyHtml: string, button?: { label: string; url: string }): string {
  const btn = button
    ? `<p style="margin:28px 0"><a href="${button.url}" style="background:#1F8A84;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600;display:inline-block">${escapeHtml(button.label)}</a></p>`
    : ''
  return `<!doctype html><html><body style="margin:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#111">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f6;padding:24px 0"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:8px;overflow:hidden">
<tr><td style="height:5px;background:linear-gradient(90deg,#1F8A84,#5F6F4B)"></td></tr>
<tr><td style="padding:28px 32px 8px"><img src="${SITE_URL}/atom-logo.png" alt="Atom Consultancy" width="140" style="display:block"></td></tr>
<tr><td style="padding:8px 32px 28px;font-size:15px;line-height:1.6">
<h2 style="font-size:19px;margin:12px 0 16px">${escapeHtml(title)}</h2>${bodyHtml}${btn}
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #eee;font-size:12px;color:#777">Atom Consultancy · Food. Science. Strategy. · Mumbai</td></tr>
</table></td></tr></table></body></html>`
}

export interface EmailAttachment {
  filename: string
  content: string // base64
}

export async function sendEmail(
  settings: Settings,
  msg: { to: string[]; subject: string; html: string; replyTo?: string; cc?: string[]; attachments?: EmailAttachment[] },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) {
    console.warn('RESEND_API_KEY not set — email not sent:', msg.subject)
    return { ok: false, error: 'Email is not set up yet (missing Resend key).' }
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${settings.email.fromName} <${settings.email.fromAddress}>`,
      to: msg.to,
      cc: msg.cc?.length ? msg.cc : undefined,
      reply_to: msg.replyTo ?? settings.email.replyTo,
      subject: msg.subject,
      html: msg.html,
      attachments: msg.attachments,
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error('Resend error', res.status, body)
    return { ok: false, error: body?.message ?? `Email failed (${res.status})` }
  }
  return { ok: true, id: body?.id }
}

/** Email Jay about something a client did. Never throws. */
export async function notifyAdmin(db: SupabaseClient, subject: string, lines: string[], link?: string) {
  try {
    const settings = await loadSettings(db)
    const body = lines.map((l) => `<p style="margin:0 0 8px">${escapeHtml(l)}</p>`).join('')
    await sendEmail(settings, {
      to: [settings.email.notifyTo || ADMIN_EMAIL],
      subject,
      html: emailLayout(subject, body, link ? { label: 'Open in dashboard', url: link } : undefined),
    })
  } catch (e) {
    console.error('notifyAdmin failed', e)
  }
}

export async function logEvent(db: SupabaseClient, clientId: string | null, kind: string, detail: Record<string, unknown> = {}) {
  await db.from('events').insert({ client_id: clientId, kind, detail })
}

/** Checks the caller's login token belongs to an admin. Returns the user id. */
export async function requireAdmin(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization') ?? ''
  const jwt = auth.replace(/^Bearer\s+/i, '')
  if (!jwt) return null
  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await userClient.rpc('is_admin')
  if (error || data !== true) return null
  const { data: u } = await userClient.auth.getUser(jwt)
  return u.user?.id ?? null
}

export function adminLink(path: string): string {
  return `${SITE_URL}/#/admin${path}`
}
