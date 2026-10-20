// PIN login for the admin area. The PIN is only ever checked here, on the server.
//
// Actions: status, request_setup_code, setup_pin, login, verify_device,
//          request_reset_code, reset_pin, change_pin, logout_everywhere
import bcrypt from 'npm:bcryptjs@2.4.3'
import {
  ADMIN_EMAIL, adminDb, anonDb, clientIp, cors, emailLayout, escapeHtml, json, loadSettings,
  randomCode, rateLimit, requireAdmin, roughLocation, sendEmail, sha256,
} from '../_shared/server.ts'

const MAX_TRIES = 5
const BASE_LOCK_MINUTES = 15
const CODE_MINUTES = 15

const WEAK_PINS = new Set([
  '123456', '654321', '123123', '112233', '121212', '123321', '696969', '159753', '147258', '100200',
  '987654', '012345', '1234567', '12345678', '123456789', '11223344', '22446688', '13579246',
])

export function pinProblem(pin: unknown): string | null {
  if (typeof pin !== 'string' || !/^\d{6,12}$/.test(pin)) return 'Your PIN must be 6 to 12 digits.'
  if (/^(\d)\1+$/.test(pin)) return 'Please don’t use the same digit repeated.'
  const digits = pin.split('').map(Number)
  const asc = digits.every((d, i) => i === 0 || d === (digits[i - 1] + 1) % 10)
  const desc = digits.every((d, i) => i === 0 || d === (digits[i - 1] + 9) % 10)
  if (asc || desc) return 'Please don’t use a sequence like 123456.'
  if (WEAK_PINS.has(pin)) return 'That PIN is too easy to guess. Please choose another.'
  return null
}

function lockMinutes(level: number) {
  return Math.min(BASE_LOCK_MINUTES * 2 ** Math.max(0, level - 1), 24 * 60)
}

function deviceLabel(ua: string): string {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  const os = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'device'
  return `${browser} on ${os}`
}

function istNow() {
  return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  if (req.method !== 'POST') return json(req, { error: 'Not allowed' }, 405)

  const db = adminDb()
  const ip = clientIp(req)
  const ua = (req.headers.get('user-agent') ?? '').slice(0, 300)
  const location = roughLocation(req)
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch { /* empty body */ }
  const action = String(body.action ?? '')
  const deviceId = typeof body.deviceId === 'string' && body.deviceId.length >= 32 ? body.deviceId : ''

  const { data: admin } = await db.from('admins').select('user_id, email').eq('email', ADMIN_EMAIL).maybeSingle()
  if (!admin) return json(req, { error: 'Admin account is not set up.' }, 500)
  const userId = admin.user_id as string

  const getSec = async () => {
    const { data } = await db.from('admin_security').select('*').eq('user_id', userId).maybeSingle()
    return data as { pin_hash: string | null; failed_count: number; lock_level: number; locked_until: string | null } | null
  }

  const logLogin = (kind: string) =>
    db.from('login_events').insert({ kind, ip, user_agent: ua, location: location || null })

  const settings = await loadSettings(db)

  const emailAdmin = (subject: string, html: string) =>
    sendEmail(settings, { to: [ADMIN_EMAIL], subject, html: emailLayout(subject, html) })

  /** Sign the admin in and return a session for the browser. */
  const issueSession = async () => {
    const { data, error } = await anonDb().auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: Deno.env.get('ADMIN_AUTH_PASSWORD')!,
    })
    if (error || !data.session) {
      console.error('signIn failed', error)
      return json(req, { error: 'Could not start your session. Please try again.' }, 500)
    }
    await logLogin('login_success')
    return json(req, {
      ok: true,
      session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token },
    })
  }

  const trustDevice = async () => {
    const device_hash = await sha256(deviceId)
    await db.from('trusted_devices').upsert(
      { user_id: userId, device_hash, label: deviceLabel(ua), ip, last_used_at: new Date().toISOString() },
      { onConflict: 'device_hash' },
    )
  }

  const sendCode = async (purpose: 'device' | 'setup' | 'reset') => {
    if (!deviceId) return { ok: false, error: 'Missing device.' }
    if (!(await rateLimit(db, `code:${purpose}`, 5, 60))) {
      return { ok: false, error: 'Too many codes requested. Please wait an hour.' }
    }
    const code = randomCode()
    await db.from('auth_codes').insert({
      purpose,
      code_hash: await sha256(`${purpose}:${code}`),
      device_hash: await sha256(deviceId),
      expires_at: new Date(Date.now() + CODE_MINUTES * 60_000).toISOString(),
      ip,
    })
    const what = {
      device: 'Someone (hopefully you) entered the correct PIN on a new browser or device.',
      setup: 'Use this code to set your admin PIN.',
      reset: 'Use this code to reset your admin PIN.',
    }[purpose]
    const sent = await emailAdmin(
      `Your Atom admin code: ${code}`,
      `<p>${escapeHtml(what)}</p>
       <p style="font-size:28px;letter-spacing:6px;font-weight:700;margin:18px 0">${code}</p>
       <p style="color:#555">Device: ${escapeHtml(deviceLabel(ua))}<br>IP: ${escapeHtml(ip)}${location ? ` (${escapeHtml(location)})` : ''}<br>Time: ${escapeHtml(istNow())} IST</p>
       <p style="color:#555">The code expires in ${CODE_MINUTES} minutes. If this wasn’t you, ignore this email and consider changing your PIN.</p>`,
    )
    return sent.ok ? { ok: true } : { ok: false, error: sent.error }
  }

  /** Checks a 6-digit code for this device. */
  const checkCode = async (purpose: 'device' | 'setup' | 'reset', code: unknown) => {
    if (!deviceId || typeof code !== 'string') return false
    const device_hash = await sha256(deviceId)
    const { data: row } = await db.from('auth_codes').select('*')
      .eq('purpose', purpose).eq('device_hash', device_hash).is('used_at', null)
      .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!row || row.attempts >= 5) return false
    if (row.code_hash !== (await sha256(`${purpose}:${code.trim()}`))) {
      await db.from('auth_codes').update({ attempts: row.attempts + 1 }).eq('id', row.id)
      return false
    }
    await db.from('auth_codes').update({ used_at: new Date().toISOString() }).eq('id', row.id)
    return true
  }

  const setPin = async (pin: string) => {
    const pin_hash = await bcrypt.hash(pin, 12)
    await db.from('admin_security').upsert({
      user_id: userId, pin_hash, pin_set_at: new Date().toISOString(), failed_count: 0, lock_level: 0, locked_until: null,
    })
    await db.from('ip_limits').delete().eq('ip', ip)
  }

  switch (action) {
    case 'status': {
      const sec = await getSec()
      return json(req, { pinSet: !!sec?.pin_hash })
    }

    case 'request_setup_code': {
      const sec = await getSec()
      if (sec?.pin_hash) return json(req, { error: 'A PIN is already set. Use “Forgot PIN” instead.' }, 400)
      const r = await sendCode('setup')
      return json(req, r, r.ok ? 200 : 400)
    }

    case 'setup_pin': {
      const sec = await getSec()
      if (sec?.pin_hash) return json(req, { error: 'A PIN is already set.' }, 400)
      const problem = pinProblem(body.pin)
      if (problem) return json(req, { error: problem }, 400)
      if (!(await checkCode('setup', body.code))) return json(req, { error: 'That code is wrong or has expired.' }, 400)
      await setPin(body.pin as string)
      await trustDevice()
      await logLogin('pin_set')
      return issueSession()
    }

    case 'login': {
      if (!deviceId) return json(req, { error: 'Missing device.' }, 400)
      const sec = await getSec()
      if (!sec?.pin_hash) return json(req, { needsSetup: true })
      const now = Date.now()

      // Per-device/IP lock and overall lock (so switching computers doesn't help).
      const { data: ipRow } = await db.from('ip_limits').select('*').eq('ip', ip).maybeSingle()
      const lockedUntil = Math.max(
        sec.locked_until ? Date.parse(sec.locked_until) : 0,
        ipRow?.locked_until ? Date.parse(ipRow.locked_until) : 0,
      )
      if (lockedUntil > now) {
        return json(req, { error: 'Too many wrong PINs. Login is locked for now.', lockedUntil: new Date(lockedUntil).toISOString() }, 429)
      }

      const pin = typeof body.pin === 'string' ? body.pin : ''
      const ok = /^\d{6,12}$/.test(pin) && (await bcrypt.compare(pin, sec.pin_hash))

      if (!ok) {
        await logLogin('login_failed')
        // overall counter
        let failed = sec.failed_count + 1
        let level = sec.lock_level
        let until: string | null = null
        if (failed >= MAX_TRIES) {
          level += 1
          until = new Date(now + lockMinutes(level) * 60_000).toISOString()
          failed = 0
        }
        await db.from('admin_security').update({ failed_count: failed, lock_level: level, locked_until: until }).eq('user_id', userId)
        // per-IP counter
        let ipFails = (ipRow?.fails ?? 0) + 1
        let ipLevel = ipRow?.lock_level ?? 0
        let ipUntil: string | null = null
        if (ipFails >= MAX_TRIES) {
          ipLevel += 1
          ipUntil = new Date(now + lockMinutes(ipLevel) * 60_000).toISOString()
          ipFails = 0
        }
        await db.from('ip_limits').upsert({ ip, fails: ipFails, lock_level: ipLevel, locked_until: ipUntil, updated_at: new Date().toISOString() })

        const lockAt = until ?? ipUntil
        if (lockAt) {
          await logLogin('locked')
          await emailAdmin(
            'Security alert: admin login locked',
            `<p>There were ${MAX_TRIES} wrong PIN attempts, so the admin login is locked until <b>${escapeHtml(new Date(lockAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))} IST</b>.</p>
             <p style="color:#555">Last attempt: ${escapeHtml(istNow())} IST<br>IP: ${escapeHtml(ip)}${location ? ` (${escapeHtml(location)})` : ''}<br>Device: ${escapeHtml(deviceLabel(ua))}</p>
             <p>If this wasn't you, no action is needed — the lock protects you. If it keeps happening, change your PIN in Settings.</p>`,
          )
          return json(req, { error: 'Too many wrong PINs. Login is locked for now.', lockedUntil: lockAt }, 429)
        }
        const left = MAX_TRIES - Math.max(failed, ipFails)
        return json(req, { error: `Wrong PIN. ${left} ${left === 1 ? 'try' : 'tries'} left before a lock.` }, 401)
      }

      await db.from('admin_security').update({ failed_count: 0, lock_level: 0, locked_until: null }).eq('user_id', userId)
      await db.from('ip_limits').delete().eq('ip', ip)

      const { data: device } = await db.from('trusted_devices').select('id').eq('device_hash', await sha256(deviceId)).maybeSingle()
      if (!device) {
        await logLogin('new_device_code_sent')
        const r = await sendCode('device')
        if (!r.ok) return json(req, { error: r.error }, 400)
        return json(req, { needsDeviceCode: true })
      }
      await db.from('trusted_devices').update({ last_used_at: new Date().toISOString(), ip }).eq('id', device.id)
      return issueSession()
    }

    case 'verify_device': {
      if (!(await checkCode('device', body.code))) {
        await logLogin('device_code_failed')
        return json(req, { error: 'That code is wrong or has expired.' }, 400)
      }
      await trustDevice()
      await logLogin('device_trusted')
      return issueSession()
    }

    case 'request_reset_code': {
      const r = await sendCode('reset')
      await logLogin('pin_reset_requested')
      return json(req, r, r.ok ? 200 : 400)
    }

    case 'reset_pin': {
      const problem = pinProblem(body.pin)
      if (problem) return json(req, { error: problem }, 400)
      if (!(await checkCode('reset', body.code))) return json(req, { error: 'That code is wrong or has expired.' }, 400)
      await setPin(body.pin as string)
      await trustDevice()
      await logLogin('pin_reset')
      await emailAdmin('Your admin PIN was changed', `<p>Your admin PIN was reset at ${escapeHtml(istNow())} IST from ${escapeHtml(deviceLabel(ua))} (IP ${escapeHtml(ip)}).</p><p>If this wasn't you, reset it again straight away.</p>`)
      return issueSession()
    }

    case 'change_pin': {
      const uid = await requireAdmin(req)
      if (!uid) return json(req, { error: 'Please log in again.' }, 401)
      const sec = await getSec()
      const oldPin = typeof body.oldPin === 'string' ? body.oldPin : ''
      if (!sec?.pin_hash || !(await bcrypt.compare(oldPin, sec.pin_hash))) {
        await logLogin('change_pin_failed')
        return json(req, { error: 'Your current PIN is not correct.' }, 400)
      }
      const problem = pinProblem(body.newPin)
      if (problem) return json(req, { error: problem }, 400)
      await setPin(body.newPin as string)
      await logLogin('pin_changed')
      await emailAdmin('Your admin PIN was changed', `<p>Your admin PIN was changed at ${escapeHtml(istNow())} IST.</p><p>If this wasn't you, use “Forgot PIN” on the login screen straight away.</p>`)
      return json(req, { ok: true })
    }

    case 'logout_everywhere': {
      const uid = await requireAdmin(req)
      if (!uid) return json(req, { error: 'Please log in again.' }, 401)
      const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
      const { error } = await db.auth.admin.signOut(jwt, 'global')
      if (error) return json(req, { error: error.message }, 500)
      await logLogin('logout_everywhere')
      return json(req, { ok: true })
    }

    default:
      return json(req, { error: 'Unknown action' }, 400)
  }
})
