import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-atom-teal text-white hover:bg-atom-teal/90 disabled:bg-atom-teal/50',
  secondary: 'border border-neutral-300 bg-white text-atom-ink hover:border-atom-ink disabled:opacity-50',
  ghost: 'text-neutral-700 hover:bg-neutral-100 disabled:opacity-50',
  danger: 'border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50',
  dark: 'bg-atom-ink text-white hover:bg-neutral-800 disabled:opacity-50',
}

export function Button({
  variant = 'primary', size = 'md', busy, className = '', children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; busy?: boolean }) {
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' }
  return (
    <button
      {...rest}
      disabled={rest.disabled || busy}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition ${sizes[size]} ${VARIANTS[variant]} ${className}`}
    >
      {busy && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  )
}

export function Spinner({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export function PageSpinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-atom-teal">
      <Spinner className="h-8 w-8" />
    </div>
  )
}

export const inputClass =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-atom-teal focus:ring-2 focus:ring-atom-teal/20 disabled:bg-neutral-100'

export function Label({ children, required, htmlFor }: { children: ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-neutral-800">
      {children}
      {required && <span className="text-atom-teal"> *</span>}
    </label>
  )
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={`${inputClass} ${props.className ?? ''}`} />
}

export function Select({ options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <select {...props} className={`${inputClass} ${props.className ?? ''}`}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

export function Card({ children, className = '', title, actions }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={`rounded-lg border border-neutral-200 bg-white ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

export function Badge({ children, tone = 'bg-neutral-100 text-neutral-700' }: { children: ReactNode; tone?: string }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>{children}</span>
}

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error' | 'success'; children: ReactNode }) {
  const tones = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  }
  return <div className={`rounded-md border px-3 py-2 text-sm ${tones[tone]}`}>{children}</div>
}

export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode; disabled?: boolean }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 ${disabled ? 'opacity-50' : ''}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition ${checked ? 'bg-atom-teal' : 'bg-neutral-300'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
      <span className="text-sm">
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-xs text-neutral-500">{hint}</span>}
      </span>
    </label>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center" onMouseDown={onClose}>
      <div
        className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-lg bg-white shadow-xl`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
        <header className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-neutral-500 hover:bg-neutral-100" aria-label="Close">✕</button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

/** Renders text with **bold** markers. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}
    </>
  )
}

/**
 * Click-to-edit text, like a Word document. Shows the text; click it to get a
 * small editor with Save / Cancel / Reset to template.
 */
export function Editable({
  text, onSave, onReset, edited, disabled, multiline = true, className = '', badge,
}: {
  text: string
  onSave: (v: string) => void
  onReset?: () => void
  edited?: boolean
  disabled?: boolean
  multiline?: boolean
  className?: string
  badge?: ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(text)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (editing) {
      setDraft(text)
      setTimeout(() => {
        ref.current?.focus()
        // Short values (like "Week 5 - Week 9") are selected, so typing replaces them.
        if (text.length <= 40) ref.current?.select()
      }, 0)
    }
  }, [editing, text])

  if (disabled) return <span className={className}><RichText text={text} />{badge}</span>
  if (!editing) {
    return (
      <span
        role="button"
        tabIndex={0}
        title="Click to edit"
        onClick={() => setEditing(true)}
        onKeyDown={(e) => e.key === 'Enter' && setEditing(true)}
        className={`cursor-text rounded-sm decoration-atom-teal decoration-2 underline-offset-4 outline-none hover:bg-atom-aqua/60 focus:bg-atom-aqua/60 ${edited ? 'underline decoration-dotted' : ''} ${className}`}
      >
        <RichText text={text} />
        {badge}
      </span>
    )
  }
  return (
    <span className="my-1 block rounded-md border border-atom-teal/40 bg-white p-2 font-sans shadow-sm">
      <textarea
        ref={ref}
        value={draft}
        rows={multiline ? Math.min(8, Math.max(2, Math.ceil(draft.length / 70))) : 1}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setEditing(false)
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            onSave(draft)
            setEditing(false)
          }
        }}
        className="w-full resize-y rounded border border-neutral-200 p-2 text-sm outline-none focus:border-atom-teal"
      />
      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs">
        <Button size="sm" onClick={() => { onSave(draft); setEditing(false) }}>Save</Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        {onReset && (
          <Button size="sm" variant="ghost" onClick={() => { onReset(); setEditing(false) }}>Reset to template wording</Button>
        )}
        <span className="text-neutral-400">Use **double stars** for bold</span>
      </span>
    </span>
  )
}

export function useDebouncedEffect(fn: () => void, deps: unknown[], ms: number) {
  useEffect(() => {
    const t = setTimeout(fn, ms)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-neutral-500">{children}</div>}
    </div>
  )
}
