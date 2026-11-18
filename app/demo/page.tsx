import SurveyPage from '@/components/survey-page'

export const metadata = { title: 'Demo Survei Pelanggan | HiFi', robots: { index: false, follow: false } }

export default function DemoPage() {
  return <SurveyPage status="demo" token="" />
}
