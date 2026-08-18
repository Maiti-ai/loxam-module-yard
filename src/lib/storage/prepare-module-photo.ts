import {MODULE_PHOTO_MIME_TYPES} from "@/lib/storage/module-photos";

export type ModulePhotoMimeType = (typeof MODULE_PHOTO_MIME_TYPES)[number];

export const STORAGE_UPLOAD_TIMEOUT_MS = 60_000;

export type PhotoUploadFailureCode =
  | "MATERIALIZE_FAILED"
  | "STORAGE_UPLOAD_FAILED"
  | "STORAGE_UPLOAD_TIMEOUT"
  | "METADATA_SAVE_FAILED";

export class PhotoUploadTimeoutError extends Error {
  readonly code = "STORAGE_UPLOAD_TIMEOUT" as const;

  constructor() {
    super("STORAGE_UPLOAD_TIMEOUT");
    this.name = "PhotoUploadTimeoutError";
  }
}

function extensionOf(fileName: string) {
  const base = fileName.trim().split(/[\\/]/).pop() ?? fileName;
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) {
    return "";
  }
  return base.slice(dot + 1).toLowerCase();
}

export function normalizePhotoMimeType(
  fileType: string | undefined,
  fileName: string,
): ModulePhotoMimeType | null {
  const raw = (fileType ?? "").trim().toLowerCase();
  const fromType = raw === "image/jpg" ? "image/jpeg" : raw;

  if (fromType && (MODULE_PHOTO_MIME_TYPES as readonly string[]).includes(fromType)) {
    return fromType as ModulePhotoMimeType;
  }

  if (fromType) {
    return null;
  }

  const extension = extensionOf(fileName);
  if (extension === "jpg" || extension === "jpeg") {
    return "image/jpeg";
  }
  if (extension === "png") {
    return "image/png";
  }
  if (extension === "webp") {
    return "image/webp";
  }
  return null;
}

function fallbackFileName(mimeType: ModulePhotoMimeType) {
  if (mimeType === "image/png") {
    return "photo.png";
  }
  if (mimeType === "image/webp") {
    return "photo.webp";
  }
  return "photo.jpg";
}

export async function materializePhotoFile(file: File, mimeType: ModulePhotoMimeType): Promise<File> {
  const bytes = await file.arrayBuffer();
  const name = file.name.trim() || fallbackFileName(mimeType);
  return new File([bytes], name, {type: mimeType, lastModified: Date.now()});
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout?: () => void,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      onTimeout?.();
      reject(new PhotoUploadTimeoutError());
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}
