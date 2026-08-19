import {MODULE_PHOTO_MIME_TYPES} from "@/lib/storage/module-photos";
import type {ActionErr, AppErrorCode} from "@/lib/errors";

export type ModulePhotoMimeType = (typeof MODULE_PHOTO_MIME_TYPES)[number];

export const STORAGE_UPLOAD_TIMEOUT_MS = 60_000;

export type PhotoUploadFailureCode =
  | "UNSUPPORTED_TYPE"
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

export function createLocalPhotoPreviewUrl(file: Blob): string {
  return URL.createObjectURL(file);
}

export function revokeLocalPhotoPreviewUrl(url: string | null | undefined) {
  if (typeof url !== "string" || !url.startsWith("blob:")) {
    return;
  }
  URL.revokeObjectURL(url);
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

export function bytesToMb(byteSize: number) {
  return Number((byteSize / (1024 * 1024)).toFixed(2));
}

function asNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function redactSecrets(value: string) {
  return value
    .replace(/https?:\/\/[^\s]+/gi, "[url]")
    .replace(/\b(bearer|apikey|token)=?\s*[^\s,;]+/gi, "[redacted]")
    .slice(0, 300);
}

export function summarizeStorageError(error: unknown): {
  name?: string;
  message?: string;
  status?: number;
  statusCode?: string;
  code?: string;
} {
  if (!error || typeof error !== "object") {
    return {name: "unknown", message: error == null ? "empty" : redactSecrets(String(error))};
  }

  const record = error as Record<string, unknown>;
  const message = asNonEmptyString(record.message);
  const statusCode =
    asNonEmptyString(record.statusCode) ??
    (typeof record.statusCode === "number" ? String(record.statusCode) : undefined);

  return {
    name: asNonEmptyString(record.name),
    message: message ? redactSecrets(message) : undefined,
    status: typeof record.status === "number" ? record.status : undefined,
    statusCode,
    code: asNonEmptyString(record.code),
  };
}

export function summarizePostgrestError(error: {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
} | null) {
  return {
    dbCode: error?.code ?? null,
    dbMessage: error?.message ? redactSecrets(error.message) : null,
    dbDetails: error?.details ? redactSecrets(error.details) : null,
    dbHint: error?.hint ? redactSecrets(error.hint) : null,
  };
}

export type MetadataServerStage =
  | "ACTION_ENTERED"
  | "INPUT_PARSE"
  | "AUTH_SESSION"
  | "AUTH_ROLE"
  | "SUPABASE_CLIENT"
  | "MODULE_PHOTOS_INSERT"
  | "INSERT_RETURNING"
  | "REVALIDATE_PATH"
  | "FINAL_RETURN";

export type PhotoMetadataActionInput = {
  moduleId: string;
  storagePath: string;
  fileName: string;
  mimeType: string | null;
  byteSize: number | null;
  caption: string | null;
};

export type PhotoMetadataActionFlags = {
  actionEntered: boolean;
  supabaseClientCreated: boolean;
  authLookupStarted: boolean;
  authLookupSucceeded: boolean;
  insertReached: boolean;
  insertSucceeded: boolean;
};

function asJsonString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? redactSecrets(value) : fallback;
}

function asJsonStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? redactSecrets(value) : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRequiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`PHOTO_METADATA_INPUT_${field}_NOT_STRING`);
  }
  return value;
}

function asStringOrNull(value: unknown, field: string): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`PHOTO_METADATA_INPUT_${field}_NOT_STRING`);
  }
  return value;
}

function asFiniteNumberOrNull(value: unknown, field: string): number | null {
  if (value == null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`PHOTO_METADATA_INPUT_${field}_NOT_NUMBER`);
  }
  return value;
}

export function parsePhotoMetadataActionInput(input: unknown): PhotoMetadataActionInput {
  if (typeof File !== "undefined" && input instanceof File) {
    throw new Error("PHOTO_METADATA_INPUT_HAS_FILE");
  }
  if (typeof Blob !== "undefined" && input instanceof Blob) {
    throw new Error("PHOTO_METADATA_INPUT_HAS_BLOB");
  }
  if (!isPlainObject(input)) {
    throw new Error("PHOTO_METADATA_INPUT_NOT_OBJECT");
  }

  if (typeof File !== "undefined" && input.file instanceof File) {
    throw new Error("PHOTO_METADATA_INPUT_HAS_FILE");
  }
  if (typeof Blob !== "undefined" && input.blob instanceof Blob) {
    throw new Error("PHOTO_METADATA_INPUT_HAS_BLOB");
  }

  return {
    moduleId: asRequiredString(input.moduleId, "MODULE_ID"),
    storagePath: asRequiredString(input.storagePath, "STORAGE_PATH"),
    fileName: asRequiredString(input.fileName, "FILE_NAME"),
    mimeType: asStringOrNull(input.mimeType, "MIME_TYPE"),
    byteSize: asFiniteNumberOrNull(input.byteSize, "BYTE_SIZE"),
    caption: asStringOrNull(input.caption, "CAPTION"),
  };
}

export function toJsonSafeMetadataActionSuccess(id: string): {ok: true; id: string} {
  return JSON.parse(JSON.stringify({ok: true, id: String(id)})) as {ok: true; id: string};
}

export function toJsonSafeMetadataActionFailure(fields: {
  code?: string | null;
  serverStage: string;
  thrownName?: string | null;
  dbCode?: string | null;
  dbMessage?: string | null;
  dbDetails?: string | null;
  dbHint?: string | null;
  insertReached?: boolean;
  insertSucceeded?: boolean;
}) {
  const code: AppErrorCode =
    fields.code === "UNAUTHENTICATED" || fields.code === "FORBIDDEN"
      ? fields.code
      : "UPLOAD_FAILED";
  const plain = {
    ok: false as const,
    code,
    stage: asJsonString(fields.serverStage, "NONE"),
    serverStage: asJsonString(fields.serverStage, "NONE"),
    thrownName: asJsonString(fields.thrownName, "NONE"),
    dbCode: asJsonString(fields.dbCode, "NONE"),
    dbMessage: asJsonStringOrNull(fields.dbMessage),
    dbDetails: asJsonStringOrNull(fields.dbDetails),
    dbHint: asJsonStringOrNull(fields.dbHint),
    insertReached: fields.insertReached === true,
    insertSucceeded: fields.insertSucceeded === true,
  };
  return JSON.parse(JSON.stringify(plain)) as ActionErr;
}

export function buildPhotoMetadataActionThrowLog(input: {
  stage: string;
  thrownName: string;
  thrownMessage: string | null;
  dbCode: string | null;
  dbDetails: string | null;
  dbHint: string | null;
  flags: PhotoMetadataActionFlags;
}) {
  return JSON.parse(
    JSON.stringify({
      event: "PHOTO_METADATA_ACTION_THROW",
      stage: asJsonString(input.stage, "NONE"),
      thrownName: asJsonString(input.thrownName, "Error"),
      thrownMessage: asJsonStringOrNull(input.thrownMessage),
      dbCode: asJsonString(input.dbCode, "NONE"),
      dbDetails: asJsonStringOrNull(input.dbDetails),
      dbHint: asJsonStringOrNull(input.dbHint),
      actionEntered: input.flags.actionEntered === true,
      supabaseClientCreated: input.flags.supabaseClientCreated === true,
      authLookupStarted: input.flags.authLookupStarted === true,
      authLookupSucceeded: input.flags.authLookupSucceeded === true,
      insertReached: input.flags.insertReached === true,
      insertSucceeded: input.flags.insertSucceeded === true,
    }),
  ) as Record<string, string | boolean | null>;
}

export function classifyMetadataSaveThrow(error: unknown, stage: string) {
  const looksLikePostgrest =
    error &&
    typeof error === "object" &&
    ("code" in error || "details" in error || "hint" in error);
  const postgrest = summarizePostgrestError(
    looksLikePostgrest
      ? (error as {code?: string; message?: string; details?: string; hint?: string})
      : null,
  );
  const thrown = summarizeThrownException(error);
  return {
    stage,
    serverStage: stage,
    thrownName: thrown.thrownName,
    dbCode: postgrest.dbCode ?? "NONE",
    dbMessage: postgrest.dbMessage ?? thrown.thrownMessage ?? thrown.thrownName ?? null,
    dbDetails: postgrest.dbDetails,
    dbHint: postgrest.dbHint,
  };
}

export type ClientUploadStage =
  | "FILE_MATERIALIZE"
  | "STORAGE_UPLOAD"
  | "METADATA_ACTION"
  | "UI_REFRESH";

export type ClientStorageStatus = "NOT_STARTED" | "SUCCESS" | "FAILED";

export function summarizeThrownException(error: unknown): {
  thrownName: string;
  thrownMessage: string | null;
  thrownStack: string | null;
} {
  const summary = summarizeStorageError(error);
  const thrownName =
    summary.name ?? (error instanceof Error && error.name ? error.name : "Error");
  const thrownMessage = summary.message ?? null;
  let thrownStack: string | null = null;
  if (error instanceof Error && error.stack?.trim()) {
    thrownStack = error.stack
      .replace(/https?:\/\/[^\s]+/gi, "[url]")
      .replace(/\b(bearer|apikey|token)=?\s*[^\s,;]+/gi, "[redacted]")
      .slice(0, 800);
  }
  return {thrownName, thrownMessage, thrownStack};
}
