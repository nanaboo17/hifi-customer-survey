# HiFi bulk campaign (up to 500,000 customers)

## Workflow
At /upload, staff upload CSV or XLSX (up to 100 MB) with customer_id, customer_name and phone_number.
The browser validates up to 500,000 distinct IDs and stages 500-row batches in Supabase.
Each processing request claims a durable batch, creates/reuses per-customer invitations, and stores its KATA-ready CSV lines.
Job status, processed counters and up to 25,000-row KATA CSV exports remain accessible after a browser refresh.

## Required setup
1. Run `supabase/migrations/20261125_bulk_campaign_jobs.sql` in Supabase SQL Editor.
2. Deploy latest GitHub main to the existing `hifi-customer-survey` Cloudflare Worker.
3. For unattended processing, configure the same random 32+ character `BULK_WORKER_TOKEN` as a runtime secret on BOTH the existing survey Worker and the dedicated scheduled worker.
4. Configure the scheduled worker:
   ```bash
   npx wrangler secret put BULK_WORKER_TOKEN --config wrangler.bulk-runner.jsonc
   npx wrangler deploy --config wrangler.bulk-runner.jsonc
   ```
   Deploy after the main survey Worker is running. The scheduled worker runs once per minute and processes up to 10 batches per invocation.

## Usage
- Open /upload and log in.
- Upload the file, provide the public direct HTTPS image header URL, start.
- Upload staging is performed in the browser; keep that tab open until all input batches have been stored.
- Once uploaded, processing can run via the browser or the optional Cron Worker with the tab closed.
- Resume an interrupted campaign using the stored browser job ID; for incomplete staging, re-select the original file.
- Download all KATA CSV export parts when the campaign is complete.

## Safeguards and limits
- Maximum 100 MB per input file, 500,000 distinct customers per campaign, 500 customers per batch, at most 1000 batches.
- Each export part contains at most 25,000 customers and uses the correct KATA cta_website_variable token field.
- Valid existing invitations are reused. Expired/revoked links and phone-number mismatches are skipped rather than silently replaced.
- Tokens expire 14 days after creation; distribute promptly.
- Test with small data before submitting a high-volume campaign. Do not assume Cloudflare, Supabase, or KATA service quotas can sustain a 500k-run untested.
- Batch payloads and export files contain customer PII and remain in database tables. Establish a deletion/retention policy after the campaign, restrict access, and monitor Supabase database usage.
- Creating invitations is not a WhatsApp blast. Exported CSV still must be uploaded to KATA.
