/**
 * File: /utils/imageUtils.ts
 * Image processing utilities with explicit Persian error handling.
 */

/**
 * Converts a data URL to a binary Blob object.
 * @param dataurl Base64 data URL
 * @returns Blob
 */
export const dataURLtoBlob = (dataurl: string): Blob => {
  try {
    const arr = dataurl.split(',');
    if (arr.length < 2) {
      throw new Error("فرمت داده نامعتبر است");
    }
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (error: any) {
    console.error("Error in dataURLtoBlob:", error);
    throw new Error("خطا در تبدیل عکس به فرمت باینری: " + (error.message || "محتوا نامعتبر است"));
  }
};

/**
 * Compresses an image file to JPEG format at a specified width/height and quality.
 * @param file The original image file
 * @param maxWidth Max width in pixels (defaults to 1024)
 * @param maxHeight Max height in pixels (defaults to 1024)
 * @param quality Compression quality (0 to 1, defaults to 0.7)
 * @returns Promise resolving to a Base64 JPEG data URL
 */
export const compressImage = (
  file: File,
  maxWidth = 1024,
  maxHeight = 1024,
  quality = 0.7
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      if (!file.type.startsWith('image/')) {
        return reject(new Error("فایل انتخاب شده تصویر نیست."));
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = (event) => {
        try {
          const img = new Image();
          img.src = event.target?.result as string;
          
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;

              if (width > height) {
                if (width > maxWidth) {
                  height *= maxWidth / width;
                  width = maxWidth;
                }
              } else {
                if (height > maxHeight) {
                  width *= maxHeight / height;
                  height = maxHeight;
                }
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                return reject(new Error("امکان کانتکست‌گیری ۲بعدی برای فشرده‌سازی وجود ندارد"));
              }
              
              ctx.drawImage(img, 0, 0, width, height);
              // Compress to JPEG at specified quality
              resolve(canvas.toDataURL('image/jpeg', quality));
            } catch (canvasErr: any) {
              reject(new Error("خطا در فشرده‌سازی لایه‌ای تصویر: " + (canvasErr.message || "")));
            }
          };

          img.onerror = () => {
            reject(new Error("خطا در بارگذاری المنت تصویر برای فشرده‌سازی."));
          };
        } catch (readerOnloadErr: any) {
          reject(new Error("خطا در پردازش بافر خوانده شده عکس: " + (readerOnloadErr.message || "")));
        }
      };

      reader.onerror = () => {
        reject(new Error("خطا در خواندن فایل فیزیکی تصویر."));
      };
    } catch (outerErr: any) {
      reject(new Error("خطا در شروع عملیات فشرده‌سازی عکس: " + (outerErr.message || "")));
    }
  });
};
