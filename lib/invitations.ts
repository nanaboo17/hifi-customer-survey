import 'server-only'
import { createHash } from 'node:crypto'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export type InvitationStatus = 'valid' | 'missing' | 'invalid' | 'expired' | 'already_submitted' | 'unconfigured'
export type InvitationResult = { status: InvitationStatus }
const TOKEN_PATTERN = /^[-_a-zA-Z0-9]{32,256}$/
export const isValidTokenFormat = (token: string) => TOKEN_PATTERN.test(token)
export function hashToken(token: string) { return createHash('sha256').update(token).digest('hex') }

export async function resolveInvitation(token: string | undefined): Promise<InvitationResult> {
  if (!token) return { status: 'missing' }
  if (!isValidTokenFormat(token)) return { status: 'invalid' }
  const client = getSupabaseAdmin()
  if (!client) return { status: 'unconfigured' }
  const { data, error } = await client.from('survey_invitations')
    .select('id, expires_at, revoked_at, survey_responses(id)')
    .eq('token_hash', hashToken(token)).maybeSingle()
  if (error) { console.error('Invitation lookup failed', error.code); return { status: 'unconfigured' } }
  if (!data || data.revoked_at) return { status: 'invalid' }
  if (Array.isArray(data.survey_responses) && data.survey_responses.length) return { status: 'already_submitted' }
  if (Date.parse(data.expires_at) <= Date.now()) return { status: 'expired' }
  return { status: 'valid' }
}
