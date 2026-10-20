// Default wording for quotes. Prices are NOT stored here (this code is public) —
// they live in the private Settings row in the database.

export type ModuleId = 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6'
export type GroupId = ModuleId | 'addons'
export type Model = 'milestone' | 'retainer'
export type Complexity = 'easy' | 'medium' | 'hard'

/** The six core services, in project order. Each switched-on service becomes a phase. */
export const MODULES: { id: ModuleId; name: string; short: string; blurb: string }[] = [
  {
    id: 'M1', name: 'Ideation & Rapid Prototyping', short: 'Ideation',
    blurb: 'Product concepts and quick samples to explore directions (for ideation only; no IP transfer).',
  },
  {
    id: 'M2', name: 'Feasibility Study', short: 'Feasibility',
    blurb: 'Competitive, literature and compliance review, plus a quick check with 3–4 manufacturers, before recipe work starts.',
  },
  {
    id: 'M3', name: 'Recipe Development & Standardisation', short: 'Recipe development',
    blurb: 'Tabletop recipe trials, raw material standardisation and a documented tabletop process.',
  },
  {
    id: 'M4', name: 'Contract Manufacturing & Scale-up', short: 'Scale-up',
    blurb: 'Finding the right manufacturer, running pilot trials and standardising the product at scale.',
  },
  {
    id: 'M5', name: 'Compliance & Licensing', short: 'Compliance',
    blurb: 'FSSAI licensing, label compliance and packaging compliance.',
  },
  {
    id: 'M6', name: 'Commercial Alignment', short: 'Commercialisation',
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
  /** Hide this item when another service is on (avoids saying the same thing twice). */
  unless?: ModuleId
  /** Use different wording when another service is on. */
  alt?: { ifOn: ModuleId; text: string }
}

// {prototypes} {tastings} {trials} are filled from the quote. {perMonth} becomes
// " per month" on retainer quotes and "" on milestone quotes.
export const SCOPE_ITEMS: ScopeItemDef[] = [
  { id: 'm1-1', module: 'M1', text: 'Run ideation to define product concepts, with a preliminary feasibility check.' },
  { id: 'm1-2', module: 'M1', text: 'Create up to {prototypes} rapid prototypes to explore product directions.' },
  { id: 'm1-3', module: 'M1', text: 'Shortlist the strongest concept to take forward.' },

  { id: 'm2-1', module: 'M2', text: '**Competitive analysis:** review benchmark products for ingredients, claims, nutrition, pricing and positioning.' },
  { id: 'm2-2', module: 'M2', text: '**Literature review:** study research papers, ingredient technical data sheets and published data relevant to the product.' },
  { id: 'm2-3', module: 'M2', text: '**Compliance review:** confirm the FSSAI category and ingredient limits, review the intended claims and check RDA requirements.' },
  { id: 'm2-4', module: 'M2', text: '**Manufacturer quick check:** identify 3–4 contract manufacturers and align on the technology and processing required.' },
  { id: 'm2-5', module: 'M2', text: 'Share a feasibility summary with the recommended product direction before recipe development begins.' },

  { id: 'm3-0', module: 'M3', unless: 'M2', text: 'Review benchmark products for ingredients, claims, nutrition and pricing.' },
  { id: 'm3-1', module: 'M3', text: 'Define the target product profile and build the theoretical Bill of Materials (BOM).' },
  { id: 'm3-2', module: 'M3', text: 'Source and standardise raw materials from qualified vendors.' },
  { id: 'm3-3', module: 'M3', text: 'Develop the recipe through iterative tabletop trials, optimising taste, texture, stability and nutrition.' },
  { id: 'm3-4', module: 'M3', text: 'Hold {tastings} tasting sessions{perMonth} against benchmark products to finalise the recipe with you.' },
  { id: 'm3-5', module: 'M3', text: 'Document the standardised tabletop recipe and process.' },

  {
    id: 'm4-1', module: 'M4',
    text: 'Identify and shortlist contract manufacturers with the right equipment, capacity and certifications.',
    alt: { ifOn: 'M2', text: 'Shortlist contract manufacturers for the final recipe and process: re-engage those from the feasibility check and approach new ones where better suited.' },
  },
  { id: 'm4-2', module: 'M4', text: 'Run up to {trials} pilot trials{perMonth} to reproduce the recipe at scale.' },
  { id: 'm4-3', module: 'M4', text: 'Standardise the product at scale and write manufacturing SOPs for consistency and food safety.' },
  { id: 'm4-4', module: 'M4', text: 'Arrange shelf-life and nutrition testing at a NABL-accredited lab.' },

  { id: 'm5-1', module: 'M5', text: 'Advise on the FSSAI licence required and support the application.' },
  { id: 'm5-2', module: 'M5', text: 'Provide label compliance details (nutrition panel, ingredients, claims, allergens and legal metrology) for the packaging artwork.' },
  { id: 'm5-3', module: 'M5', text: 'Recommend compliant packaging formats and materials, and identify packaging vendors.' },

  { id: 'm6-1', module: 'M6', text: 'Hand over a Technology Transfer Document: final recipe, process SOPs, quality checks (including CCPs) and vendor list.' },
  { id: 'm6-2', module: 'M6', text: 'Prepare product costing to support MRP setting.' },
  { id: 'm6-3', module: 'M6', text: 'Support the first commercial production run.' },
]

/** Detailed tasks from the Atom Project Checklist — shown to Jay only, as a hint. */
export const MODULE_HINTS: Record<ModuleId, string[]> = {
  M1: [
    'Concept ideation and preliminary feasibility',
    'Rapid prototypes of initial concepts (ideation only, no IP)',
    'Shortlist a concept for development',
  ],
  M2: [
    '15–20 competitor products documented; 3+ benchmarks selected; benchmark tasting log',
    'Literature on ingredient functionality and health benefits (5+ sources per key claim)',
    'FSSAI limits, category classification, permissible claims, ICMR RDA values',
    'CM quick check: 3–4 manufacturers, technology and processing fit',
  ],
  M3: [
    'Target Product Profile approved before lab work; theoretical formulation and COGS (±15%)',
    '2–3 vendors per ingredient; samples, COAs, MOQ and pricing',
    'Iterative tabletop trials; internal hedonic tasting; QC parameters (pH, moisture, Aw, Brix…)',
    'Client tasting rounds, written sign-off, locked recipe and tabletop SOP',
  ],
  M4: [
    'CM longlist (feasibility CMs + new ones for the final process), shortlist 3 with MOQ and pilot costs',
    'Schedule IV / FSSAI audit of shortlisted CMs; client approves CM',
    'Pilot trial plan (scaled recipe, CCPs, QC checkpoints); report within 48 hrs',
    '2 consistent pilot batches; client tasting of pilot product',
    'Shelf-life protocol and NABL lab testing',
  ],
  M5: [
    'FSSAI licence category confirmed and application support',
    'Label compliance checklist for every SKU and artwork sign-off',
    'Client packaging brief; 5+ PM vendors, 3 shortlisted; PM spec locked',
  ],
  M6: [
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
  { id: 't-ideation', module: 'M1', label: 'Ideation & Concept Definition' },
  { id: 't-proto', module: 'M1', label: 'Rapid Prototyping & Shortlisting' },
  { id: 't-feasibility', module: 'M2', label: 'Feasibility Study' },
  { id: 't-research', module: 'M3', label: 'Target Product Profile & BOM' },
  { id: 't-recipe', module: 'M3', label: 'Recipe Development, Raw Material Standardisation & Tastings' },
  { id: 't-cm', module: 'M4', label: 'Contract Manufacturer Selection & Pilot Trials' },
  { id: 't-scale', module: 'M4', label: 'Scale-up Standardisation, SOPs & Shelf-life Testing' },
  { id: 't-compliance', module: 'M5', label: 'FSSAI Licensing, Label & Packaging Compliance' },
  { id: 't-transfer', module: 'M6', label: 'Technology Transfer & MRP Costing' },
  { id: 't-commercial', module: 'M6', label: 'Commercial Run Support', openEnded: true },
]

export type WeekRange = [number, number]
export type TimelinePreset = Record<string, WeekRange>

/**
 * Full-scope week ranges (all services on), kept on the longer side on purpose:
 * Easy 30, Medium 39, Hard 52 weeks. Switching a service off shifts later rows earlier.
 */
export const DEFAULT_PRESETS: Record<Complexity, TimelinePreset> = {
  easy: {
    't-ideation': [1, 2], 't-proto': [2, 6], 't-feasibility': [5, 8], 't-research': [8, 10], 't-recipe': [9, 18],
    't-cm': [15, 23], 't-scale': [21, 28], 't-compliance': [21, 27], 't-transfer': [27, 30],
  },
  medium: {
    't-ideation': [1, 3], 't-proto': [3, 8], 't-feasibility': [7, 11], 't-research': [11, 13], 't-recipe': [12, 23],
    't-cm': [19, 30], 't-scale': [27, 36], 't-compliance': [27, 34], 't-transfer': [35, 39],
  },
  hard: {
    't-ideation': [1, 4], 't-proto': [4, 11], 't-feasibility': [9, 14], 't-research': [14, 17], 't-recipe': [16, 32],
    't-cm': [28, 41], 't-scale': [37, 47], 't-compliance': [39, 47], 't-transfer': [47, 52],
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
  /** Short topic shown in bold at the start of the clause. */
  topic: string
  text: string
  /** false = the MOU already covers this in its own clauses, so don't repeat it there. */
  inMou?: boolean
}

/** "Terms & Assumptions" on the quote — short, client-friendly, aligned with the MOU. */
export const ASSUMPTIONS: AssumptionDef[] = [
  // Payment
  { id: 'a-pay-milestone', tag: 'milestone', inMou: false, topic: 'Payment', text: 'Each tranche is invoiced on reaching its milestone and is payable within 7 days. Late payments attract interest at the rate prescribed for MSMEs, and work may pause until dues are cleared (paused time does not count towards the timeline).' },
  { id: 'a-pay-retainer', tag: 'retainer', inMou: false, topic: 'Payment', text: 'The retainer is invoiced at the start of each month and is payable within 7 days. Late payments attract interest at the rate prescribed for MSMEs, and work may pause until dues are cleared (paused time does not count towards the timeline).' },
  { id: 'a-termination', tag: 'milestone', inMou: false, topic: 'Termination', text: 'Either party may end the project with 30 days’ written notice. If it ends between milestones, fees up to the next milestone are payable, along with any unpaid dues.' },
  { id: 'a-termination-r', tag: 'retainer', inMou: false, topic: 'Termination', text: 'Either party may end the engagement with 30 days’ written notice. Retainer fees are payable up to the effective date of termination.' },
  // What's included
  { id: 'a-prototypes', tag: 'both', requires: 'M1', topic: 'Prototypes', text: 'Up to {prototypes} rapid prototypes are included. They are for ideation only; no formulation IP is transferred at this stage.' },
  { id: 'a-tastings', tag: 'both', requires: 'M3', topic: 'Tastings', text: '{tastings} tabletop tastings{perMonth} are included. Further tastings are charged as listed above.' },
  { id: 'a-trials', tag: 'both', requires: 'M4', topic: 'Pilot trials', text: '{trials} pilot trials{perMonth} are included. Further trials are charged as listed above.' },
  { id: 'a-manufacturer', tag: 'both', requires: 'M4', inMou: false, topic: 'Manufacturer', text: 'We recommend a manufacturer based on your volumes and equipment needs. Moving to a different manufacturer after trials and standardisation is additional scope.' },
  { id: 'a-scope', tag: 'both', topic: 'Changes to scope', text: 'Any work outside this scope will be flagged in advance and charged at mutually agreed rates.' },
  { id: 'a-exclusions', tag: 'both', topic: 'Not included', text: 'Branding, packaging design and sales support.' },
  // Costs at actuals
  { id: 'a-actuals', tag: 'both', topic: 'Costs at actuals', text: 'Lab testing (nutrition, shelf life and any other tests), raw materials and competitor samples, manufacturer facility charges, licence and government fees, and travel for outstation visits are charged at cost.' },
  { id: 'a-asl', tag: 'both', requires: 'M4', topic: 'Shelf-life testing', text: 'Accelerated testing takes about 8 days per month of shelf life (around 7 weeks for 6 months).' },
  // Realities of development
  { id: 'a-outcomes', tag: 'both', topic: 'Outcomes', text: 'Product development is iterative. Timelines are estimates that depend on timely feedback and approvals from you, and we cannot guarantee commercial success, consumer acceptance, shelf life or regulatory approval.' },
  { id: 'a-materials', tag: 'both', inMou: false, topic: 'Raw materials', text: 'If a raw material becomes unavailable, is discontinued or has a high minimum order quantity, we will propose alternatives; any resulting change in cost or scope will be agreed with you.' },
  { id: 'a-continuity', tag: 'both', inMou: false, topic: 'Continuity', text: 'The project runs continuously and cannot be paused and resumed. Restarting after termination needs a fresh agreement.' },
  { id: 'a-handover', tag: 'both', inMou: false, topic: 'Handover', text: 'Formulations, documents and other deliverables are handed over once all dues are paid.' },
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
  { id: 'c-tasting', requires: 'M3', label: 'Additional tasting (beyond {tastings} tabletop tastings{perMonth})', priceKey: 'extraTasting', unit: 'per tasting per flavour' },
  { id: 'c-flavour', requires: 'M3', label: 'Additional product or flavour (tabletop development)', priceKey: 'extraFlavour', unit: 'per flavour{perMonth}' },
  { id: 'c-trial', requires: 'M4', label: 'Additional pilot trial (planning and visit charges)', priceKey: 'extraTrial', unit: 'per trial' },
]

export const FIXED_TEXT = {
  intro: 'Our scope of work will cover the following:',
  addonsTitle: 'Additional Services',
  feesMilestone: 'The fees for this project will be **INR {fee} + GST,** with a target timeline of **{months}.**',
  feesRetainer: 'The fees for this project will be **INR {fee} + GST per month,** with a target timeline of **{months}.**',
  tranchesIntro: 'The fee is payable in the following tranches:',
  retainerPayable: 'The fee is payable at the start of every month.',
  retainerEstimate: 'Estimated total fees: INR {total} + GST ({monthsCount} months × INR {fee}).',
  assumptionsTitle: 'Terms & Assumptions',
  assumptionsMilestone: 'This quotation is based on the following terms. The full terms will be set out in the MOU.',
  assumptionsRetainer: 'This quotation is based on the following terms. The full terms will be set out in the MOU.',
  validity: '**Validity**: This quotation is valid for {validityDays} days from the date of issue.',
  mouNote: 'Once you approve this scope, we will send an MOU with the full terms for signature.',
}

/** Changes from the original Word templates (shown to Jay once). */
export const TEMPLATE_FIXES = [
  'Services reorganised into six phases: Ideation, Feasibility, Recipe Development, Scale-up, Compliance, Commercial Alignment',
  'Benchmark research appears once (in Feasibility, or in Recipe Development when there is no Feasibility phase)',
  '“Fee Assumptions” replaced by shorter “Terms & Assumptions” that include the key MOU points (payment, termination, handover)',
  'Scope items, timeline labels and fixed sentences rewritten to be shorter',
  '"Week Week 32" in the Master MOU timeline → "Week 32"',
  '"outsidethe" → "outside the"; clauses start with a capital letter',
  'Retainer quotes say "Monthly Retainer Fee" instead of "fixed fee"',
  'Tasting/trial numbers in scope and assumptions always match (one number drives both)',
  'Months in the Fees line are calculated from the timeline total, so they always agree',
]
