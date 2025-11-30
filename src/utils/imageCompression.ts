// 이미지 압축 유틸리티 (Firebase Storage 최적화)
// 목표: 이미지당 최대 500KB 이하로 유지

const MAX_FILE_SIZE = 500 * 1024; // 500KB
const MIN_QUALITY = 0.3; // 최소 품질

export const compressImage = async (
  dataUrl: string,
  maxWidth: number = 1200,
  maxHeight: number = 1200,
  quality: number = 0.7
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions
      let width = img.width;
      let height = img.height;

      // Only resize if image is larger than max dimensions
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Create canvas for compression
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Draw image
      ctx.drawImage(img, 0, 0, width, height);

      // Determine output format
      const hasTrans = dataUrl.includes('image/png') && hasTransparency(canvas, ctx);
      
      // Try WebP first (better compression), fallback to JPEG
      const formats = hasTrans ? ['image/png'] : ['image/webp', 'image/jpeg'];
      
      let bestResult = dataUrl;
      let currentQuality = quality;

      // Progressive compression until under MAX_FILE_SIZE
      for (const format of formats) {
        currentQuality = quality;
        
        while (currentQuality >= MIN_QUALITY) {
          const compressed = canvas.toDataURL(format, currentQuality);
          const size = getDataUrlSize(compressed);
          
          if (size <= MAX_FILE_SIZE) {
            if (compressed.length < bestResult.length) {
              bestResult = compressed;
            }
            break;
          }
          
          currentQuality -= 0.1;
        }
      }

      // If still too large, reduce dimensions
      if (getDataUrlSize(bestResult) > MAX_FILE_SIZE && (width > 800 || height > 800)) {
        const smallerCanvas = document.createElement('canvas');
        smallerCanvas.width = Math.round(width * 0.7);
        smallerCanvas.height = Math.round(height * 0.7);
        const smallerCtx = smallerCanvas.getContext('2d');
        
        if (smallerCtx) {
          smallerCtx.drawImage(canvas, 0, 0, smallerCanvas.width, smallerCanvas.height);
          const smallerResult = smallerCanvas.toDataURL('image/jpeg', 0.6);
          if (smallerResult.length < bestResult.length) {
            bestResult = smallerResult;
          }
        }
      }

      resolve(bestResult.length < dataUrl.length ? bestResult : dataUrl);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = dataUrl;
  });
};

// 썸네일 생성 (캔버스 미리보기용)
export const createThumbnail = async (
  dataUrl: string,
  maxSize: number = 200
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const ratio = Math.min(maxSize / img.width, maxSize / img.height);
      const width = Math.round(img.width * ratio);
      const height = Math.round(img.height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.5));
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
};

// Check if image has transparency
const hasTransparency = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): boolean => {
  try {
    const imageData = ctx.getImageData(0, 0, Math.min(canvas.width, 100), Math.min(canvas.height, 100));
    const data = imageData.data;

    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
};

// Get size of data URL in bytes
export const getDataUrlSize = (dataUrl: string): number => {
  const base64 = dataUrl.split(',')[1];
  if (!base64) return 0;

  return Math.round(base64.length * 0.75);
};

// Format bytes to human readable
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
