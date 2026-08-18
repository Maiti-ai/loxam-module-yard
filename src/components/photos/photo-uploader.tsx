"use client";

import {useRef, useState} from "react";
import {useTranslations} from "next-intl";
import {useRouter} from "@/i18n/navigation";
import {savePhotoMetadataAction} from "@/features/module-photos/actions";
import {createClient} from "@/lib/supabase/client";
import {MODULE_PHOTOS_BUCKET, modulePhotoObjectPath} from "@/lib/storage/module-photos";
import {
  STORAGE_UPLOAD_TIMEOUT_MS,
  bytesToMb,
  materializePhotoFile,
  normalizePhotoMimeType,
  PhotoUploadTimeoutError,
  summarizeStorageError,
  withTimeout,
  type PhotoUploadFailureCode,
} from "@/lib/storage/prepare-module-photo";

type PhotoSource = "camera" | "gallery";

function logPhotoUpload(event: string, details: Record<string, unknown>) {
  console.info("[photo-upload]", event, details);
}

function logPhotoUploadFailure(code: PhotoUploadFailureCode, details: Record<string, unknown>) {
  console.error("[photo-upload]", code, details);
}

export function PhotoUploader({moduleId}: {moduleId: string}) {
  const t = useTranslations();
  const router = useRouter();
  const [caption, setCaption] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticCode, setDiagnosticCode] = useState<PhotoUploadFailureCode | null>(null);
  const pendingRef = useRef(false);

  async function onFile(file: File | undefined, source: PhotoSource) {
    if (!file || pendingRef.current) {
      return;
    }

    const originalFileName = file.name;
    const originalMimeType = file.type || "";
    const originalByteSize = file.size;
    const mimeType = normalizePhotoMimeType(file.type, file.name);

    logPhotoUpload("FILE_SELECTED", {
      source,
      moduleId,
      originalFileName,
      originalMimeType,
      originalByteSize,
      originalSizeMb: bytesToMb(originalByteSize),
      normalizedMimeType: mimeType,
    });

    if (!mimeType) {
      logPhotoUploadFailure("UNSUPPORTED_TYPE", {
        source,
        moduleId,
        originalFileName,
        originalMimeType,
        originalByteSize,
      });
      setDiagnosticCode("UNSUPPORTED_TYPE");
      setError(t("errors.UPLOAD_FAILED"));
      return;
    }

    pendingRef.current = true;
    setPending(true);
    setError(null);
    setDiagnosticCode(null);

    let failureCode: PhotoUploadFailureCode = "MATERIALIZE_FAILED";
    try {
      const uploadFile = await materializePhotoFile(file, mimeType);
      logPhotoUpload("MATERIALIZE_OK", {
        source,
        moduleId,
        originalFileName,
        originalMimeType,
        originalByteSize,
        originalSizeMb: bytesToMb(originalByteSize),
        materializedFileName: uploadFile.name,
        normalizedMimeType: mimeType,
        materializedByteSize: uploadFile.size,
        materializedSizeMb: bytesToMb(uploadFile.size),
      });

      const path = modulePhotoObjectPath(moduleId, uploadFile.name);
      logPhotoUpload("STORAGE_UPLOAD_START", {
        source,
        moduleId,
        storagePath: path,
        normalizedMimeType: mimeType,
        materializedByteSize: uploadFile.size,
      });

      const supabase = createClient();
      failureCode = "STORAGE_UPLOAD_FAILED";
      const upload = await withTimeout(
        supabase.storage.from(MODULE_PHOTOS_BUCKET).upload(path, uploadFile, {
          contentType: mimeType,
          upsert: false,
        }),
        STORAGE_UPLOAD_TIMEOUT_MS,
      );

      if (upload.error) {
        const storageError = summarizeStorageError(upload.error);
        logPhotoUploadFailure("STORAGE_UPLOAD_FAILED", {
          source,
          moduleId,
          originalFileName,
          originalMimeType,
          normalizedMimeType: mimeType,
          originalByteSize,
          materializedByteSize: uploadFile.size,
          storagePath: path,
          storageError,
        });
        setDiagnosticCode("STORAGE_UPLOAD_FAILED");
        setError(t("errors.UPLOAD_FAILED"));
        return;
      }

      logPhotoUpload("STORAGE_UPLOAD_OK", {
        source,
        moduleId,
        storagePath: path,
        materializedByteSize: uploadFile.size,
      });
      logPhotoUpload("METADATA_SAVE_START", {
        source,
        moduleId,
        storagePath: path,
        fileName: uploadFile.name,
        mimeType,
        byteSize: uploadFile.size,
      });

      failureCode = "METADATA_SAVE_FAILED";
      const saved = await savePhotoMetadataAction({
        moduleId,
        storagePath: path,
        fileName: uploadFile.name,
        mimeType,
        byteSize: uploadFile.size,
        caption: caption.trim() || null,
      });

      if (!saved.ok) {
        logPhotoUploadFailure("METADATA_SAVE_FAILED", {
          source,
          moduleId,
          storagePath: path,
          fileName: uploadFile.name,
          mimeType,
          byteSize: uploadFile.size,
          actionCode: saved.code,
        });
        setDiagnosticCode("METADATA_SAVE_FAILED");
        setError(t(`errors.${saved.code}`));
        return;
      }

      logPhotoUpload("METADATA_SAVE_OK", {
        source,
        moduleId,
        storagePath: path,
      });
      setCaption("");
      router.refresh();
    } catch (caught) {
      const code: PhotoUploadFailureCode =
        caught instanceof PhotoUploadTimeoutError ? "STORAGE_UPLOAD_TIMEOUT" : failureCode;
      logPhotoUploadFailure(code, {
        source,
        moduleId,
        originalFileName,
        originalMimeType,
        normalizedMimeType: mimeType,
        originalByteSize,
        thrown: summarizeStorageError(caught),
      });
      setDiagnosticCode(code);
      setError(t("errors.UPLOAD_FAILED"));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={(event) => event.preventDefault()}>
      <label className="block">
        <span className="text-xs font-bold uppercase text-loxam-muted">{t("photos.caption")}</span>
        <input
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          disabled={pending}
          className="mt-2 min-h-14 w-full border-2 border-loxam-line px-3 text-base"
        />
      </label>
      <label className="flex min-h-20 cursor-pointer items-center justify-center bg-loxam-red text-xl font-black uppercase text-white">
        {pending ? t("photos.uploading") : t("photos.capture")}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          disabled={pending}
          className="sr-only"
          onChange={(event) => {
            void onFile(event.target.files?.[0], "camera");
            event.target.value = "";
          }}
        />
      </label>
      <label className="flex min-h-16 cursor-pointer items-center justify-center border-2 border-loxam-black bg-white text-sm font-black uppercase">
        {t("photos.gallery")}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={pending}
          className="sr-only"
          onChange={(event) => {
            void onFile(event.target.files?.[0], "gallery");
            event.target.value = "";
          }}
        />
      </label>
      {error ? (
        <div>
          <p className="text-sm font-bold text-loxam-occupied">{error}</p>
          {diagnosticCode ? (
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-loxam-muted">
              Code: {diagnosticCode}
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
