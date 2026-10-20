// Default wording for quotes. Prices are NOT stored here (this code is public) —
// they live in the private Settings row in the database.

export type ModuleId = 'M1' | 'M2' | 'M3' | 'M4' | 'M5'
export type GroupId = ModuleId | 'addons'
export type Model = 'milestone' | 'retainer'
export type Complexity = 'easy' | 'medium' | 'hard'

/** The five core services, in project order. Each switched-on module becomes a phase. */
export const MODULES: { id: ModuleId; name: string; short: string; blurb: string }[] = [
  {
    id: 'M1', name: 'Ideation & Rapid Prototyping', short: 'Ideation',
    blurb: 'Feasibility check and quick samples to explore product directions (for ideation only; no IP transfer).',
  },
  {
    id: 'M2', name: 'Recipe Development & Standardisation', short: 'Recipe development',
    blurb: 'Tabletop recipe trials, raw material standardisation and a documented tabletop process.',
  },
  {
    id: 'M3', name: 'Contract Manufacturing & Scale-up', short: 'Scale-up',
    blurb: 'Finding the right manufacturer, running pilot trials and standardising the product at scale.',
  },
  {
    id: 'M4', name: 'Compliance & Licensing', short: 'Compliance',
    blurb: 'FSSAI licensing, label compliance and packaging compliance.',
  },
  {
    id: 'M5', name: 'Commercial Alignment', short: 'Commercialisation',
    blurb: 'Technology transfer and SOP handover, MRP costing and support for the first commercial run.',
  },
]

/** Standalone services a client can ask for on their own or alongside a project. */
export const ADD_ONS: { id: string; name: string; blurb: string; scope: string }[] = [
  {
    id: 'x-fssai', name: 'FSSAI Licensing',
    blurb: 'A new FSSAI licence or registration, or changes to an existing one.',
    scope: 'Obtain the required FSSAI licence or registration, or modify an existing one.',
  },
  {
    id: 'x-shelf', name: 'Shelf-life Extension',
    blurb: 'Longer shelf life for an existing product through formulation, process and packaging changes.',
    scope: 'Extend the shelf life of the existing product through formulation, process and packaging changes, validated by testing.',
  },
  {
    id: 'x-advisory', name: 'Advisory Services',
    blurb: 'Expert guidance on product, process, regulatory or commercial decisions.',
    scope: 'Provide expert advice on product, process, regulatory and commercial decisions as required.',
  },
  {
    id: 'x-cm', name: 'Contract Manufacturer Alignment',
    blurb: 'Finding and onboarding the right manufacturer for an existing product.',
    scope: 'Identify, assess and onboard a suitable contract manufacturer for the existing product.',
  },
  {
    id: 'x-approval', name: 'Product Approvals',
    blurb: 'FSSAI product approval for novel, nutraceutical or non-standardised products.',
    scope: 'Prepare and file the FSSAI product approval application and support it through to approval.',
  },
]

export interface ScopeItemDef {
  id: string
  module: ModuleId
  text: string
}

// {prototypes} {tastings} {trials} are filled from the quote. {perMonth} becomes
// " per month" on retainer quotes and "" on milestone quotes.
export const SCOPE_ITEMS: ScopeItemDef[] = [
  { id: 'm1-1', module: 'M1', text: 'Assess the feasibility of the product concept and benchmark competing products.' },
  { id: 'm1-2', module: 'M1', text: 'Create up to {prototypes} rapid prototypes to explore product directions.' },
  { id: 'm1-3', module: 'M1', text: 'Shortlist the strongest prototypes for recipe development.' },

  { id: 'm2-1', module: 'M2', text: 'Research benchmark products: ingredients, claims, nutrition, pricing and positioning.' },
  { id: 'm2-2', module: 'M2', text: 'Build the theoretical Bill of Materials (BOM) against the target product profile.' },
  { id: 'm2-3', module: 'M2', text: 'Source and standardise raw materials from qualified vendors.' },
  { id: 'm2-4', module: 'M2', text: 'Develop the recipe through iterative tabletop trials, optimising taste, texture, stability and nutrition.' },
  { id: 'm2-5', module: 'M2', text: 'Hold {tastings} tasting sessions{perMonth} against benchmark products to finalise the recipe with you.' },
  { id: 'm2-6', module: 'M2', text: 'Document the standardised tabletop recipe and process.' },

  { id: 'm3-1', module: 'M3', text: 'Identify and shortlist contract manufacturers with the right equipment, capacity and certifications.' },
  { id: 'm3-2', module: 'M3', text: 'Run up to {trials} pilot trials{perMonth} to reproduce the recipe at scale.' },
  { id: 'm3-3', module: 'M3', text: 'Standardise the product at scale and write manufacturing SOPs for consistency and food safety.' },
  { id: 'm3-4', module: 'M3', text: 'Arrange shelf-life and nutrition testing at a NABL-accredited lab.' },

  { id: 'm4-1', module: 'M4', text: 'Advise on the FSSAI licence required and support the application.' },
  { id: 'm4-2', module: 'M4', text: 'Provide label compliance details (nutrition panel, ingredients, claims, allergens and legal metrology) for the packaging artwork.' },
  { id: 'm4-3', module: 'M4', text: 'Recommend compliant packaging formats and materials, and identify packaging vendors.' },

  { id: 'm5-1', module: 'M5', text: 'Hand over a Technology Transfer Document: final recipe, process SOPs, quality checks (including CCPs) and vendor list.' },
  { id: 'm5-2', module: 'M5', text: 'Prepare product costing to support MRP setting.' },
  { id: 'm5-3', module: 'M5', text: 'Support the first commercial production run.' },
]

/** Detailed tasks from the Atom Project Checklist — shown to Jay only, as a hint. */
export const MODULE_HINTS: Record<ModuleId, string[]> = {
  M1: [
    'Category feasibility and competitor benchmarking',
    'Rapid prototypes of initial concepts (ideation only, no IP)',
    'Shortlist prototypes for development',
  ],
  M2: [
    'Literature on ingredient functionality and regulatory limits (5+ sources per key claim)',
    '15–20 competitor products documented; 3+ benchmarks selected',
    'Target Product Profile approved before lab work; theoretical formulation and COGS (±15%)',
    '2–3 vendors per ingredient; samples, COAs, MOQ and pricing',
    'Iterative tabletop trials; internal hedonic tasting; QC parameters (pH, moisture, Aw, Brix…)',
    'Client tasting rounds, written sign-off, locked recipe and tabletop SOP',
  ],
  M3: [
    'CM longlist (8+), shortlist 3 with MOQ, conversion and pilot costs',
    'Schedule IV / FSSAI audit of shortlisted CMs; client approves CM',
    'Pilot trial plan (scaled recipe, CCPs, QC checkpoints); report within 48 hrs',
    '2 consistent pilot batches; client tasting of pilot product',
    'Shelf-life protocol and NABL lab testing',
  ],
  M4: [
    'FSSAI licence category confirmed and application support',
    'Label compliance checklist for every SKU and artwork sign-off',
    'Client packaging brief; 5+ PM vendors, 3 shortlisted; PM spec locked',
  ],
  M5: [
    'Technology Transfer Document and knowledge-transfer session',
    'Costing for MRP setting',
    'Oversee first commercial run; commercial run report; project close-out',
  ],
}

export interface TimelineRowDef {
  id: string
  module: ModuleId
  label: string
  openEnded?: boolean
}

export const TIMELINE_ROWS: TimelineRowDef[] = [
  { id: 't-ideation', module: 'M1', label: 'Ideation & Feasibility Check' },
  { id: 't-proto', module: 'M1', label: 'Rapid Prototyping & Shortlisting' },
  { id: 't-research', module: 'M2', label: 'Benchmarking & BOM Development' },
  { id: 't-recipe', module: 'M2', label: 'Recipe Development, Raw Material Standardisation & Tastings' },
  { id: 't-cm', module: 'M3', label: 'Contract Manufacturer Selection & Pilot Trials' },
  { id: 't-scale', module: 'M3', label: 'Scale-up Standardisation, SOPs & Shelf-life Testing' },
  { id: 't-compliance', module: 'M4', label: 'FSSAI Licensing, Label & Packaging Compliance' },
  { id: 't-transfer', module: 'M5', label: 'Technology Transfer & MRP Costing' },
  { id: 't-commercial', module: 'M5', label: 'Commercial Run Support', openEnded: true },
]

export type WeekRange = [number, number]
export type TimelinePreset = Record<string, WeekRange>

/**
 * Full-scope week ranges (all modules on), kept on the longer side on purpose:
 * Easy 28, Medium 36, Hard 48 weeks. Switching a module off shifts later rows earlier.
 */
export const DEFAULT_PRESETS: Record<Complexity, TimelinePreset> = {
  easy: {
    't-ideation': [1, 2], 't-proto': [2, 6], 't-research': [4, 9], 't-recipe': [7, 16],
    't-cm': [13, 21], 't-scale': [19, 26], 't-compliance': [19, 25], 't-transfer': [25, 28],
  },
  medium: {
    't-ideation': [1, 3], 't-proto': [3, 8], 't-research': [5, 11], 't-recipe': [9, 20],
    't-cm': [16, 27], 't-scale': [24, 33], 't-compliance': [24, 31], 't-transfer': [32, 36],
  },
  hard: {
    't-ideation': [1, 4], 't-proto': [4, 11], 't-research': [6, 14], 't-recipe': [12, 28],
    't-cm': [24, 37], 't-scale': [33, 43], 't-compliance': [35, 43], 't-transfer': [43, 48],
  },
}

export const COMPLEXITY_LABELS: Record<Complexity, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

export interface CountDefaults {
  prototypes: number
  tastings: number
  trials: number
}

export const DEFAULT_COUNTS: Record<Model, CountDefaults> = {
  milestone: { prototypes: 3, tastings: 3, trials: 3 },
  retainer: { prototypes: 3, tastings: 2, trials: 2 },
}

export type ClauseTag = 'both' | 'milestone' | 'retainer'

export interface AssumptionDef {
  id: string
  tag: ClauseTag
  requires?: ModuleId
  text: string
}

export const ASSUMPTIONS: AssumptionDef[] = [
  { id: 'a-engage', tag: 'both', text: 'Client will engage the business for the entire duration of the project;' },
  { id: 'a-termination', tag: 'milestone', text: 'Project Termination fees will be applicable should the client choose to terminate the project in between milestones, fees up to the next milestone will be due along with any unpaid dues;' },
  { id: 'a-indicative', tag: 'both', text: 'The deliverables and timelines set out above are indicative estimates only, do not constitute binding delivery dates, and are based on the assumption of timely and continued cooperation from the Client;' },
  { id: 'a-iterative', tag: 'both', text: 'The Client acknowledges and agrees that new product development, including formulation of food products, is inherently iterative, experimental, and uncertain in outcome;' },
  { id: 'a-noguarantee', tag: 'both', text: 'The Consultant makes no guarantee, warranty, or representation, express or implied, as to the commercial success, consumer acceptance, taste, shelf-stability, regulatory approval, or market performance of the Product;' },
  { id: 'a-prototypes', tag: 'both', requires: 'M1', text: 'Rapid prototyping is limited to {prototypes} prototypes, made for ideation only; no formulation IP is transferred at this stage;' },
  { id: 'a-tastings', tag: 'both', requires: 'M2', text: 'The tabletop trials are limited to {tastings} tastings{perMonth}, every tasting after that will be billed additionally;' },
  { id: 'a-trials', tag: 'both', requires: 'M3', text: 'The contract manufacturing trials are limited to {trials} trials{perMonth}, every trial after that will be billed additionally;' },
  { id: 'a-testing', tag: 'both', text: 'Nutritional Testing and Shelf Life Testing Fees are at actuals from the NABL certified lab, 3rd Party Testing fees for any additional testing are at actuals;' },
  { id: 'a-asl', tag: 'both', text: 'Accelerated Shelf Life testing requires approximately 8 days to mimic 1 month of shelf life, i.e a 6 month shelf life will require a 7 week testing period;' },
  { id: 'a-scope', tag: 'both', text: 'There will be no change to the scope of work set out above. If any work is performed outside the scope of work, then the same shall be highlighted upfront and any additional amount shall be charged on mutually acceptable terms;' },
  { id: 'a-rentals', tag: 'retainer', text: 'Contract manufacturing facility rentals are charged at actuals, basis the scale and volume of operation;' },
  { id: 'a-branding', tag: 'both', text: 'We will not be required to render any assistance in relation to the process of branding, packaging design or sales;' },
  { id: 'a-regfees', tag: 'retainer', text: 'Our fees do not include any fee payable to any regulatory authorities or other advisors for approvals;' },
  { id: 'a-oop', tag: 'both', text: 'All reasonable and necessary out-of-pocket expenses (for eg. procurement of competing samples, procurement of raw material, government fees, testing fees, travel & accommodation for outstation facility visits) will be charged at cost.' },
]

export interface CostDef {
  id: string
  requires?: ModuleId
  label: string
  /** Name of the price in Settings → costs. */
  priceKey: 'extraTasting' | 'extraFlavour' | 'extraTrial'
  unit: string
}

export const ADDITIONAL_COSTS: CostDef[] = [
  { id: 'c-tasting', requires: 'M2', label: 'Additional tasting (beyond {tastings} tabletop tastings{perMonth})', priceKey: 'extraTasting', unit: 'per tasting per flavour' },
  { id: 'c-flavour', requires: 'M2', label: 'Additional product or flavour (tabletop development)', priceKey: 'extraFlavour', unit: 'per flavour{perMonth}' },
  { id: 'c-trial', requires: 'M3', label: 'Additional pilot trial (planning and visit charges)', priceKey: 'extraTrial', unit: 'per trial' },
]

export const FIXED_TEXT = {
  intro: 'Our scope of work will cover the following:',
  addonsTitle: 'Additional Services',
  feesMilestone: 'The fees for this project will be **INR {fee} + GST,** with a target timeline of **{months}.**',
  feesRetainer: 'The fees for this project will be **INR {fee} + GST per month,** with a target timeline of **{months}.**',
  tranchesIntro: 'The fee is payable in the following tranches:',
  retainerPayable: 'The fee is payable at the start of every month.',
  retainerEstimate: 'Estimated total fees: INR {total} + GST ({monthsCount} months × INR {fee}).',
  assumptionsMilestone: 'This fixed fee is offered on the following assumptions:',
  assumptionsRetainer: 'This Monthly Retainer Fee is offered on the following assumptions:',
  validity: '**Validity**: This quotation is valid for {validityDays} days from the date of issue.',
  mouNote: 'Once you approve this scope, we will send an MOU setting out the full terms, including tastings, trials, consumer tastings and offsite visits.',
}

/** Changes from the original Word templates (shown to Jay once). */
export const TEMPLATE_FIXES = [
  'Services reorganised into five phases: Ideation, Recipe Development, Scale-up, Compliance, Commercial Alignment',
  'Scope items, timeline labels and fixed sentences rewritten to be shorter',
  '"Week Week 32" in the Master MOU timeline → "Week 32"',
  '"outsidethe" → "outside the"; clauses start with a capital letter',
  'Retainer quotes say "Monthly Retainer Fee" instead of "fixed fee"',
  'Tasting/trial numbers in scope and assumptions always match (one number drives both)',
  'Months in the Fees line are calculated from the timeline total, so they always agree',
]
