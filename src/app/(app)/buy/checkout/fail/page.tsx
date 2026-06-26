export default async function CheckoutFailPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; code?: string }>
}) {
  const sp = await searchParams
  const message = sp.message ?? '결제에 실패했습니다'

  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '40px 20px',
        textAlign: 'center',
        minHeight: '100vh',
        background: '#f7f6f2',
      }}
    >
      <div style={{ background: '#fff', borderRadius: 16, padding: '40px 24px' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>❌</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a1a', margin: '0 0 8px' }}>결제 실패</h1>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 24px' }}>{message}</p>
        {sp.code ? (
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 16px' }}>오류 코드: {sp.code}</p>
        ) : null}
        <a
          href="/buy/checkout"
          style={{
            display: 'block',
            padding: '14px',
            background: '#1f5d3a',
            borderRadius: 12,
            color: '#fff',
            textDecoration: 'none',
            fontSize: 15,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          다시 시도하기
        </a>
        <a
          href="/buy"
          style={{
            display: 'block',
            padding: '14px',
            background: '#f7f6f2',
            borderRadius: 12,
            color: '#374151',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          쇼핑으로 돌아가기
        </a>
      </div>
    </main>
  )
}
