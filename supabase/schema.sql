-- Reference schema for the already initialized hifi-customer-survey project.
-- Do not rerun against the existing project; tables are present.
create table if not exists public.survey_invitations (
 id uuid primary key default gen_random_uuid(), customer_id text not null,
 phone_number text not null, token_hash text not null unique,
 created_at timestamptz not null default now(), expires_at timestamptz not null,
 revoked_at timestamptz
);
create table if not exists public.survey_responses (
 id uuid primary key default gen_random_uuid(),
 invitation_id uuid not null unique references public.survey_invitations(id) on delete restrict,
 selected_reason text not null check (selected_reason in
 ('Kendala Jaringan Internet','Sedang Tidak di Rumah','Menggunakan Provider Internet Lain','Harga Paket Kurang Sesuai dengan Anggaran','Sudah Tidak Membutuhkan Layanan Internet','Alasan Lainnya')),
 additional_reason text, submitted_at timestamptz not null default now(),
 constraint survey_other_reason_check check (
 (selected_reason='Alasan Lainnya' and length(trim(coalesce(additional_reason,''))) between 1 and 500)
 or (selected_reason <> 'Alasan Lainnya' and additional_reason is null))
);
alter table public.survey_invitations enable row level security;
alter table public.survey_responses enable row level security;
revoke all on public.survey_invitations from anon,authenticated;
revoke all on public.survey_responses from anon,authenticated;
