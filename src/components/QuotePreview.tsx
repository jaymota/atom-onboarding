import { createContext, useContext, type ReactNode } from 'react'
import { SECTION_TITLES, type QuoteDoc, type SectionKey } from '../../supabase/functions/_shared/engine/quote.ts'
import type { CompanySettings } from '../../supabase/functions/_shared/engine/settings.ts'
import { Editable, RichText } from './ui'

/**
 * One editing system for the whole document:
 * click text to edit · hover to move ↑↓ or remove · "+ Add" at the end of each list.
 */
export interface PreviewEditing {
  onText: (key: string, value: string) => void
  onReset: (key: string) => void
  isEdited: (key: string) => boolean
  onRemove?: (key: string) => void
  onMove?: (listKey: string, id: string, dir: -1 | 1) => void
  onAdd?: (listKey: string) => void
}

export const EditingContext = createContext<PreviewEditing | undefined>(undefined)

/** Editable text when editing, plain text otherwise. */
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

/** Small ↑ ↓ ✕ toolbar, shown only while hovering its line. */
function Tools({ listKey, id, removeKey, index, count, what, group = 'line' }: {
  listKey?: string
  id?: string
  removeKey?: string
  index?: number
  count?: number
  what: string
  group?: 'line' | 'sec'
}) {
  const editing = useContext(EditingContext)
  if (!editing) return null
  const canMove = listKey && id && editing.onMove && count !== undefined && count > 1
  const btn = 'flex h-6 w-6 items-center justify-center rounded text-xs text-neutral-600 hover:bg-atom-aqua disabled:opacity-25'
  const show = group === 'sec' ? 'group-hover/sec:flex' : 'group-hover/line:flex'
  return (
    <span className={`absolute -top-3 right-0 z-10 hidden items-center rounded-md border border-neutral-200 bg-white font-sans font-normal shadow ${show}`}>
      {canMove && (
        <>
          <button type="button" className={btn} disabled={index === 0} onClick={() => editing.onMove!(listKey!, id!, -1)} title={`Move ${what} up`}>↑</button>
          <button type="button" className={btn} disabled={index === count! - 1} onClick={() => editing.onMove!(listKey!, id!, 1)} title={`Move ${what} down`}>↓</button>
        </>
      )}
      {removeKey && editing.onRemove && (
        <button type="button" className={`${btn} hover:text-red-600`} onClick={() => editing.onRemove!(removeKey)} title={`Remove this ${what}`}>✕</button>
      )}
    </span>
  )
}

/** "+ Add …" link at the end of a list (edit mode only). */
function Add({ listKey, label }: { listKey: string; label: string }) {
  const editing = useContext(EditingContext)
  if (!editing?.onAdd) return null
  return (
    <button type="button" onClick={() => editing.onAdd!(listKey)} className="mt-1 ml-9 font-sans text-xs text-neutral-400 hover:text-atom-teal">
      + {label}
    </button>
  )
}

/** A removable paragraph. */
function Line({ k, text, className = '' }: { k: string; text: string; className?: string }) {
  if (!text) return null
  return (
    <p className={`group/line relative ${className}`}>
      <Tools removeKey={k} what="line" />
      <E k={k} text={text} />
    </p>
  )
}

/** Section wrapper: heading plus a move/remove toolbar for the whole section. */
function Section({ id, index, count, title, children }: { id: SectionKey; index: number; count: number; title?: string; children: ReactNode }) {
  return (
    <section className="group/sec relative mt-7">
      <Tools listKey="sections" id={id} removeKey={`sec:${id}`} index={index} count={count} what="section" group="sec" />
      {title && <H>{title}</H>}
      {children}
    </section>
  )
}

function ScopeSection({ doc }: { doc: QuoteDoc }) {
  return (
    <>
      <Line k="intro" text={doc.intro} />
      {doc.phases.map((ph) => (
        <div key={ph.group} className="mt-3">
          {doc.showPhaseHeadings && <p className="mt-4 mb-1 font-bold text-atom-teal"><E k={`phase:${ph.group}`} text={ph.title} /></p>}
          <ol className="ml-6 space-y-1">
            {ph.items.map((it, i) => (
              <li key={it.id} className="group/line relative flex gap-2">
                <Tools listKey={ph.listKey} id={it.id} removeKey={it.id} index={i} count={ph.items.length} what="point" />
                <span className="w-7 shrink-0 text-right">{it.n}.</span>
                <span className="flex-1"><E k={it.key} text={it.text} /></span>
              </li>
            ))}
          </ol>
          <Add listKey={ph.listKey} label="Add point" />
        </div>
      ))}
    </>
  )
}

function FeesSection({ doc }: { doc: QuoteDoc }) {
  return (
    <>
      <p><E k={doc.model === 'retainer' ? 'fees:retainer' : 'fees:milestone'} text={doc.feesText} /></p>
      {doc.feeLines.map((l) => <Line key={l.key} k={l.key} text={l.text} className="mt-3" />)}
      {doc.tranches && (
        <>
          <Line k="tranchesIntro" text={doc.tranchesIntro ? `**${doc.tranchesIntro}**` : ''} className="mt-4" />
          <Table headers={['Sr.No.', 'Milestone', '% of Fees', 'Amount']} widths={['12%', '48%', '18%', '22%']}>
            {doc.tranches.rows.map((r, i) => (
              <Row key={r.id} listKey="tranches" id={r.id} index={i} count={doc.tranches!.rows.length} what="tranche"
                cells={[r.n, r.name, `${r.pct}%`, r.amount]} />
            ))}
            <Row bold cells={['', 'Total', `${doc.tranches.totalPct}%`, doc.tranches.totalAmount]} />
          </Table>
        </>
      )}
      {doc.gstSummary && (
        <div className="group/line relative mt-2 ml-auto w-fit">
          <Tools removeKey="gstSummary" what="GST summary" />
          <table className="text-[13px]">
            <tbody>
              <tr><td className="pr-6">Fees</td><td className="text-right">{doc.gstSummary.fee}</td></tr>
              <tr><td className="pr-6">{doc.gstSummary.gstLabel}</td><td className="text-right">{doc.gstSummary.gst}</td></tr>
              <tr className="font-bold"><td className="pr-6">Total</td><td className="text-right">{doc.gstSummary.total}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function TimelineSection({ doc }: { doc: QuoteDoc }) {
  const rows = doc.timeline.rows
  return (
    <>
      <Table headers={['Sr.No.', 'Actionables', 'Timeline']} widths={['12%', '58%', '30%']}>
        {rows.map((r, i) => (
          <Row key={r.id} listKey="timeline" id={r.id} index={i} count={rows.length} what="row"
            cells={[r.n, <E k={r.labelKey} text={r.label} />, <E k={`tlp:${r.id}`} text={r.period} />]} />
        ))}
        <Row bold cells={['', 'Total', <E k="tl:total" text={doc.timeline.total} />]} />
      </Table>
      <Add listKey="timeline" label="Add row" />
    </>
  )
}

function CostsSection({ doc }: { doc: QuoteDoc }) {
  const rows = doc.costs?.rows ?? []
  return (
    <>
      <Table headers={['Sr. No.', 'Areas of Work', 'Fees / Costs']} widths={['12%', '58%', '30%']}>
        {rows.map((r, i) => (
          <Row key={r.id} listKey="costs" id={r.id} index={i} count={rows.length} what="row"
            cells={[r.n, <E k={r.labelKey} text={r.label} />, <E k={r.valueKey} text={r.value} />]} />
        ))}
      </Table>
      <Add listKey="costs" label="Add row" />
    </>
  )
}

function TermsSection({ doc }: { doc: QuoteDoc }) {
  return (
    <>
      <Line k="termsIntro" text={doc.assumptionsIntro} />
      <ol className="mt-2 ml-4 space-y-1">
        {doc.assumptions.map((a, i) => (
          <li key={a.id} className="group/line relative flex gap-2">
            <Tools listKey="terms" id={a.id} removeKey={a.id} index={i} count={doc.assumptions.length} what="term" />
            <span className="w-9 shrink-0 text-right">{a.roman}.</span>
            <span className="flex-1"><E k={a.key} text={a.text} /></span>
          </li>
        ))}
      </ol>
      <Add listKey="terms" label="Add term" />
    </>
  )
}

function ClosingSection({ doc }: { doc: QuoteDoc }) {
  return (
    <>
      <Line k="validity" text={doc.validity} />
      <Line k="mouNote" text={doc.mouNote} className="mt-4" />
    </>
  )
}

const SECTION_BODY: Record<SectionKey, (p: { doc: QuoteDoc }) => ReactNode> = {
  scope: ScopeSection,
  fees: FeesSection,
  timeline: TimelineSection,
  costs: CostsSection,
  terms: TermsSection,
  closing: ClosingSection,
}

/** The quote drawn as a page, in the same order as the PDF. */
export function QuotePreview({ doc, company, editing }: { doc: QuoteDoc; company: CompanySettings; editing?: PreviewEditing }) {
  return (
    <EditingContext.Provider value={editing}>
      <article className="quote-page mx-auto w-full max-w-[820px] bg-white px-6 py-8 font-serif text-[14px] leading-relaxed text-neutral-900 shadow-sm ring-1 ring-neutral-200 sm:px-14 sm:py-12">
        <Letterhead company={company} />
        <p className="mt-6 text-right"><b>Date:</b> {doc.date}</p>
        {doc.quoteNumber && <p className="text-right text-xs text-neutral-500">Ref: {doc.quoteNumber}</p>}
        <p className="mt-4"><E k="to" text={doc.to} /></p>
        <p className="mt-4"><b>Subject:</b> <E k="subject" text={doc.subject} /></p>

        {doc.sections.map((id, i) => {
          const Body = SECTION_BODY[id]
          return (
            <Section key={id} id={id} index={i} count={doc.sections.length} title={id === 'closing' ? undefined : SECTION_TITLES[id]}>
              <Body doc={doc} />
            </Section>
          )
        })}

        <p className="mt-6">Yours Sincerely,</p>
        <p className="mt-4">{doc.signoff.name}<br />{doc.signoff.title}<br />{doc.signoff.company}</p>
        <Footer company={company} />
      </article>
    </EditingContext.Provider>
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
  return <h3 className="mb-2 font-bold text-atom-ink">{children}</h3>
}

function Table({ headers, widths, children }: { headers: string[]; widths: string[]; children: ReactNode }) {
  return (
    <table className="mt-2 w-full border-collapse text-[13px]">
      <thead>
        <tr className="bg-atom-teal/10">
          {headers.map((h, i) => (
            <th key={h} style={{ width: widths[i] }} className="border border-neutral-400 px-2 py-1 text-left font-bold">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

/** Table row; the last cell carries the hover toolbar in edit mode. */
function Row({ cells, listKey, id, index, count, what = 'row', bold }: {
  cells: ReactNode[]
  listKey?: string
  id?: string
  index?: number
  count?: number
  what?: string
  bold?: boolean
}) {
  return (
    <tr className={`group/line ${bold ? 'font-bold' : ''}`}>
      {cells.map((c, i) => (
        <td key={i} className={`border border-neutral-400 px-2 py-1 align-top ${i === cells.length - 1 ? 'relative' : ''}`}>
          {i === cells.length - 1 && id && <Tools listKey={listKey} id={id} removeKey={id} index={index} count={count} what={what} />}
          {c}
        </td>
      ))}
    </tr>
  )
}
