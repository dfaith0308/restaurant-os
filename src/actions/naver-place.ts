'use server'

export interface NaverPlaceMenuItem {
  name: string
  price: string
}

export interface NaverPlaceBlogReview {
  title: string
  summary: string
}

export interface NaverPlaceCrawlData {
  name: string | null
  category: string | null
  address: string | null
  phone: string | null
  business_hours: string[]
  menus: NaverPlaceMenuItem[]
  visitor_reviews: string[]
  blog_reviews: NaverPlaceBlogReview[]
  rating: string | null
  review_count: string | null
}

export type CrawlNaverPlaceResult =
  | { success: true; data: NaverPlaceCrawlData }
  | { success: false; error: string }

export async function crawlNaverPlace(url: string): Promise<CrawlNaverPlaceResult> {
  const trimmed = url.trim()
  if (!trimmed.includes('naver.com')) {
    return { success: false, error: '네이버 플레이스 URL을 입력해주세요' }
  }

  const crawlerUrl = process.env.NAVER_CRAWLER_URL?.replace(/\/$/, '')
  const apiKey = process.env.CRAWLER_API_KEY

  if (!crawlerUrl || !apiKey) {
    return { success: false, error: '크롤러 미설정' }
  }

  try {
    const res = await fetch(`${crawlerUrl}/crawl/naver-place`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ url: trimmed }),
      cache: 'no-store',
    })

    const body = (await res.json().catch(() => null)) as {
      success?: boolean
      data?: NaverPlaceCrawlData
      error?: string
    } | null

    if (!res.ok) {
      return { success: false, error: body?.error ?? '크롤링 실패' }
    }

    if (!body?.data) {
      return { success: false, error: '수집된 데이터가 없습니다' }
    }

    return { success: true, data: body.data }
  } catch {
    return { success: false, error: '크롤러 서버에 연결할 수 없습니다' }
  }
}
