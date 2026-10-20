import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { callFn } from '../lib/supabase'
import { Alert, Button, Label, PageSpinner, TextInput } from '../components/ui'
import { PublicShell } from './PublicShell'

interface DetailsResponse {
  brand: string
  fields: { key: string; label: string; value: string }[]
}

/** "Complete your details" page for the MOU. */
export default function DetailsForm() {
  const { token = '' } = useParams()
  const [data, setData] = useState<DetailsResponse | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    callFn<DetailsResponse>('public', { action: 'get_details', token })
      .then((d) => {
        setData(d)
        setValues(Object.fromEntries(d.fields.map((f) => [f.key, f.value])))
      })
      .catch((e) => setError(e.message))
  }, [token])

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await callFn('public', { action: 'submit_details', token, details: values })
      setDone(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!data && !error) return <PublicShell><PageSpinner /></PublicShell>

  return (
    <PublicShell>
      <div className="mx-auto max-w-xl py-10">
        {done ? (
          <Alert tone="success">Thank you! Your details have been saved. We'll send your agreement for signature shortly.</Alert>
        ) : !data ? (
          <Alert tone="error">{error}</Alert>
        ) : (
          <section className="rounded-lg border border-neutral-200 bg-white p-6">
            <h1 className="text-xl font-semibold">Company details for your agreement</h1>
            <div className="mt-3 rounded-md border-l-4 border-atom-red bg-atom-red/5 px-4 py-3 text-sm">
              <b>Important:</b> please enter these exactly as they appear on your registration documents. They will be used on your official agreement (MOU) and tax invoices.
            </div>
            <div className="mt-6 space-y-4">
              {data.fields.map((f) => (
                <div key={f.key}>
                  <Label required>{f.label}</Label>
                  <TextInput value={values[f.key] ?? ''} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                </div>
              ))}
            </div>
            {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}
            <div className="mt-6 flex justify-end">
              <Button onClick={submit} busy={busy}>Save details</Button>
            </div>
          </section>
        )}
      </div>
    </PublicShell>
  )
}
