export default function TodayTrustNotice({
  text = '\uc6b4\uc601 \ub370\uc774\ud130\ub294 \uc8fc\ubb38\u00b7\uac70\ub798\uba85\uc138\uc11c\u00b7\uc785\ub825 \ud750\ub984\uc744 \uae30\ubc18\uc73c\ub85c \ubd84\uc11d\ub3fc\uc694.',
}: {
  text?: string
}) {
  return (
    <p style={{ fontSize: 11, color: '#9ca3af', margin: '12px 0 0', lineHeight: 1.45 }}>
      {text}
    </p>
  )
}
