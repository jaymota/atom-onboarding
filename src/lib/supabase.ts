import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

// The publishable key is safe in the browser: Row Level Security decides what it can see.
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'atom-admin-session' },
})

/** Call one of our Edge Functions. Throws an Error with a friendly message on failure. */
export async function callFn<T = Record<string, unknown>>(
  name: 'admin-auth' | 'public' | 'admin-actions',
  body: Record<string, unknown>,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_KEY,
  }
  // Only admin actions need the login token. Public calls skip it, so they never
  // wait on the login library (which can be busy while signing in or out).
  const needsLogin = name === 'admin-actions' || ['change_pin', 'logout_everywhere'].includes(String(body.action))
  if (needsLogin) {
    const { data: s } = await supabase.auth.getSession()
    if (s.session?.access_token) headers.Authorization = `Bearer ${s.session.access_token}`
  }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, { method: 'POST', headers, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.error ?? `Something went wrong (${res.status})`) as Error & { data?: unknown; status?: number }
    err.data = data
    err.status = res.status
    throw err
  }
  return data as T
}
