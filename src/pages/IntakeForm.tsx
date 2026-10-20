import { useEffect, useMemo, useRef, useState } from 'react'
import {
  type Answers, type Field, STEPS, isVisible, validateFields,
} from '../../supabase/functions/_shared/engine/intake.ts'
import { callFn } from '../lib/supabase'
import { Alert, Button, Label, inputClass } from '../components/ui'
import { PublicShell } from './PublicShell'

const STORAGE_KEY = 'atom-intake-draft-v1'

function loadDraft(): { answers: Answers; step: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { answers: { billingSame: true }, step: 0 }
}

export default function IntakeForm() {
  const initial = useMemo(loadDraft, [])
  const [answers, setAnswers] = useState<Answers>(initial.answers)
  const [step, setStep] = useState(Math.min(initial.step, STEPS.length - 1))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')
  const [done, setDone] = useState(false)
  const [honeypot, setHoneypot] = useState('')
  const startedAt = useRef(Date.now())
  const topRef = useRef<HTMLDivElement>(null)

  const current = STEPS[step]
  const resumed = initial.step > 0 || Object.keys(initial.answers).length > 1

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, step }))
    } catch { /* ignore */ }
  }, [answers, step])

  // Validate as the client types (only fields they've touched).
  useEffect(() => {
    const all = validateFields(current.fields, answers)
    setErrors(Object.fromEntries(Object.entries(all).filter(([k]) => touched[k])))
  }, [answers, touched, current])

  const set = (id: string, v: Answers[string]) => {
    setAnswers((a) => ({ ...a, [id]: v }))
    setTouched((t) => ({ ...t, [id]: true }))
  }

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const next = () => {
    const errs = validateFields(current.fields, answers)
    setTouched((t) => ({ ...t, ...Object.fromEntries(current.fields.map((f) => [f.id, true])) }))
    setErrors(errs)
    if (Object.keys(errs).length) {
      const first = current.fields.find((f) => errs[f.id])
      if (first) document.getElementById(`f-${first.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (step < STEPS.length - 1) {
      setStep(step + 1)
      scrollTop()
    } else {
      void submit()
    }
  }

  const submit = async () => {
    setSubmitting(true)
    setServerError('')
    try {
      await callFn('public', { action: 'submit_intake', answers, website2: honeypot, startedAt: startedAt.current })
      try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
      setDone(true)
      scrollTop()
    } catch (e) {
      const err = e as Error & { data?: { errors?: Record<string, string> } }
      setServerError(err.message)
      if (err.data?.errors) {
        setErrors(err.data.errors)
        const badStep = STEPS.findIndex((s) => s.fields.some((f) => err.data!.errors![f.id]))
        if (badStep >= 0) setStep(badStep)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <PublicShell>
        <div ref={topRef} className="mx-auto max-w-xl py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">✓</div>
          <h1 className="mt-6 text-2xl font-semibold">Thank you, {String(answers.fullName ?? '').split(' ')[0]}!</h1>
          <p className="mt-3 text-neutral-600">
            We've received your project details. Our team will review them and send you a scope of work and quotation shortly.
          </p>
          <p className="mt-6 text-sm text-neutral-500">
            Questions in the meantime? Email <a className="text-atom-red underline" href="mailto:jay@atomconsulting.in">jay@atomconsulting.in</a> or call +91 93723 15541.
          </p>
        </div>
      </PublicShell>
    )
  }

  return (
    <PublicShell>
      <div ref={topRef} className="mx-auto max-w-2xl scroll-mt-4 py-8 sm:py-12">
        {step === 0 && (
          <header className="mb-8">
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-atom-red">Start your project</p>
            <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Tell us about your product</h1>
            <p className="mt-2 text-neutral-600">
              It takes about 10 minutes. Your answers are saved on this device as you go, so you can come back to finish.
            </p>
            {resumed && <p className="mt-2 text-sm text-emerald-700">Welcome back — we've kept your earlier answers.</p>}
          </header>
        )}

        {/* Progress */}
        <div className="mb-6">
          <div className="mb-2 flex justify-between text-xs font-medium text-neutral-500">
            <span>Step {step + 1} of {STEPS.length}: {current.title}</span>
            <span>{Math.round(((step + 1) / STEPS.length) * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full rounded-full bg-gradient-to-r from-atom-red to-atom-yellow transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
          <div className="mt-3 hidden gap-2 sm:flex">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                disabled={i > step}
                onClick={() => setStep(i)}
                className={`flex-1 rounded px-2 py-1 text-xs ${i === step ? 'bg-atom-ink text-white' : i < step ? 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200' : 'text-neutral-400'}`}
              >
                {i + 1}. {s.title}
              </button>
            ))}
          </div>
        </div>

        <section className="rounded-lg border border-neutral-200 bg-white p-5 sm:p-8">
          <h2 className="text-xl font-semibold">{current.title}</h2>
          {current.intro && (
            <div className="mt-3 rounded-md border-l-4 border-atom-red bg-atom-red/5 px-4 py-3 text-sm text-neutral-800">
              <b>Important:</b> {current.intro}
            </div>
          )}
          <div className="mt-6 grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
            {current.fields.filter((f) => isVisible(f, answers)).map((f) => (
              <FieldInput key={f.id} field={f} answers={answers} error={errors[f.id]} onChange={set} />
            ))}
          </div>

          {/* Hidden from people; bots fill it in. */}
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>Leave this empty<input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} /></label>
          </div>

          {serverError && <div className="mt-6"><Alert tone="error">{serverError}</Alert></div>}

          <div className="mt-8 flex items-center justify-between gap-3">
            {step > 0 ? (
              <Button variant="secondary" onClick={() => { setStep(step - 1); scrollTop() }}>← Back</Button>
            ) : <span />}
            <Button size="lg" onClick={next} busy={submitting}>
              {step < STEPS.length - 1 ? 'Continue →' : 'Submit'}
            </Button>
          </div>
        </section>
        <p className="mt-4 text-center text-xs text-neutral-400">Fields marked <span className="text-atom-red">*</span> are required.</p>
      </div>
    </PublicShell>
  )
}

function FieldInput({ field: f, answers, error, onChange }: {
  field: Field
  answers: Answers
  error?: string
  onChange: (id: string, v: Answers[string]) => void
}) {
  const v = answers[f.id]
  const id = `f-${f.id}`
  const full = !f.half || f.type === 'textarea' || f.type === 'radio' || f.type === 'checkboxes'
  const wrap = (children: React.ReactNode, showLabel = true) => (
    <div id={id} className={`${full ? 'sm:col-span-2' : ''} scroll-mt-24`}>
      {showLabel && <Label htmlFor={`${id}-input`} required={f.required && !(f.skipWith && answers[f.skipWith])}>{f.label}</Label>}
      {children}
      {f.help && !error && <p className="mt-1 text-xs text-neutral-500">{f.help}</p>}
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  )
  const errCls = error ? 'border-red-400' : ''
  const other = f.other && (v === 'Other' || (Array.isArray(v) && v.includes('Other'))) && (
    <input
      className={`${inputClass} mt-2`}
      placeholder="Please specify"
      value={String(answers[`${f.id}_other`] ?? '')}
      onChange={(e) => onChange(`${f.id}_other`, e.target.value)}
    />
  )

  switch (f.type) {
    case 'notice':
      return <div className="border-t border-neutral-100 pt-4 sm:col-span-2"><p className="font-semibold">{f.label}</p></div>
    case 'textarea':
      return wrap(<textarea id={`${id}-input`} rows={4} className={`${inputClass} ${errCls}`} placeholder={f.placeholder} value={String(v ?? '')} onChange={(e) => onChange(f.id, e.target.value)} />)
    case 'select':
      return wrap(
        <>
          <select id={`${id}-input`} className={`${inputClass} ${errCls}`} value={String(v ?? '')} onChange={(e) => onChange(f.id, e.target.value)}>
            <option value="">Choose…</option>
            {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
            {f.other && <option value="Other">Other</option>}
          </select>
          {other}
        </>,
      )
    case 'radio':
      return wrap(
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {[...f.options!, ...(f.other ? ['Other'] : [])].map((o) => (
              <label key={o} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${v === o ? 'border-atom-red bg-atom-red/5' : 'border-neutral-200 hover:border-neutral-400'}`}>
                <input type="radio" name={f.id} checked={v === o} onChange={() => onChange(f.id, o)} className="accent-atom-red" />
                {o}
              </label>
            ))}
          </div>
          {other}
        </>,
      )
    case 'checkboxes': {
      const arr = Array.isArray(v) ? v : []
      return wrap(
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {[...f.options!, ...(f.other ? ['Other'] : [])].map((o) => (
              <label key={o} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${arr.includes(o) ? 'border-atom-red bg-atom-red/5' : 'border-neutral-200 hover:border-neutral-400'}`}>
                <input
                  type="checkbox"
                  checked={arr.includes(o)}
                  onChange={(e) => onChange(f.id, e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))}
                  className="accent-atom-red"
                />
                {o}
              </label>
            ))}
          </div>
          {other}
        </>,
      )
    }
    case 'checkbox':
      return (
        <div id={id} className={`${full ? 'sm:col-span-2' : ''} flex flex-col justify-end`}>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" checked={v === true} onChange={(e) => onChange(f.id, e.target.checked)} className="mt-0.5 h-4 w-4 accent-atom-red" />
            <span>{f.label}{f.required && <span className="text-atom-red"> *</span>}</span>
          </label>
          {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
        </div>
      )
    default: {
      const skipped = f.skipWith ? answers[f.skipWith] === true : false
      return wrap(
        <input
          id={`${id}-input`}
          type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : 'text'}
          inputMode={f.type === 'number' ? 'numeric' : undefined}
          min={f.type === 'number' ? 1 : undefined}
          disabled={skipped}
          className={`${inputClass} ${errCls} ${f.validate === 'gstin' || f.validate === 'pan' ? 'uppercase' : ''}`}
          placeholder={f.placeholder}
          value={skipped ? '' : String(v ?? '')}
          onChange={(e) => onChange(f.id, f.type === 'number' ? e.target.value : e.target.value)}
          autoComplete={f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : f.id === 'fullName' ? 'name' : 'off'}
        />,
      )
    }
  }
}
