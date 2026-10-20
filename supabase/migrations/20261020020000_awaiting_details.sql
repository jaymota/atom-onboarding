-- New status: the client accepted the quote and we've asked for their company & billing details.
alter table public.clients drop constraint clients_status_check;
alter table public.clients add constraint clients_status_check check (status in (
  'new_enquiry', 'quote_draft', 'quote_sent', 'changes_requested', 'quote_accepted', 'awaiting_details',
  'mou_draft', 'mou_sent', 'signed_by_client', 'fully_signed', 'project_started', 'lost'));
