// ============================================================
// 거래명세표 Mock Parser
//
// 실제 OCR/파일 파서 붙이기 전에 쓰는 스캐폴드.
// 업로드된 파일 내용은 보지 않고, 파일명/크기 해시로 데모 데이터셋을 고른다.
// 같은 파일을 다시 올리면 같은 결과 — 재현성 보장.
//
// 이후 실제 파서로 교체할 때 ParsedInvoice 스키마만 유지하면 된다.
// ============================================================

export interface ParsedInvoiceRow {
  name:          string          // raw_name (명세서 원문)
  unit:          string
  quantity:      number
  unit_price:    number
  supplier_name: string
  // ── SKU 레이어 (선택, OCR 가 뽑아낸 값) ──
  parsed_name?:  string | null
  brand?:        string | null
  barcode?:      string | null
  manufacturer?: string | null
}

// ── 제품 뒷면 사진 전용 결과 ──
export interface ParsedProductBack {
  name:          string      // raw_name 제안값
  parsed_name:   string
  brand:         string
  unit:          string
  barcode:       string
  manufacturer:  string
}

export interface ParsedInvoice {
  supplier_name: string
  invoice_date:  string   // YYYY-MM-DD
  rows:          ParsedInvoiceRow[]
}

const MOCK_DATASETS: ParsedInvoice[] = [
  {
    supplier_name: '한마음 식자재',
    invoice_date:  today(),
    rows: [
      { name: '돼지고기 앞다리', unit: 'kg', quantity: 10, unit_price: 11500, supplier_name: '한마음 식자재',
        parsed_name: '국산 돼지 앞다리', brand: '한마음', barcode: null, manufacturer: '한마음식품' },
      { name: '양파',            unit: 'kg', quantity: 20, unit_price: 2800,  supplier_name: '한마음 식자재',
        parsed_name: '국산 양파',       brand: null,     barcode: null, manufacturer: null },
      { name: '대파',            unit: 'kg', quantity: 5,  unit_price: 5500,  supplier_name: '한마음 식자재' },
      { name: '계란',            unit: '판', quantity: 3,  unit_price: 7800,  supplier_name: '한마음 식자재',
        parsed_name: '특란 30구', brand: '농협', barcode: '8801234010001', manufacturer: '농협중앙회' },
    ],
  },
  {
    supplier_name: '부평 야채상',
    invoice_date:  today(),
    rows: [
      { name: '고춧가루',        unit: 'kg', quantity: 3,  unit_price: 16800, supplier_name: '부평 야채상',
        parsed_name: '국산 태양초 고춧가루 1kg', brand: '청정원', barcode: '8801234020015', manufacturer: '대상(주)' },
      { name: '마늘',            unit: 'kg', quantity: 5,  unit_price: 12000, supplier_name: '부평 야채상',
        parsed_name: '깐마늘', brand: null, barcode: null, manufacturer: null },
      { name: '깻잎',            unit: 'kg', quantity: 2,  unit_price: 18000, supplier_name: '부평 야채상' },
      { name: '상추',            unit: 'kg', quantity: 4,  unit_price: 9500,  supplier_name: '부평 야채상' },
    ],
  },
  {
    supplier_name: '남동 축산',
    invoice_date:  today(),
    rows: [
      { name: '돼지고기 삼겹살', unit: 'kg', quantity: 8,  unit_price: 17500, supplier_name: '남동 축산',
        parsed_name: '국산 냉장 삼겹살', brand: '도드람', barcode: '8801234030022', manufacturer: '도드람양돈조합' },
      { name: '소고기 국거리',   unit: 'kg', quantity: 4,  unit_price: 28000, supplier_name: '남동 축산',
        parsed_name: '1등급 국거리', brand: '한우자조금', barcode: '8801234030039', manufacturer: '한우자조금관리위원회' },
      { name: '닭고기',          unit: 'kg', quantity: 12, unit_price: 7200,  supplier_name: '남동 축산' },
    ],
  },
]

// ── 제품 뒷면 사진 전용 mock ─────────────────────────────────
// OCR 로 브랜드/용량/바코드/제조사를 뽑은 결과 형태.
const MOCK_PRODUCT_BACKS: ParsedProductBack[] = [
  {
    name:         '고춧가루',
    parsed_name:  '국산 태양초 고춧가루 1kg',
    brand:        '청정원',
    unit:         'kg',
    barcode:      '8801234020015',
    manufacturer: '대상(주)',
  },
  {
    name:         '간장',
    parsed_name:  '진간장 골드 1.8L',
    brand:        '샘표',
    unit:         'L',
    barcode:      '8801234040011',
    manufacturer: '샘표식품',
  },
  {
    name:         '참기름',
    parsed_name:  '프리미엄 참기름 320ml',
    brand:        '오뚜기',
    unit:         'ml',
    barcode:      '8801234050028',
    manufacturer: '오뚜기',
  },
]

export function mockParseProductBack(file: { name: string; size: number }): ParsedProductBack {
  const idx = Math.abs(hashString('pb:' + file.name + ':' + file.size)) % MOCK_PRODUCT_BACKS.length
  return MOCK_PRODUCT_BACKS[idx]
}

export function mockParseInvoice(file: { name: string; size: number }): ParsedInvoice {
  const idx = Math.abs(hashString(file.name + ':' + file.size)) % MOCK_DATASETS.length
  // 날짜는 항상 오늘
  return { ...MOCK_DATASETS[idx], invoice_date: today() }
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}
