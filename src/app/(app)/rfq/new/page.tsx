import RfqNewForm from '@/components/rfq/RfqNewForm'
import { requireNetworkApprovedPage } from '@/lib/get-restaurant'

export default async function RfqNewPage({
  searchParams,
}: {
  searchParams: Promise<{ ingredient?: string; price?: string }>
}) {
  await requireNetworkApprovedPage()
  const sp    = await searchParams
  const name  = sp.ingredient ? decodeURIComponent(sp.ingredient) : undefined
  const price = sp.price ? parseInt(sp.price, 10) : undefined

  return <RfqNewForm prefillName={name} prefillPrice={price} />
}
