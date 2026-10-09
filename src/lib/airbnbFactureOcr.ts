/** Prépare une image puis lit le texte (Tesseract, chargé à la demande). */

function preprocessCanvas(source: HTMLCanvasElement | HTMLImageElement): HTMLCanvasElement {
  const sw = "naturalWidth" in source ? source.naturalWidth || source.width : source.width;
  const sh = "naturalHeight" in source ? source.naturalHeight || source.height : source.height;
  const targetW = Math.max(sw * 2, 1400);
  const scale = targetW / Math.max(sw, 1);
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const y = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
    d[i] = d[i + 1] = d[i + 2] = y;
    if (y < min) min = y;
    if (y > max) max = y;
  }
  const span = Math.max(1, max - min);
  for (let i = 0; i < d.length; i += 4) {
    let y = ((d[i]! - min) / span) * 255;
    y = (y - 128) * 1.35 + 128;
    y = Math.max(0, Math.min(255, y));
    d[i] = d[i + 1] = d[i + 2] = y;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export async function imageFileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      if (typeof r.result === "string") resolve(r.result);
      else reject(new Error("Lecture image impossible."));
    };
    r.onerror = () => reject(new Error("Lecture image impossible."));
    r.readAsDataURL(file);
  });
}

export async function ocrFactureImage(file: Blob): Promise<string> {
  const dataUrl = await imageFileToDataUrl(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Image illisible."));
    el.src = dataUrl;
  });
  const prepared = preprocessCanvas(img);
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("fra");
  try {
    const r = await worker.recognize(prepared);
    return (r.data.text ?? "").trim();
  } finally {
    await worker.terminate();
  }
}
