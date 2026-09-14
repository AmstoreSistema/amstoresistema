import { uploadCatalogImage } from "@/lib/images.functions";

/** Reduz a imagem no navegador (máx. 1000px, JPEG) para envio rápido. */
async function compress(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Falha ao ler a imagem"));
    reader.readAsDataURL(file);
  });

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Imagem inválida"));
      el.src = dataUrl;
    });

    const max = 1000;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return dataUrl;
  }
}

/**
 * Envia a foto para o armazenamento de arquivos e devolve a URL leve
 * que deve ser salva no banco (mantém o sistema rápido).
 */
export async function uploadImageFile(file: File, folder = "products"): Promise<string> {
  const dataUrl = await compress(file);
  const res = await uploadCatalogImage({ data: { dataUrl, folder } });
  return res.url;
}
