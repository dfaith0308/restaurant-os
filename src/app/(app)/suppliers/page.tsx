import { getRestaurantId } from '@/lib/get-restaurant'
import { getSuppliers } from '@/actions/suppliers'
import Link from 'next/link'
import { formatKRW } from '@/lib/utils'

export default async function SuppliersPage() {
  const restaurantId = await getRestaurantId()
  const result = await getSuppliers(restaurantId)
  const suppliers = result.data ?? []

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>거래처</h1>
          <p style={{ fontSize: 13, color: '#9ca3af', margin: '4px 0 0' }}>매입 의사결정 판단 DB</p>
        </div>
        <Link href="/suppliers/new" style={{ padding: '9px 16px', background: '#111827', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>+ 추가</Link>
      </div>

      {suppliers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🤝</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 8 }}>아직 거래처가 없어요</div>
          <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 20 }}>거래처를 등록하면 가격·납기 이력을<br />한눈에 볼 수 있어요</p>
          <Link href="/suppliers/new" style={{ display: 'inline-block', padding: '11px 24px', background: '#111827', color: '#fff', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>첫 거래처 등록하기</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {suppliers.map(s => (
            <Link key={s.id} href={`/suppliers/${s.id}`} style={{ textDecoration: 'none' }}>
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{s.name}</div>
                    {s.contact && <div style={{ fontSize: 12, color: '#6b7280' }}>{s.contact}</div>}
                    {s.region  && <div style={{ fontSize: 12, color: '#9ca3af' }}>{s.region}</div>}
                    {s.recent_order && (
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                        최근 거래: {s.recent_order.product_name} · {formatKRW(s.recent_order.total_amount)}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 18, color: '#9ca3af' }}>›</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
