-- HiFi bulk campaign ingestion and resumable processing.
-- Apply in Supabase SQL Editor before using /upload/bulk.
create table if not exists public.hifi_bulk_jobs (
 id uuid primary key default gen_random_uuid(),
 file_name text not null,
 header_image_url text not null,
 total_customers integer not null check (total_customers between 1 and 500000),
 total_batches integer not null check (total_batches between 1 and 1000),
 status text not null default 'uploading' check (status in ('uploading','ready','processing','complete')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.hifi_bulk_batches (
 job_id uuid not null references public.hifi_bulk_jobs(id) on delete cascade,
 batch_index integer not null check (batch_index between 0 and 999),
 customers jsonb not null default '[]'::jsonb,
 status text not null default 'queued' check (status in ('queued','processing','done')),
 csv text,
 created integer not null default 0,
 reused integer not null default 0,
 skipped integer not null default 0,
 errors jsonb not null default '[]'::jsonb,
 processing_started_at timestamptz,
 completed_at timestamptz,
 primary key (job_id, batch_index),
 constraint batch_customers_array check (jsonb_typeof(customers) = 'array' and jsonb_array_length(customers) between 1 and 500)
);
create index if not exists hifi_bulk_batches_pending_idx on public.hifi_bulk_batches(job_id,batch_index) where status <> 'done';
alter table public.hifi_bulk_jobs enable row level security;
alter table public.hifi_bulk_batches enable row level security;
revoke all on public.hifi_bulk_jobs from anon, authenticated;
revoke all on public.hifi_bulk_batches from anon, authenticated;

-- Atomically acquire a batch for one processor.
create or replace function public.hifi_claim_bulk_batch(p_job uuid)
returns table(out_index integer, out_customers jsonb)
language plpgsql security invoker set search_path = public
as $$
begin
 return query
 with next_batch as (
   select b.job_id,b.batch_index from public.hifi_bulk_batches b
   where b.job_id = p_job
     and (b.status='queued' or (b.status='processing' and b.processing_started_at < now()-interval '5 minutes'))
   order by b.batch_index
   limit 1 for update skip locked
 ), claimed as (
   update public.hifi_bulk_batches b
   set status='processing', processing_started_at=now()
   from next_batch n where b.job_id=n.job_id and b.batch_index=n.batch_index
   returning b.batch_index,b.customers
 )
 select c.batch_index,c.customers from claimed c;
end;
$$;
revoke all on function public.hifi_claim_bulk_batch(uuid) from public, anon, authenticated;
grant execute on function public.hifi_claim_bulk_batch(uuid) to service_role;
