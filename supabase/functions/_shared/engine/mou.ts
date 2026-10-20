// MOU engine: builds the agreement from the Master MOU wording, the accepted
// quote and the client's details. Clauses marked isNew were drafted for the
// milestone model and must be reviewed by a lawyer (shown to Jay only).
import { type Settings } from './settings.ts'
import { type QuoteInput, type QuoteDoc, buildQuoteDoc } from './quote.ts'
import { type ClientDetails, REQUIRED_MOU_FIELDS } from './intake.ts'
import { amountInWords, fill, formatDate, formatINR, toLetter } from './format.ts'

export interface MouInput {
  quote: QuoteInput
  client: ClientDetails
  /** Text edits keyed by block key. */
  texts: Record<string, string>
  effectiveDate: string | null
  place: string
}

export type Block =
  | { type: 'p'; key: string; text: string; isNew?: boolean }
  | { type: 'items'; style: 'decimal' | 'alpha' | 'upperAlpha' | 'roman' | 'dash'; start?: number; items: { key: string; label: string; text: string; isNew?: boolean; children?: Block[] }[] }
  | { type: 'heading'; text: string }
  | { type: 'table'; headers: string[]; widths: number[]; rows: string[][]; boldLast?: boolean }

export interface MouSection {
  key: string
  number: number
  heading: string
  isNew?: boolean
  blocks: Block[]
}

export interface MouDoc {
  title: string
  effectiveDate: string
  place: string
  parties: { label: string; consultant: string; client: string }[]
  sections: MouSection[]
  signatures: {
    consultant: { company: string; name: string; title: string }
    client: { company: string; name: string; title: string }
  }
  missing: string[]
  hasNewClauses: boolean
  quoteDoc: QuoteDoc
}

const T = {
  background:
    '**Background:** {consultant} is engaged in the business of providing new product research & development services in the packaged food and beverage sector to third party clients. The Client has approached {consultant} and is desirous of availing the Consultancy’s services for {services} (“**Project**”) of {product} (“**the Product/s**”).',
  scopeIntro: 'The Consultant’s services & scope of work in connection with the project shall comprise the following (“**Services**”):',
  timelinesIntro:
    "The deliverables and timelines set out below are indicative and based on the assumption of timely cooperation from the Client. All timelines remain subject to adjustment basis the Client's responsiveness, approval of product ideation and directions, unforeseen challenges in formulation or product development, raw material availability, regulatory requirements, or any other factor outside the Consultant's reasonable control.",

  // Retainer (from the Master MOU)
  feesA_r:
    'The fees for the services set out in the Scope of Work shall be payable on a monthly retainer basis at **INR {fee}** ({feeWords}) + {gst}% GST per month (“**Monthly Retainer Fee**”). The target timeline to achieve the above is {months} from the date of commencement.',
  feesB_r:
    'The Monthly Retainer Fee shall be payable in advance, on or before the 1st (first) day of each calendar month (or, in the case of the first month, on or before the date of execution of this MOU). The Client shall make payment as per the banking details provided in the invoice raised by the Consultant.',
  feesC_r:
    'The Monthly Retainer Fee shall become due and payable within **7 (seven) calendar days** of the date of the invoice raised by the Consultant (“**Due Date**”). In the event the Client fails to make payment by the Due Date, the Consultant shall notify the Client in writing (“**Default Notice**”) and shall be entitled to **immediately suspend all services** under this MOU with effect from the date of the Default Notice, until such time as all outstanding amounts (including any accrued interest) are paid in full.',

  // Milestone (NEW — drafted from the milestone quote terms)
  feesA_m:
    'The fees for the services set out in the Scope of Work shall be a fixed fee of **INR {fee}** ({feeWords}) + {gst}% GST (“**Project Fee**”). The target timeline to achieve the above is {months} from the date of commencement.',
  feesB_m: 'The Project Fee shall be payable in the following tranches, on reaching each milestone set out below:',
  feesC_m:
    'Each tranche shall become due and payable within **7 (seven) calendar days** of the date of the invoice raised by the Consultant on reaching the relevant milestone (“**Due Date**”). In the event the Client fails to make payment by the Due Date, the Consultant shall notify the Client in writing (“**Default Notice**”) and shall be entitled to **immediately suspend all services** under this MOU with effect from the date of the Default Notice, until such time as all outstanding amounts (including any accrued interest) are paid in full.',

  suspension:
    'Any period of suspension shall not count towards the Project timeline, and the Consultant shall bear no liability for any delay in deliverables arising from or consequent to such suspension.',
  thirtyDays:
    'If payment remains outstanding for more than **30 (thirty) calendar days** from the Due Date, the Consultant shall be entitled, at its sole discretion, to treat the MOU as terminated.',

  termIntro:
    'Either party may terminate this MOU by providing not less than 30 (thirty) days’ prior written notice to the other party (“**Termination Notice**”). In the event of termination:',
  termClient:
    '**Termination by the Client:** If the Client terminates this MOU for any reason other than a material breach by the Consultant, or if the Client fails to pay as per Clause 4 (Fees) and the Consultant elects to terminate under Clause 4, the following shall be payable by the Client to the Consultant:',
  termClientR1:
    'All Monthly Retainer Fees due and payable up to and including the month in which the Termination Notice is issued or the effective date of termination, whichever is later;',
  termClientM1:
    'All tranches for milestones reached up to the effective date of termination, together with the tranche for the next milestone, along with any unpaid dues;',
  termClient2: 'All out-of-pocket expenses incurred by the Consultant up to the effective date of termination, at actuals.',
  termConsultant:
    "**Termination by the Consultant:** If the Consultant terminates this MOU due to the Client's material breach (including non-payment), all outstanding amounts shall become immediately due and payable. If the Consultant terminates for any other reason, only fees earned up to the termination date and out-of-pocket expenses shall be payable.",
  termHandover:
    'All deliverables, formulations, work product, and documentation developed and paid for up to the date of termination shall be handed over to the Client upon receipt of all outstanding payments, in full.',

  invoicing_r:
    '**Invoicing:** The Consultant shall raise invoices at the start of every month, which will be payable within 7 (seven) days of the date of the invoice as per the details and instructions provided in such invoice. {consultant} is a registered MSME, and any delay in payments attracts interest at the prescribed rates. The fee set out above is exclusive of all applicable Indian taxes. Any Fees, Invoices, Reimbursements due and payable to {consultant} are subject to {gst}% GST which shall be charged over and above the Monthly Retainer Fee & the Client shall be responsible for payment of such tax on the services rendered by the Consultant.',
  invoicing_m:
    '**Invoicing:** The Consultant shall raise an invoice on reaching each milestone set out in Clause 4, which will be payable within 7 (seven) days of the date of the invoice as per the details and instructions provided in such invoice. {consultant} is a registered MSME, and any delay in payments attracts interest at the prescribed rates. The fee set out above is exclusive of all applicable Indian taxes. Any Fees, Invoices, Reimbursements due and payable to {consultant} are subject to {gst}% GST which shall be charged over and above the Project Fee & the Client shall be responsible for payment of such tax on the services rendered by the Consultant.',

  assumptionsIntro_r: 'The above Monthly Retainer Fee has been offered by us subject to the assumptions that:',
  assumptionsIntro_m: 'The above Project Fee has been offered by us subject to the assumptions that:',

  tcA:
    'Consultant will provide details of the compliance information required on the product packaging to meet FSSAI regulations. However, this scope of work does not include charges for obtaining the requisite FSSAI License or modification of an existing FSSAI License, or application of a new product approval.',
  tcB1:
    "Consultant will suggest a suitable manufacturer based on the Client's order quantities, special machinery and equipment requirements, and other relevant factors.",
  tcB2:
    'Should the Client require an alternative manufacturer, upon conducting trials and standardizing the recipe at the initial suggested manufacturer, the evaluation and selection of an alternative manufacturer will be considered an additional scope of work.',
  tcC:
    "The Client understands and acknowledges that the successful development and commercialization of the Product may be influenced by the Client's procurement capabilities and budget:",
  tcCa: '**Category 1: Bulk Procurement:** The Client possesses the resources and infrastructure to procure raw materials and packaging in bulk quantities at competitive prices.',
  tcCb: '**Category 2: Initial Investors:** The Client may have limited initial investment and require assistance in sourcing raw materials and packaging from suitable vendors based on their budget and production scale.',
  tcD:
    "The Consultant shall utilize commercially reasonable efforts to develop the Product based on the Client's desired specifications and target product profiling. However, the final Product may be subject to adjustments or limitations based on:",
  tcDa: "**Availability and Cost of Raw Materials:** If the Client's budget or procurement capabilities restrict access to specific raw materials or packaging, the Consultant may need to propose alternative options that may impact the final product's cost, quality, or performance.",
  tcDb: "**Minimum Order Quantities (MOQs):** If the Client's initial production volume is below the MOQs required by suppliers of raw materials or packaging, the Client may incur higher unit costs due to:",
  tcDbi: 'Higher procurement costs for smaller quantities.',
  tcDbii: 'Potential for increased waste due to excess inventory.',
  tcE:
    'If a finalized raw material becomes unavailable due to discontinuation by the supplier, the Consultant shall use commercially reasonable efforts to identify and source suitable alternative raw materials. If the alternative raw materials result in significant price increases or have volume limitations, the Client shall be consulted to determine the best course of action, which may include:',
  tcEa: 'Adjusting the product formulation to accommodate the alternative raw materials.',
  tcEb: 'Exploring alternative suppliers for the original raw materials.',
  tcEc: 'Revising the project scope or budget to accommodate the increased costs.',
  tcE2: 'Since this is beyond the control of the Consultant, the charges in this scenario will be over and above.',
  tcF:
    'The initial project scope is based on an estimated hours of work and number of products/trials/visits/tastings. In certain cases, unforeseen circumstances may necessitate additional trials, tastings, or revisions beyond the scope of the initial project. These may include, but are not limited to:',
  tcFa: 'Client-requested changes to product/flavour beyond the tastings included in the Fee Assumptions.',
  tcFb: 'Unexpected challenges in formulation development.',
  tcFc: 'Unforeseen regulatory changes from FSSAI.',
  tcF2: 'Any such additional work will be discussed and agreed upon separately with the Client, including a mutually agreed-upon fee adjustment.',
  tcG_r:
    'This MOU is structured as a continuous retainer and cannot be paused or partially resumed. The Consultant’s resources, vendor relationships, and manufacturing schedules are committed on the basis of an uninterrupted timeline.',
  tcG_m:
    'This MOU is structured as a continuous, milestone-based engagement and cannot be paused or partially resumed. The Consultant’s resources, vendor relationships, and manufacturing schedules are committed on the basis of an uninterrupted timeline.',
  tcG2:
    'Once this MOU is terminated or expires, the Consultant shall have no obligation to resume or replicate any work performed hereunder. Any re-engagement by the Client shall require execution of a fresh agreement on terms and fees to be negotiated at that time. The Consultant makes no representation as to its availability for re-engagement, or that prior formulations, vendor arrangements, or manufacturer relationships will remain accessible at such time.',
}

/** Default wording for a key, for "reset to template". */
export function mouTemplateText(key: string): string | undefined {
  return (T as Record<string, string>)[key]
}

export function missingClientFields(c: ClientDetails): string[] {
  return REQUIRED_MOU_FIELDS.filter((f) => !String(c[f.key] ?? '').trim()).map((f) => f.label)
}

export function buildMouDoc(input: MouInput, settings: Settings): MouDoc {
  const q = input.quote
  const qd = buildQuoteDoc(q, settings)
  const co = settings.company
  const c = input.client
  const milestone = q.model === 'milestone'
  const gst = settings.gstRate
  const fee = q.fee ?? 0
  const services = q.modules.M1 ? 'ideation, prototyping, development and commercialization' : 'prototyping, development and commercialization'
  const product = [c.variants || q.variants, c.productShort || q.productDescription].filter(Boolean).join(' ')
  const vars = {
    consultant: co.name,
    services,
    product,
    fee: formatINR(fee),
    feeWords: amountInWords(fee),
    gst,
    months: qd.timeline.monthsText.replace(' - ', ' to '),
  }
  const t = (key: string) => fill(input.texts[key] ?? settings.wording[`mou:${key}`] ?? (T as Record<string, string>)[key] ?? '', vars)
  const p = (key: string, isNew = false): Block => ({ type: 'p', key, text: t(key), isNew })
  const dash = (keys: string[], isNew = false): Block => ({
    type: 'items', style: 'dash', items: keys.map((k) => ({ key: k, label: '-', text: t(k), isNew })),
  })

  const sections: MouSection[] = []

  sections.push({ key: 'background', number: 1, heading: '', blocks: [p('background')] })

  // 2. Scope of work — taken from the accepted quote
  const scopeBlocks: Block[] = [p('scopeIntro')]
  for (const ph of qd.phases) {
    if (qd.showPhaseHeadings) scopeBlocks.push({ type: 'heading', text: ph.title })
    scopeBlocks.push({
      type: 'items', style: 'decimal', start: ph.items[0]?.n ?? 1,
      items: ph.items.map((it) => ({ key: `scope:${it.id}`, label: `${it.n}.`, text: input.texts[`scope:${it.id}`] ?? it.text })),
    })
  }
  sections.push({ key: 'scope', number: 2, heading: 'Scope of Work', blocks: scopeBlocks })

  // 3. Deliverables and timelines
  sections.push({
    key: 'timelines', number: 3, heading: 'Deliverables and Timelines', blocks: [
      p('timelinesIntro'),
      {
        type: 'table', headers: ['Sr.No.', 'Actionables', 'Timeline'], widths: [12, 58, 30], boldLast: true,
        rows: [...qd.timeline.rows.map((r) => [String(r.n), r.label, r.period]), ['', 'Total', qd.timeline.total]],
      },
    ],
  })

  // 4. Fees
  const feeBlocks: Block[] = []
  if (milestone) {
    feeBlocks.push({
      type: 'items', style: 'alpha', items: [
        { key: 'feesA_m', label: 'a.', text: t('feesA_m'), isNew: true },
        {
          key: 'feesB_m', label: 'b.', text: t('feesB_m'), isNew: true, children: [{
            type: 'table', headers: ['Sr.No.', 'Milestone', '% of Fees', 'Amount (₹)'], widths: [12, 48, 16, 24], boldLast: true,
            rows: [
              ...(qd.tranches?.rows ?? []).map((r) => [String(r.n), r.name, `${r.pct}%`, r.amount.replace('₹', '')]),
              ['', 'Total', `${qd.tranches?.totalPct ?? 0}%`, (qd.tranches?.totalAmount ?? '').replace('₹', '')],
            ],
          }],
        },
        { key: 'feesC_m', label: 'c.', text: t('feesC_m'), isNew: true, children: [dash(['suspension', 'thirtyDays'], true)] },
      ],
    })
  } else {
    feeBlocks.push({
      type: 'items', style: 'alpha', items: [
        { key: 'feesA_r', label: 'a.', text: t('feesA_r') },
        { key: 'feesB_r', label: 'b.', text: t('feesB_r') },
        { key: 'feesC_r', label: 'c.', text: t('feesC_r'), children: [dash(['suspension', 'thirtyDays'])] },
      ],
    })
  }
  sections.push({ key: 'fees', number: 4, heading: 'Fees', isNew: milestone, blocks: feeBlocks })

  // 5. Termination
  sections.push({
    key: 'termination', number: 5, heading: 'Termination', isNew: milestone, blocks: [
      p('termIntro'),
      p('termClient'),
      dash([milestone ? 'termClientM1' : 'termClientR1', 'termClient2'], milestone),
      p('termConsultant'),
      p('termHandover'),
    ],
  })

  // 6. Invoicing
  sections.push({ key: 'invoicing', number: 6, heading: '', isNew: milestone, blocks: [p(milestone ? 'invoicing_m' : 'invoicing_r', milestone)] })

  // 7. Fee assumptions & client commitments — from the accepted quote
  sections.push({
    key: 'assumptions', number: 7, heading: 'Fee Assumptions & Client Commitments', blocks: [
      p(milestone ? 'assumptionsIntro_m' : 'assumptionsIntro_r'),
      {
        type: 'items', style: 'upperAlpha',
        items: qd.assumptions.map((a, i) => ({ key: `assume:${a.id}`, label: `${toLetter(i)}.`, text: input.texts[`assume:${a.id}`] ?? a.text })),
      },
    ],
  })

  // 8. Engagement assumptions, terms & conditions
  const sub = (keys: string[], style: 'alpha' | 'roman') => ({
    type: 'items' as const, style,
    items: keys.map((k, i) => ({ key: k, label: style === 'alpha' ? `${String.fromCharCode(97 + i)}.` : `${['i', 'ii', 'iii', 'iv'][i]}.`, text: t(k) })),
  })
  sections.push({
    key: 'tc', number: 8, heading: 'Engagement Assumptions, Terms & Conditions', blocks: [{
      type: 'items', style: 'upperAlpha', items: [
        { key: 'tcA', label: 'A.', text: `**Legal & Regulatory Advisory:** ${t('tcA')}` },
        { key: 'tcB1', label: 'B.', text: `**Finding Correct Manufacturer:** ${t('tcB1')}`, children: [p('tcB2')] },
        { key: 'tcC', label: 'C.', text: `**Client Limitations:** ${t('tcC')}`, children: [sub(['tcCa', 'tcCb'], 'alpha')] },
        {
          key: 'tcD', label: 'D.', text: `**Project Scope and Limitations:** ${t('tcD')}`, children: [{
            type: 'items', style: 'alpha', items: [
              { key: 'tcDa', label: 'a.', text: t('tcDa') },
              { key: 'tcDb', label: 'b.', text: t('tcDb'), children: [sub(['tcDbi', 'tcDbii'], 'roman')] },
            ],
          }],
        },
        { key: 'tcE', label: 'E.', text: `**Raw Material Discontinuation:** ${t('tcE')}`, children: [sub(['tcEa', 'tcEb', 'tcEc'], 'alpha'), p('tcE2')] },
        { key: 'tcF', label: 'F.', text: `**Additional Tastings and Trials:** ${t('tcF')}`, children: [sub(['tcFa', 'tcFb', 'tcFc'], 'alpha'), p('tcF2')] },
        {
          key: milestone ? 'tcG_m' : 'tcG_r', label: 'G.', isNew: milestone,
          text: `**Project Timeline and Fees:** ${t(milestone ? 'tcG_m' : 'tcG_r')}`, children: [p('tcG2')],
        },
      ],
    }],
  })

  const v = (s: string) => s || '—'
  const parties = [
    { label: 'Name', consultant: co.name, client: v(c.legalName) },
    { label: 'Entity Type', consultant: co.entityType, client: v(c.entityType) },
    { label: 'Registered Address', consultant: co.address, client: v(c.address) },
    { label: 'GSTIN', consultant: co.gstin, client: v(c.gstin) },
    { label: 'FSSAI Lic. No.', consultant: co.fssai || 'n.a.', client: c.fssai || 'n.a.' },
    { label: 'PAN No.', consultant: co.pan, client: v(c.pan) },
    { label: 'Authorised Signatory', consultant: co.signatoryName, client: v(c.signatoryName) },
  ]

  return {
    title: 'MEMORANDUM OF UNDERSTANDING',
    effectiveDate: input.effectiveDate ? formatDate(input.effectiveDate) : 'Date of the last signature on this MOU',
    place: input.place || 'Mumbai, Maharashtra',
    parties,
    sections,
    signatures: {
      consultant: { company: co.name.toUpperCase(), name: `Mr. ${co.signatoryName}`, title: co.mouSignatoryTitle },
      client: { company: c.legalName || '[Client legal name]', name: c.signatoryName || '[Authorised signatory]', title: c.signatoryTitle || '[Title]' },
    },
    missing: missingClientFields(c),
    hasNewClauses: milestone,
    quoteDoc: qd,
  }
}
