import { getRfqList } from '@/actions/rfq'
import RfqListClient from '@/components/rfq/RfqListClient'
import Link from 'next/link'
import { getTenantId } from '@/lib/get-restaurant'

const ALLOWED_STATUS = new Set(['open', 'ordered', 'closed'])

export default async function RfqPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>
}) {
  const tenant_id = await getTenantId()
  const sp = (await searchParams) ?? {}
  const status = sp.status && ALLOWED_STATUS.has(sp.status) ? (sp.status as 'open' | 'ordered' | 'closed') : undefined

  const [allRes, filteredRes] = await Promise.all([
    getRfqList(tenant_id).catch(() => ({ success: true as const, data: [] })),
    getRfqList(tenant_id, status).catch(() => ({ success: true as const, data: [] })),
  ])

  const allRfqs = allRes.data ?? []
  const rfqs    = filteredRes.data ?? []

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>
            주문관리
          </h1>
          <p style={{ fontSize: 13, color: '#9ca3af', margin: '4px 0 0 0' }}>
            견적 요청부터 납품까지
          </p>
        </div>
        <Link href="/rfq/new" style={{
          padding: '10px 18px', background: '#111827', color: '#fff',
          borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none',
        }}>
          + 새 견적 요청
        </Link>
      </div>

      <RfqListClient
        rfqs={rfqs}
        allRfqs={allRfqs}
        activeStatus={(status ?? 'all') as 'all' | 'open' | 'ordered' | 'closed'}
      />
    </main>
  )
}
