import type { ReactElement } from 'react'
import { Document, Page, Text, View } from '@react-pdf/renderer'
import { SECTION_TITLES, type QuoteDoc, type SectionKey } from '../../supabase/functions/_shared/engine/quote.ts'
import type { CompanySettings } from '../../supabase/functions/_shared/engine/settings.ts'
import { Footer, Item, Letterhead, PdfTable, Rich, TEAL, pdfSafe, s } from './common'

const title = (id: SectionKey) => <Text style={s.h} minPresenceAhead={60}>{SECTION_TITLES[id]}</Text>

function Scope({ doc }: { doc: QuoteDoc }) {
  return (
    <View>
      {title('scope')}
      {doc.intro ? <Rich text={doc.intro} style={s.p} /> : null}
      {doc.phases.map((ph) => (
        <View key={ph.group}>
          {doc.showPhaseHeadings ? <Text style={[s.bold, { marginTop: 8, marginBottom: 4, color: TEAL }]} minPresenceAhead={40}>{ph.title}</Text> : null}
          {ph.items.map((it) => <Item key={it.id} label={`${it.n}.`} text={it.text} indent={14} />)}
        </View>
      ))}
    </View>
  )
}

function Fees({ doc }: { doc: QuoteDoc }) {
  return (
    <View>
      <View wrap={false}>
        {title('fees')}
        <Rich text={doc.feesText} style={s.p} />
        {doc.feeLines.map((l) => <Rich key={l.key} text={l.text} style={{ marginTop: 6 }} />)}
      </View>
      {doc.tranches ? (
        <View wrap={false}>
          {doc.tranchesIntro ? <Rich text={`**${doc.tranchesIntro}**`} style={{ marginTop: 8, marginBottom: 2 }} /> : <View style={{ height: 8 }} />}
          <PdfTable
            headers={['Sr.No.', 'Milestone', '% of Fees', 'Amount (INR)']}
            widths={[12, 48, 18, 22]}
            rows={[
              ...doc.tranches.rows.map((r) => [String(r.n), r.name, `${r.pct}%`, r.amount.replace('₹', '')]),
              ['', 'Total', `${doc.tranches.totalPct}%`, doc.tranches.totalAmount.replace('₹', '')],
            ]}
            boldLast
          />
        </View>
      ) : null}
      {doc.gstSummary ? (
        <View style={{ alignSelf: 'flex-end', width: 230, marginTop: 2 }} wrap={false}>
          {[
            ['Fees', doc.gstSummary.fee],
            [doc.gstSummary.gstLabel, doc.gstSummary.gst],
            ['Total', doc.gstSummary.total],
          ].map(([a, b], i) => (
            <View key={a} style={[s.row, { justifyContent: 'space-between' }, i === 2 ? s.bold : {}]}>
              <Text>{a}</Text>
              <Text>{pdfSafe(b)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

function Timeline({ doc }: { doc: QuoteDoc }) {
  return (
    <View wrap={false}>
      {title('timeline')}
      <PdfTable
        headers={['Sr.No.', 'Actionables', 'Timeline']}
        widths={[12, 58, 30]}
        rows={[...doc.timeline.rows.map((r) => [String(r.n), r.label, r.period]), ['', 'Total', doc.timeline.total]]}
        boldLast
      />
    </View>
  )
}

function Costs({ doc }: { doc: QuoteDoc }) {
  if (!doc.costs) return null
  return (
    <View wrap={false}>
      {title('costs')}
      <PdfTable headers={['Sr. No.', 'Areas of Work', 'Fees / Costs']} widths={[12, 58, 30]} rows={doc.costs.rows.map((r) => [String(r.n), r.label, r.value])} />
    </View>
  )
}

function Terms({ doc }: { doc: QuoteDoc }) {
  return (
    <View>
      {title('terms')}
      {doc.assumptionsIntro ? <Rich text={doc.assumptionsIntro} style={{ marginBottom: 6 }} /> : null}
      {doc.assumptions.map((a) => <Item key={a.id} label={`${a.roman}.`} text={a.text} indent={8} labelWidth={30} />)}
    </View>
  )
}

function Closing({ doc }: { doc: QuoteDoc }) {
  return (
    <View wrap={false}>
      {doc.validity ? <Rich text={doc.validity} style={{ marginTop: 12 }} /> : null}
      {doc.mouNote ? <Rich text={doc.mouNote} style={{ marginTop: 10 }} /> : null}
    </View>
  )
}

const SECTIONS: Record<SectionKey, (p: { doc: QuoteDoc }) => ReactElement | null> = {
  scope: Scope, fees: Fees, timeline: Timeline, costs: Costs, terms: Terms, closing: Closing,
}

export function QuotePdf({ doc, company }: { doc: QuoteDoc; company: CompanySettings }) {
  return (
    <Document title={`Quotation ${doc.quoteNumber}`} author={company.name} creator={company.name}>
      <Page size="A4" style={s.page}>
        <Letterhead company={company} />
        <Footer company={company} />

        <Text style={{ textAlign: 'right' }}>
          <Text style={s.bold}>Date: </Text>{doc.date}
        </Text>
        {doc.quoteNumber ? <Text style={{ textAlign: 'right', fontSize: 8.5, color: '#666' }}>Ref: {doc.quoteNumber}</Text> : null}
        <Rich text={doc.to} style={{ marginTop: 10 }} />
        <Rich text={`**Subject:** ${doc.subject}`} style={{ marginTop: 10 }} />

        {doc.sections.map((id) => {
          const Section = SECTIONS[id]
          return <Section key={id} doc={doc} />
        })}

        <View wrap={false}>
          <Text style={{ marginTop: 14 }}>Yours Sincerely,</Text>
          <Text style={{ marginTop: 12 }}>{doc.signoff.name}</Text>
          <Text>{doc.signoff.title}</Text>
          <Text>{doc.signoff.company}</Text>
        </View>
      </Page>
    </Document>
  )
}
