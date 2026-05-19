// 거래명세서 원본 이미지 경로·런타임 (Storage 연동은 invoice-document-upload.ts)

import type {
  InvoiceIngredient,
  InvoiceOcrResult,
  InvoiceSupplier,
} from '@/lib/invoice-ocr'

export type InvoiceDocumentRuntime = {
  image_path: string | null
  invoice_date: string | null
  supplier: InvoiceSupplier | null
  items: InvoiceIngredient[]
  ocr_raw_text?: string | null
}

/** bucket 이름 참고용 (향후 migration) */
export const INVOICE_DOCUMENT_BUCKET_SUGGESTED = 'invoice-documents'

function resolvePathDate(invoiceDate: string | null): string {
  if (invoiceDate && /^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)) {
    return invoiceDate
  }
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function fileExtension(file: File): string {
  if (file.type.includes('png')) return 'png'
  if (file.type.includes('webp')) return 'webp'
  return 'jpg'
}

/** tenant-id/invoices/yyyy/mm/{timestamp}.ext */
export function buildInvoiceStoragePath(
  tenantId: string,
  invoiceDate: string | null,
  file: File,
): string {
  const date = resolvePathDate(invoiceDate)
  const [y, m] = date.split('-')
  const ext = fileExtension(file)
  return `${tenantId}/invoices/${y}/${m}/${Date.now()}.${ext}`
}

export function buildInvoiceDocumentRuntime(
  ocr: InvoiceOcrResult,
  imagePath: string | null,
  ocrRawText?: string | null,
): InvoiceDocumentRuntime {
  return {
    image_path: imagePath,
    invoice_date: ocr.invoice_date,
    supplier: ocr.supplier,
    items: ocr.items,
    ocr_raw_text: ocrRawText ?? null,
  }
}
