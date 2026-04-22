import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const code      = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type      = searchParams.get('type') as EmailOtpType | null
  const next      = searchParams.get('next') ?? '/today'

  console.log('[auth/callback] 진입. params:', { code: !!code, tokenHash: !!tokenHash, type, next })

  // redirect response를 먼저 만들어두고 여기에 쿠키를 직접 심는 것이 핵심
  // cookies().set()은 Route Handler에서 response에 반영되지 않음
  const redirectTo  = new URL(next, origin)
  const failUrl     = new URL('/login', origin)
  failUrl.searchParams.set('error', 'auth_failed')

  // 쿠키를 수집할 배열
  const cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }> = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // 요청 쿠키 전달 (PKCE verifier 등)
          return request.cookies.getAll()
        },
        setAll(cs: { name: string; value: string; options: Record<string, unknown> }[]) {
          // response에 심을 쿠키를 배열에 모음
          cs.forEach((c: { name: string; value: string; options: Record<string, unknown> }) =>
            cookiesToSet.push(c),
          )
        },
      },
    },
  )

  let authError: string | null = null

  if (code) {
    console.log('[auth/callback] PKCE code 교환 시도')
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      authError = error.message
      console.error('[auth/callback] code 교환 실패:', error.message)
    } else {
      console.log('[auth/callback] code 교환 성공. 쿠키 수:', cookiesToSet.length)
    }
  } else if (tokenHash && type) {
    console.log('[auth/callback] token_hash 검증 시도. type:', type)
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error) {
      authError = error.message
      console.error('[auth/callback] token_hash 검증 실패:', error.message)
    } else {
      console.log('[auth/callback] token_hash 검증 성공. 쿠키 수:', cookiesToSet.length)
    }
  } else {
    authError = 'code 또는 token_hash 파라미터 없음'
    console.error('[auth/callback]', authError)
  }

  if (authError) {
    return NextResponse.redirect(failUrl)
  }

  // 성공 — redirect response에 세션 쿠키를 직접 심음
  const response = NextResponse.redirect(redirectTo)
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
  })

  console.log('[auth/callback] 성공. redirect →', redirectTo.pathname)
  return response
}
