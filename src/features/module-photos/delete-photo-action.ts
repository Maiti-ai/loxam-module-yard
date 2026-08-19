"use server";

import {revalidatePath} from "next/cache";
import {getCurrentProfile} from "@/features/auth";
import {
  isPhotoDeleteComplete,
  parseModulePhotoId,
  photoStoragePathsToRemove,
} from "@/features/module-photos/delete-photo";
import {canDeleteModulePhotos} from "@/features/roles";
import type {ActionResult} from "@/lib/errors";
import {MODULE_PHOTOS_BUCKET} from "@/lib/storage/module-photos";
import {createClient} from "@/lib/supabase/server";

export async function deleteModulePhotoAction(
  input: unknown,
): Promise<ActionResult<{id: string}>> {
  try {
    const photoId = parseModulePhotoId(input);
    if (!photoId) {
      return {ok: false, code: "NOT_FOUND"};
    }

    const profile = await getCurrentProfile();
    if (!profile) {
      return {ok: false, code: "UNAUTHENTICATED"};
    }
    if (!canDeleteModulePhotos(profile.role)) {
      return {ok: false, code: "FORBIDDEN"};
    }

    const supabase = await createClient();
    const {data: photo, error: loadError} = await supabase
      .from("module_photos")
      .select("id, storage_path")
      .eq("id", photoId)
      .maybeSingle();

    if (loadError) {
      console.error("[photo-delete]", "LOAD_FAILED", {photoId});
      return {ok: false, code: "DELETE_FAILED"};
    }
    if (!photo) {
      return {ok: false, code: "NOT_FOUND"};
    }

    const storagePaths = photoStoragePathsToRemove({storagePath: photo.storage_path});
    if (storagePaths.length !== 1) {
      console.error("[photo-delete]", "STORAGE_PATH_MISSING", {photoId});
      return {ok: false, code: "DELETE_FAILED"};
    }

    const {error: storageError} = await supabase.storage
      .from(MODULE_PHOTOS_BUCKET)
      .remove(storagePaths);

    if (storageError) {
      console.error("[photo-delete]", "STORAGE_DELETE_FAILED", {photoId});
      return {ok: false, code: "DELETE_FAILED"};
    }

    const {error: recordError} = await supabase
      .from("module_photos")
      .delete()
      .eq("id", photoId);

    if (recordError) {
      console.error("[photo-delete]", "RECORD_DELETE_FAILED", {photoId});
      return {ok: false, code: "DELETE_FAILED"};
    }

    if (!isPhotoDeleteComplete({storageDeleted: true, recordDeleted: true})) {
      return {ok: false, code: "DELETE_FAILED"};
    }

    revalidatePath("/", "layout");
    return {ok: true, id: photoId};
  } catch {
    console.error("[photo-delete]", "UNEXPECTED");
    return {ok: false, code: "DELETE_FAILED"};
  }
}
