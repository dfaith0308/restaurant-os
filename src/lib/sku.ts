// ============================================================
// SKU 식별 레이어
//
// 이름 매칭(raw_name) 위에 얹힘 — 기존 name 기반 로직은 fallback 으로 살아있음.
// 우선순위: barcode → brand+parsed_name+unit → raw_name
// ============================================================

export interface SkuIdentity {
  name:         string           // raw_name (필수, 삭제 금지)
  parsed_name?: string | null
  brand?:       string | null
  unit?:        string | null
  barcode?:     string | null
  manufacturer?: string | null
  possible_duplicate_group_id?: string | null    // 같은 상품 그룹 (barcode 없을 때 fallback)
}

// exact   : barcode 일치 — 가장 확실
// grouped : 자동 또는 수동으로 같은 상품 그룹에 묶임 — 그 다음으로 확실
// branded : 브랜드 + 품목명 + 단위가 일치 (그룹 미부여)
// name_only: 원본 이름 뿐
export type SkuPrecision = 'exact' | 'grouped' | 'branded' | 'name_only'

// ── 매칭: candidate 와 가장 가까운 existing row 를 찾음 ──────
//   반환 null 이면 "기존에 없음 → 신규 삽입 필요"
export function matchSku<T extends SkuIdentity & { id: string }>(
  candidate: SkuIdentity,
  existing:  T[],
): T | null {
  // 1순위 — barcode 완전 일치
  const bc = normalize(candidate.barcode)
  if (bc) {
    const hit = existing.find(e => normalize(e.barcode) === bc)
    if (hit) return hit
  }

  // 2순위 — brand + (parsed_name 또는 raw_name) + unit 일치
  const brand = normalize(candidate.brand)
  const pname = normalize(candidate.parsed_name) ?? normalize(candidate.name)
  const unit  = normalize(candidate.unit)
  if (brand && pname && unit) {
    const hit = existing.find(e =>
      normalize(e.brand)        === brand &&
      (normalize(e.parsed_name) ?? normalize(e.name)) === pname &&
      normalize(e.unit)         === unit,
    )
    if (hit) return hit
  }

  // 3순위 — raw_name fallback (기존 동작 보존)
  const rname = normalize(candidate.name)
  if (rname) {
    return existing.find(e => normalize(e.name) === rname) ?? null
  }
  return null
}

// ── SKU 완성도 분류 ─────────────────────────────────────────
//   UI 에서 "SKU 정확 매칭" 뱃지, AI 에서 비교 신뢰도 메타로 사용
//   우선순위: exact > grouped > branded > name_only
export function skuConfidence(s: SkuIdentity): SkuPrecision {
  if (normalize(s.barcode)) return 'exact'
  if (normalize(s.possible_duplicate_group_id)) return 'grouped'
  if (normalize(s.brand) && (normalize(s.parsed_name) || normalize(s.unit))) return 'branded'
  return 'name_only'
}

// ── 그룹핑용 유사도 판정 ─────────────────────────────────────
//   조건: 같은 brand + 같은 unit + parsed_name(또는 name)이 "서로 부분 문자열"
//   matchSku 의 branded 매칭보다 관대함 — 거기서 못 잡은 비슷한 SKU 를 그룹으로 묶는 용도
export function isSimilarForGrouping(
  a: Pick<SkuIdentity, 'name' | 'parsed_name' | 'brand' | 'unit'>,
  b: Pick<SkuIdentity, 'name' | 'parsed_name' | 'brand' | 'unit'>,
): boolean {
  const bA = normalize(a.brand), bB = normalize(b.brand)
  if (!bA || bA !== bB) return false
  const uA = normalize(a.unit), uB = normalize(b.unit)
  if (!uA || uA !== uB) return false
  const nA = normalize(a.parsed_name) ?? normalize(a.name)
  const nB = normalize(b.parsed_name) ?? normalize(b.name)
  if (!nA || !nB) return false
  if (nA === nB) return true
  return nA.includes(nB) || nB.includes(nA)
}

export function skuDisplayName(s: SkuIdentity): string {
  const parts: string[] = []
  if (s.brand)        parts.push(s.brand)
  parts.push(s.parsed_name || s.name)
  return parts.join(' · ')
}

// ── 유틸 ────────────────────────────────────────────────────

function normalize(v: string | null | undefined): string | null {
  if (v == null) return null
  const t = v.trim().toLowerCase().replace(/\s+/g, '')
  return t.length > 0 ? t : null
}
