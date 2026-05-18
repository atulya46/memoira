import imageCompression from "browser-image-compression";

// HEIF/HEIC files use the ISOBMFF container — 'ftyp' appears at bytes 4-7
// iOS Chrome often sends these with type="" and a generic filename, so
// we detect by magic bytes rather than relying on the MIME type or extension.
async function isHeifFile(file: File): Promise<boolean> {
  if (file.type === "image/heic" || file.type === "image/heif") return true;
  if (/\.(heic|heif)$/i.test(file.name)) return true;
  try {
    const buf = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    // bytes 4-7 must be 'ftyp'
    if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
      const brand = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]);
      return ["heic", "heis", "hevc", "hevx", "heim", "heix", "hevm", "mif1", "msf1"]
        .some(b => brand.startsWith(b));
    }
  } catch { /* ignore */ }
  return false;
}

// Always returns a Blob typed image/jpeg so the backend never sees an empty content-type
export async function compressImage(file: File): Promise<Blob> {
  try {
    let source = file;

    if (await isHeifFile(file)) {
      const heic2any = (await import("heic2any")).default;
      const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 }) as Blob;
      source = new File([blob], "photo.jpg", { type: "image/jpeg" });
    }

    const compressed = await imageCompression(source, {
      maxSizeMB: 0.3,
      maxWidthOrHeight: 800,
      useWebWorker: false, // false = reliable on iOS WebKit
    });

    const buf = await compressed.arrayBuffer();
    return new Blob([buf], { type: "image/jpeg" });
  } catch {
    // Fallback: send original bytes — backend accepts up to 8 MB
    const buf = await file.arrayBuffer();
    return new Blob([buf], { type: "image/jpeg" });
  }
}
