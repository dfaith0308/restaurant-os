import { Suspense } from 'react'
import { getInactiveMenus, getMenus } from '@/actions/menus'
import { getIngredients } from '@/actions/ingredients'
import MenusClient from '@/components/settings/MenusClient'

export default async function MenusPage() {
  const [menusRes, inactiveMenusRes, ingRes] = await Promise.all([
    getMenus(),
    getInactiveMenus(),
    getIngredients(),
  ])
  return (
    <Suspense fallback={null}>
      <MenusClient
        menus={menusRes.data ?? []}
        inactiveMenus={inactiveMenusRes.data ?? []}
        ingredients={ingRes.data ?? []}
        error={menusRes.success ? null : (menusRes.error ?? '조회 실패')}
      />
    </Suspense>
  )
}

