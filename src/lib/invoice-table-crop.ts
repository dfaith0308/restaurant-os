/** 거래명세서 품목표 영역 crop — Canvas 비율 기반, AI 미사용 */

export type InvoiceTableCropBounds = {
  /** 상단 제거 비율 (0~1) */
  topRatio: number
  /** 하단 제거 비율 (0~1) */
  bottomRatio: number
}

export type InvoiceTableCropResult = {
  file: File
  /** 개발·디버그용 data URL (실패 시 null) */
  previewDataUrl: string | null
  bounds: InvoiceTableCropBounds
  /** crop 미적용(원본 유지) 여부 */
  usedOriginal: boolean
}

/** 상단 18~22% → 20%, 하단 15~20% → 17.5% */
export const DEFAULT_TABLE_CROP_BOUNDS: InvoiceTableCropBounds = {
  topRatio: 0.2,
  bottomRatio: 0.175,
}

const MIN_CROP_HEIGHT_PX = 80

type BitmapSource = {
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

async function loadBitmapSource(file: File): Promise<BitmapSource> {
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
      // fallback
    }
  }

  const img = await loadImageElement(file)
  return {
    source: img,
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
  }
}

function computeCropRect(
  width: number,
  height: number,
  bounds: InvoiceTableCropBounds,
): { sx: number; sy: number; sw: number; sh: number } | null {
  const topPx = Math.round(height * bounds.topRatio)
  const bottomPx = Math.round(height * bounds.bottomRatio)
  const cropHeight = height - topPx - bottomPx

  if (cropHeight < MIN_CROP_HEIGHT_PX || cropHeight >= height) {
    return null
  }

  return {
    sx: 0,
    sy: topPx,
    sw: width,
    sh: cropHeight,
  }
}

/**
 * 명세서 이미지에서 품목표(중앙 표) 영역만 crop.
 * 실패·비정상 비율 시 원본 file 반환 (throw 없음).
 */
export async function cropInvoiceTableRegion(
  file: File,
  bounds: InvoiceTableCropBounds = DEFAULT_TABLE_CROP_BOUNDS,
): Promise<InvoiceTableCropResult> {
  if (!file.type.startsWith('image/')) {
    return {
      file,
      previewDataUrl: null,
      bounds,
      usedOriginal: true,
    }
  }

  let bitmap: BitmapSource | null = null
  try {
    bitmap = await loadBitmapSource(file)
    const rect = computeCropRect(bitmap.width, bitmap.height, bounds)
    if (!rect) {
      return {
        file,
        previewDataUrl: null,
        bounds,
        usedOriginal: true,
      }
    }

    const canvas = document.createElement('canvas')
    canvas.width = rect.sw
    canvas.height = rect.sh
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return {
        file,
        previewDataUrl: null,
        bounds,
        usedOriginal: true,
      }
    }

    ctx.drawImage(
      bitmap.source,
      rect.sx,
      rect.sy,
      rect.sw,
      rect.sh,
      0,
      0,
      rect.sw,
      rect.sh,
    )

    const blob = await canvasToJpegBlob(canvas, 0.88)
    if (!blob) {
      return {
        file,
        previewDataUrl: null,
        bounds,
        usedOriginal: true,
      }
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'invoice'
    const croppedFile = new File([blob], `${baseName}-table.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })

    let previewDataUrl: string | null = null
    try {
      previewDataUrl = canvas.toDataURL('image/jpeg', 0.72)
    } catch {
      previewDataUrl = null
    }

    return {
      file: croppedFile,
      previewDataUrl,
      bounds,
      usedOriginal: false,
    }
  } catch {
    return {
      file,
      previewDataUrl: null,
      bounds,
      usedOriginal: true,
    }
  } finally {
    bitmap?.close?.()
  }
}
