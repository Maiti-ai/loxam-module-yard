"use client";

import {useTranslations} from "next-intl";
import type {ModulePhotoRecord} from "@/features/module-photos";

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
