import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ============================================================
// 식당OS role 게이트
//
// 두 OS 가 Supabase 프로젝트 하나를 공유해서 auth 세션이 그대로 통한다.
// 이 파일이 no-op 이던 동안 공급자 계정으로 로그인하면 식당OS 의 /buy 를 포함한
// 모든 화면이 그대로 열렸다. getAuthCtx 도 tenant_id 만 요구하고 role 은 반환만
// 할 뿐 검사하지 않아서, 애플리케이션 어디에도 role 경계가 없었다.
//
// 여기서 users.role 을 확인해 식당 사용자가 아닌 세션을 (app) 영역에서 차단한다.
// ============================================================

/**
 * 식당OS (app) 영역에 들어올 수 있는 role.
 *
 * - restaurant : 본래 사용자
 * - admin      : 플랫폼 운영자. 이미 관리자OS 에서 모든 원가를 보는 계정이라
 *                여기 들여보내도 새로 노출되는 정보가 없고, 막으면 고객 지원이
 *                끊긴다. 그래서 허용한다.
 * - supplier   : 차단 대상. 공급자에게 식당 구매 화면(가격·할인)을 열어줄 이유가 없다.
 *
 * 정책을 바꾸려면 이 배열만 고치면 된다.
 */
const ALLOWED_APP_ROLES = ['restaurant', 'admin'] as const

/** 로그인 없이 접근 가능한 경로 */
function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith('/login') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/terms') ||
    // Supabase 인증 콜백 / 로그아웃
    pathname.startsWith('/auth') ||
    // 외부에서 호출된다 — 토스 결제 콜백, 웹푸시 구독. 세션이 없는 게 정상이다.
    pathname.startsWith('/api')
  )
}

/**
 * 로그인은 필요하지만 role 은 아직 없을 수 있는 경로.
 * 가입 직후에는 users 행이 없고, onboarding 이 users 와 tenants 를 만들면서
 * role='restaurant' 를 넣는다(app/onboarding/page.tsx). 그 사이를 막으면 가입이 끊긴다.
 */
function isRoleExemptPath(pathname: string): boolean {
  return pathname.startsWith('/onboarding') || pathname.startsWith('/pending')
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          list.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(
              name,
              value,
              options as Parameters<typeof supabaseResponse.cookies.set>[2],
            ),
          )
        },
      },
    },
  )

  const { pathname } = request.nextUrl

  if (isPublicPath(pathname)) return supabaseResponse

  // 세션 확인 — 쿠키 파싱만 하므로 네트워크 호출이 없다.
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }

  // 온보딩·승인대기는 role 이 없어도 통과시킨다. 각 페이지가 자체적으로
  // tenant_id / is_approved 를 보고 다음 단계로 보낸다.
  if (isRoleExemptPath(pathname)) return supabaseResponse

  // 여기부터는 role 을 확인한다. getSession 은 쿠키를 그대로 믿으므로
  // 권한 판정에는 쓰지 않고, 서명을 검증하는 getUser 로 다시 확인한다.
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()

  if (userErr || !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('role, tenant_id')
    .eq('id', user.id)
    .maybeSingle()

  // users 행이 아직 없다 = 가입은 했으나 온보딩 미완료. 온보딩으로 보낸다.
  if (!userRow?.tenant_id) {
    const url = request.nextUrl.clone()
    url.pathname = '/onboarding'
    url.search = ''
    return NextResponse.redirect(url)
  }

  const role = (userRow as { role?: string | null }).role ?? null

  // role 이 아직 없는 상태는 "권한 없음"이 아니라 "가입 미완료"로 본다.
  // DB 트리거(handle_new_user_onboarding)가 auth 가입 시점에 '내 회사' tenant 와
  // users 행을 먼저 만들어 두고, signup.ts 가 그것을 정리한 뒤 role='restaurant' 를
  // 넣는다(cleanupTriggerOnboardingArtifacts). 그 사이에 끊기면 tenant_id 는 있는데
  // role 만 비어 있는 행이 남는다. 이걸 차단 안내로 보내면 정상 가입자가 영문도
  // 모르고 막히므로 온보딩으로 돌린다.
  if (!role) {
    const url = request.nextUrl.clone()
    url.pathname = '/onboarding'
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (!(ALLOWED_APP_ROLES as readonly string[]).includes(role)) {
    // 로그아웃시키지 않는다 — auth 가 공급자OS 와 공유되므로 여기서 세션을 끊으면
    // 원래 쓰던 공급자OS 세션까지 함께 죽는다. 로그인 화면으로만 되돌린다.
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = '?blocked=role'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  // 정적 자원과 이미지 제외. /api 는 isPublicPath 에서 다시 걸러진다
  // (matcher 에서 빼지 않는 이유: 목록을 한 곳에서만 관리하기 위해).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
