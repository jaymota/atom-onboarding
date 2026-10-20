import { Document, Image, Page, Text, View } from '@react-pdf/renderer'
import type { Block, MouDoc } from '../../supabase/functions/_shared/engine/mou.ts'
import type { CompanySettings } from '../../supabase/functions/_shared/engine/settings.ts'
import { Footer, PdfTable, Rich, s } from './common'

function Blocks({ blocks, indent }: { blocks: Block[]; indent: number }) {
  return (
    <>
      {blocks.map((b, i) => {
        if (b.type === 'p') return <Rich key={i} text={b.text} style={{ marginLeft: indent, marginBottom: 6 }} />
        if (b.type === 'heading') return <Text key={i} style={[s.bold, { marginLeft: indent, marginTop: 6, marginBottom: 4 }]} minPresenceAhead={40}>{b.text}</Text>
        if (b.type === 'table') {
          return (
            <View key={i} style={{ marginLeft: indent, marginBottom: 6 }}>
              <PdfTable headers={b.headers} widths={b.widths} rows={b.rows} boldLast={b.boldLast} />
            </View>
          )
        }
        return (
          <View key={i} style={{ marginLeft: indent }}>
            {b.items.map((it) => (
              <View key={it.key} style={{ marginBottom: 4 }}>
                <View style={s.row} wrap={false}>
                  <Text style={{ width: 22 }}>{it.label}</Text>
                  <Rich text={it.text} style={{ flex: 1 }} />
                </View>
                {it.children ? <Blocks blocks={it.children} indent={22} /> : null}
              </View>
            ))}
          </View>
        )
      })}
    </>
  )
}


export function MouPdf({ doc, company }: { doc: MouDoc; company: CompanySettings }) {
  return (
    <Document title={`MOU - ${doc.signatures.client.company}`} author={company.name}>
      <Page size="A4" style={s.page}>
        <View style={{ alignItems: 'center', marginBottom: 10 }} fixed>
          <Image src="/atom-logo.png" style={{ width: 90 }} />
        </View>
        <Footer company={company} />
        <Text style={{ fontFamily: 'Times-Bold', fontSize: 12, textAlign: 'center', marginBottom: 10 }}>{doc.title}</Text>

        <View style={s.table} wrap={false}>
          <View style={s.tr}>
            <Text style={[s.td, { width: '100%' }]}><Text style={s.bold}>Effective Date: </Text>{doc.effectiveDate}</Text>
          </View>
          <View style={s.tr}>
            <Text style={[s.td, { width: '100%' }]}><Text style={s.bold}>Place: </Text>{doc.place}</Text>
          </View>
          <View style={s.tr}>
            <Text style={[s.th, { width: '50%' }]}>FIRST PARTY (“Consultant”)</Text>
            <Text style={[s.th, { width: '50%' }]}>SECOND PARTY (“Client”)</Text>
          </View>
          {doc.parties.map((p) => (
            <View key={p.label} style={s.tr}>
              <Text style={[s.td, { width: '50%' }]}><Text style={s.bold}>{p.label}: </Text>{p.consultant}</Text>
              <Text style={[s.td, { width: '50%' }]}><Text style={s.bold}>{p.label === 'Name' ? 'Name of Client' : p.label}: </Text>{p.client}</Text>
            </View>
          ))}
        </View>

        {doc.sections.map((sec) => (
          <View key={sec.key} style={{ marginTop: 10 }}>
            <View style={s.row} minPresenceAhead={50}>
              <Text style={[s.bold, { width: 20 }]}>{sec.number}.</Text>
              {sec.heading ? <Text style={[s.bold, { flex: 1 }]}>{sec.heading}{sec.key === 'background' ? '' : ':'}</Text> : null}
            </View>
            <View style={{ marginTop: sec.heading ? 4 : -14 }}>
              <Blocks blocks={sec.blocks} indent={20} />
            </View>
          </View>
        ))}

        <View style={[s.row, { marginTop: 24, borderWidth: 0.75, borderColor: '#333' }]} wrap={false}>
          {[doc.signatures.consultant, doc.signatures.client].map((sig, i) => (
            <View key={i} style={{ width: '50%', padding: 10, borderLeftWidth: i ? 0.75 : 0, borderColor: '#333', minHeight: 110 }}>
              <Text>For <Text style={s.bold}>{sig.company}</Text></Text>
              <View style={{ height: 46 }} />
              <Text>____________________________</Text>
              <Text><Text style={s.bold}>Name: </Text>{sig.name}</Text>
              <Text><Text style={s.bold}>Title: </Text>{sig.title}</Text>
            </View>
          ))}
        </View>

      </Page>
    </Document>
  )
}
