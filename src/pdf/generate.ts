// Loads the PDF library only when needed (it is large) and returns a PDF file.
import type { QuoteDoc } from '../../supabase/functions/_shared/engine/quote.ts'
import type { MouDoc } from '../../supabase/functions/_shared/engine/mou.ts'
import type { CompanySettings } from '../../supabase/functions/_shared/engine/settings.ts'

export async function quotePdfBlob(doc: QuoteDoc, company: CompanySettings): Promise<Blob> {
  const [{ pdf }, { QuotePdf }, React] = await Promise.all([import('@react-pdf/renderer'), import('./QuotePdf'), import('react')])
  const blob = await pdf(React.createElement(QuotePdf, { doc, company }) as never).toBlob()
  return addPageNumbers(blob, doc.quoteNumber)
}

export async function mouPdfBlob(doc: MouDoc, company: CompanySettings): Promise<Blob> {
  const [{ pdf }, { MouPdf }, React] = await Promise.all([import('@react-pdf/renderer'), import('./MouPdf'), import('react')])
  const blob = await pdf(React.createElement(MouPdf, { doc, company }) as never).toBlob()
  return addPageNumbers(blob, 'MOU')
}

/** Writes "Page X of Y" in the bottom-right corner of every page. */
async function addPageNumbers(blob: Blob, label: string): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdfDoc = await PDFDocument.load(await blob.arrayBuffer())
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const pages = pdfDoc.getPages()
  pages.forEach((page, i) => {
    const text = `${label ? `${label}  ·  ` : ''}Page ${i + 1} of ${pages.length}`
    const size = 6.5
    const { width } = page.getSize()
    page.drawText(text, { x: width - 54 - font.widthOfTextAtSize(text, size), y: 12, size, font, color: rgb(0.47, 0.47, 0.47) })
  })
  const bytes = await pdfDoc.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
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
