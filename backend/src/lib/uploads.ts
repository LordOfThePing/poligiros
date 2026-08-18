/**
 * What may be uploaded as class material.
 *
 * Documents and images only — video and audio are rejected on purpose (they are
 * huge, R2 egress is not free, and the course hosts its recordings on Zoom).
 *
 * The check is an ALLOWLIST on the extension, not on the browser-declared MIME
 * type: a client can send any `Content-Type` it likes. The stored object then
 * gets the MIME we derive from the extension, so an uploaded `.html` cannot be
 * served back as active content from the bucket domain.
 */
export const ALLOWED_UPLOADS: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  txt: "text/plain",
  csv: "text/csv",
  rtf: "application/rtf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
}

/** 25 MB — comfortably above a slide deck, far below any video. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

export const ALLOWED_EXTENSIONS = Object.keys(ALLOWED_UPLOADS)

export type UploadCheck =
  | { ok: true; extension: string; mimeType: string }
  | { ok: false; error: string }

export function checkUpload(fileName: string, size: number): UploadCheck {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? ""

  if (!extension || !(extension in ALLOWED_UPLOADS)) {
    return {
      ok: false,
      error: `Tipo de archivo no permitido. Se aceptan: ${ALLOWED_EXTENSIONS.join(", ")}.`,
    }
  }
  if (size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `El archivo supera los ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
    }
  }

  return { ok: true, extension, mimeType: ALLOWED_UPLOADS[extension] }
}

/**
 * Build a collision-proof object key that keeps a readable name. The original
 * name is slugified so it cannot inject path segments or odd characters.
 */
export function buildObjectKey(itemId: string, fileName: string, extension: string): string {
  const base = fileName
    .slice(0, fileName.length - extension.length - 1)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)

  return `modules/${itemId}/${Date.now()}-${base || "archivo"}.${extension}`
}
