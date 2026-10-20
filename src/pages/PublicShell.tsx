import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/** Header and footer for pages the public / clients see. */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-atom-cream">
      <div className="h-1.5 bg-gradient-to-r from-atom-teal to-atom-green" />
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <a href="https://www.atomconsulting.in" aria-label="Atom Consultancy website">
            <img src="/atom-logo.png" alt="Atom Consultancy" className="w-28" />
          </a>
          <span className="hidden text-xs text-neutral-500 sm:block">From Concept to Shelf</span>
        </div>
      </header>
      <main className="flex-1 px-4">{children}</main>
      <footer className="border-t border-neutral-200 bg-white px-4 py-5 text-center text-xs text-neutral-500">
        Atom Consultancy · Food. Science. Strategy. · Mumbai ·{' '}
        <a className="hover:underline" href="https://www.atomconsulting.in">atomconsulting.in</a>
        <Link to="/admin" className="ml-3 text-neutral-300 hover:text-neutral-500">Team login</Link>
      </footer>
    </div>
  )
}
