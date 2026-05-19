'use server'

import { createServerClient } from '@/lib/supabase-server'
import { getTenantId } from '@/lib/get-restaurant'
import { buildInvoiceStoragePath } from '@/lib/invoice-document'

/**
 * Supabase Storage 업로드. INVOICE_STORAGE_BUCKET 미설정·bucket 없으면 null (OCR 흐름 유지).
 */
export async function uploadInvoiceDocumentImage(
  file: File,
  invoiceDate: string | null,
): Promise<string | null> {
  const bucket = process.env.INVOICE_STORAGE_BUCKET?.trim()
  if (!bucket) return null

  const tenant_id = await getTenantId().catch(() => null)
  if (!tenant_id) return null
  if (!file.type.startsWith('image/')) return null

  const path = buildInvoiceStoragePath(tenant_id, invoiceDate, file)

  try {
    const supabase = await createServerClient()
    const buffer = Buffer.from(await file.arrayBuffer())
    const contentType = file.type.startsWith('image/') ? file.type : 'image/jpeg'

    const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
      contentType,
      upsert: false,
    })

    if (error) return null
    return path
  } catch {
    return null
  }
}
