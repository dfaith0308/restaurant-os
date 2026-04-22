import Link from 'next/link'

interface Props {
  openCount: number
  noPrice?:  boolean
}

export default function TodayRfqCard({ openCount, noPrice }: Props) {
  if (noPrice) {
    return (
      <div style={{
        background: '#fff', borderRadius: 16,
        border: '1px solid #E0E7FF', overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 18px' }}>
          <div style={{ fontSize: 12, color: '#4F46E5', fontWeight: 600, marginBottom: 8 }}>
            📋 오늘 할 일
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 16 }}>
            품목만 알려주시면 더 싼 곳 찾아드려요
          </div>
          <Link href="/rfq/new" style={{
            display: 'block', padding: '15px',
            background: '#111827', color: '#fff',
            borderRadius: 12, fontSize: 16, fontWeight: 700,
            textDecoration: 'none', textAlign: 'center',
          }}>
            더 싼 곳 찾기
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      border: '1px solid #BFDBFE', overflow: 'hidden',
    }}>
      <div style={{ padding: '18px 18px' }}>
        <div style={{ fontSize: 12, color: '#1D4ED8', fontWeight: 600, marginBottom: 6 }}>
          📋 오늘 할 일
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 16 }}>
          견적 {openCount}건 도착했어요
        </div>
        <Link href="/rfq" style={{
          display: 'block', padding: '15px',
          background: '#111827', color: '#fff',
          borderRadius: 12, fontSize: 16, fontWeight: 700,
          textDecoration: 'none', textAlign: 'center',
        }}>
          더 싼 곳 고르기
        </Link>
      </div>
    </div>
  )
}
