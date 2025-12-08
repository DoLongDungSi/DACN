import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, parseISO, isValid } from 'date-fns';

// ============================================================================
// STYLING UTILITIES
// ============================================================================

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

/**
 * Format ngày tháng an toàn.
 * Trả về chuỗi định dạng VN (dd/mm/yyyy) hoặc thông báo lỗi nếu data sai.
 */
export function formatDate(dateString: string | Date | undefined | null): string {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch (error) {
    return 'Error Date';
  }
}

/**
 * Format khoảng thời gian (VD: 500ms, 1.2s).
 */
export function formatDuration(ms: number): string {
  if (!ms && ms !== 0) return 'N/A';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Format khoảng thời gian tương đối (VD: 5 phút trước).
 * Dùng cho phần Thảo luận.
 */
export function safeFormatDistanceToNow(dateString: string | null | undefined): string {
    if (!dateString) return '';
    try { 
        const date = parseISO(dateString); 
        if (isValid(date)) return formatDistanceToNow(date, { addSuffix: true }); 
        return ''; 
    } catch (e) { 
        console.error("Error parsing date for distance:", e);
        return ''; 
    }
}

/**
 * Làm sạch tên file từ server (bỏ timestamp/uuid loằng ngoằng).
 */
export function formatFileName(fileName: string | null | undefined): string {
  if (!fileName) return 'Unknown File';
  
  const lower = fileName.toLowerCase();
  if (lower.includes('train') && lower.endsWith('.csv')) return 'train.csv';
  if ((lower.includes('test') || lower.includes('public_test')) && lower.endsWith('.csv')) return 'test.csv';
  if ((lower.includes('truth') || lower.includes('ground')) && lower.endsWith('.csv')) return 'ground_truth.csv';

  // Regex loại bỏ timestamp/UUID ở đầu tên file
  const cleanName = fileName.replace(/^\d{10,}-([a-f0-9-]{36}-)?/, '').replace(/-\d{10,}-/, '-');
  
  if (cleanName.length > 30) {
      return fileName.substring(0, 15) + '...' + fileName.substring(fileName.lastIndexOf('.'));
  }
  
  return cleanName;
}

// ============================================================================
// STATUS UTILITIES
// ============================================================================

export const getStatusColor = (status: string) => {
    switch (status) {
        case 'succeeded': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
        case 'failed': return 'text-red-600 bg-red-50 border-red-200';
        case 'running': return 'text-blue-600 bg-blue-50 border-blue-200';
        case 'pending': return 'text-amber-600 bg-amber-50 border-amber-200';
        default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
};

export const getStatusText = (status: string) => {
    switch (status) {
        case 'succeeded': return 'Thành công';
        case 'failed': return 'Thất bại';
        case 'running': return 'Đang chấm';
        case 'pending': return 'Đang chờ';
        default: return status;
    }
};

// ============================================================================
// IMAGE PROCESSING UTILITIES (Cắt ảnh Avatar)
// ============================================================================

// [FIX QUAN TRỌNG] Thêm timestamp để bypass cache trình duyệt -> Sửa lỗi ảnh đen
export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    
    // Bắt buộc set anonymous để vẽ lên canvas
    image.setAttribute('crossOrigin', 'anonymous') 
    
    // Hack: Thêm timestamp vào URL để trình duyệt tải ảnh mới (có CORS header) thay vì dùng cache cũ (không có CORS)
    if (url.startsWith('http')) {
        const separator = url.includes('?') ? '&' : '?';
        image.src = `${url}${separator}t=${new Date().getTime()}`;
    } else {
        image.src = url
    }
  })

export function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180
}

export function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = getRadianAngle(rotation)
  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  }
}

/**
 * Hàm cắt ảnh chính:
 * 1. Tải ảnh (với chế độ bypass cache).
 * 2. Vẽ lên canvas trung gian (để xoay).
 * 3. Cắt vùng pixelCrop.
 * 4. Vẽ lên canvas đích.
 * 5. Xuất ra Blob.
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  rotation = 0,
  flip = { horizontal: false, vertical: false }
): Promise<Blob | null> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return null
  }

  const rotRad = getRadianAngle(rotation)

  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.width,
    image.height,
    rotation
  )

  canvas.width = bBoxWidth
  canvas.height = bBoxHeight

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2)
  ctx.rotate(rotRad)
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1)
  ctx.translate(-image.width / 2, -image.height / 2)

  ctx.drawImage(image, 0, 0)

  const data = ctx.getImageData(
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height
  )

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  ctx.putImageData(data, 0, 0)

  return new Promise((resolve, reject) => {
    canvas.toBlob((file) => {
       if(file) resolve(file)
       else reject(null)
    }, 'image/jpeg', 0.95)
  })
}