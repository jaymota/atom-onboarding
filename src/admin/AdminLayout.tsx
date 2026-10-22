import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { mergeSettings, type Settings } from '../../supabase/functions/_shared/engine/settings.ts'
import { supabase } from '../lib/supabase'
import { PageSpinner } from '../components/ui'

interface SettingsCtx {
  settings: Settings
  reload: () => Promise<void>
}

export const SettingsContext = createContext<SettingsCtx | null>(null)
const Ctx = SettingsContext

/** Company settings, prices and wording — loaded once for the admin area. */
export function useSettings(): SettingsCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useSettings outside AdminLayout')
  return c
}

export function AdminLayout() {
  const [settings, setSettings] = useState<Settings | null>(null)

  const reload = useCallback(async () => {
    const { data } = await supabase.from('settings').select('data').eq('id', 1).maybeSingle()
    setSettings(mergeSettings(data?.data))
  }, [])

  useEffect(() => { void reload() }, [reload])

  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-atom-ink text-white' : 'text-neutral-700 hover:bg-neutral-100'}`

  return (
    <div className="min-h-svh bg-neutral-50">
      <div className="h-1 bg-gradient-to-r from-atom-teal to-atom-green" />
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[1500px] items-center gap-2 px-4 py-2">
          <img src="/atom-logo.png" alt="Atom" className="mr-3 w-20" />
          <nav className="flex flex-1 gap-1 overflow-x-auto">
            <NavLink to="/admin" end className={link}>Dashboard</NavLink>
            <NavLink to="/admin/settings" className={link}>Settings</NavLink>
          </nav>
          <button
            onClick={() => supabase.auth.signOut({ scope: 'local' })}
            className="rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100"
          >
            Log out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] px-4 py-6">
        {settings ? (
          <Ctx.Provider value={{ settings, reload }}>
            <Outlet />
          </Ctx.Provider>
        ) : (
          <PageSpinner />
        )}
      </main>
    </div>
  )
}
