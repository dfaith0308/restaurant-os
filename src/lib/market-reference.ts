// ============================================================
// 시장 참고 단가 (MVP — 2025년 한국 기준 개략치)
// 시장 데이터가 쌓이기 전까지 "판단"을 제공하는 기준값
// 키워드 매칭 방식: 입력 품목명에 아래 키 중 하나가 포함되면 매칭
// ============================================================

export interface PriceReference {
  unit: string
  avg:  number   // 단위당 평균 원
}

// 키워드는 짧고 흔한 것부터. 길이 긴 키워드가 우선 매칭되도록 정렬해 사용.
const REF: Record<string, PriceReference> = {
  // 육류
  '돼지고기 앞다리': { unit: 'kg', avg: 10000 },
  '돼지고기 삼겹살': { unit: 'kg', avg: 16000 },
  '돼지고기':        { unit: 'kg', avg: 12000 },
  '소고기 국거리':   { unit: 'kg', avg: 22000 },
  '소고기':          { unit: 'kg', avg: 25000 },
  '닭고기':          { unit: 'kg', avg: 7000  },
  '계란':            { unit: '판', avg: 7500  },

  // 양념/가루
  '고춧가루':        { unit: 'kg', avg: 14000 },
  '고추장':          { unit: 'kg', avg: 10000 },
  '된장':            { unit: 'kg', avg: 6000  },
  '간장':            { unit: 'L',  avg: 5000  },
  '식용유':          { unit: 'L',  avg: 4000  },
  '참기름':          { unit: 'L',  avg: 20000 },
  '설탕':            { unit: 'kg', avg: 2500  },
  '소금':            { unit: 'kg', avg: 2000  },

  // 채소
  '마늘':            { unit: 'kg', avg: 10000 },
  '양파':            { unit: 'kg', avg: 2500  },
  '대파':            { unit: 'kg', avg: 5000  },
  '쪽파':            { unit: 'kg', avg: 8000  },
  '무':              { unit: 'kg', avg: 1500  },
  '배추':            { unit: 'kg', avg: 2500  },
  '상추':            { unit: 'kg', avg: 8000  },
  '깻잎':            { unit: 'kg', avg: 15000 },
  '고추':            { unit: 'kg', avg: 10000 },
  '콩나물':          { unit: 'kg', avg: 2500  },
  '두부':            { unit: '모', avg: 2000  },
  '감자':            { unit: 'kg', avg: 3000  },

  // 곡물
  '쌀':              { unit: 'kg', avg: 3500  },
}

// 긴 키워드가 우선 매칭되도록 정렬
const SORTED_KEYS = Object.keys(REF).sort((a, b) => b.length - a.length)

export function lookupReference(name: string): { key: string; ref: PriceReference } | null {
  const n = name.replace(/\s+/g, '').toLowerCase()
  for (const key of SORTED_KEYS) {
    const k = key.replace(/\s+/g, '').toLowerCase()
    if (n.includes(k)) return { key, ref: REF[key] }
  }
  return null
}

export type Verdict = 'high' | 'normal' | 'low' | 'unknown'

export interface PriceEvaluation {
  verdict:          Verdict
  diff_pct:         number   // +면 비쌈, -면 쌈
  avg_price:        number   // 참고 평균 (unknown이면 0)
  saving_per_unit:  number   // current - avg (양수 = 절약 가능)
  ref_key:          string | null
  ref_unit:         string | null  // 참고 기준 단위
}

export function evaluatePrice(
  name:    string,
  _unit:   string,
  current: number | null,
): PriceEvaluation {
  if (!current || current <= 0) {
    return { verdict: 'unknown', diff_pct: 0, avg_price: 0, saving_per_unit: 0, ref_key: null, ref_unit: null }
  }
  const match = lookupReference(name)
  if (!match) {
    return { verdict: 'unknown', diff_pct: 0, avg_price: 0, saving_per_unit: 0, ref_key: null, ref_unit: null }
  }
  const avg     = match.ref.avg
  const diffPct = Math.round(((current - avg) / avg) * 100)
  const verdict: Verdict =
    diffPct > 10  ? 'high'  :
    diffPct < -10 ? 'low'   :
                    'normal'
  return {
    verdict,
    diff_pct:        diffPct,
    avg_price:       avg,
    saving_per_unit: Math.max(0, current - avg),
    ref_key:         match.key,
    ref_unit:        match.ref.unit,
  }
}

// UI 헬퍼 — 판정별 문구
export function verdictCopy(ev: PriceEvaluation, name: string): {
  headline: string
  sub:      string
  tone:     'danger' | 'warn' | 'good' | 'neutral'
} {
  switch (ev.verdict) {
    case 'high':
      return {
        headline: `${name}, 평균보다 ${ev.diff_pct}% 비싸요`,
        sub:      `단위당 약 ${ev.saving_per_unit.toLocaleString()}원 절약 여지가 있어요`,
        tone:     ev.diff_pct > 20 ? 'danger' : 'warn',
      }
    case 'low':
      return {
        headline: `${name}, 꽤 좋은 가격이에요`,
        sub:      `평균보다 ${Math.abs(ev.diff_pct)}% 싼 편`,
        tone:     'good',
      }
    case 'normal':
      return {
        headline: `${name}, 적정 가격이에요`,
        sub:      '그래도 다른 조건도 받아볼 수 있어요',
        tone:     'neutral',
      }
    case 'unknown':
      return {
        headline: `${name}, 아직 비교 데이터가 없어요`,
        sub:      '다른 거래처 조건을 받아보면 바로 비교돼요',
        tone:     'neutral',
      }
  }
}
