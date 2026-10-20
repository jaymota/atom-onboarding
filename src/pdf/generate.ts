// Loads the PDF library only when needed (it is large) and returns a PDF file.
import type { QuoteDoc } from '../../supabase/functions/_shared/engine/quote.ts'
import type { MouDoc } from '../../supabase/functions/_shared/engine/mou.ts'
import type { CompanySettings } from '../../supabase/functions/_shared/engine/settings.ts'

export async function quotePdfBlob(doc: QuoteDoc, company: CompanySettings): Promise<Blob> {
  const [{ pdf }, { QuotePdf }, React] = await Promise.all([import('@react-pdf/renderer'), import('./QuotePdf'), import('react')])
  return pdf(React.createElement(QuotePdf, { doc, company }) as never).toBlob()
}

export async function mouPdfBlob(doc: MouDoc, company: CompanySettings): Promise<Blob> {
  const [{ pdf }, { MouPdf }, React] = await Promise.all([import('@react-pdf/renderer'), import('./MouPdf'), import('react')])
  return pdf(React.createElement(MouPdf, { doc, company }) as never).toBlob()
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function safeName(s: string): string {
  return s.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Client'
}

/** "2026-10-16" -> "16-10-2026" for file names. */
export function fileDate(iso: string): string {
  return iso.split('-').reverse().join('-')
}
