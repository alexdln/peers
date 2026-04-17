/** 1×1 transparent PNG for failed avatar fetches */
const EMPTY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export const fetchImageAsDataUrl = async (url: string): Promise<string> => {
  const response = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!response.ok) {
    throw new Error(`Failed to fetch image (${response.status})`);
  }
  const blob = await response.blob();
  const mime = blob.type || "image/jpeg";
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

export const fetchImageAsDataUrlSafe = async (url: string): Promise<string> => {
  try {
    return await fetchImageAsDataUrl(url);
  } catch {
    return EMPTY_PNG_DATA_URL;
  }
}

export const downloadSvgString = (svg: string, fileName: string): void => {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export const rasterizeSvgStringToPng = async (svg: string, fileName: string, transparent: boolean): Promise<void> => {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(blob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to rasterize SVG to PNG."));
      image.src = svgUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || 800;
    canvas.height = img.naturalHeight || 600;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas is not supported.");
    }
    ctx.fillStyle = transparent ? "transparent" : "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const pngUrl = canvas.toDataURL("image/png");
    const anchor = document.createElement("a");
    anchor.href = pngUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
