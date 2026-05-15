import SupplierNewClient from './SupplierNewClient'
import { requireNetworkApprovedPage } from '@/lib/get-restaurant'

export default async function SupplierNewPage() {
  await requireNetworkApprovedPage()
  return <SupplierNewClient />
}
