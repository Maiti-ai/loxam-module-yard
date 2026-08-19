"use client";

import {useLocale, useTranslations} from "next-intl";
import {useState} from "react";
import {formatDateTime} from "@/lib/format";
import type {ModulePhotoRecord} from "@/features/module-photos";
import {PhotoDeleteButton} from "@/components/photos/photo-delete-button";

export function ModulePhotoGrid({
  photos,
  slots = 4,
}: {
  photos: ModulePhotoRecord[];
  slots?: number;
}) {
  const t = useTranslations("photos");
  const cells = Array.from({length: slots}, (_, index) => photos[index] ?? null);

  if (photos.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {cells.map((_, index) => (
          <div
            key={index}
            className="flex aspect-square items-center justify-center border border-dashed border-loxam-line bg-loxam-paper text-xs font-bold text-loxam-muted"
          >
            {t("empty")}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {cells.map((photo, index) =>
        photo?.signedUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={photo.id}
            src={photo.signedUrl}
            alt={photo.caption || photo.fileName}
            className="aspect-square w-full object-cover"
          />
        ) : (
          <div
            key={photo?.id ?? `empty-${index}`}
            className="flex aspect-square items-center justify-center border border-dashed border-loxam-line bg-loxam-paper text-xs font-bold text-loxam-muted"
          >
            {t("empty")}
          </div>
        ),
      )}
    </div>
  );
}

export function PhotoHistoryList({
  photos,
  canDelete = false,
}: {
  photos: ModulePhotoRecord[];
  canDelete?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const visiblePhotos = photos.filter((photo) => !deletedIds.includes(photo.id));

  if (visiblePhotos.length === 0) {
    return (
      <p className="border border-dashed border-loxam-line bg-white p-6 font-bold text-loxam-muted">
        {t("photos.empty")}
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {visiblePhotos.map((photo) => (
        <li key={photo.id} className="border border-loxam-line bg-white">
          {photo.signedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.signedUrl}
              alt={photo.caption || photo.fileName}
              className="aspect-video w-full object-cover"
            />
          ) : null}
          <div className="space-y-1 p-4 text-sm">
            <p className="font-black">{formatDateTime(photo.createdAt, locale)}</p>
            <p className="text-loxam-muted">
              {t("photos.by")}: {photo.uploaderName || t("history.unknownUser")}
            </p>
            <p className="break-all text-xs text-loxam-muted">{photo.storagePath}</p>
            {photo.caption ? <p className="font-bold">{photo.caption}</p> : null}
            {canDelete ? (
              <div className="pt-3">
                <PhotoDeleteButton
                  photoId={photo.id}
                  onDeleted={(photoId) => {
                    setDeletedIds((current) =>
                      current.includes(photoId) ? current : [...current, photoId],
                    );
                  }}
                />
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
