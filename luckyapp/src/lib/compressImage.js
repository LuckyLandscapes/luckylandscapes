// Client-side image compression for Supabase free-tier friendliness.
// A 4MB phone photo typically lands around 200–400KB after this runs.
// Returns the original File unchanged for PDFs, tiny images, or formats
// the browser can't decode (e.g. HEIC on non-Safari).

const DEFAULTS = {
  maxDimension: 1600,        // px on the longest edge
  quality: 0.7,              // JPEG quality
  skipBytes: 200_000,        // already small? upload as-is
};

export async function compressImage(file, opts = {}) {
  const { maxDimension, quality, skipBytes } = { ...DEFAULTS, ...opts };

  if (!file) return file;
  if (file.type === 'application/pdf') return file;
  if (!file.type.startsWith('image/')) return file;
  if (file.size < skipBytes) return file;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }

  const ratio = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) return file;
  if (blob.size >= file.size) return file;

  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}

export function bytesPretty(n) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
