import SurveyPage from '@/components/survey-page'
import { resolveInvitation } from '@/lib/invitations'

export const dynamic = 'force-dynamic'
export default async function CustomerSurvey({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { status } = await resolveInvitation(token)
  return <SurveyPage status={status} token={token} />
}
