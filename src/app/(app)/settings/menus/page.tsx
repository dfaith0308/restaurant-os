import { getMenus } from '@/actions/menus'
import { getIngredients } from '@/actions/ingredients'
import MenusClient from '@/components/settings/MenusClient'

export default async function MenusPage() {
  const [menusRes, ingRes] = await Promise.all([getMenus(), getIngredients()])
  return (
    <MenusClient
      menus={menusRes.data ?? []}
      ingredients={ingRes.data ?? []}
      error={menusRes.success ? null : (menusRes.error ?? '조회 실패')}
    />
  )
}

