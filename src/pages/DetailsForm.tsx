import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { type Answers, DETAILS_STEP, isVisible, validateFields } from '../../supabase/functions/_shared/engine/intake.ts'
import { callFn } from '../lib/supabase'
import { Alert, Button, PageSpinner } from '../components/ui'
import { FieldInput } from './IntakeForm'
import { PublicShell } from './PublicShell'

/** Company & billing details, asked only after the client accepts the quote. */
export default function DetailsForm() {
  const { token = '' } = useParams()
  const [brand, setBrand] = useState('')
  const [answers, setAnswers] = useState<Answers | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    callFn<{ brand: string; answers: Answers }>('public', { action: 'get_details', token })
      .then((d) => {
        setBrand(d.brand)
        setAnswers(d.answers)
      })
      .catch((e) => setLoadError(e.message))
  }, [token])

  useEffect(() => {
    if (!answers) return
    const all = validateFields(DETAILS_STEP.fields, answers)
    setErrors(Object.fromEntries(Object.entries(all).filter(([k]) => touched[k])))
  }, [answers, touched])

  const set = (id: string, v: Answers[string]) => {
    setAnswers((a) => ({ ...(a ?? {}), [id]: v }))
    setTouched((t) => ({ ...t, [id]: true }))
  }

  const submit = async () => {
    if (!answers) return
    const errs = validateFields(DETAILS_STEP.fields, answers)
    setTouched(Object.fromEntries(DETAILS_STEP.fields.map((f) => [f.id, true])))
    setErrors(errs)
    if (Object.keys(errs).length) {
      const first = DETAILS_STEP.fields.find((f) => errs[f.id])
      if (first) document.getElementById(`f-${first.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setBusy(true)
    setError('')
    try {
      await callFn('public', { action: 'submit_details', token, answers })
      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      const err = e as Error & { data?: { errors?: Record<string, string> } }
      setError(err.message)
      if (err.data?.errors) setErrors(err.data.errors)
    } finally {
      setBusy(false)
    }
  }

  if (!answers && !loadError) return <PublicShell><PageSpinner /></PublicShell>

  return (
    <PublicShell>
      <div className="mx-auto max-w-2xl py-8 sm:py-12">
        {done ? (
          <div className="py-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">✓</div>
            <h1 className="mt-6 text-2xl font-semibold">Thank you!</h1>
            <p className="mt-3 text-neutral-600">We have your company details. We'll send your agreement (MOU) for e-signature shortly.</p>
          </div>
        ) : !answers ? (
          <Alert tone="error">{loadError}</Alert>
        ) : (
          <>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-atom-teal">Step 2 of 3 · {brand}</p>
            <h1 className="mt-2 text-2xl font-semibold">{DETAILS_STEP.title}</h1>
            <p className="mt-2 text-neutral-600">Quote accepted ✓ → <b>Company details</b> → Sign the agreement</p>
            <section className="mt-6 rounded-lg border border-neutral-200 bg-white p-5 sm:p-8">
              <div className="rounded-md border-l-4 border-atom-teal bg-atom-aqua/40 px-4 py-3 text-sm text-neutral-800">
                <b>Important:</b> {DETAILS_STEP.intro}
              </div>
              <div className="mt-6 grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                {DETAILS_STEP.fields.filter((f) => isVisible(f, answers)).map((f) => (
                  <FieldInput key={f.id} field={f} answers={answers} error={errors[f.id]} onChange={set} />
                ))}
              </div>
              {error && <div className="mt-6"><Alert tone="error">{error}</Alert></div>}
              <div className="mt-8 flex justify-end">
                <Button size="lg" onClick={submit} busy={busy}>Submit details</Button>
              </div>
            </section>
          </>
        )}
      </div>
    </PublicShell>
  )
}
