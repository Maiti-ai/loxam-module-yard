export function parseModulePhotoId(input: unknown): string | null {
  const raw =
    typeof input === "string"
      ? input
      : input && typeof input === "object" && "photoId" in input
        ? (input as {photoId?: unknown}).photoId
        : null;

  if (typeof raw !== "string") {
    return null;
  }

  const photoId = raw.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(photoId)) {
    return null;
  }

  return photoId;
}

export function photoStoragePathsToRemove(photo: {storagePath: string | null | undefined}): string[] {
  const storagePath = photo.storagePath?.trim();
  if (!storagePath) {
    return [];
  }

  return [storagePath];
}

export function isPhotoDeleteComplete(steps: {
  storageDeleted: boolean;
  recordDeleted: boolean;
}) {
  return steps.storageDeleted === true && steps.recordDeleted === true;
}
