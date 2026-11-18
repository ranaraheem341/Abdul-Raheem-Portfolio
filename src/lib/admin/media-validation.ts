import { oneText, validId } from "./records-validation";
export const mediaLimit = 5 * 1024 * 1024;
export type MediaPurpose = "photo" | "cv" | "screenshot";
export type MediaItem = {
  id: string; object_path: string; mime_type: string; size_bytes: number; alt_text: string;
  deleting: boolean; purpose: string; draft_project_id: string | null; published: boolean; revision: number;
};
export type MediaState = { ok: boolean; message: string };
export function mediaTarget(form: FormData) {
  const purpose = oneText(form, "purpose");
  const project = oneText(form, "project_id");
  if (!purpose || !["photo", "cv", "screenshot"].includes(purpose) || project === null || (purpose === "screenshot" ? !validId(project) : project !== "")) return null;
  return { purpose: purpose as MediaPurpose, project: project || null };
}
// MIME, extension AND container signatures must agree. SVG/HTML/GIF are never accepted.
// These checks do not claim malware scanning or complete document sanitization.
export async function inspectUpload(file: File, purpose: MediaPurpose) {
  if (file.size < 1 || file.size > mediaLimit) throw Error("Choose a nonempty file of at most 5 MiB.");
  const types: Record<string, { ext: string; suffix: RegExp }> = {
    "image/png": { ext: "png", suffix: /\.png$/i }, "image/jpeg": { ext: "jpg", suffix: /\.jpe?g$/i },
    "image/webp": { ext: "webp", suffix: /\.webp$/i }, "application/pdf": { ext: "pdf", suffix: /\.pdf$/i },
  };
  const type = types[file.type];
  if (!type || !type.suffix.test(file.name) || (purpose === "cv") !== (file.type === "application/pdf")) throw Error("Use a PDF for the CV or a PNG, JPEG or WebP image for photos/screenshots.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  const view = new DataView(bytes.buffer);
  let valid = false;
  if (file.type === "image/png" && bytes.length >= 45) {
    valid = [137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value) && view.getUint32(8) === 13 && ascii(12,16) === "IHDR" && ascii(bytes.length-8, bytes.length-4) === "IEND" && view.getUint32(16)>0 && view.getUint32(20)>0 && view.getUint32(16)*view.getUint32(20)<=40000000;
    let offset = 8, hasPixels = false;
    while (valid && offset + 12 <= bytes.length) {
      const length = view.getUint32(offset);
      if (offset + 12 + length > bytes.length) { valid = false; break; }
      const chunk = ascii(offset+4,offset+8);
      if (chunk === "IDAT" && length > 0) hasPixels = true;
      offset += 12 + length;
    }
    valid = valid && hasPixels && offset === bytes.length;
  } else if (file.type === "image/jpeg" && bytes.length >= 12) {
    let offset = 2, hasFrame = false;
    valid = bytes[0] === 255 && bytes[1] === 216 && bytes.at(-2) === 255 && bytes.at(-1) === 217;
    let hasScan = false;
    while (valid && offset+4 < bytes.length) {
      if (bytes[offset] !== 255) { valid = false; break; }
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (offset+2 > bytes.length) { valid = false; break; }
      const length = view.getUint16(offset);
      if (length < 2 || offset+length > bytes.length) { valid = false; break; }
      if ([0xc0,0xc1,0xc2].includes(marker) && length >= 8) {
        const height = view.getUint16(offset+3), width = view.getUint16(offset+5);
        hasFrame = width > 0 && height > 0 && width*height <= 40000000;
      }
      if (marker === 0xda) { hasScan = length >= 6 && offset+length < bytes.length-2; break; }
      offset += length;
    }
    valid = valid && hasFrame && hasScan;
  } else if (file.type === "image/webp" && bytes.length >= 20) {
    valid = ascii(0,4) === "RIFF" && ascii(8,12) === "WEBP" && ["VP8 ","VP8L","VP8X"].includes(ascii(12,16)) && view.getUint32(4,true)+8 === bytes.length;
    let offset = 12, hasPixels = false;
    while (valid && offset+8 <= bytes.length) {
      const length = view.getUint32(offset+4,true), chunk = ascii(offset,offset+4);
      if (offset+8+length > bytes.length) { valid = false; break; }
      if (chunk === "VP8 " && length >= 10) hasPixels = [0x9d,1,0x2a].every((value,index) => bytes[offset+11+index] === value);
      if (chunk === "VP8L" && length >= 5) hasPixels = bytes[offset+8] === 0x2f;
      offset += 8 + length + (length % 2);
    }
    valid = valid && hasPixels && offset === bytes.length;
  } else if (file.type === "application/pdf" && bytes.length >= 20) {
    valid = /^%PDF-(1\.[0-7]|2\.0)/.test(ascii(0,8)) && /%%EOF\s*$/.test(ascii(Math.max(0,bytes.length-1024), bytes.length)) && /startxref\s+\d+\s+%%EOF\s*$/.test(ascii(Math.max(0,bytes.length-1024), bytes.length));
  }
  if (!valid) throw Error("The file signature does not match its declared type, or its container is invalid.");
  return { bytes, extension: type.ext, mime: file.type };
}
