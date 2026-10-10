export interface CompressOptions {
  maxEdge?: number; // Default 2048 px
  maxBytes?: number; // Default 300 KB (307,200 bytes)
  initialQuality?: number; // Default 0.85
  mimeType?: string; // Default "image/webp"
}

export interface CompressResult {
  blob: Blob;
  width: number;
  height: number;
  mime: string;
  bytes: number;
}

/**
 * Compresses and resizes an image client-side before upload to preserve bucket storage.
 * Uses createImageBitmap and Canvas to avoid heavy server-side processing.
 */
export async function compressImage(
  file: Blob | File,
  options: CompressOptions = {},
): Promise<CompressResult> {
  const maxEdge = options.maxEdge ?? 2048;
  const maxBytes = options.maxBytes ?? 300 * 1024;
  const targetMime = options.mimeType ?? "image/webp";
  let quality = options.initialQuality ?? 0.85;

  let bitmap: ImageBitmap;
  if (typeof createImageBitmap === "function") {
    bitmap = await createImageBitmap(file);
  } else {
    // Fallback for environments where createImageBitmap is not available
    throw new Error("createImageBitmap is not supported in this environment");
  }

  let width = bitmap.width;
  let height = bitmap.height;

  if (width > maxEdge || height > maxEdge) {
    if (width > height) {
      height = Math.round((height * maxEdge) / width);
      width = maxEdge;
    } else {
      width = Math.round((width * maxEdge) / height);
      height = maxEdge;
    }
  }

  // Draw to canvas
  let canvas: OffscreenCanvas | HTMLCanvasElement;
  let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;

  if (typeof OffscreenCanvas !== "undefined") {
    canvas = new OffscreenCanvas(width, height);
    ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D | null;
  } else if (typeof document !== "undefined") {
    canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    ctx = canvas.getContext("2d");
  } else {
    throw new Error("No canvas context available for image compression");
  }

  if (!ctx) {
    throw new Error("Failed to get 2D canvas context");
  }

  ctx.drawImage(bitmap, 0, 0, width, height);

  // Helper to convert canvas to blob
  const toBlob = async (q: number): Promise<Blob> => {
    if ("convertToBlob" in canvas) {
      return await canvas.convertToBlob({ type: targetMime, quality: q });
    }
    return new Promise<Blob>((resolve, reject) => {
      (canvas as HTMLCanvasElement).toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error("Canvas toBlob failed"));
        },
        targetMime,
        q,
      );
    });
  };

  let blob = await toBlob(quality);

  // If blob exceeds target size, step down quality up to 3 times
  let iterations = 0;
  while (blob.size > maxBytes && quality > 0.4 && iterations < 3) {
    quality -= 0.15;
    blob = await toBlob(quality);
    iterations++;
  }

  return {
    blob,
    width,
    height,
    mime: targetMime,
    bytes: blob.size,
  };
}
