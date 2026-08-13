export {
  MODULE_PHOTOS_BUCKET,
  MODULE_PHOTO_MIME_TYPES,
  modulePhotoObjectPath,
} from "@/lib/storage/module-photos";

export type ModulePhoto = {
  id: string;
  moduleId: string;
  storagePath: string;
  caption: string | null;
};
