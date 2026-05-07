import { redirect } from 'next/navigation'

export default async function MoneyPage() {
  redirect('/money/upcoming')
}
