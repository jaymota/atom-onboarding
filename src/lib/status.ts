export const CLIENT_STATUSES: { id: string; label: string; tone: string }[] = [
  { id: 'new_enquiry', label: 'New enquiry', tone: 'bg-sky-100 text-sky-800' },
  { id: 'quote_draft', label: 'Quote draft', tone: 'bg-neutral-100 text-neutral-700' },
  { id: 'quote_sent', label: 'Quote sent', tone: 'bg-indigo-100 text-indigo-800' },
  { id: 'changes_requested', label: 'Changes requested', tone: 'bg-amber-100 text-amber-800' },
  { id: 'quote_accepted', label: 'Quote accepted', tone: 'bg-emerald-100 text-emerald-800' },
  { id: 'awaiting_details', label: 'Awaiting company details', tone: 'bg-amber-100 text-amber-800' },
  { id: 'mou_draft', label: 'MOU draft', tone: 'bg-neutral-100 text-neutral-700' },
  { id: 'mou_sent', label: 'MOU sent', tone: 'bg-indigo-100 text-indigo-800' },
  { id: 'signed_by_client', label: 'Signed by client', tone: 'bg-teal-100 text-teal-800' },
  { id: 'fully_signed', label: 'Fully signed', tone: 'bg-emerald-200 text-emerald-900' },
  { id: 'project_started', label: 'Project started', tone: 'bg-atom-aqua text-atom-ink' },
  { id: 'lost', label: 'Lost / Not proceeding', tone: 'bg-red-100 text-red-800' },
]

export function statusInfo(id: string) {
  return CLIENT_STATUSES.find((s) => s.id === id) ?? { id, label: id, tone: 'bg-neutral-100 text-neutral-700' }
}

export const QUOTE_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  approved: 'Approved — not sent',
  sent: 'Sent',
  changes_requested: 'Changes requested',
  accepted: 'Accepted',
  superseded: 'Replaced',
  revoked: 'Link revoked',
}

export const MOU_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  approved: 'Approved — ready to sign',
  sent_for_signature: 'Sent for signature',
  signed_by_client: 'Signed by client',
  signed: 'Fully signed',
}

export function istDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function istDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' })
}
