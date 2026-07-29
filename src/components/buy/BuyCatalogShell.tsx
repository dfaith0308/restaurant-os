'use client'

import { useEffect, useState, useTransition, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

export type BuyCatalogCategory = {
  id: string
  name: string
  slug: string
  children: { id: string; name: string; slug: string }[]
}

export type BuySort = 'default' | 'price_asc' | 'price_desc'

function buyHref(search?: string, catSlug?: string, subCatSlug?: string, sort?: BuySort) {
  const p = new URLSearchParams()
  if (search?.trim()) p.set('search', search.trim())
  if (catSlug && catSlug !== 'all') p.set('cat', catSlug)
  if (subCatSlug) p.set('subcat', subCatSlug)
  if (sort && sort !== 'default') p.set('sort', sort)
  const q = p.toString()
  return q ? `/buy?${q}` : '/buy'
}

const chipRowStyle = {
  display: 'flex',
  gap: 8,
  overflowX: 'auto' as const,
  paddingBottom: 4,
  marginLeft: -16,
  marginRight: -16,
  paddingLeft: 16,
  paddingRight: 16,
  WebkitOverflowScrolling: 'touch' as const,
}

const SORT_OPTIONS: { id: BuySort; label: string }[] = [
  { id: 'default', label: '기본순' },
  { id: 'price_asc', label: '낮은가격' },
  { id: 'price_desc', label: '높은가격' },
]

export default function BuyCatalogShell({
  categories,
  search,
  catSlug,
  subCatSlug,
  sort = 'default',
  children,
}: {
  categories: BuyCatalogCategory[]
  search?: string
  catSlug?: string
  subCatSlug?: string
  sort?: BuySort
  children: ReactNode
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState(search ?? '')

  useEffect(() => {
    setQuery(search ?? '')
  }, [search])

  function navigate(nextSearch?: string, nextCat?: string, nextSub?: string, nextSort?: BuySort) {
    const href = buyHref(nextSearch, nextCat, nextSub, nextSort ?? sort)
    startTransition(() => {
      router.replace(href, { scroll: false })
    })
  }

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault()
    navigate(query.trim() || undefined, catSlug, subCatSlug, sort)
  }

  const selectedParent =
    catSlug && catSlug !== 'all'
      ? categories.find((c) => c.slug === catSlug || c.id === catSlug)
      : null

  const allActive = !catSlug || catSlug === 'all'

  return (
    <>
      <form onSubmit={onSearchSubmit} style={{ marginBottom: 12 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="상품명 검색"
          enterKeyHint="search"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '12px 14px',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            fontSize: 14,
          }}
        />
      </form>

      <div
        style={{
          ...chipRowStyle,
          marginBottom: 10,
          opacity: isPending ? 0.7 : 1,
        }}
      >
        <button type="button" onClick={() => navigate(search, 'all', undefined, sort)} style={chipStyle(allActive)}>
          전체
        </button>

        {categories.map((c) => {
          const isActive = catSlug === c.slug || catSlug === c.id
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => navigate(search, c.slug || c.id, undefined, sort)}
              style={chipStyle(isActive)}
            >
              {c.name}
            </button>
          )
        })}
      </div>

      {selectedParent && selectedParent.children.length > 0 ? (
        <div
          style={{
            background: '#f3f7f5',
            borderRadius: 10,
            padding: '10px 0',
            marginBottom: 10,
            marginLeft: -16,
            marginRight: -16,
            opacity: isPending ? 0.7 : 1,
          }}
        >
          <div style={chipRowStyle}>
            <button type="button" onClick={() => navigate(search, catSlug, undefined, sort)} style={subChipStyle(!subCatSlug)}>
              {selectedParent.name} 전체
            </button>
            {selectedParent.children.map((sub) => {
              const isActive = subCatSlug === sub.slug || subCatSlug === sub.id
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => navigate(search, catSlug, sub.slug || sub.id, sort)}
                  style={subChipStyle(isActive)}
                >
                  {sub.name}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <div
        style={{
          ...chipRowStyle,
          marginBottom: 20,
          opacity: isPending ? 0.7 : 1,
        }}
        role="group"
        aria-label="정렬"
      >
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => navigate(search, catSlug, subCatSlug, opt.id)}
            style={sortChipStyle(sort === opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div
        style={{
          opacity: isPending ? 0.45 : 1,
          transition: 'opacity 0.15s ease',
          pointerEvents: isPending ? 'none' : undefined,
        }}
        aria-busy={isPending}
      >
        {children}
      </div>
    </>
  )
}

function chipStyle(active: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 16px',
    borderRadius: 20,
    fontSize: 14,
    fontWeight: active ? 600 : 400,
    background: active ? '#1f5d3a' : 'var(--color-background-primary)',
    color: active ? '#fff' : 'var(--color-text-primary)',
    border: `1px solid ${active ? '#1f5d3a' : 'var(--color-border-default)'}`,
    whiteSpace: 'nowrap',
    flex: '0 0 auto',
    cursor: 'pointer',
    fontFamily: 'inherit',
  }
}

function subChipStyle(active: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 14px',
    borderRadius: 16,
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    background: active ? '#f0f7f3' : '#fff',
    color: active ? '#1f5d3a' : '#374151',
    border: `1px solid ${active ? '#1f5d3a' : '#e5e7eb'}`,
    whiteSpace: 'nowrap',
    flex: '0 0 auto',
    cursor: 'pointer',
    fontFamily: 'inherit',
  }
}

function sortChipStyle(active: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 12px',
    borderRadius: 16,
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    background: active ? '#f0f7f3' : '#fff',
    color: active ? '#1f5d3a' : '#6b7280',
    border: `1px solid ${active ? '#1f5d3a' : '#e5e7eb'}`,
    whiteSpace: 'nowrap',
    flex: '0 0 auto',
    cursor: 'pointer',
    fontFamily: 'inherit',
  }
}
