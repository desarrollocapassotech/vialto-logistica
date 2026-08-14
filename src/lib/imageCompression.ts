/**
 * Redimensiona/comprime fotos de cámara antes de guardarlas en el estado del
 * formulario. Sin esto, dos fotos de cámara sin comprimir (10+ MB, 4000px+)
 * quedan decodificadas en memoria a la vez (preview + archivo crudo pendiente
 * de subida) y en celulares con poca RAM Chrome tira su propio "Memoria
 * insuficiente para completar la operación anterior" (OOM del renderer, no
 * un error de la app) — reportado por un chofer en COMB.
 */
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
// Por debajo de esto no vale la pena recomprimir: ya es chica y evitamos
// perder calidad sin ganar memoria.
const SKIP_THRESHOLD_BYTES = 1.5 * 1024 * 1024;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo decodificar la imagen"));
    img.src = src;
  });
}

function fitDimensions(width: number, height: number, max: number) {
  if (width <= max && height <= max) return { width, height };
  const ratio = width > height ? max / width : max / height;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const alreadySmall =
      img.naturalWidth <= MAX_DIMENSION &&
      img.naturalHeight <= MAX_DIMENSION &&
      file.size <= SKIP_THRESHOLD_BYTES;
    if (alreadySmall) return file;

    const { width, height } = fitDimensions(
      img.naturalWidth,
      img.naturalHeight,
      MAX_DIMENSION,
    );

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.\w+$/, "") + ".jpg";
    return new File([blob], newName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    // Formato raro, canvas no disponible, decode fallido, etc.: seguimos con
    // el archivo original en vez de bloquear la carga de la foto.
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
