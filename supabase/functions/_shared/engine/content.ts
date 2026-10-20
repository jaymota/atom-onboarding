// Default wording for quotes, taken from Atom Consultancy's own quote templates.
// Prices are NOT stored here (this code is public) — they live in the private
// Settings row in the database.

export type ModuleId = 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6'
export type GroupId = 'ideation' | 'development' | 'scaleup' | 'handover'
export type Model = 'milestone' | 'retainer'
export type Complexity = 'easy' | 'medium' | 'hard'

export const MODULES: { id: ModuleId; name: string; short: string; optional?: boolean }[] = [
  { id: 'M1', name: 'Ideation & Rapid Prototyping', short: 'Ideation' },
  { id: 'M2', name: 'Literature Review & Competitive Analysis', short: 'Literature review' },
  { id: 'M3', name: 'Raw Material Procurement & Tabletop Development', short: 'Tabletop development' },
  { id: 'M4', name: 'Contract Manufacturer Identification & Pilot Trials', short: 'Pilot trials' },
  { id: 'M5', name: 'Packaging, FSSAI Compliance & Handover', short: 'Packaging & handover' },
  { id: 'M6', name: 'Commercial Batch Advisory (add-on)', short: 'Commercial batch', optional: true },
]

/** Phase groups, in order. Phase numbers are given to the groups that have items. */
export const GROUPS: GroupId[] = ['ideation', 'development', 'scaleup', 'handover']

export interface ScopeItemDef {
  id: string
  module: ModuleId
  group: GroupId
  text: string
}

// {prototypes} {tastings} {trials} are filled from the quote. {perMonth} becomes
// " per month" on retainer quotes and "" on milestone quotes.
export const SCOPE_ITEMS: ScopeItemDef[] = [
  { id: 'm1-1', module: 'M1', group: 'ideation', text: 'Provide ideation services, competitive analysis and conduct feasibility studies for the relevant product categories.' },
  { id: 'm1-2', module: 'M1', group: 'ideation', text: 'Create up to {prototypes} rapid prototypes of initial product concepts to understand product directions.' },
  { id: 'm1-3', module: 'M1', group: 'ideation', text: 'Shortlist a range of prototypes to commence validation and standardization.' },

  { id: 'm2-1', module: 'M2', group: 'development', text: 'Perform a literature review and market analysis to deeply understand the ingredients, claims, nutrition, positioning, price points, contract manufacturing details and flavours of similar products in the market.' },
  { id: 'm2-2', module: 'M2', group: 'development', text: 'Develop the theoretical Bill of Materials (BOM) for the products that meet specifications.' },
  { id: 'm4-0', module: 'M4', group: 'development', text: 'Identify potential contract manufacturers with the relevant machinery and know how to manufacture the products at scale.' },
  { id: 'm3-1', module: 'M3', group: 'development', text: 'Procure raw materials from vendors to identify the most suitable quality ingredient for the trials.' },
  { id: 'm3-2', module: 'M3', group: 'development', text: 'Take iterative table top trials to standardise the formulations as per the target product profile and optimise for flavour, stability and nutrition.' },
  { id: 'm3-3', module: 'M3', group: 'development', text: 'Perform sensory analysis against benchmark products with the client over {tastings} tasting sessions{perMonth} to qualify the formulation for pilot trials.' },

  { id: 'm4-1', module: 'M4', group: 'scaleup', text: 'Shortlist contract manufacturers with the right capacity, certifications, technology and overall support to commercialize the products.' },
  { id: 'm4-2', module: 'M4', group: 'scaleup', text: 'Perform up to {trials} pilot trials{perMonth} at the contract manufacturers facility to recreate the tabletop recipe at the facility.' },
  { id: 'm4-3', module: 'M4', group: 'scaleup', text: 'Create SOPs for manufacturing the product at the relevant facilities to ensure product consistency and safety, while validating the product specifications.' },
  { id: 'm4-4', module: 'M4', group: 'scaleup', text: 'Send the product for shelf life and nutrition testing to a 3rd Party NABL lab for mandatory compliance tests.' },

  { id: 'm5-1', module: 'M5', group: 'handover', text: 'Identify packaging options basis the packaging line and support in procuring the packaging materials (PM) by identifying vendors that can meet the requirements.' },
  { id: 'm5-2', module: 'M5', group: 'handover', text: 'Provide the required labelling compliance to the team to commence packaging development.' },
  { id: 'm5-3', module: 'M5', group: 'handover', text: 'Provide a Technical Transfer Document (TTD) covering the entire operation: raw material sourcing, production guidelines, quality standards (including CCPs), SOPs and vendor details.' },
  { id: 'm6-1', module: 'M6', group: 'handover', text: 'Provide advisory services for manufacturing the commercial batch of the product.' },
]

/** Detailed tasks from the Atom Project Checklist — shown to Jay only, as a hint. */
export const MODULE_HINTS: Record<ModuleId, string[]> = {
  M1: [
    'Ideation workshop and category feasibility',
    'Rapid prototypes of initial concepts',
    'Shortlist prototypes for validation',
  ],
  M2: [
    'Literature on ingredient functionality, regulatory limits, health benefits (min. 5 sources per key claim)',
    'FSSAI limits, category classification and permissible claims',
    '15–20 competitor products documented; 3+ benchmarks selected',
    'Benchmark tasting and samples log',
    'Target Product Profile (TPP) approved before lab work',
    'Theoretical formulation and cost per serve vs target COGS (±15%)',
  ],
  M3: [
    '2–3 vendors per ingredient; samples, COAs, MOQ and pricing',
    'Iterative tabletop trials with hypothesis → conclusion log',
    'Internal hedonic tasting (3+ panellists) and QC parameters (pH, moisture, Aw, Brix…)',
    'Client tasting rounds and written tabletop sign-off',
    'Locked final recipe and tabletop SOP',
  ],
  M4: [
    'CM longlist (8+), shortlist 3 with MOQ, conversion and pilot costs',
    'Schedule IV / FSSAI audit of shortlisted CMs; client approves CM',
    'Pilot trial plan (scaled recipe, CCPs, QC checkpoints)',
    'Pilot trial report within 48 hrs; 2 consistent batches',
    'Client tasting of pilot product; shelf-life protocol and NABL lab tests',
  ],
  M5: [
    'Client packaging brief; 5+ PM vendors, 3 shortlisted',
    'PM spec sheet locked and shared with CM',
    'Label compliance checklist and artwork sign-off',
    'FSSAI licence category confirmed / application support',
    'Technical Transfer Document and knowledge-transfer session',
  ],
  M6: ['Oversee first commercial run', 'Commercial run report', 'Final project summary and close-out'],
}

export interface TimelineRowDef {
  id: string
  module: ModuleId
  group: GroupId
  label: string
  openEnded?: boolean
}

export const TIMELINE_ROWS: TimelineRowDef[] = [
  { id: 't-ideation', module: 'M1', group: 'ideation', label: 'Ideation and Feasibility Studies' },
  { id: 't-proto', module: 'M1', group: 'ideation', label: 'Rapid Prototyping and Product Shortlisting' },
  { id: 't-lit', module: 'M2', group: 'development', label: 'Literature Review, Market Analysis & BOM Development' },
  { id: 't-rm', module: 'M3', group: 'development', label: 'Raw Material Procurement, Recipe Development and Sensory Trials' },
  { id: 't-cm', module: 'M4', group: 'scaleup', label: 'Shortlist Contract Manufacturer & Pilot Trials' },
  { id: 't-fssai', module: 'M4', group: 'scaleup', label: 'FSSAI Licensing, SOP Creation & Shelf Life testing' },
  { id: 't-pm', module: 'M5', group: 'handover', label: 'Packing Materials and Vendor Finalization' },
  { id: 't-ttd', module: 'M5', group: 'handover', label: 'Compliances and Technical Transfer Documentation' },
  { id: 't-adv', module: 'M6', group: 'handover', label: 'Advisory Services for Commercial Batches', openEnded: true },
]

export type WeekRange = [number, number]
export type TimelinePreset = Record<string, WeekRange>

/**
 * Full-scope week ranges (all modules on). Kept on the longer side on purpose:
 * Easy 28 weeks, Medium 36 weeks, Hard 48 weeks. Removing a module shifts the
 * later rows earlier. Medium without ideation = 32 weeks.
 */
export const DEFAULT_PRESETS: Record<Complexity, TimelinePreset> = {
  easy: {
    't-ideation': [1, 2], 't-proto': [2, 6], 't-lit': [4, 9], 't-rm': [7, 16],
    't-cm': [13, 21], 't-fssai': [19, 26], 't-pm': [19, 25], 't-ttd': [25, 28],
  },
  medium: {
    't-ideation': [1, 3], 't-proto': [3, 8], 't-lit': [5, 11], 't-rm': [9, 20],
    't-cm': [16, 27], 't-fssai': [24, 33], 't-pm': [24, 31], 't-ttd': [32, 36],
  },
  hard: {
    't-ideation': [1, 4], 't-proto': [4, 11], 't-lit': [6, 14], 't-rm': [12, 28],
    't-cm': [24, 37], 't-fssai': [33, 43], 't-pm': [35, 43], 't-ttd': [43, 48],
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
  { id: 'a-prototypes', tag: 'both', requires: 'M1', text: 'Rapid prototyping is limited to {prototypes} product prototypes;' },
  { id: 'a-tastings', tag: 'both', requires: 'M3', text: 'The tabletop trials are limited to {tastings} tastings{perMonth}, every tasting after that will be billed additionally;' },
  { id: 'a-trials', tag: 'both', requires: 'M4', text: 'The contract manufacturing trials are limited to {trials} trials{perMonth}, every trial after that will be billed additionally;' },
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
  { id: 'c-tasting', requires: 'M3', label: 'Additional Tasting (Over and above {tastings} table top tastings{perMonth})', priceKey: 'extraTasting', unit: 'per tasting per flavour' },
  { id: 'c-flavour', label: 'Additional Products/Flavours (for table top prototyping)', priceKey: 'extraFlavour', unit: 'per flavour{perMonth}' },
  { id: 'c-trial', requires: 'M4', label: 'Additional Contract Manufacturing Trials (Planning and Visitation Charges)', priceKey: 'extraTrial', unit: 'per trial' },
]

export const FIXED_TEXT = {
  intro: 'We understand that our scope of work in connection with the services shall comprise the following:',
  feesMilestone: 'The fees for this project will be **INR {fee} + GST,** the target timeline to achieve all the above would be **{months}.**',
  feesRetainer: 'The fees for this project will be **INR {fee} + GST per month,** the target timeline to achieve all the above would be **{months}.**',
  tranchesIntro: 'The fee shall be payable in the following tranches:',
  retainerPayable: 'The fee shall be payable at the start of every month.',
  retainerEstimate: 'Estimated total fees: INR {total} + GST ({monthsCount} months × INR {fee}).',
  assumptionsMilestone: 'The above fixed fee has been offered by us subject to the assumptions that:',
  assumptionsRetainer: 'The above Monthly Retainer Fee has been offered by us subject to the assumptions that:',
  validity: '**Validity**: This quotation is valid for a period of {validityDays} days from the date of issuance.',
  mouNote: 'Once the above scope of work and project brief is approved, we will send across an MOU which will detail all the terms and conditions regarding tastings, trials, consumer tasting, offsite visits and more.',
}

/** Typos fixed from the original Word templates (shown to Jay once). */
export const TEMPLATE_FIXES = [
  '"Week Week 32" in the Master MOU timeline → "Week 32"',
  'Stray full stop after "comprise the following:." removed',
  '"outsidethe" → "outside the"',
  'Clauses now start with a capital letter ("there will be…" → "There will be…")',
  'Retainer quotes say "Monthly Retainer Fee" instead of "fixed fee"',
  'Tasting/trial numbers in scope and assumptions now always match (one number drives both)',
  'Months in the Fees line are calculated from the timeline total, so they always agree',
]
