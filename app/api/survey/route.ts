import { NextRequest, NextResponse } from 'next/server'
import { isReason, REASONS } from '@/lib/survey'
import { hashToken, isValidTokenFormat } from '@/lib/invitations'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
const noStore = { 'Cache-Control': 'no-store' }
export async function POST(req: NextRequest) {
  try {
    if (Number(req.headers.get('content-length') || 0) > 5000)
      return NextResponse.json({ error: 'Data terlalu besar.' }, { status: 413, headers: noStore })
    const payload: unknown = await req.json()
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      return NextResponse.json({ error: 'Format tidak valid.' }, { status: 400, headers: noStore })
    const { token, reason, details } = payload as Record<string, unknown>
    if (typeof token !== 'string' || !isValidTokenFormat(token))
      return NextResponse.json({ error: 'Tautan survei tidak valid.' }, { status: 400, headers: noStore })
    if (!isReason(reason))
      return NextResponse.json({ error: 'Pilihan alasan tidak valid.' }, { status: 400, headers: noStore })
    const notes = typeof details === 'string' ? details.trim() : null
    if (notes && notes.length > 500)
      return NextResponse.json({ error: 'Rincian jawaban maksimal 500 karakter.' }, { status: 400, headers: noStore })
    if (reason === 'other' && (!notes || notes.length < 3))
      return NextResponse.json({ error: 'Mohon isi alasan (3–500 karakter).' }, { status: 400, headers: noStore })
    if (reason === 'network_issue' && !['Buat tiket: Ya','Buat tiket: Tidak'].includes(notes || ''))
      return NextResponse.json({ error: 'Mohon tentukan apakah ingin dibantu membuat tiket.' }, { status: 400, headers: noStore })
    if (reason === 'other_provider' && (!notes || !/^Provider: .+; Harga: [0-9]+; Lanjut HiFi: (Ya|Tidak)$/.test(notes)))
      return NextResponse.json({ error: 'Lengkapi provider, harga, dan kelanjutan HiFi.' }, { status: 400, headers: noStore })
    if (reason === 'no_longer_needed' && (!notes || !/^Minta informasi freeze tagihan: (Ya|Tidak); Durasi: .+$/.test(notes)))
      return NextResponse.json({ error: 'Lengkapi pilihan freeze tagihan dan perkiraan durasi.' }, { status: 400, headers: noStore })
    const db = getSupabaseAdmin()
    if (!db) return NextResponse.json({ error: 'Layanan survei belum dikonfigurasi.' }, { status: 503, headers: noStore })
    const { data: invitation, error: lookupError } = await db.from('survey_invitations')
      .select('id, expires_at, revoked_at').eq('token_hash', hashToken(token)).maybeSingle()
    if (lookupError) { console.error('Lookup failure', lookupError.code); throw new Error('lookup') }
    if (!invitation || invitation.revoked_at) return NextResponse.json({ error: 'Tautan survei tidak valid.' }, { status: 403, headers: noStore })
    if (Date.parse(invitation.expires_at) <= Date.now())
      return NextResponse.json({ error: 'Tautan survei sudah kedaluwarsa.' }, { status: 403, headers: noStore })
    const title = REASONS.find(x => x.id === reason)!.title
    const { error } = await db.from('survey_responses').insert({
      invitation_id: invitation.id, selected_reason: title, additional_reason: notes,
    })
    if (error?.code === '23505') return NextResponse.json({ error: 'Survei ini sudah pernah dijawab.' }, { status: 409, headers: noStore })
    if (error?.code === '23514') {
      console.error('Survey constraint mismatch. Apply supabase/migrations/20261016_survey_followup_constraints.sql')
      return NextResponse.json({ error: 'Konfigurasi survei sedang diperbarui. Silakan coba kembali beberapa saat lagi.' }, { status: 503, headers: noStore })
    }
    if (error) { console.error('Survey save failed', error.code); throw new Error('insert') }
    return NextResponse.json({ ok: true }, { headers: noStore })
  } catch {
    return NextResponse.json({ error: 'Gagal menyimpan jawaban. Silakan coba lagi.' }, { status: 500, headers: noStore })
  }
}
