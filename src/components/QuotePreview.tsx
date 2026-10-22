import { createContext, useContext, type ReactNode } from 'react'
import type { QuoteDoc } from '../../supabase/functions/_shared/engine/quote.ts'
import type { CompanySettings } from '../../supabase/functions/_shared/engine/settings.ts'
import { Editable, RichText } from './ui'

export interface PreviewEditing {
  onText: (key: string, value: string) => void
  onReset: (key: string) => void
  isEdited: (key: string) => boolean
  onRemoveItem?: (id: string) => void
  onMoveItem?: (group: string, id: string, dir: -1 | 1) => void
  onRemoveTerm?: (id: string) => void
  onMoveTerm?: (id: string, dir: -1 | 1) => void
}

/** Small ↑ ↓ ✕ buttons shown when hovering a point (edit mode only). */
function PointTools({ first, last, onMove, onRemove, what }: {
  first: boolean
  last: boolean
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
  what: string
}) {
  const btn = 'flex h-7 w-7 items-center justify-center rounded text-sm text-neutral-700 hover:bg-atom-aqua disabled:opacity-25'
  return (
    <span className="absolute -left-[5.5rem] -top-0.5 hidden items-center rounded-md border border-neutral-200 bg-white font-sans text-neutral-500 shadow-sm group-hover:flex">
      <button type="button" className={btn} disabled={first} onClick={() => onMove(-1)} title={`Move ${what} up`}>↑</button>
      <button type="button" className={btn} disabled={last} onClick={() => onMove(1)} title={`Move ${what} down`}>↓</button>
      <button type="button" className={`${btn} hover:text-red-600`} onClick={onRemove} title={`Remove this ${what}`}>✕</button>
    </span>
  )
}

/** The quote drawn as a page — the same layout as the PDF. */
export function QuotePreview({ doc, company, editing }: { doc: QuoteDoc; company: CompanySettings; editing?: PreviewEditing }) {
  return (
    <EditingContext.Provider value={editing}>
    <article className="quote-page mx-auto w-full max-w-[820px] bg-white px-6 py-8 font-serif text-[14px] leading-relaxed text-neutral-900 shadow-sm ring-1 ring-neutral-200 sm:px-14 sm:py-12">
      <Letterhead company={company} />

      <p className="mt-6 text-right"><b>Date:</b> {doc.date}</p>
      {doc.quoteNumber && <p className="text-right text-xs text-neutral-500">Ref: {doc.quoteNumber}</p>}

      <p className="mt-4"><E k="to" text={doc.to} /></p>
      <p className="mt-4"><b>Subject:</b> <E k="subject" text={doc.subject} /></p>

      <H>Scope of Work</H>
      <p><E k="intro" text={doc.intro} /></p>
      {doc.phases.map((ph) => (
        <div key={ph.group} className="mt-3">
          {doc.showPhaseHeadings && <p className="mt-4 mb-1 font-bold text-atom-teal">{ph.title}</p>}
          <ol className="ml-6 space-y-1">
            {ph.items.map((it, idx) => (
              <li key={it.id} className="group relative flex gap-2">
                {editing?.onRemoveItem && (
                  <PointTools
                    what="point"
                    first={idx === 0}
                    last={idx === ph.items.length - 1}
                    onMove={(dir) => editing.onMoveItem?.(ph.group, it.id, dir)}
                    onRemove={() => editing.onRemoveItem!(it.id)}
                  />
                )}
                <span className="w-7 shrink-0 text-right">{it.n}.</span>
                <span className="flex-1"><E k={it.key} text={it.text} /></span>
              </li>
            ))}
          </ol>
        </div>
      ))}

      <H>Fees</H>
      <p><E k={doc.model === 'retainer' ? 'fees:retainer' : 'fees:milestone'} text={doc.feesText} /></p>
      {doc.retainerPayable && <p className="mt-3 font-bold"><E k="retainerPayable" text={doc.retainerPayable} /></p>}
      {doc.retainerEstimate && <p className="mt-2"><E k="retainerEstimate" text={doc.retainerEstimate} /></p>}

      {doc.tranches && (
        <>
          <p className="mt-4 font-bold"><E k="tranchesIntro" text={doc.tranchesIntro ?? ''} /></p>
          <Table
            headers={['Sr.No.', 'Milestone', '% of Fees', 'Amount']}
            widths={['12%', '48%', '18%', '22%']}
            rows={doc.tranches.rows.map((r) => [String(r.n), r.name, `${r.pct}%`, r.amount])}
            total={['', 'Total', `${doc.tranches.totalPct}%`, doc.tranches.totalAmount]}
          />
        </>
      )}
      {doc.gstSummary && (
        <table className="mt-2 ml-auto text-[13px]">
          <tbody>
            <tr><td className="pr-6">Fees</td><td className="text-right">{doc.gstSummary.fee}</td></tr>
            <tr><td className="pr-6">{doc.gstSummary.gstLabel}</td><td className="text-right">{doc.gstSummary.gst}</td></tr>
            <tr className="font-bold"><td className="pr-6">Total</td><td className="text-right">{doc.gstSummary.total}</td></tr>
          </tbody>
        </table>
      )}

      <H>Deliverables and timelines:</H>
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="bg-atom-teal/10">
            <Th w="12%">Sr.No.</Th><Th w="58%">Actionables</Th><Th w="30%">Timeline</Th>
          </tr>
        </thead>
        <tbody>
          {doc.timeline.rows.map((r) => (
            <tr key={r.id}>
              <Td>{r.n}</Td>
              <Td><E k={r.labelKey} text={r.label} /></Td>
              <Td>{r.period}</Td>
            </tr>
          ))}
          <tr className="font-bold">
            <Td />
            <Td>Total</Td>
            <Td><E k="tl:total" text={doc.timeline.total} /></Td>
          </tr>
        </tbody>
      </table>

      {doc.costs && (
        <>
          <H>Potential Additional Costs:</H>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-atom-teal/10">
                <Th w="12%">Sr. No.</Th><Th w="58%">Areas of Work</Th><Th w="30%">Fees / Costs</Th>
              </tr>
            </thead>
            <tbody>
              {doc.costs.rows.map((r) => (
                <tr key={r.id}>
                  <Td>{r.n}</Td>
                  <Td><E k={r.labelKey} text={r.label} /></Td>
                  <Td><E k={r.valueKey} text={r.value} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <H>Terms & Assumptions</H>
      <p><E k={doc.model === 'retainer' ? 'assumptions:retainer' : 'assumptions:milestone'} text={doc.assumptionsIntro} /></p>
      <ol className="mt-2 ml-4 space-y-1">
        {doc.assumptions.map((a, idx) => (
          <li key={a.id} className="group relative flex gap-2">
            {editing?.onRemoveTerm && (
              <PointTools
                what="term"
                first={idx === 0}
                last={idx === doc.assumptions.length - 1}
                onMove={(dir) => editing.onMoveTerm?.(a.id, dir)}
                onRemove={() => editing.onRemoveTerm!(a.id)}
              />
            )}
            <span className="w-9 shrink-0 text-right">{a.roman}.</span>
            <span className="flex-1"><E k={a.key} text={a.text} /></span>
          </li>
        ))}
      </ol>

      <p className="mt-6"><E k="validity" text={doc.validity} /></p>
      <p className="mt-4"><E k="mouNote" text={doc.mouNote} /></p>

      <p className="mt-6">Yours Sincerely,</p>
      <p className="mt-4">{doc.signoff.name}<br />{doc.signoff.title}<br />{doc.signoff.company}</p>

      <Footer company={company} />
    </article>
    </EditingContext.Provider>
  )
}

export const EditingContext = createContext<PreviewEditing | undefined>(undefined)

/** Editable text when the preview is in edit mode, plain text otherwise. */
export function E({ k, text, className }: { k: string; text: string; className?: string }) {
  const editing = useContext(EditingContext)
  if (!editing) return <span className={className}><RichText text={text} /></span>
  return (
    <Editable
      text={text}
      className={className}
      edited={editing.isEdited(k)}
      onSave={(v) => editing.onText(k, v)}
      onReset={() => editing.onReset(k)}
    />
  )
}

export function Letterhead({ company }: { company: CompanySettings }) {
  return (
    <header className="flex flex-col gap-4 border-b-2 border-atom-teal pb-4 font-sans sm:flex-row sm:items-start sm:justify-between">
      <img src="/atom-logo.png" alt="Atom Consultancy" className="w-40" />
      <div className="text-xs leading-snug text-neutral-700 sm:max-w-[300px] sm:text-right">
        <p>{company.address}</p>
        <p className="mt-1">{company.phone} · {company.email}</p>
      </div>
    </header>
  )
}

export function Footer({ company }: { company: CompanySettings }) {
  return (
    <footer className="mt-10 border-t border-neutral-200 pt-3 text-center font-sans text-[10px] leading-snug text-neutral-500">
      {company.name} · {company.address}
      <br />
      {company.gstin && <>GSTIN {company.gstin} · </>}{company.website} · {company.email} · {company.phone}
    </footer>
  )
}

export function H({ children }: { children: ReactNode }) {
  return <h3 className="mt-7 mb-2 font-bold text-atom-ink">{children}</h3>
}

export function Th({ children, w }: { children?: ReactNode; w?: string }) {
  return <th style={{ width: w }} className="border border-neutral-400 px-2 py-1 text-left font-bold">{children}</th>
}

export function Td({ children }: { children?: ReactNode }) {
  return <td className="border border-neutral-400 px-2 py-1 align-top">{children}</td>
}

export function Table({ headers, widths, rows, total }: { headers: string[]; widths: string[]; rows: string[][]; total?: string[] }) {
  return (
    <table className="mt-2 w-full border-collapse text-[13px]">
      <thead>
        <tr className="bg-atom-teal/10">{headers.map((h, i) => <Th key={h} w={widths[i]}>{h}</Th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <Td key={j}>{c}</Td>)}</tr>)}
        {total && <tr className="font-bold">{total.map((c, j) => <Td key={j}>{c}</Td>)}</tr>}
      </tbody>
    </table>
  )
}
