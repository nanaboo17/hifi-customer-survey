import { redirect } from 'next/navigation'

export default function LegacyBulkUploadRedirect() {
  redirect('/upload')
}
