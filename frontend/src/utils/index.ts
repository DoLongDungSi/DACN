import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, parseISO, isValid } from 'date-fns';

// ============================================================================
// STYLING UTILITIES
// ============================================================================

/**
 * Hàm tiện ích gộp class Tailwind (hỗ trợ điều kiện và conflict).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

/**
 * Format ngày tháng an toàn (dd/mm/yyyy hh:mm).
 * Tránh crash ứng dụng nếu date string bị lỗi.
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
    console.error("Date formatting error:", error);
    return 'Error Date';
  }
}

/**
 * Format khoảng thời gian (ms -> giây/ms).
 * Dùng cho runtime bài nộp.
 */
export function formatDuration(ms: number): string {
  if (!ms && ms !== 0) return 'N/A';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Format thời gian tương đối (VD: "5 phút trước", "vừa xong").
 * Dùng cho phần Thảo luận (Discussion) và Thông báo.
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
 * Làm sạch tên file từ server.
 * Loại bỏ timestamp/UUID dài dòng (VD: 1765...-file.csv -> file.csv).
 */
export function formatFileName(fileName: string | null | undefined): string {
  if (!fileName) return 'Unknown File';
  
  const lower = fileName.toLowerCase();
  
  // Chuẩn hóa tên dataset đặc biệt
  if (lower.includes('train') && lower.endsWith('.csv')) return 'train.csv';
  if ((lower.includes('test') || lower.includes('public_test')) && lower.endsWith('.csv')) return 'test.csv';
  if ((lower.includes('truth') || lower.includes('ground')) && lower.endsWith('.csv')) return 'ground_truth.csv';

  // Regex loại bỏ prefix timestamp
  const cleanName = fileName.replace(/^\d{10,}-([a-f0-9-]{36}-)?/, '').replace(/-\d{10,}-/, '-');
  
  // Cắt ngắn nếu tên quá dài
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
// IMAGE PROCESSING UTILITIES (Cắt & Xử lý ảnh Avatar)
// ============================================================================

/**
 * Tải ảnh từ URL -> HTMLImageElement.
 * [QUAN TRỌNG] Thêm timestamp ?t=... để ép trình duyệt tải ảnh mới (Bypass Cache),
 * giúp sửa lỗi Canvas bị đen (Tainted Canvas) khi cắt ảnh.
 */
export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    
    // Yêu cầu quyền CORS để vẽ lên canvas
    image.setAttribute('crossOrigin', 'anonymous') 
    
    // Nếu là URL mạng (http/https), thêm timestamp để tránh cache 304
    if (url.startsWith('http')) {
        const separator = url.includes('?') ? '&' : '?';
        image.src = `${url}${separator}t=${new Date().getTime()}`;
    } else {
        image.src = url
    }
  })

/**
 * Chuyển đổi độ (degrees) sang radian.
 */
export function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180
}

/**
 * Tính toán kích thước khung bao (bounding box) sau khi xoay ảnh.
 * Đảm bảo ảnh không bị cắt mất góc khi xoay.
 */
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
 * Hàm CẮT ẢNH CHÍNH (Core Function).
 * Sử dụng kỹ thuật 2-Canvas (Trung gian -> Đích) để đảm bảo tọa độ cắt chính xác
 * và không bị lỗi đen ảnh trên các trình duyệt/màn hình khác nhau.
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

  // 1. Tính toán kích thước cho canvas trung gian (chứa toàn bộ ảnh sau khi xoay)
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.width,
    image.height,
    rotation
  )

  // Set kích thước canvas
  canvas.width = bBoxWidth
  canvas.height = bBoxHeight

  // 2. Dịch chuyển và Xoay trên canvas trung gian
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2)
  ctx.rotate(rotRad)
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1)
  ctx.translate(-image.width / 2, -image.height / 2)

  // 3. Vẽ ảnh gốc lên canvas trung gian
  ctx.drawImage(image, 0, 0)

  // 4. Lấy dữ liệu pixel từ vùng cắt (PixelCrop tọa độ dựa trên ảnh ĐÃ XOAY)
  const data = ctx.getImageData(
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height
  )

  // 5. Resize canvas về đúng kích thước vùng cắt để xuất ra
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  // 6. Vẽ lại dữ liệu pixel sạch lên canvas đích
  ctx.putImageData(data, 0, 0)

  // 7. Xuất ra Blob (File) để upload
  return new Promise((resolve, reject) => {
    canvas.toBlob((file) => {
       if(file) {
           resolve(file)
       }
       else reject(null)
    }, 'image/jpeg', 0.95) // Chất lượng ảnh 95%
  })
}