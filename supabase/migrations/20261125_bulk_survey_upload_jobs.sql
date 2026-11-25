-- Apply in Supabase SQL Editor before deploying bulk upload.
-- Persistent, resumable campaign import jobs. All data is admin-only.
create table if not exists public.survey_upload_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  header_image_url text not null,
  file_name text not null,
  file_size bigint not null,
  total_rows integer not null check (total_rows between 1 and 500000),
  uploaded_rows integer not null default 0 check (uploaded_rows >= 0),
  processed_rows integer not null default 0 check (processed_rows >= 0),
  created_count integer not null default 0,
  reused_count integer not null default 0,
  skipped_count integer not null default 0,
  status text not null default 'uploading' check (status in ('uploading','ready','processing','completed'))
);
create table if not exists public.survey_upload_items (
  job_id uuid not null references public.survey_upload_jobs(id) on delete cascade,
  row_number integer not null,
  customer_id text not null,
  customer_name text not null,
  phone_number text not null,
  status text not null default 'pending' check (status in ('pending','ready','skipped')),
  error_reason text,
  token_ciphertext text,
  primary key (job_id,row_number),
  unique (job_id,customer_id)
);
create index if not exists survey_upload_items_pending_idx on public.survey_upload_items(job_id,status,row_number);
alter table public.survey_upload_jobs enable row level security;
alter table public.survey_upload_items enable row level security;
revoke all on public.survey_upload_jobs from anon, authenticated;
revoke all on public.survey_upload_items from anon, authenticated;
-- No anon/authenticated RLS policies: only the server's Supabase secret key may access jobs.
