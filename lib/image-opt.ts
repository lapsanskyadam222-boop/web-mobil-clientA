// lib/image-opt.ts
// Downscale + (voliteľná) konverzia do WebP/AVIF priamo v prehliadači
// Výstupom je Blob pripravený na upload.

// Max dĺžka kratšej strany/rozmerov – šetrí bandwidth aj Image Transformations.
export type DownscaleOptions = {
  maxWidth?: number;     // default 1600
  maxHeight?: number;    // default 1600
  mimeType?: 'image/webp' | 'image/jpeg' | 'image/avif';
  quality?: number;      // 0..1 (default 0.82)
  keepIfSmaller?: boolean; // ak je už menší ako limit, neškáluj (default true)
};

export async function downscaleImageFile(file: File, opts: DownscaleOptions = {}): Promise<Blob> {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    mimeType = 'image/webp',
    quality = 0.82,
    keepIfSmaller = true,
  } = opts;

  // Pre GIF/SVG a pod. – nechaj pôvodný obsah
  if (!file.type.startsWith('image/')) return file;

  // Načítaj bitmapu
  const imgDataUrl = await fileToDataURL(file);
  const bmp = await createImageBitmap(await (await fetch(imgDataUrl)).blob());

  let { width, height } = bmp;

  // ak netreba zmenšovať
  if (keepIfSmaller && width <= maxWidth && height <= maxHeight) {
    // Môžeme aspoň recompress → ak by si chcel striktne zachovať originál, vráť "file"
    return await bitmapToBlob(bmp, mimeType, quality);
  }

  // vypočítaj scale s zachovaním pomeru
  const scale = Math.min(maxWidth / width, maxHeight / height);
  const dstW = Math.round(width * scale);
  const dstH = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = dstW;
  canvas.height = dstH;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // lepší sampling
  ctx.imageSmoothingEnabled = true;
  (ctx as any).imageSmoothingQuality = 'high';

  ctx.drawImage(bmp, 0, 0, dstW, dstH);

  // priorita AVIF/WebP → výrazne menšie súbory pri rovnakej vizuálnej kvalite
  const outMime = mimeType;
  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b as Blob), outMime, quality),
  );

  return blob ?? file;
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

async function bitmapToBlob(bmp: ImageBitmap, type: string, quality: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0);
  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b as Blob), type, quality),
  );
}
