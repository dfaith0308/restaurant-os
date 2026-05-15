import { redirect } from 'next/navigation'
import { requireNetworkApprovedPage } from '@/lib/get-restaurant'

export default async function MoneyPage() {
  await requireNetworkApprovedPage()
  redirect('/money/upcoming')
}
