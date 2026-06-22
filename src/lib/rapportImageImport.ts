/** Import d’images pour le module Rapport (data URL allégées pour localStorage / jsPDF). */

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp)$/i;

export type ImportImageResult =
  | { ok: true; dataUrl: string }
  | { ok: false; message: string };

function isLikelyImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  if (!file.type && IMAGE_EXT.test(file.name)) return true;
  return false;
}

function loadImageFromObjectUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("decode"));
    el.src = url;
  });
}

/**
 * Lit une image, la redimensionne si besoin (bord max), renvoie une data URL JPEG ou PNG.
 * Les fichiers sans type MIME mais avec extension image sont acceptés (souvent mobile / export).
 */
export async function importerImageEnDataUrl(
  file: File,
  opts?: { maxEdge?: number; jpegQuality?: number },
): Promise<ImportImageResult> {
  // Par défaut on vise une taille compatible localStorage / PDF (jsPDF).
  const maxEdge = opts?.maxEdge ?? 1600;
  const jpegQuality = opts?.jpegQuality ?? 0.78;

  if (!isLikelyImageFile(file)) {
    return {
      ok: false,
      message:
        "Ce fichier ne semble pas être une image reconnue (JPEG, PNG, WebP, GIF). Les fichiers HEIC doivent être convertis en JPEG ou PNG.",
    };
  }

  if (file.size > 80 * 1024 * 1024) {
    return { ok: false, message: "Fichier trop volumineux (max. 80 Mo)." };
  }

  const objUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageFromObjectUrl(objUrl);
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    if (!w || !h) {
      return { ok: false, message: "Dimensions d’image invalides." };
    }
    if (w > maxEdge || h > maxEdge) {
      const s = maxEdge / Math.max(w, h);
      w = Math.round(w * s);
      h = Math.round(h * s);
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return { ok: false, message: "Impossible de traiter l’image dans ce navigateur." };
    }

    // PNG peut exploser en base64 (très lourd). On ne garde le PNG que s’il est déjà petit.
    const isPng = file.type === "image/png" || /\.png$/i.test(file.name);
    const keepPng = isPng && w * h <= 900 * 900;
    if (keepPng) {
      ctx.drawImage(img, 0, 0, w, h);
      return { ok: true, dataUrl: canvas.toDataURL("image/png") };
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return { ok: true, dataUrl: canvas.toDataURL("image/jpeg", jpegQuality) };
  } catch {
    return {
      ok: false,
      message:
        "Impossible de lire cette image. Essayez JPEG ou PNG, ou une photo moins lourde.",
    };
  } finally {
    URL.revokeObjectURL(objUrl);
  }
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("decode"));
    el.src = dataUrl;
  });
}

/** Miniature légère pour l’aperçu UI (évite de charger des Mo en mémoire). */
export async function imageDataUrlPreviewThumb(
  dataUrl: string,
  maxEdge = 160,
): Promise<string> {
  if (!dataUrl.startsWith("data:image/")) return dataUrl;
  try {
    const img = await loadImageFromDataUrl(dataUrl);
    const w0 = img.naturalWidth || img.width;
    const h0 = img.naturalHeight || img.height;
    if (!w0 || !h0) return dataUrl;
    const scale = maxEdge / Math.max(w0, h0, 1);
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.72);
  } catch {
    return dataUrl.length <= 120_000 ? dataUrl : "";
  }
}
