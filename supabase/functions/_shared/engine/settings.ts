// Shape of the private Settings row (stored in the database, editable by Jay).
import {
  type Complexity, type Model, type TimelinePreset, type CountDefaults,
  DEFAULT_PRESETS, DEFAULT_COUNTS,
} from './content.ts'

export interface CompanySettings {
  name: string
  entityType: string
  address: string
  city: string
  gstin: string
  pan: string
  fssai: string
  website: string
  email: string
  phone: string
  signatoryName: string
  signatoryTitle: string
  mouSignatoryTitle: string
}

export interface Settings {
  company: CompanySettings
  /** Suggested fees by model and complexity (₹). null = no suggestion. */
  fees: Record<Model, Record<Complexity, number | null>>
  /** Prices for the "Potential Additional Costs" table (₹). */
  costs: { extraTasting: number | null; extraFlavour: number | null; extraTrial: number | null }
  counts: Record<Model, CountDefaults>
  presets: Record<Complexity, TimelinePreset>
  validityDays: number
  gstRate: number
  /** Jay's own default wording, keyed by clause/item id. Empty = template wording. */
  wording: Record<string, string>
  email: { fromName: string; fromAddress: string; replyTo: string; notifyTo: string }
  /** Link used for the "Open BoldSign" button. */
  signingUrl: string
}

export const DEFAULT_SETTINGS: Settings = {
  company: {
    name: 'Atom Consultancy',
    entityType: 'Proprietorship',
    address: '215, BGTA Ganga, 1, Mukundrao Ambedkar Rd, Wadala Truck Terminal, Sion, Mumbai, Maharashtra 400037',
    city: 'Mumbai, Maharashtra',
    gstin: '',
    pan: '',
    fssai: 'n.a.',
    website: 'www.atomconsulting.in',
    email: 'jay@atomconsulting.in',
    phone: '+91 93723 15541',
    signatoryName: 'Jay Mota',
    signatoryTitle: 'Founder',
    mouSignatoryTitle: 'Founder and CEO',
  },
  fees: {
    milestone: { easy: null, medium: null, hard: null },
    retainer: { easy: null, medium: null, hard: null },
  },
  costs: { extraTasting: null, extraFlavour: null, extraTrial: null },
  counts: DEFAULT_COUNTS,
  presets: DEFAULT_PRESETS,
  validityDays: 30,
  gstRate: 18,
  wording: {},
  email: {
    fromName: 'Atom Consultancy',
    fromAddress: 'quotes@atomconsulting.in',
    replyTo: 'jay@atomconsulting.in',
    notifyTo: 'jay@atomconsulting.in',
  },
  signingUrl: 'https://app.boldsign.com/dashboard',
}

/** Deep-merge saved settings over the defaults so new fields always exist. */
export function mergeSettings(saved: unknown): Settings {
  const s = (saved && typeof saved === 'object' ? saved : {}) as Partial<Settings>
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    company: { ...DEFAULT_SETTINGS.company, ...(s.company ?? {}) },
    fees: {
      milestone: { ...DEFAULT_SETTINGS.fees.milestone, ...(s.fees?.milestone ?? {}) },
      retainer: { ...DEFAULT_SETTINGS.fees.retainer, ...(s.fees?.retainer ?? {}) },
    },
    costs: { ...DEFAULT_SETTINGS.costs, ...(s.costs ?? {}) },
    counts: {
      milestone: { ...DEFAULT_SETTINGS.counts.milestone, ...(s.counts?.milestone ?? {}) },
      retainer: { ...DEFAULT_SETTINGS.counts.retainer, ...(s.counts?.retainer ?? {}) },
    },
    presets: {
      easy: { ...DEFAULT_SETTINGS.presets.easy, ...(s.presets?.easy ?? {}) },
      medium: { ...DEFAULT_SETTINGS.presets.medium, ...(s.presets?.medium ?? {}) },
      hard: { ...DEFAULT_SETTINGS.presets.hard, ...(s.presets?.hard ?? {}) },
    },
    wording: { ...(s.wording ?? {}) },
    email: { ...DEFAULT_SETTINGS.email, ...(s.email ?? {}) },
  }
}
