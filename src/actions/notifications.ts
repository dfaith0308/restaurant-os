'use server'

import { createServerClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, Notification } from '@/types'

export async function getNotifications(
  tenant_id: string,
): Promise<ActionResult<Notification[]>> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, priority, title, message, action_link, action_label, is_read, created_at')
    .eq('tenant_id', tenant_id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return { success: false, error: error.message }
  return { success: true, data: (data ?? []) as Notification[] }
}

export async function markNotificationRead(
  id: string,
  tenant_id: string,
): Promise<ActionResult> {
  if (!id?.trim()) return { success: false, error: 'id가 올바르지 않습니다.' }
  if (!tenant_id?.trim()) return { success: false, error: 'tenant_id가 올바르지 않습니다.' }

  const supabase = await createServerClient()
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('tenant_id', tenant_id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/today')
  revalidatePath('/notifications')
  return { success: true }
}

