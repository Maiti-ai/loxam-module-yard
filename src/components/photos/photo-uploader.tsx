"use client";

import {useEffect, useRef, useState} from "react";
import {useTranslations} from "next-intl";
import {useRouter} from "@/i18n/navigation";
import {savePhotoMetadataAction} from "@/features/module-photos/actions";
import {createClient} from "@/lib/supabase/client";
import {MODULE_PHOTOS_BUCKET, modulePhotoObjectPath} from "@/lib/storage/module-photos";
import {TouchButton} from "@/components/ui/touch-button";
import {
  STORAGE_UPLOAD_TIMEOUT_MS,
  bytesToMb,
  createLocalPhotoPreviewUrl,
  materializePhotoFile,
  normalizePhotoMimeType,
  PhotoUploadTimeoutError,
  revokeLocalPhotoPreviewUrl,
  summarizeStorageError,
  summarizeThrownException,
  withTimeout,
  type ClientStorageStatus,
  type ClientUploadStage,
  type ModulePhotoMimeType,
  type PhotoUploadFailureCode,
} from "@/lib/storage/prepare-module-photo";

type PhotoSource = "camera" | "gallery";

type PendingPhoto = {
  file: File;
  mimeType: ModulePhotoMimeType;
  previewUrl: string;
  source: PhotoSource;
  originalFileName: string;
  originalMimeType: string;
  originalByteSize: number;
};

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
  const [pendingPhoto, setPendingPhoto] = useState<PendingPhoto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticCode, setDiagnosticCode] = useState<PhotoUploadFailureCode | null>(null);
  const [dbDiagnostic, setDbDiagnostic] = useState<{
    storage: ClientStorageStatus;
    stage: string | null;
    serverStage: string | null;
    thrownName: string | null;
    dbCode: string | null;
    dbMessage: string | null;
    dbDetails: string | null;
    dbHint: string | null;
  } | null>(null);
  const pendingRef = useRef(false);
  const previewUrlRef = useRef<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  function replacePreviewUrl(nextUrl: string | null) {
    revokeLocalPhotoPreviewUrl(previewUrlRef.current);
    previewUrlRef.current = nextUrl;
  }

  useEffect(() => {
    return () => {
      revokeLocalPhotoPreviewUrl(previewUrlRef.current);
      previewUrlRef.current = null;
    };
  }, []);

  function onFile(file: File | undefined, source: PhotoSource) {
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

    const previewUrl = createLocalPhotoPreviewUrl(file);
    replacePreviewUrl(previewUrl);
    setError(null);
    setDiagnosticCode(null);
    setDbDiagnostic(null);
    setPendingPhoto({
      file,
      mimeType,
      previewUrl,
      source,
      originalFileName,
      originalMimeType,
      originalByteSize,
    });
    logPhotoUpload("PREVIEW_READY", {
      source,
      moduleId,
      originalFileName,
      originalByteSize,
      normalizedMimeType: mimeType,
    });
  }

  function onRetake() {
    if (pendingRef.current) {
      return;
    }

    const reopenCamera = pendingPhoto?.source === "camera";
    replacePreviewUrl(null);
    setPendingPhoto(null);
    logPhotoUpload("PREVIEW_DISCARDED", {moduleId, reopenCamera});
    if (reopenCamera) {
      cameraInputRef.current?.click();
    }
  }

  async function onSave() {
    const selected = pendingPhoto;
    if (!selected || pendingRef.current) {
      return;
    }

    pendingRef.current = true;
    setPending(true);
    setError(null);
    setDiagnosticCode(null);
    setDbDiagnostic(null);

    const {file, mimeType, originalFileName, originalMimeType, originalByteSize, source} = selected;
    let clientStage: ClientUploadStage = "FILE_MATERIALIZE";
    let storageStatus: ClientStorageStatus = "NOT_STARTED";
    try {
      clientStage = "FILE_MATERIALIZE";
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

      clientStage = "STORAGE_UPLOAD";
      const supabase = createClient();
      const upload = await withTimeout(
        supabase.storage.from(MODULE_PHOTOS_BUCKET).upload(path, uploadFile, {
          contentType: mimeType,
          upsert: false,
        }),
        STORAGE_UPLOAD_TIMEOUT_MS,
      );

      if (upload.error) {
        storageStatus = "FAILED";
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
          storage: storageStatus,
          stage: clientStage,
        });
        setDiagnosticCode("STORAGE_UPLOAD_FAILED");
        setDbDiagnostic({
          storage: storageStatus,
          stage: clientStage,
          serverStage: "NONE",
          thrownName: "NONE",
          dbCode: "NONE",
          dbMessage: storageError.message ?? storageError.code ?? null,
          dbDetails: null,
          dbHint: null,
        });
        setError(t("errors.UPLOAD_FAILED"));
        return;
      }

      storageStatus = "SUCCESS";
      logPhotoUpload("STORAGE_UPLOAD_OK", {
        source,
        moduleId,
        storagePath: path,
        materializedByteSize: uploadFile.size,
        storage: storageStatus,
      });
      logPhotoUpload("METADATA_SAVE_START", {
        source,
        moduleId,
        storagePath: path,
        fileName: uploadFile.name,
        mimeType,
        byteSize: uploadFile.size,
        storage: storageStatus,
      });

      clientStage = "METADATA_ACTION";
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
          storage: storageStatus,
          stage: clientStage,
          serverStage: saved.serverStage ?? saved.stage ?? "NONE",
          thrownName: saved.thrownName ?? "NONE",
          dbCode: saved.dbCode ?? null,
          dbMessage: saved.dbMessage ?? null,
          dbDetails: saved.dbDetails ?? null,
          dbHint: saved.dbHint ?? null,
          insertReached: saved.insertReached ?? false,
          insertSucceeded: saved.insertSucceeded ?? false,
        });
        setDiagnosticCode("METADATA_SAVE_FAILED");
        setDbDiagnostic({
          storage: storageStatus,
          stage: clientStage,
          serverStage: saved.serverStage ?? saved.stage ?? "NONE",
          thrownName: saved.thrownName ?? "NONE",
          dbCode: saved.dbCode ? saved.dbCode : "NONE",
          dbMessage: saved.dbMessage ?? null,
          dbDetails: saved.dbDetails ?? null,
          dbHint: saved.dbHint ?? null,
        });
        setError(t(`errors.${saved.code}`));
        return;
      }

      logPhotoUpload("METADATA_SAVE_OK", {
        source,
        moduleId,
        storagePath: path,
        storage: storageStatus,
      });
      clientStage = "UI_REFRESH";
      replacePreviewUrl(null);
      setPendingPhoto(null);
      setCaption("");
      router.refresh();
    } catch (caught) {
      const thrown = summarizeThrownException(caught);
      const code: PhotoUploadFailureCode =
        caught instanceof PhotoUploadTimeoutError
          ? "STORAGE_UPLOAD_TIMEOUT"
          : clientStage === "FILE_MATERIALIZE"
            ? "MATERIALIZE_FAILED"
            : clientStage === "STORAGE_UPLOAD"
              ? "STORAGE_UPLOAD_FAILED"
              : "METADATA_SAVE_FAILED";
      if (clientStage === "STORAGE_UPLOAD" && storageStatus !== "SUCCESS") {
        storageStatus = "FAILED";
      }
      logPhotoUploadFailure(code, {
        source,
        moduleId,
        originalFileName,
        originalMimeType,
        normalizedMimeType: mimeType,
        originalByteSize,
        storage: storageStatus,
        stage: clientStage,
        thrownName: thrown.thrownName,
        thrownMessage: thrown.thrownMessage,
        thrownStack: thrown.thrownStack,
      });
      setDiagnosticCode(code);
      setDbDiagnostic({
        storage: storageStatus,
        stage: clientStage,
        serverStage: "NONE",
        thrownName: thrown.thrownName,
        dbCode: "NONE",
        dbMessage: thrown.thrownMessage,
        dbDetails: null,
        dbHint: null,
      });
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
      <input
        id="module-photo-camera"
        ref={cameraInputRef}
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
      <input
        id="module-photo-gallery"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={pending}
        className="sr-only"
        onChange={(event) => {
          void onFile(event.target.files?.[0], "gallery");
          event.target.value = "";
        }}
      />
      {pendingPhoto ? (
        <div className="space-y-3">
          <div className="overflow-hidden border-2 border-loxam-black bg-loxam-paper">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pendingPhoto.previewUrl}
              alt=""
              className="mx-auto block h-auto max-h-[min(60vh,28rem)] w-full max-w-full object-contain"
            />
          </div>
          <TouchButton
            variant="secondary"
            className="min-h-20 text-xl"
            disabled={pending}
            onClick={onRetake}
          >
            {t("photos.retake")}
          </TouchButton>
          <TouchButton className="min-h-20 text-xl" disabled={pending} onClick={() => void onSave()}>
            {pending ? t("photos.uploading") : t("photos.save")}
          </TouchButton>
        </div>
      ) : (
        <>
          <label
            htmlFor="module-photo-camera"
            className={`flex min-h-20 items-center justify-center bg-loxam-red text-xl font-black uppercase text-white ${
              pending ? "pointer-events-none opacity-60" : "cursor-pointer"
            }`}
          >
            {t("photos.capture")}
          </label>
          <label
            htmlFor="module-photo-gallery"
            className={`flex min-h-16 items-center justify-center border-2 border-loxam-black bg-white text-sm font-black uppercase ${
              pending ? "pointer-events-none opacity-60" : "cursor-pointer"
            }`}
          >
            {t("photos.gallery")}
          </label>
        </>
      )}
      {error ? (
        <div>
          <p className="text-sm font-bold text-loxam-occupied">{error}</p>
          {diagnosticCode ? (
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-loxam-muted">
              Code: {diagnosticCode}
            </p>
          ) : null}
          {dbDiagnostic ? (
            <>
              <p className="mt-1 break-all text-xs font-bold text-loxam-muted">
                Storage: {dbDiagnostic.storage}
              </p>
              <p className="mt-1 break-all text-xs font-bold text-loxam-muted">
                Stage: {dbDiagnostic.stage ?? "NONE"}
              </p>
              <p className="mt-1 break-all text-xs font-bold text-loxam-muted">
                Server: {dbDiagnostic.serverStage ?? "NONE"}
              </p>
              <p className="mt-1 break-all text-xs font-bold text-loxam-muted">
                DB: {dbDiagnostic.dbCode ?? "NONE"}
              </p>
              {dbDiagnostic.dbMessage ? (
                <p className="mt-1 break-all text-xs text-loxam-muted">
                  Message: {dbDiagnostic.dbMessage}
                </p>
              ) : null}
            </>
          ) : null}
          {dbDiagnostic?.dbDetails ? (
            <p className="mt-1 break-all text-xs text-loxam-muted">
              DETAILS: {dbDiagnostic.dbDetails}
            </p>
          ) : null}
          {dbDiagnostic?.dbHint ? (
            <p className="mt-1 break-all text-xs text-loxam-muted">HINT: {dbDiagnostic.dbHint}</p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
