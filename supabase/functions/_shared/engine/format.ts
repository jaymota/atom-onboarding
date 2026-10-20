// Indian formatting helpers shared by the website and the server functions.

/** 900000 -> "9,00,000" (Indian digit grouping, no decimals unless present). */
export function formatINR(n: number): string {
  if (!Number.isFinite(n)) return ''
  const negative = n < 0
  const [intPart, decPart] = Math.abs(Math.round(n * 100) / 100).toFixed(2).split('.')
  let out = intPart
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3)
    const rest = intPart.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')
    out = `${rest},${last3}`
  }
  if (decPart !== '00') out += `.${decPart}`
  return (negative ? '-' : '') + out
}

/** 900000 -> "₹9,00,000" */
export function rupees(n: number): string {
  return `₹${formatINR(n)}`
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigits(n: number): string {
  if (n < 20) return ONES[n]
  return [TENS[Math.floor(n / 10)], ONES[n % 10]].filter(Boolean).join(' ')
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100)
  const r = n % 100
  return [h ? `${ONES[h]} Hundred` : '', r ? twoDigits(r) : ''].filter(Boolean).join(' ')
}

/** 150000 -> "One Lakh Fifty Thousand" (Indian system: crore, lakh, thousand). */
export function numberToIndianWords(num: number): string {
  let n = Math.floor(Math.abs(num))
  if (n === 0) return 'Zero'
  const parts: string[] = []
  const crore = Math.floor(n / 1_00_00_000)
  n %= 1_00_00_000
  const lakh = Math.floor(n / 1_00_000)
  n %= 1_00_000
  const thousand = Math.floor(n / 1000)
  n %= 1000
  if (crore) parts.push(`${crore >= 100 ? numberToIndianWords(crore) : twoDigits(crore)} Crore`)
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`)
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`)
  if (n) parts.push(threeDigits(n))
  return parts.join(' ')
}

/** 900000 -> "Indian Rupees Nine Lakh only" */
export function amountInWords(n: number): string {
  const rupeesPart = Math.floor(Math.abs(n))
  const paise = Math.round((Math.abs(n) - rupeesPart) * 100)
  let s = `Indian Rupees ${numberToIndianWords(rupeesPart)}`
  if (paise) s += ` and ${twoDigits(paise)} Paise`
  return `${s} only`
}

/** Date -> "16/10/2026" */
export function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return ''
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${date.getFullYear()}`
}

/** Today's date in India as YYYY-MM-DD. */
export function todayIST(now: Date = new Date()): string {
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000)
  return ist.toISOString().slice(0, 10)
}

/** Indian financial year label for a date: 2026-10-16 -> "2026-27" (April–March). */
export function financialYear(isoDate: string): string {
  const [y, m] = isoDate.split('-').map(Number)
  const start = m >= 4 ? y : y - 1
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}

const ROMAN: [number, string][] = [
  [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'],
  [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
]

/** 4 -> "iv" */
export function toRoman(n: number): string {
  let out = ''
  for (const [v, s] of ROMAN) {
    while (n >= v) {
      out += s
      n -= v
    }
  }
  return out
}

/** 0 -> "A", 1 -> "B" */
export function toLetter(i: number): string {
  return String.fromCharCode(65 + i)
}

const WEEKS_PER_MONTH = 52 / 12

/** 28 -> "6 - 7 months" using 4.33 weeks per month. */
export function weeksToMonthsText(weeks: number): string {
  const exact = weeks / WEEKS_PER_MONTH
  const lo = Math.floor(exact + 0.05)
  const hi = Math.ceil(exact - 0.05)
  if (lo === hi) return `${lo} months`
  return `${lo} - ${hi} months`
}

/** Fill {placeholders} in template text. Unknown placeholders are left as-is. */
export function fill(text: string, vars: Record<string, string | number | undefined>): string {
  return text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : String(vars[k])))
}
