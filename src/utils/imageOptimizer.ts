export interface ImageOptimizationResult {
  dataUrl: string;
  width: number;
  height: number;
  originalSize: number;
  optimizedSize: number;
  fileName: string;
  mimeType: string;
}

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  outputFormat?: 'image/webp' | 'image/jpeg' | 'image/png';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function optimizeImageFile(
  file: File,
  options: ImageOptimizationOptions = {}
): Promise<ImageOptimizationResult> {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.85,
    outputFormat = 'image/webp',
  } = options;

  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error('Selected file is not a valid image format.');
  }

  // If SVG, don't re-encode in canvas
  if (file.type === 'image/svg+xml') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          dataUrl: reader.result as string,
          width: 0,
          height: 0,
          originalSize: file.size,
          optimizedSize: file.size,
          fileName: file.name,
          mimeType: file.type,
        });
      };
      reader.onerror = () => reject(new Error('Failed to read SVG file.'));
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;

          // Scale down proportionally if larger than maximum boundaries
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({
              dataUrl: e.target?.result as string,
              width: img.width,
              height: img.height,
              originalSize: file.size,
              optimizedSize: file.size,
              fileName: file.name,
              mimeType: file.type,
            });
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          let dataUrl = canvas.toDataURL(outputFormat, quality);
          let targetMime = outputFormat;

          // Fallback to JPEG if browser doesn't export webp
          if (outputFormat === 'image/webp' && !dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
            targetMime = 'image/jpeg';
          }

          const base64Length = dataUrl.length - (dataUrl.indexOf(',') + 1);
          const optimizedBytes = Math.round((base64Length * 3) / 4);

          resolve({
            dataUrl,
            width,
            height,
            originalSize: file.size,
            optimizedSize: optimizedBytes,
            fileName: file.name,
            mimeType: targetMime,
          });
        } catch (err: any) {
          reject(new Error(`Failed to process image: ${err?.message || 'Unknown error'}`));
        }
      };
      img.onerror = () => reject(new Error('Failed to decode image file. Please ensure it is a valid image.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file from computer storage.'));
    reader.readAsDataURL(file);
  });
}
