import { NextRequest, NextResponse } from 'next/server'
import { staff, originOK } from '@/lib/upload-security'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'no-store' }

export async function POST(req: NextRequest) {
  if (!originOK(req) || !staff(req)) return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403, headers })
  try {
    const body = await req.json() as { total_rows?: number; header_image_url?: string }
    const total = body.total_rows
    const image = typeof body.header_image_url === 'string' ? body.header_image_url.trim() : ''
    if (!Number.isInteger(total) || total! < 1 || total! > 500000)
      return NextResponse.json({ error: 'Jumlah pelanggan maksimal 500.000.' }, { status: 400, headers })
    if (!image || image.length > 2000) return NextResponse.json({ error: 'URL gambar header wajib diisi.' }, { status: 400, headers })
    try {
      const url = new URL(image)
      if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw Error('invalid')
    } catch { return NextResponse.json({ error: 'Gunakan URL gambar publik HTTPS.' }, { status: 400, headers }) }
    const db = getSupabaseAdmin()
    if (!db) return NextResponse.json({ error: 'Supabase belum dikonfigurasi.' }, { status: 503, headers })
    const { data, error } = await db.from('survey_upload_jobs').insert({ total_rows: total, header_image_url: image }).select('id').single()
    if (error) { console.error('Create bulk job', error.code); throw Error('Gagal membuat job. Pastikan migrasi bulk upload sudah dijalankan.') }
    return NextResponse.json({ id: data.id }, { headers })
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal membuat job.' }, { status: 500, headers }) }
}
