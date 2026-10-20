import { Font, Image, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { Style } from '@react-pdf/types'
import type { CompanySettings } from '../../supabase/functions/_shared/engine/settings.ts'

Font.register({
  family: 'Prompt',
  fonts: [
    { src: '/fonts/Prompt-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/Prompt-Medium.ttf', fontWeight: 500 },
    { src: '/fonts/Prompt-SemiBold.ttf', fontWeight: 600 },
  ],
})
// Keep words whole (no automatic hyphenation).
Font.registerHyphenationCallback((word) => [word])

export const RED = '#DF2C21'
export const TINT = '#FBE6E4'

export const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 64, paddingHorizontal: 54, fontFamily: 'Times-Roman', fontSize: 10.5, lineHeight: 1.4, color: '#111' },
  letterhead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1.5, borderBottomColor: RED, paddingBottom: 10, marginBottom: 14 },
  logo: { width: 120 },
  lhText: { fontFamily: 'Prompt', fontSize: 7.5, color: '#444', textAlign: 'right', maxWidth: 230, lineHeight: 1.35 },
  h: { fontFamily: 'Times-Bold', fontSize: 11, marginTop: 14, marginBottom: 5 },
  p: { marginBottom: 4 },
  bold: { fontFamily: 'Times-Bold' },
  row: { flexDirection: 'row' },
  footer: { position: 'absolute', bottom: 24, left: 54, right: 54, borderTopWidth: 0.5, borderTopColor: '#ccc', paddingTop: 5, fontFamily: 'Prompt', fontSize: 6.8, color: '#777', textAlign: 'center', lineHeight: 1.35 },
  table: { borderTopWidth: 0.75, borderLeftWidth: 0.75, borderColor: '#555', marginTop: 4, marginBottom: 4 },
  tr: { flexDirection: 'row' },
  th: { borderRightWidth: 0.75, borderBottomWidth: 0.75, borderColor: '#555', padding: 3, fontFamily: 'Times-Bold', backgroundColor: TINT },
  td: { borderRightWidth: 0.75, borderBottomWidth: 0.75, borderColor: '#555', padding: 3 },
})

/** PDF fonts don't include the ₹ sign, so we write "Rs." instead. */
export function pdfSafe(text: string): string {
  return text.replace(/₹\s?/g, 'Rs. ')
}

/** Text with **bold** markers. */
export function Rich({ text, style }: { text: string; style?: Style | Style[] }) {
  const parts = pdfSafe(text).split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? <Text key={i} style={s.bold}>{p.slice(2, -2)}</Text> : p,
      )}
    </Text>
  )
}

export function Letterhead({ company }: { company: CompanySettings }) {
  return (
    <View style={s.letterhead} fixed>
      <Image src="/atom-logo.png" style={s.logo} />
      <View>
        <Text style={s.lhText}>{company.address}</Text>
        <Text style={[s.lhText, { marginTop: 2 }]}>{company.phone}  ·  {company.email}</Text>
      </View>
    </View>
  )
}

export function Footer({ company, label }: { company: CompanySettings; label?: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>{company.name} · {company.address}</Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          `${company.gstin ? `GSTIN ${company.gstin} · ` : ''}${company.website} · ${company.email} · ${company.phone}    ${label ? `${label} · ` : ''}Page ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  )
}

/** A table that is never split across pages (small tables) or keeps rows whole (long ones). */
export function PdfTable({ headers, widths, rows, boldLast }: { headers: string[]; widths: number[]; rows: string[][]; boldLast?: boolean }) {
  const small = rows.length <= 12
  return (
    <View style={s.table} wrap={!small}>
      <View style={s.tr} fixed={!small}>
        {headers.map((h, i) => (
          <Text key={i} style={[s.th, { width: `${widths[i]}%` }]}>{h}</Text>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} style={s.tr} wrap={false}>
          {r.map((c, ci) => (
            <Rich key={ci} text={c} style={[s.td, { width: `${widths[ci]}%` }, boldLast && ri === rows.length - 1 ? s.bold : {}]} />
          ))}
        </View>
      ))}
    </View>
  )
}

/** Numbered/lettered list item with a hanging label. */
export function Item({ label, text, indent = 0, labelWidth = 22 }: { label: string; text: string; indent?: number; labelWidth?: number }) {
  return (
    <View style={[s.row, { marginLeft: indent, marginBottom: 3 }]} wrap={false}>
      <Text style={{ width: labelWidth, textAlign: 'right', paddingRight: 6 }}>{label}</Text>
      <Rich text={text} style={{ flex: 1 }} />
    </View>
  )
}
