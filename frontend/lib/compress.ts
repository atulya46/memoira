import imageCompression from "browser-image-compression";

export async function compressImage(file: File): Promise<File> {
  let source = file;

  const isHeic = file.type === "image/heic" || file.type === "image/heif" ||
    /\.(heic|heif)$/i.test(file.name);

  if (isHeic) {
    const heic2any = (await import("heic2any")).default;
    const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 }) as Blob;
    source = new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
  }

  return imageCompression(source, {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 800,
    useWebWorker: true,
  });
}
