'use server'

import { createServerClient as _create, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function createServerClient() {
  const cookieStore = await cookies()
  const schema = process.env.SUPABASE_DB_SCHEMA ?? 'public'

  return _create(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cs: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cs.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {}
        },
      },
    },
  )
}

export interface AuthCtx {
  user_id: string
  tenant_id: string
  role: string
}

export async function getAuthCtx(supabase: any): Promise<AuthCtx | null> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data, error: rowErr } = await supabase
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (rowErr || !data?.tenant_id) return null
  return {
    user_id: user.id,
    tenant_id: data.tenant_id as string,
    role: (data as any).role ?? 'unknown',
  }
}