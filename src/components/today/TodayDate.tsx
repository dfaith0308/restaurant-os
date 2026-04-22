'use client'

import { useEffect, useState } from 'react'

export default function TodayDate() {
  const [date, setDate] = useState('')

  useEffect(() => {
    setDate(new Date().toLocaleDateString('ko-KR', {
      month: 'long', day: 'numeric', weekday: 'long',
    }))
  }, [])

  return <span>{date}</span>
}
