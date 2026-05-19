/** 거래명세서 OCR 업로드용 클라이언트 이미지 압축·방향 보정 (Canvas, dependency 없음) */

const MAX_WIDTH_PX = 1600
const TARGET_MAX_BYTES = 1024 * 1024
const INITIAL_JPEG_QUALITY = 0.76
const MIN_JPEG_QUALITY = 0.52
const QUALITY_STEP = 0.08
/** 가로가 세로보다 이만큼 길면 세로 문서로 90° 회전 */
const LANDSCAPE_ROTATE_RATIO = 1.15

type OrientedBitmap = {
  source: CanvasImageSource
  width: number
  height: number
  close?: () => void
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

async function loadImageElement(file: File): Promise<HTMLImageElement> {
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

async function loadOrientedBitmap(file: File): Promise<OrientedBitmap> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: 'from-image',
      })
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      }
    } catch {
      // Image fallback
    }
  }

  const img = await loadImageElement(file)
  return {
    source: img,
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
  }
}

/**
 * EXIF 보정 후에도 가로가 긴 모바일 촬영본 → 세로(portrait) 캔버스로 회전.
 */
function drawOrientedToCanvas(bitmap: OrientedBitmap): HTMLCanvasElement {
  const { source, width: srcW, height: srcH } = bitmap
  const rotateToPortrait = srcW > srcH * LANDSCAPE_ROTATE_RATIO

  let drawW = srcW
  let drawH = srcH
  if (rotateToPortrait) {
    drawW = srcH
    drawH = srcW
  }

  const { width, height } = scaledDimensions(drawW, drawH, MAX_WIDTH_PX)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('canvas_context_failed')
  }

  if (rotateToPortrait) {
    const scale = Math.min(width / srcH, height / srcW)
    ctx.save()
    ctx.translate(width, 0)
    ctx.rotate(Math.PI / 2)
    ctx.scale(scale, scale)
    ctx.drawImage(source, 0, 0, srcW, srcH)
    ctx.restore()
  } else {
    ctx.drawImage(source, 0, 0, width, height)
  }

  return canvas
}

/**
 * OCR 업로드 전 방향 보정·압축. 실패·미지원 시 원본 file 반환.
 */
export async function compressImageForInvoiceOcr(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file
  }

  let bitmap: OrientedBitmap | null = null
  try {
    bitmap = await loadOrientedBitmap(file)
    const canvas = drawOrientedToCanvas(bitmap)

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
  } finally {
    bitmap?.close?.()
  }
}
