/** 거래명세서 OCR 업로드용 클라이언트 이미지 압축 (Canvas, dependency 없음) */

const MAX_WIDTH_PX = 1600
const TARGET_MAX_BYTES = 1024 * 1024
const INITIAL_JPEG_QUALITY = 0.76
const MIN_JPEG_QUALITY = 0.52
const QUALITY_STEP = 0.08
const SKIP_IF_UNDER_BYTES = 900 * 1024

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image_load_failed'))
    }
    img.src = url
  })
}

function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality)
  })
}

function scaledDimensions(
  width: number,
  height: number,
  maxWidth: number,
): { width: number; height: number } {
  if (width <= maxWidth) {
    return { width, height }
  }
  const nextHeight = Math.round((height * maxWidth) / width)
  return { width: maxWidth, height: Math.max(1, nextHeight) }
}

/**
 * OCR 업로드 전 압축. 실패·미지원 시 원본 file 반환.
 */
export async function compressImageForInvoiceOcr(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file
  }

  if (file.size <= SKIP_IF_UNDER_BYTES) {
    return file
  }

  try {
    const img = await loadImageElement(file)
    const { width, height } = scaledDimensions(
      img.naturalWidth || img.width,
      img.naturalHeight || img.height,
      MAX_WIDTH_PX,
    )

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return file
    }

    ctx.drawImage(img, 0, 0, width, height)

    let quality = INITIAL_JPEG_QUALITY
    let blob: Blob | null = null

    while (quality >= MIN_JPEG_QUALITY) {
      blob = await canvasToJpegBlob(canvas, quality)
      if (blob && blob.size <= TARGET_MAX_BYTES) {
        break
      }
      quality -= QUALITY_STEP
    }

    if (!blob) {
      return file
    }

    if (blob.size >= file.size && file.size <= TARGET_MAX_BYTES) {
      return file
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'invoice'
    return new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } catch {
    return file
  }
}
