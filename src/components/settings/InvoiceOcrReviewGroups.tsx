'use client'

import type { InvoiceIngredient } from '@/lib/invoice-ocr'
import {
  getOcrReviewSignals,
  isOcrReviewRecommended,
} from '@/lib/invoice-ocr-correction'
import {
  getInvoiceItemDisplayParts,
} from '@/lib/invoice-item-validation'
import { formatKRW } from '@/lib/utils'

const BRAND_ORANGE = '#F97316'
const BRAND_GREEN = '#1f5d3a'

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '0.5px solid #e8e5de',
  borderRadius: 8,
  fontSize: 13,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  background: '#ffffff',
}

type Ingredient = {
  id: string
  name: string
  unit: string
  current_price: number | null
}

export type OcrIngredientRow = InvoiceIngredient & {
  rowKey: string
  nameGroupId: string
  effectiveFrom: string
  priceAction?: 'apply' | 'keep'
}

function InvoiceOcrItemTitle({
  name,
  spec,
}: {
  name: string
  spec: string | null
}) {
  const parts = getInvoiceItemDisplayParts(name, spec)
  return (
    <p style={{ fontSize: 13, margin: '0 0 4px', lineHeight: 1.45 }}>
      <span style={{ fontWeight: 700, color: '#2b2b2b' }}>{parts.name}</span>
      {parts.spec ? (
        <span style={{ fontWeight: 400, color: '#6b7280', fontSize: 11 }}>
          {' '}
          {parts.spec}
        </span>
      ) : null}
    </p>
  )
}

function isLikelySameIngredient(
  a: string,
  b: string,
  normalize: (n: string) => string,
): boolean {
  const left = normalize(a)
  const right = normalize(b)
  if (!left || !right) return false
  return left === right
}

type Props = {
  groups: Array<[string, OcrIngredientRow[]]>
  allRows: OcrIngredientRow[]
  ingredientList: Ingredient[]
  normalizeName: (name: string) => string
  onGroupNameChange: (nameGroupId: string, value: string) => void
  onRowFieldChange: (
    rowKey: string,
    field: keyof InvoiceIngredient,
    value: string,
  ) => void
  onEffectiveFromChange: (rowKey: string, value: string) => void
  onPriceAction: (rowKey: string, action: 'apply' | 'keep') => void
  onRemoveRow: (rowKey: string) => void
  pricesDiffer: (a: number | null, b: number | null) => boolean
}

export default function InvoiceOcrReviewGroups({
  groups,
  allRows,
  ingredientList,
  normalizeName,
  onGroupNameChange,
  onRowFieldChange,
  onEffectiveFromChange,
  onPriceAction,
  onRemoveRow,
  pricesDiffer,
}: Props) {
  function findMatch(ocrName: string): Ingredient | undefined {
    return ingredientList.find((row) =>
      isLikelySameIngredient(row.name, ocrName, normalizeName),
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {groups.map(([nameGroupId, groupRows]) => {
        const lead = groupRows[0]
        if (!lead) return null

        const groupHasReview = groupRows.some((r) => {
          const ex = findMatch(r.name)
          return isOcrReviewRecommended(
            getOcrReviewSignals(r, allRows, !!ex),
          )
        })

        return (
          <div
            key={nameGroupId}
            style={{
              border: groupHasReview
                ? `1px solid ${BRAND_ORANGE}`
                : '0.5px solid #e8e5de',
              borderRadius: 12,
              overflow: 'hidden',
              background: groupHasReview ? '#fff7ed' : '#ffffff',
            }}
          >
            <div
              style={{
                padding: 12,
                background: '#f7f6f2',
                borderBottom: '0.5px solid #e8e5de',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 8,
                  marginBottom: 8,
                  flexWrap: 'wrap',
                }}
              >
                <InvoiceOcrItemTitle name={lead.name} spec={null} />
                <span
                  style={{
                    fontSize: 10,
                    color: '#6b7280',
                    background: '#fff',
                    borderRadius: 999,
                    padding: '3px 8px',
                    border: '0.5px solid #e8e5de',
                  }}
                >
                  {groupRows.length}개 규격
                </span>
              </div>
              {groupRows.length > 1 && (
                <p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 6px' }}>
                  품명 수정 시 동일 상품 {groupRows.length}줄에 함께 반영됩니다.
                </p>
              )}
              <input
                value={lead.name}
                onChange={(e) => onGroupNameChange(nameGroupId, e.target.value)}
                placeholder="품명"
                style={INPUT_STYLE}
              />
              {lead.ocr_name_raw && lead.ocr_name_raw !== lead.name && (
                <p style={{ fontSize: 10, color: '#9ca3af', margin: '6px 0 0' }}>
                  OCR 원문: {lead.ocr_name_raw}
                </p>
              )}
            </div>

            {groupRows.map((row, rowIdx) => {
              const existing = findMatch(row.name)
              const isNew = !existing
              const reviewSignals = getOcrReviewSignals(row, allRows, !!existing)
              const reviewRecommended = isOcrReviewRecommended(reviewSignals)
              const priceChanged =
                !!existing &&
                row.price != null &&
                pricesDiffer(existing.current_price, row.price)

              return (
                <div
                  key={row.rowKey}
                  style={{
                    position: 'relative',
                    background: reviewRecommended
                      ? '#fff7ed'
                      : priceChanged
                        ? '#fff8f3'
                        : '#ffffff',
                    borderTop: rowIdx > 0 ? '0.5px solid #e8e5de' : undefined,
                    borderLeft: reviewRecommended
                      ? `3px solid ${BRAND_ORANGE}`
                      : undefined,
                    padding: 12,
                  }}
                >
                  <button
                    type="button"
                    aria-label="이 행 삭제"
                    onClick={() => onRemoveRow(row.rowKey)}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      border: 'none',
                      background: '#e5e7eb',
                      color: '#6b7280',
                      fontSize: 16,
                      lineHeight: 1,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    ×
                  </button>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 8,
                      flexWrap: 'wrap',
                      paddingRight: 32,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <InvoiceOcrItemTitle name={row.name} spec={row.spec} />
                      <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>
                        {row.quantity != null ? `${row.quantity}` : '-'}
                        {row.unit ? ` ${row.unit}` : ''}
                        {' · '}
                        {row.price != null ? formatKRW(row.price) : '공급가 미입력'}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {reviewRecommended && (
                        <span
                          style={{
                            background: '#fff7ed',
                            color: BRAND_ORANGE,
                            borderRadius: 999,
                            padding: '3px 8px',
                            fontSize: 10,
                            fontWeight: 600,
                            border: `1px solid ${BRAND_ORANGE}`,
                          }}
                        >
                          검토 권장
                        </span>
                      )}
                      <span
                        style={{
                          background: isNew ? '#edf7f1' : '#f3f4f6',
                          color: isNew ? BRAND_GREEN : '#6b7280',
                          borderRadius: 999,
                          padding: '3px 8px',
                          fontSize: 10,
                          fontWeight: 500,
                        }}
                      >
                        {isNew ? '신규' : '기존'}
                      </span>
                      {priceChanged && (
                        <span
                          style={{
                            background: '#fff8f3',
                            color: BRAND_ORANGE,
                            borderRadius: 999,
                            padding: '3px 8px',
                            fontSize: 10,
                            fontWeight: 500,
                          }}
                        >
                          가격 변경
                        </span>
                      )}
                    </div>
                  </div>

                  {!isNew && (
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 8px' }}>
                      기존 식자재와 연결됨
                    </p>
                  )}

                  <input
                    value={row.spec ?? ''}
                    onChange={(e) =>
                      onRowFieldChange(row.rowKey, 'spec', e.target.value)
                    }
                    placeholder="규격 (예: 14KG, 1.8L/10)"
                    style={{ ...INPUT_STYLE, marginBottom: 8 }}
                  />
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <input
                      value={row.quantity != null ? String(row.quantity) : ''}
                      onChange={(e) =>
                        onRowFieldChange(row.rowKey, 'quantity', e.target.value)
                      }
                      placeholder="수량"
                      inputMode="decimal"
                      style={INPUT_STYLE}
                    />
                    <input
                      value={row.unit ?? ''}
                      onChange={(e) =>
                        onRowFieldChange(row.rowKey, 'unit', e.target.value)
                      }
                      placeholder="단위"
                      style={INPUT_STYLE}
                    />
                  </div>
                  <input
                    value={row.price != null ? String(row.price) : ''}
                    onChange={(e) =>
                      onRowFieldChange(row.rowKey, 'price', e.target.value)
                    }
                    placeholder="공급가 (원)"
                    inputMode="numeric"
                    style={{ ...INPUT_STYLE, marginBottom: priceChanged ? 10 : 0 }}
                  />

                  {priceChanged && existing && row.price != null && (
                    <div
                      style={{
                        background: '#fff8f3',
                        border: `0.5px solid ${BRAND_ORANGE}`,
                        borderRadius: 10,
                        padding: 12,
                      }}
                    >
                      <p
                        style={{
                          fontSize: 12,
                          color: '#374151',
                          margin: '0 0 4px',
                          lineHeight: 1.5,
                        }}
                      >
                        기존 공급가:
                        <br />
                        {existing.current_price != null
                          ? formatKRW(existing.current_price)
                          : '미등록'}
                      </p>
                      <p
                        style={{
                          fontSize: 12,
                          color: '#374151',
                          margin: '0 0 8px',
                          lineHeight: 1.5,
                        }}
                      >
                        새 거래명세서:
                        <br />
                        {formatKRW(row.price)}
                      </p>
                      <p
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: BRAND_ORANGE,
                          margin: '0 0 10px',
                        }}
                      >
                        공급가 변경으로 보입니다.
                      </p>
                      <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 6px' }}>
                        적용 시작일
                      </p>
                      <input
                        type="date"
                        value={row.effectiveFrom}
                        onChange={(e) =>
                          onEffectiveFromChange(row.rowKey, e.target.value)
                        }
                        style={{ ...INPUT_STYLE, marginBottom: 10 }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => onPriceAction(row.rowKey, 'apply')}
                          style={{
                            flex: 1,
                            padding: 10,
                            background:
                              row.priceAction === 'apply'
                                ? BRAND_ORANGE
                                : '#ffffff',
                            color:
                              row.priceAction === 'apply' ? '#ffffff' : BRAND_ORANGE,
                            border: `1px solid ${BRAND_ORANGE}`,
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          새 가격 적용
                        </button>
                        <button
                          type="button"
                          onClick={() => onPriceAction(row.rowKey, 'keep')}
                          style={{
                            flex: 1,
                            padding: 10,
                            background:
                              row.priceAction === 'keep' ? '#f3f4f6' : '#ffffff',
                            color: '#6b7280',
                            border: '0.5px solid #e8e5de',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          기존 가격 유지
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
