import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'node:crypto'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { staff, originOK, encrypt, decrypt } from '@/lib/upload-security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'no-store' }
const BATCH = 200
const EXPORT_ROWS = 5000
type Params = { params: Promise<{ id: string }> }
type Row = { job_id: string; row_number: number; customer_id: string; customer_name: string; phone_number: string; status: string; error_reason: string | null; token_ciphertext: string | null }
type Job = { id: string; total_rows: number; uploaded_rows: number; processed_rows: number; created_count: number; reused_count: number; skipped_count: number; status: string; header_image_url: string }
const quote = (value: string) => '"' + (/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replace(/"/g, '""') + '"'
const CSV_HEADER = 'country_code,whatsapp_number,contact_name,header_type,header_text/link,body1_type,body1_text,body2_type,body2_text,cta_website_variable'
function phone(v: string) {
  const digits = v.replace(/\D/g, '')
  const normalized = digits.startsWith('0') ? '62' + digits.slice(1) : digits.startsWith('8') ? '62' + digits : digits
  return /^628\d{8,11}$/.test(normalized) ? normalized : null
}
function fail(message: string, status = 400) { return NextResponse.json({ error: message }, { status, headers }) }
function validId(value: string) { return /^[a-f0-9-]{36}$/i.test(value) }
async function context(req: NextRequest, args: Params) {
  const { id } = await args.params
  if (!staff(req) || !validId(id)) return null
  const db = getSupabaseAdmin()
  if (!db) return null
  const { data, error } = await db.from('survey_upload_jobs').select('*').eq('id', id).maybeSingle()
  if (error) throw Error('Gagal membaca job: ' + error.code)
  if (!data) return null
  return { id, db, job: data as Job }
}
export async function GET(req: NextRequest, args: Params) {
  try {
    const ctx = await context(req, args)
    if (!ctx) return fail('Job tidak ditemukan atau sesi sudah berakhir.', 403)
    const { job, id, db } = ctx
    const partParam = req.nextUrl.searchParams.get('part')
    if (partParam === null) return NextResponse.json({ ...job, export_files: Math.ceil((job.created_count + job.reused_count) / EXPORT_ROWS) }, { headers })
    const part = Number(partParam)
    if (job.status !== 'completed') return fail('Selesaikan proses terlebih dahulu.')
    const total = job.created_count + job.reused_count
    if (!Number.isInteger(part) || part < 0 || part >= Math.ceil(total / EXPORT_ROWS)) return fail('Bagian export tidak valid.')
    const offset = part * EXPORT_ROWS
    const count = Math.min(EXPORT_ROWS, total - offset)
    const csv: string[] = []
    for (let start = offset; start < offset + count; start += 1000) {
      const last = Math.min(offset + count - 1, start + 999)
      const { data, error } = await db.from('survey_upload_items')
        .select('customer_id,customer_name,phone_number,token_ciphertext')
        .eq('job_id', id).eq('status', 'ready').order('row_number', { ascending: true }).range(start, last)
      if (error) throw Error('Export ' + error.code)
      for (const row of data || []) {
        if (!row.token_ciphertext) throw Error('Token enkripsi tidak ditemukan.')
        const token = decrypt(row.token_ciphertext)
        csv.push(['62', row.phone_number.slice(2), row.customer_name, 'image', job.header_image_url, 'text', row.customer_name, 'text', row.customer_id, token].map(quote).join(','))
      }
    }
    if (csv.length !== count) throw Error('Jumlah data export tidak cocok. Coba lagi.')
    return new NextResponse('\uFEFF' + CSV_HEADER + '\r\n' + csv.join('\r\n') + '\r\n', {
      headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="kata_hifi_' + id.slice(0, 8) + '_part_' + String(part + 1).padStart(3, '0') + '.csv"' }
    })
  } catch (e) { console.error('Bulk job GET', e); return fail('Gagal membaca atau mengekspor job.', 500) }
}
export async function POST(req: NextRequest, args: Params) {
  if (!originOK(req)) return fail('Asal permintaan tidak valid.', 403)
  try {
    const ctx = await context(req, args)
    if (!ctx) return fail('Job tidak ditemukan atau sesi sudah berakhir.', 403)
    const { job, db, id } = ctx
    const payload = await req.json() as { action?: string; start?: number; rows?: Array<{ customer_id: string; customer_name: string; phone_number: string }> }
    if (payload.action === 'stage') {
      if (job.status !== 'uploading') return fail('Tahap upload sudah selesai.')
      if (!Number.isInteger(payload.start) || payload.start !== job.uploaded_rows) return fail('Offset upload berubah. Muat ulang progress job.')
      if (!Array.isArray(payload.rows) || !payload.rows.length || payload.rows.length > 500 || job.uploaded_rows + payload.rows.length > job.total_rows) return fail('Batch upload tidak valid (maksimal 500 pelanggan).')
      const rows: Row[] = []
      for (let i = 0; i < payload.rows.length; i++) {
        const entry = payload.rows[i]
        const cust = typeof entry.customer_id === 'string' ? entry.customer_id.trim() : ''
        const name = typeof entry.customer_name === 'string' ? entry.customer_name.trim() : ''
        const p = typeof entry.phone_number === 'string' ? phone(entry.phone_number) : null
        if (!cust || cust.length > 100 || !name || name.length > 150 || !p) return fail('Data tidak valid di baris ' + (job.uploaded_rows + i + 2))
        rows.push({ job_id: id, row_number: job.uploaded_rows + i, customer_id: cust, customer_name: name, phone_number: p, status: 'pending', error_reason: null, token_ciphertext: null })
      }
      const { error } = await db.from('survey_upload_items').upsert(rows, { onConflict: 'job_id,row_number' })
      if (error) return fail(error.code === '23505' ? 'Customer ID duplikat di dalam file. Hapus duplikat lalu buat job baru.' : 'Upload batch gagal: ' + error.code, 400)
      const count = job.uploaded_rows + rows.length
      const { error: updateError } = await db.from('survey_upload_jobs').update({ uploaded_rows: count, status: count === job.total_rows ? 'ready' : 'uploading' }).eq('id', id)
      if (updateError) throw Error('Update upload ' + updateError.code)
      return NextResponse.json({ uploaded_rows: count, total_rows: job.total_rows }, { headers })
    }
    if (payload.action === 'process') {
      if (job.uploaded_rows !== job.total_rows) return fail('Upload data belum selesai.')
      if (job.status === 'completed') return NextResponse.json({ ...job, complete: true }, { headers })
      const { data, error } = await db.from('survey_upload_items').select('*').eq('job_id', id).eq('status', 'pending').order('row_number').limit(BATCH)
      if (error) throw Error('Read rows ' + error.code)
      const pending = (data || []) as Row[]
      if (!pending.length) {
        await db.from('survey_upload_jobs').update({ status: 'completed' }).eq('id', id)
        return NextResponse.json({ ...job, complete: true }, { headers })
      }
      const { data: previous, error: previousError } = await db.from('survey_invitations')
        .select('customer_id,phone_number,token_ciphertext,expires_at,revoked_at')
        .in('customer_id', pending.map(r => r.customer_id))
        .order('created_at', { ascending: false }).limit(1000)
      if (previousError) throw Error('Lookup invitations ' + previousError.code)
      const prior = new Map<string, NonNullable<typeof previous>[number]>()
      for (const record of previous || []) if (!prior.has(record.customer_id)) prior.set(record.customer_id, record)
      const toInsert: Array<{ customer_id: string; phone_number: string; token_hash: string; token_ciphertext: string; expires_at: string }> = []
      const outcomes: Row[] = []
      let created = 0, reused = 0, skipped = 0
      for (const row of pending) {
        const item = { ...row }
        const existing = prior.get(item.customer_id)
        if (existing) {
          if (existing.phone_number !== item.phone_number || existing.revoked_at || Date.parse(existing.expires_at) <= Date.now() || !existing.token_ciphertext) {
            item.status = 'skipped'; item.error_reason = 'Existing link cannot be re-exported'; skipped++
          } else {
            item.status = 'ready'; item.token_ciphertext = existing.token_ciphertext; reused++
          }
        } else {
          const token = randomBytes(32).toString('base64url')
          const cipher = encrypt(token)
          toInsert.push({ customer_id: item.customer_id, phone_number: item.phone_number, token_hash: createHash('sha256').update(token).digest('hex'), token_ciphertext: cipher, expires_at: new Date(Date.now() + 14 * 86400000).toISOString() })
          item.status = 'ready'; item.token_ciphertext = cipher; created++
        }
        outcomes.push(item)
      }
      if (toInsert.length) {
        const { error: insertError } = await db.from('survey_invitations').insert(toInsert)
        if (insertError) throw Error('Bulk invitation insertion failed: ' + insertError.code)
      }
      const { error: resultError } = await db.from('survey_upload_items').upsert(outcomes, { onConflict: 'job_id,row_number' })
      if (resultError) throw Error('Save batch result ' + resultError.code)
      const next = { processed_rows: job.processed_rows + pending.length, created_count: job.created_count + created, reused_count: job.reused_count + reused, skipped_count: job.skipped_count + skipped, status: job.processed_rows + pending.length === job.total_rows ? 'completed' : 'processing' }
      const { error: jobError } = await db.from('survey_upload_jobs').update(next).eq('id', id)
      if (jobError) throw Error('Update job ' + jobError.code)
      return NextResponse.json({ ...next, total_rows: job.total_rows, complete: next.status === 'completed' }, { headers })
    }
    return fail('Action tidak dikenal.')
  } catch (e) { console.error('Bulk job POST', e); return fail('Proses batch gagal. Coba lagi atau lanjutkan job nanti.', 500) }
}
