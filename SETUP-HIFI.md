# HiFi survey – connected to Supabase
Project: https://supabase.com/dashboard/project/psxvqyetczecgqwjjpdj

The existing database already contains `survey_invitations` (5 dummy records) and `survey_responses`. Do **not** execute the original `supabase/schema.sql` again, because the tables already exist.

1. Copy `.env.example` to `.env.local`.
2. Get a **server-side secret key** from Supabase project API settings and set `SUPABASE_SECRET_KEY`. Do not commit this file, paste it in chat, or use NEXT_PUBLIC_ prefix for the secret.
3. Run `npm install` and `npm run dev`.
4. Open any existing demo link in the supplied `dummy_survey_links.csv`: `http://localhost:3000/s/<token>`. These links were created against this Supabase database. You can also visit `/?demo=1` for UI-only testing.
5. Select a reason, press **Kirim Jawaban**. Verify in Supabase SQL editor:

```sql
select i.customer_id, i.phone_number, r.selected_reason, r.additional_reason, r.submitted_at
from public.survey_responses r join public.survey_invitations i on i.id=r.invitation_id
order by r.submitted_at desc;
```

## Additional invitations for KATA

`node scripts/generate-links.mjs scripts/customers.example.csv --base-url https://YOUR_DEPLOYED_DOMAIN --out scripts/out`

The script creates `scripts/out/invitations.sql` (insert first using SQL editor) and `scripts/out/urls.csv` (each customer-specific URL for KATA). Don't share the CSV publicly. For an existing customer, issuing a second invitation allows a second response because uniqueness is per invitation, so avoid regenerating invitations for the same campaign without reconciliation.

## Important security notes

- Server-side secret key only, never client-side.
- URLs are bearer tokens: forwarding a link allows a different recipient to use it.
- Add rate limits before production blasting; avoid logging tokens in request URLs or analytics.
- Customer phone numbers are not shown to the browser.
- Production use requires approved WhatsApp template, privacy notice, and authorized recipient list.
