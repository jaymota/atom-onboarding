// The public intake form: questions, validation and the rules that turn a
// submission into a first-draft quote. Edit the questions here.
import { type ModuleId, type Complexity, MODULES } from './content.ts'
import { type Settings } from './settings.ts'
import { type QuoteInput, newQuoteInput } from './quote.ts'

export type FieldType =
  | 'text' | 'email' | 'tel' | 'textarea' | 'number' | 'date'
  | 'select' | 'radio' | 'checkboxes' | 'checkbox' | 'notice'

export type Validator = 'email' | 'phone' | 'gstin' | 'pan' | 'pincode' | 'url'

export interface Field {
  id: string
  label: string
  type: FieldType
  required?: boolean
  options?: string[]
  /** Adds an "Other" option with a text box. */
  other?: boolean
  placeholder?: string
  help?: string
  validate?: Validator
  half?: boolean
  /** Only show (and require) when another answer matches. */
  showIf?: { field: string; equals?: string | boolean; notEquals?: string | boolean; includes?: string }
  /** A checkbox that, when ticked, makes this field not required. */
  skipWith?: string
}

export interface Step {
  id: string
  title: string
  intro?: string
  fields: Field[]
}

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh',
  'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal', 'Outside India',
]

export const SERVICE_OPTIONS = [
  ...MODULES.map((m) => m.name.replace(' (add-on)', '')),
  'Not sure, please advise',
]

export const COMPLEX_CATEGORIES = ['Dairy & alternatives', 'Health & nutrition supplements']

export const STEPS: Step[] = [
  {
    id: 'you',
    title: 'About you',
    fields: [
      { id: 'fullName', label: 'Full name', type: 'text', required: true, half: true },
      { id: 'designation', label: 'Designation / role', type: 'text', required: true, half: true },
      { id: 'email', label: 'Email', type: 'email', required: true, validate: 'email', half: true },
      { id: 'phone', label: 'Phone / WhatsApp number', type: 'tel', required: true, validate: 'phone', placeholder: '+91 98765 43210', half: true },
      {
        id: 'describes', label: 'What best describes you?', type: 'radio', required: true, other: true,
        options: ['Launching a new brand', 'Existing brand adding a new product', 'Improving an existing product'],
      },
    ],
  },
  {
    id: 'company',
    title: 'Company & billing details',
    intro:
      'Please enter these details exactly as they appear on your registration documents. We use them on your official quotation, agreement (MOU) and tax invoices.',
    fields: [
      { id: 'brandName', label: 'Brand name', type: 'text', required: true, half: true },
      { id: 'legalName', label: 'Registered company / legal entity name', type: 'text', required: true, half: true, help: 'As on your GST or incorporation certificate' },
      {
        id: 'entityType', label: 'Entity type', type: 'select', required: true, other: true,
        options: ['Proprietorship', 'Partnership', 'LLP', 'Private Limited', 'Public Limited', 'Not yet registered'],
      },
      { id: 'addressLine1', label: 'Registered address — line 1', type: 'text', required: true, placeholder: 'Building, street' },
      { id: 'addressLine2', label: 'Address line 2', type: 'text', placeholder: 'Area, landmark (optional)' },
      { id: 'city', label: 'City', type: 'text', required: true, half: true },
      { id: 'state', label: 'State', type: 'select', required: true, options: INDIAN_STATES, half: true },
      { id: 'pincode', label: 'PIN code', type: 'text', required: true, validate: 'pincode', half: true, showIf: { field: 'state', notEquals: 'Outside India' } },
      { id: 'country', label: 'Country', type: 'text', required: true, half: true, showIf: { field: 'state', equals: 'Outside India' } },
      { id: 'billingSame', label: 'Billing address is the same as the registered address', type: 'checkbox' },
      { id: 'billingAddress', label: 'Billing address (with city, state and PIN code)', type: 'textarea', required: true, showIf: { field: 'billingSame', notEquals: true } },
      { id: 'gstin', label: 'GSTIN', type: 'text', required: true, validate: 'gstin', placeholder: '27ABCDE1234F1Z5', skipWith: 'gstNotRegistered', half: true },
      { id: 'gstNotRegistered', label: 'We are not GST registered yet', type: 'checkbox', half: true },
      { id: 'pan', label: 'PAN of the entity', type: 'text', required: true, validate: 'pan', placeholder: 'ABCDE1234F', skipWith: 'panNotAvailable', half: true },
      { id: 'panNotAvailable', label: 'Not applicable / not available yet', type: 'checkbox', half: true },
      { id: 'fssai', label: 'FSSAI licence number (if any)', type: 'text', half: true },
      { id: 'website', label: 'Website / Instagram', type: 'text', half: true },
      { id: 'signatoryNotice', label: 'Who will sign the agreement (MOU) for your company?', type: 'notice' },
      { id: 'signatoryName', label: 'Authorised signatory — full name', type: 'text', required: true, half: true },
      { id: 'signatoryDesignation', label: 'Authorised signatory — designation', type: 'text', required: true, half: true },
      { id: 'signatoryEmail', label: 'Authorised signatory — email (for e-signing)', type: 'email', required: true, validate: 'email' },
      { id: 'billingNotice', label: 'Who should receive invoices?', type: 'notice' },
      { id: 'billingContactName', label: 'Billing contact name', type: 'text', required: true, half: true },
      { id: 'billingEmail', label: 'Billing email', type: 'email', required: true, validate: 'email', half: true },
    ],
  },
  {
    id: 'product',
    title: 'Your product',
    fields: [
      {
        id: 'category', label: 'Product category', type: 'select', required: true, other: true,
        options: [
          'Snacks', 'Beverages (RTD)', 'Beverage premixes & powders', 'Bakery', 'Confectionery', 'Dairy & alternatives',
          'Health & nutrition supplements', 'Sauces, spreads & condiments', 'Ready-to-eat & ready-to-cook', 'Pet food',
        ],
      },
      { id: 'productShort', label: 'In a few words, what is the product?', type: 'text', required: true, placeholder: 'e.g. sugar free popped chips', help: 'This appears on your quotation' },
      { id: 'productDescription', label: 'Describe the product(s) in your own words', type: 'textarea', required: true },
      { id: 'variants', label: 'Number of products / SKUs / flavours / variants', type: 'number', required: true, half: true },
      {
        id: 'formulation', label: 'Do you have a formulation already?', type: 'radio', required: true,
        options: ['No, starting from scratch', 'Rough idea or home recipe', 'Existing commercial product to improve'],
      },
      { id: 'targetConsumer', label: 'Target consumer', type: 'text' },
      { id: 'benchmarks', label: 'Benchmark or competitor products you like (names / links)', type: 'textarea' },
      {
        id: 'claims', label: 'Key claims you want', type: 'checkboxes', other: true,
        options: ['Sugar-free', 'No added sugar', 'High protein', 'Vegan', 'Gluten-free', 'Keto', 'Clean label', 'Organic', 'Probiotic or gut health', 'Fortified'],
      },
      { id: 'packFormat', label: 'Pack format and size', type: 'text', placeholder: 'e.g. 30 g pouch, 250 ml bottle', half: true },
      { id: 'targetMrp', label: 'Target MRP per pack (₹)', type: 'text', half: true },
      { id: 'targetCogs', label: 'Target cost (COGS) per pack, if known (₹)', type: 'text', half: true },
      { id: 'storage', label: 'Storage', type: 'radio', options: ['Ambient', 'Chilled', 'Frozen'] },
      { id: 'shelfLife', label: 'Desired shelf life', type: 'text', placeholder: 'e.g. 6 months', half: true },
      { id: 'firstQty', label: 'Expected first production quantity', type: 'text', placeholder: 'units or kg', half: true },
      { id: 'hasCM', label: 'Do you already have a contract manufacturer?', type: 'radio', options: ['Yes', 'No', 'Not sure'] },
      { id: 'cmName', label: 'Contract manufacturer name', type: 'text', showIf: { field: 'hasCM', equals: 'Yes' } },
      { id: 'packaging', label: 'Do you already have packaging designed?', type: 'radio', options: ['Yes', 'In progress', 'No'] },
    ],
  },
  {
    id: 'project',
    title: 'The project',
    fields: [
      { id: 'services', label: 'Which services are you interested in?', type: 'checkboxes', options: SERVICE_OPTIONS },
      { id: 'launchDate', label: 'Target launch date', type: 'date', half: true },
      {
        id: 'budget', label: 'Indicative budget range', type: 'radio',
        options: ['Under ₹5 lakh', '₹5–10 lakh', '₹10–15 lakh', '₹15 lakh+', 'Prefer to discuss'],
      },
      { id: 'engagement', label: 'Preferred engagement', type: 'radio', options: ['Fixed fee with milestones', 'Monthly retainer', 'Not sure'] },
      {
        id: 'channels', label: 'Sales channels', type: 'checkboxes',
        options: ['Quick commerce', 'E-commerce', 'Modern trade', 'General trade', 'D2C website', 'Export', 'HoReCa'],
      },
      { id: 'heardFrom', label: 'How did you hear about us?', type: 'text' },
      { id: 'notes', label: 'Anything else we should know?', type: 'textarea' },
      { id: 'accuracy', label: 'I confirm the company and billing details above are correct and may be used on official documents.', type: 'checkbox', required: true },
      { id: 'consent', label: 'I agree to be contacted by Atom Consultancy about this enquiry.', type: 'checkbox', required: true },
    ],
  },
]

export type Answers = Record<string, string | string[] | boolean | number | undefined>

export const ALL_FIELDS = STEPS.flatMap((s) => s.fields)

const RE = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  // Indian mobile with optional +91 / 0, or any international number starting with +
  phone: /^(?:(?:\+?91[\s-]?)|0)?[6-9]\d{4}[\s-]?\d{5}$|^\+(?!91)\d[\d\s-]{6,16}$/,
  gstin: /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
  pan: /^[A-Z]{5}\d{4}[A-Z]$/,
  pincode: /^[1-9]\d{5}$/,
  url: /^\S+$/,
}

const MESSAGES: Record<Validator, string> = {
  email: 'Please enter a valid email address',
  phone: 'Please enter a valid mobile number, e.g. +91 98765 43210',
  gstin: 'GSTIN should be 15 characters, e.g. 27ABCDE1234F1Z5',
  pan: 'PAN should be 10 characters, e.g. ABCDE1234F',
  pincode: 'PIN code should be 6 digits',
  url: 'Please check this link',
}

export function isVisible(field: Field, a: Answers): boolean {
  if (!field.showIf) return true
  const v = a[field.showIf.field]
  if (field.showIf.equals !== undefined) return (v ?? false) === field.showIf.equals
  if (field.showIf.notEquals !== undefined) return (v ?? false) !== field.showIf.notEquals
  if (field.showIf.includes !== undefined) return Array.isArray(v) && v.includes(field.showIf.includes)
  return true
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === '' || v === false || (Array.isArray(v) && v.length === 0)
}

/** Returns { fieldId: message } for every problem in the given fields. */
export function validateFields(fields: Field[], a: Answers): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const f of fields) {
    if (f.type === 'notice' || !isVisible(f, a)) continue
    const skipped = f.skipWith ? a[f.skipWith] === true : false
    const v = a[f.id]
    if (isEmpty(v)) {
      if (f.required && !skipped) errors[f.id] = f.type === 'checkbox' ? 'Please tick this box to continue' : 'This is required'
      continue
    }
    if (f.other && (v === 'Other' || (Array.isArray(v) && v.includes('Other'))) && isEmpty(a[`${f.id}_other`])) {
      errors[f.id] = 'Please tell us more in the "Other" box'
    }
    if (f.type === 'number') {
      const n = Number(v)
      if (!Number.isFinite(n) || n < 1 || n > 500) errors[f.id] = 'Please enter a number'
    }
    if (f.validate && typeof v === 'string' && !skipped) {
      const value = f.validate === 'gstin' || f.validate === 'pan' ? v.trim().toUpperCase() : v.trim()
      if (!RE[f.validate].test(value)) errors[f.id] = MESSAGES[f.validate]
    }
  }
  return errors
}

export function validateIntake(a: Answers): Record<string, string> {
  return validateFields(ALL_FIELDS, a)
}

/** Clean up a submission: trim text, upper-case GSTIN/PAN, drop unknown keys. */
export function normaliseAnswers(a: Answers): Answers {
  const out: Answers = {}
  const known = new Set(ALL_FIELDS.flatMap((f) => [f.id, `${f.id}_other`]))
  for (const [k, v] of Object.entries(a)) {
    if (!known.has(k)) continue
    if (typeof v === 'string') {
      const t = v.trim().slice(0, 4000)
      out[k] = k === 'gstin' || k === 'pan' ? t.toUpperCase().replace(/\s/g, '') : t
    } else if (Array.isArray(v)) {
      out[k] = v.filter((x) => typeof x === 'string').slice(0, 30).map((x) => String(x).slice(0, 200))
    } else if (typeof v === 'boolean' || typeof v === 'number') {
      out[k] = v
    }
  }
  return out
}

export function str(a: Answers, k: string): string {
  const v = a[k]
  if (v === 'Other' && typeof a[`${k}_other`] === 'string') return String(a[`${k}_other`])
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : ''
}

export function fullAddress(a: Answers): string {
  const pin = str(a, 'state') === 'Outside India' ? str(a, 'country') : str(a, 'pincode')
  const cityState = [str(a, 'city'), str(a, 'state') === 'Outside India' ? '' : str(a, 'state')].filter(Boolean).join(', ')
  return [str(a, 'addressLine1'), str(a, 'addressLine2'), [cityState, pin].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}

/** Suggested complexity with a reason Jay can read. */
export function suggestComplexity(variants: number, category: string): { complexity: Complexity; reason: string } {
  if (COMPLEX_CATEGORIES.includes(category)) {
    return { complexity: 'hard', reason: `${category} is a complex category` }
  }
  if (variants >= 5) return { complexity: 'hard', reason: `${variants} variants (5 or more)` }
  if (variants >= 3) return { complexity: 'medium', reason: `${variants} variants (3–4)` }
  return { complexity: 'easy', reason: `${variants || 1} variant${variants === 1 ? '' : 's'} (1–2)` }
}

/** Build the first-draft quote from a form submission. */
export function draftFromIntake(a: Answers, settings: Settings): QuoteInput {
  const services = Array.isArray(a.services) ? (a.services as string[]) : []
  const notSure = services.length === 0 || services.includes('Not sure, please advise')
  const modules: Record<ModuleId, boolean> = { M1: true, M2: true, M3: true, M4: true, M5: true, M6: false }
  if (!notSure) {
    for (const m of MODULES) modules[m.id] = services.includes(m.name.replace(' (add-on)', ''))
  }
  if (str(a, 'formulation') === 'Existing commercial product to improve') modules.M1 = false
  if (!Object.values(modules).some(Boolean)) Object.assign(modules, { M1: true, M2: true, M3: true, M4: true, M5: true })

  const model = str(a, 'engagement') === 'Monthly retainer' ? 'retainer' : 'milestone'
  const variants = Math.max(1, Math.round(Number(a.variants) || 1))
  const { complexity, reason } = suggestComplexity(variants, str(a, 'category'))

  return newQuoteInput(settings, {
    clientNames: str(a, 'fullName'),
    brand: str(a, 'brandName'),
    productDescription: str(a, 'productShort'),
    variants,
    modules,
    model,
    complexity,
    complexityReason: reason,
    counts: { ...settings.counts[model] },
  })
}

/** Client details used on the MOU, pulled from the form answers. */
export interface ClientDetails {
  legalName: string
  brandName: string
  entityType: string
  address: string
  billingAddress: string
  gstin: string
  pan: string
  fssai: string
  signatoryName: string
  signatoryTitle: string
  signatoryEmail: string
  contactName: string
  contactEmail: string
  contactPhone: string
  billingContactName: string
  billingEmail: string
  productShort: string
  variants: number
}

export function clientDetailsFromAnswers(a: Answers): ClientDetails {
  return {
    legalName: str(a, 'legalName'),
    brandName: str(a, 'brandName'),
    entityType: str(a, 'entityType'),
    address: fullAddress(a),
    billingAddress: a.billingSame === false ? str(a, 'billingAddress') : '',
    gstin: a.gstNotRegistered ? 'Not registered' : str(a, 'gstin'),
    pan: a.panNotAvailable ? 'n.a.' : str(a, 'pan'),
    fssai: str(a, 'fssai'),
    signatoryName: str(a, 'signatoryName'),
    signatoryTitle: str(a, 'signatoryDesignation'),
    signatoryEmail: str(a, 'signatoryEmail'),
    contactName: str(a, 'fullName'),
    contactEmail: str(a, 'email'),
    contactPhone: str(a, 'phone'),
    billingContactName: str(a, 'billingContactName'),
    billingEmail: str(a, 'billingEmail'),
    productShort: str(a, 'productShort'),
    variants: Math.max(1, Math.round(Number(a.variants) || 1)),
  }
}

export const EMPTY_CLIENT: ClientDetails = clientDetailsFromAnswers({})

/** Details the MOU cannot go out without. */
export const REQUIRED_MOU_FIELDS: { key: keyof ClientDetails; label: string }[] = [
  { key: 'legalName', label: 'Legal name' },
  { key: 'entityType', label: 'Entity type' },
  { key: 'address', label: 'Registered address' },
  { key: 'gstin', label: 'GSTIN' },
  { key: 'pan', label: 'PAN' },
  { key: 'signatoryName', label: 'Signatory name' },
  { key: 'signatoryTitle', label: 'Signatory title' },
  { key: 'signatoryEmail', label: 'Signatory email' },
]
