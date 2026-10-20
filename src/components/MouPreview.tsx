import type { Block, MouDoc } from '../../supabase/functions/_shared/engine/mou.ts'
import type { CompanySettings } from '../../supabase/functions/_shared/engine/settings.ts'
import { E, EditingContext, Footer, type PreviewEditing } from './QuotePreview'

function NewTag({ show }: { show?: boolean }) {
  if (!show) return null
  return (
    <span className="ml-2 inline-block rounded bg-amber-200 px-1.5 py-0.5 align-middle font-sans text-[10px] font-semibold text-amber-900">
      NEW: please have your lawyer review
    </span>
  )
}

function Blocks({ blocks, admin }: { blocks: Block[]; admin: boolean }) {
  return (
    <>
      {blocks.map((b, i) => {
        if (b.type === 'p') return <p key={i} className="mb-2"><E k={b.key} text={b.text} />{admin && <NewTag show={b.isNew} />}</p>
        if (b.type === 'heading') return <p key={i} className="mt-3 mb-1 font-bold">{b.text}</p>
        if (b.type === 'table') {
          return (
            <table key={i} className="my-2 w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-atom-teal/10">
                  {b.headers.map((h, j) => <th key={j} style={{ width: `${b.widths[j]}%` }} className="border border-neutral-400 px-2 py-1 text-left">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((r, ri) => (
                  <tr key={ri} className={b.boldLast && ri === b.rows.length - 1 ? 'font-bold' : ''}>
                    {r.map((c, ci) => <td key={ci} className="border border-neutral-400 px-2 py-1 align-top">{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
        return (
          <div key={i}>
            {b.items.map((it) => (
              <div key={it.key} className="mb-1.5">
                <div className="flex gap-2">
                  <span className="w-6 shrink-0">{it.label}</span>
                  <span className="flex-1"><E k={it.key} text={it.text} />{admin && <NewTag show={it.isNew} />}</span>
                </div>
                {it.children && <div className="ml-8"><Blocks blocks={it.children} admin={admin} /></div>}
              </div>
            ))}
          </div>
        )
      })}
    </>
  )
}

/** The MOU drawn as a page — same structure as the PDF. `admin` shows the review tags. */
export function MouPreview({ doc, company, editing, admin = false }: { doc: MouDoc; company: CompanySettings; editing?: PreviewEditing; admin?: boolean }) {
  return (
    <EditingContext.Provider value={editing}>
      <article className="mx-auto w-full max-w-[820px] bg-white px-6 py-8 font-serif text-[14px] leading-relaxed text-neutral-900 shadow-sm ring-1 ring-neutral-200 sm:px-14 sm:py-12">
        <div className="mb-3 flex justify-center"><img src="/atom-logo.png" alt="Atom Consultancy" className="w-28" /></div>
        <h1 className="mb-4 text-center font-bold">{doc.title}</h1>
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            <tr><td colSpan={2} className="border border-neutral-500 px-2 py-1"><b>Effective Date:</b> {doc.effectiveDate || <span className="text-neutral-400">(filled in when the last party signs)</span>}</td></tr>
            <tr><td colSpan={2} className="border border-neutral-500 px-2 py-1"><b>Place:</b> {doc.place}</td></tr>
            <tr className="bg-atom-teal/10">
              <th className="w-1/2 border border-neutral-500 px-2 py-1 text-left">FIRST PARTY (“Consultant”)</th>
              <th className="w-1/2 border border-neutral-500 px-2 py-1 text-left">SECOND PARTY (“Client”)</th>
            </tr>
            {doc.parties.map((p) => (
              <tr key={p.label}>
                <td className="border border-neutral-500 px-2 py-1 align-top"><b>{p.label}:</b> {p.consultant}</td>
                <td className={`border border-neutral-500 px-2 py-1 align-top ${admin && p.client === '—' ? 'bg-red-50 text-red-700' : ''}`}>
                  <b>{p.label === 'Name' ? 'Name of Client' : p.label}:</b> {p.client}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {doc.sections.map((sec) => (
          <section key={sec.key} className="mt-5">
            <div className="flex gap-2">
              <span className="w-6 shrink-0 font-bold">{sec.number}.</span>
              <div className="flex-1">
                {sec.heading && <p className="mb-2 font-bold">{sec.heading}:{admin && <NewTag show={sec.isNew} />}</p>}
                <Blocks blocks={sec.blocks} admin={admin} />
              </div>
            </div>
          </section>
        ))}

        <div className="mt-8 grid grid-cols-1 border border-neutral-600 sm:grid-cols-2">
          {[doc.signatures.consultant, doc.signatures.client].map((sig, i) => (
            <div key={i} className={`p-4 ${i ? 'border-t border-neutral-600 sm:border-t-0 sm:border-l' : ''}`}>
              <p>For <b>{sig.company}</b></p>
              <div className="h-14" />
              <p>____________________________</p>
              <p><b>Name:</b> {sig.name}</p>
              <p><b>Title:</b> {sig.title}</p>
            </div>
          ))}
        </div>
        <Footer company={company} />
      </article>
    </EditingContext.Provider>
  )
}
