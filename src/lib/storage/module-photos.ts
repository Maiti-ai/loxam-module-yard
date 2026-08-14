import {MODULE_PHOTOS_BUCKET} from "@/lib/env";

export {MODULE_PHOTOS_BUCKET};

export const MODULE_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export function modulePhotoObjectPath(moduleId: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return `${moduleId}/${Date.now()}-${safeName}`;
}
