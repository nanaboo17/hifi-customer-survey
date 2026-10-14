import SurveyPage from '@/components/survey-page'
import { resolveInvitation } from '@/lib/invitations'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ t?: string | string[]; demo?: string | string[] }>

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams

  if (first(params.demo) === '1') return <SurveyPage status="demo" token="" />

  const token = first(params.t) ?? ''
  const { status } = await resolveInvitation(token || undefined)
  return <SurveyPage status={status} token={token} />
}
