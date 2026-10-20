import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase, callFn } from '../lib/supabase'
import { deviceId } from '../lib/device'
import { Alert, Button, PageSpinner } from '../components/ui'

const IDLE_MS = 30 * 60 * 1000
const ACTIVITY_KEY = 'atom-admin-last-activity'

type Screen = 'checking' | 'pin' | 'device' | 'setup' | 'forgot' | 'in'

async function isAdminNow(): Promise<boolean> {
  const { data: s } = await supabase.auth.getSession()
  if (!s.session) return false
  const { data, error } = await supabase.rpc('is_admin')
  return !error && data === true
}

function lastActivity(): number {
  try {
    return Number(localStorage.getItem(ACTIVITY_KEY)) || 0
  } catch {
    return 0
  }
}

function markActivity() {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()))
  } catch { /* ignore */ }
}

/** Everything inside this needs the PIN. */
export function AdminGate({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>('checking')
  const [notice, setNotice] = useState('')

  const lock = useCallback(async (message = '') => {
    await supabase.auth.signOut({ scope: 'local' })
    setNotice(message)
    setScreen('pin')
  }, [])

  // On load: are we still logged in, and not idle for too long?
  useEffect(() => {
    void (async () => {
      if (Date.now() - lastActivity() > IDLE_MS) {
        const { data } = await supabase.auth.getSession()
        if (data.session) return lock('You were away for a while, so we locked the screen.')
      }
      if (await isAdminNow()) {
        markActivity()
        setScreen('in')
      } else {
        const { data } = await supabase.auth.getSession()
        if (data.session) await supabase.auth.signOut({ scope: 'local' })
        setScreen('pin')
      }
    })()
  }, [lock])

  // Idle lock after 30 minutes, and re-check the login every 5 minutes.
  useEffect(() => {
    if (screen !== 'in') return
    let last = 0
    const onActivity = () => {
      const now = Date.now()
      if (now - last > 15_000) {
        last = now
        markActivity()
      }
    }
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    const idle = setInterval(() => {
      if (Date.now() - lastActivity() > IDLE_MS) void lock('You were away for 30 minutes, so we locked the screen.')
    }, 30_000)
    const check = setInterval(async () => {
      if (!(await isAdminNow())) void lock('Your session ended. Please enter your PIN again.')
    }, 5 * 60_000)
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setScreen('pin')
    })
    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity))
      clearInterval(idle)
      clearInterval(check)
      sub.subscription.unsubscribe()
    }
  }, [screen, lock])

  const signedIn = async (session: { access_token: string; refresh_token: string }) => {
    await supabase.auth.setSession(session)
    markActivity()
    setNotice('')
    setScreen('in')
  }

  if (screen === 'checking') return <PageSpinner />
  if (screen === 'in') return <>{children}</>
  return <PinScreen initial={screen} notice={notice} onSignedIn={signedIn} />
}

function PinScreen({ initial, notice, onSignedIn }: {
  initial: Screen
  notice: string
  onSignedIn: (s: { access_token: string; refresh_token: string }) => void
}) {
  const [screen, setScreen] = useState<Screen>(initial)
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState(notice)
  const [busy, setBusy] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    callFn<{ pinSet: boolean }>('admin-auth', { action: 'status' })
      .then((r) => { if (!r.pinSet) setScreen('setup') })
      .catch(() => { /* ignore */ })
  }, [])

  useEffect(() => { inputRef.current?.focus() }, [screen])

  const run = async (body: Record<string, unknown>) => {
    setBusy(true)
    setError('')
    try {
      const r = await callFn<{ session?: { access_token: string; refresh_token: string }; needsDeviceCode?: boolean; needsSetup?: boolean; ok?: boolean }>(
        'admin-auth', { ...body, deviceId: deviceId() },
      )
      if (r.session) return onSignedIn(r.session)
      return r
    } catch (e) {
      setError((e as Error).message)
      return null
    } finally {
      setBusy(false)
    }
  }

  const login = async () => {
    if (pin.length < 6) return
    const r = await run({ action: 'login', pin })
    setPin('')
    if (r && 'needsDeviceCode' in r && r.needsDeviceCode) {
      setInfo('This is a new browser or device. We emailed a 6-digit code to jay@atomconsulting.in.')
      setCode('')
      setScreen('device')
    }
    if (r && 'needsSetup' in r && r.needsSetup) setScreen('setup')
  }

  const sendCode = async (action: 'request_setup_code' | 'request_reset_code') => {
    const r = await run({ action })
    if (r) {
      setCodeSent(true)
      setInfo('We emailed a 6-digit code to jay@atomconsulting.in. It works for 15 minutes.')
    }
  }

  const savePin = async (action: 'setup_pin' | 'reset_pin') => {
    if (pin !== pin2) return setError('The two PINs don’t match.')
    await run({ action, pin, code })
  }

  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 12)

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
        <img src="/atom-logo.png" alt="Atom Consultancy" className="mx-auto w-32" />

        {screen === 'pin' && (
          <form onSubmit={(e) => { e.preventDefault(); void login() }} className="mt-8 text-center">
            <h1 className="font-semibold">Enter your PIN</h1>
            <PinDots value={pin} />
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              aria-label="PIN"
              value={pin}
              onChange={(e) => setPin(digits(e.target.value))}
              className="mt-4 w-full rounded-md border border-neutral-300 px-3 py-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-atom-red"
            />
            <Keypad value={pin} onChange={setPin} />
            {info && <div className="mt-4 text-left"><Alert tone="info">{info}</Alert></div>}
            {error && <div className="mt-4 text-left"><Alert tone="error">{error}</Alert></div>}
            <Button type="submit" size="lg" className="mt-5 w-full" busy={busy} disabled={pin.length < 6}>Unlock</Button>
            <button type="button" onClick={() => { setScreen('forgot'); setError(''); setInfo(''); setCodeSent(false) }} className="mt-4 text-sm text-neutral-500 hover:text-atom-red">
              Forgot PIN?
            </button>
          </form>
        )}

        {screen === 'device' && (
          <form onSubmit={(e) => { e.preventDefault(); void run({ action: 'verify_device', code }) }} className="mt-8">
            <h1 className="text-center font-semibold">Confirm this device</h1>
            {info && <div className="mt-4"><Alert tone="info">{info}</Alert></div>}
            <CodeInput refEl={inputRef} value={code} onChange={setCode} />
            {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}
            <Button type="submit" size="lg" className="mt-5 w-full" busy={busy} disabled={code.length !== 6}>Confirm & unlock</Button>
            <p className="mt-3 text-center text-xs text-neutral-500">After this, this browser is trusted and only needs your PIN.</p>
          </form>
        )}

        {(screen === 'setup' || screen === 'forgot') && (
          <div className="mt-8">
            <h1 className="text-center font-semibold">{screen === 'setup' ? 'Set your admin PIN' : 'Reset your PIN'}</h1>
            <p className="mt-2 text-center text-sm text-neutral-600">
              {screen === 'setup'
                ? 'First, we’ll email a code to jay@atomconsulting.in to prove it’s you.'
                : 'We’ll email a reset code to jay@atomconsulting.in.'}
            </p>
            {info && <div className="mt-4"><Alert tone="info">{info}</Alert></div>}
            {!codeSent ? (
              <Button size="lg" className="mt-5 w-full" busy={busy} onClick={() => sendCode(screen === 'setup' ? 'request_setup_code' : 'request_reset_code')}>
                Email me a code
              </Button>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); void savePin(screen === 'setup' ? 'setup_pin' : 'reset_pin') }}>
                <CodeInput refEl={inputRef} value={code} onChange={setCode} />
                <label className="mt-4 block text-sm font-medium">New PIN (6–12 digits)</label>
                <input type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(e) => setPin(digits(e.target.value))}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-center text-xl tracking-[0.4em] outline-none focus:border-atom-red" />
                <label className="mt-3 block text-sm font-medium">Type it again</label>
                <input type="password" inputMode="numeric" autoComplete="new-password" value={pin2} onChange={(e) => setPin2(digits(e.target.value))}
                  className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-center text-xl tracking-[0.4em] outline-none focus:border-atom-red" />
                <p className="mt-2 text-xs text-neutral-500">Avoid easy PINs like 123456, 111111 or your birthday.</p>
                <Button type="submit" size="lg" className="mt-5 w-full" busy={busy} disabled={code.length !== 6 || pin.length < 6 || pin2.length < 6}>
                  Save PIN & unlock
                </Button>
              </form>
            )}
            {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}
            {screen === 'forgot' && (
              <button onClick={() => { setScreen('pin'); setError(''); setInfo('') }} className="mt-4 block w-full text-center text-sm text-neutral-500 hover:text-atom-red">
                ← Back to PIN
              </button>
            )}
          </div>
        )}
      </div>
      <a href="#/" className="mt-6 text-xs text-neutral-400 hover:text-neutral-600">← Back to the public site</a>
    </div>
  )
}

function PinDots({ value }: { value: string }) {
  const n = Math.max(6, value.length)
  return (
    <div className="mt-5 flex justify-center gap-2" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={`h-3 w-3 rounded-full ${i < value.length ? 'bg-atom-red' : 'bg-neutral-200'}`} />
      ))}
    </div>
  )
}

function Keypad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']
  return (
    <div className="mt-4 grid grid-cols-3 gap-2 sm:hidden">
      {keys.map((k, i) => k === '' ? <span key={i} /> : (
        <button
          key={i}
          type="button"
          onClick={() => onChange(k === '⌫' ? value.slice(0, -1) : (value + k).slice(0, 12))}
          className="rounded-lg bg-neutral-100 py-3 text-lg font-medium active:bg-neutral-200"
        >
          {k}
        </button>
      ))}
    </div>
  )
}

function CodeInput({ value, onChange, refEl }: { value: string; onChange: (v: string) => void; refEl: React.RefObject<HTMLInputElement | null> }) {
  return (
    <>
      <label className="mt-4 block text-sm font-medium">6-digit code from your email</label>
      <input
        ref={refEl}
        inputMode="numeric"
        autoComplete="one-time-code"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-center text-2xl tracking-[0.5em] outline-none focus:border-atom-red"
      />
    </>
  )
}
