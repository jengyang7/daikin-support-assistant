export interface AttachedImage {
  /** Full data URL — used for thumbnail preview in the UI */
  dataUrl: string;
  /** MIME type, e.g. "image/jpeg" */
  mimeType: string;
  /** Raw base64 (no data: prefix) — sent to the Gemini API */
  data: string;
}

/**
 * Resize a File to at most `maxDim` on its longest edge, then base64-encode it.
 * PNG files keep their MIME type; everything else is re-encoded as JPEG.
 */
export async function resizeImageFile(
  file: File,
  maxDim = 1536,
  quality = 0.85,
): Promise<AttachedImage> {
  const bitmap = await createImageBitmap(file);

  let { width, height } = bitmap;
  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D canvas context");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const dataUrl = canvas.toDataURL(mimeType, quality);
  const data = dataUrl.split(",")[1]; // strip "data:<mime>;base64,"

  return { dataUrl, mimeType, data };
}
