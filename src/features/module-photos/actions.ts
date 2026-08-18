"use server";

import {revalidatePath} from "next/cache";
import {getCurrentProfile} from "@/features/auth";
import {roleCan} from "@/features/roles";
import type {ActionResult} from "@/lib/errors";
import {MODULE_PHOTOS_BUCKET} from "@/lib/storage/module-photos";
import {summarizePostgrestError} from "@/lib/storage/prepare-module-photo";
import {createClient} from "@/lib/supabase/server";

export async function savePhotoMetadataAction(input: {
  moduleId: string;
  storagePath: string;
  fileName: string;
  mimeType: string | null;
  byteSize: number | null;
  caption: string | null;
}): Promise<ActionResult<{id: string}>> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return {ok: false, code: "UNAUTHENTICATED"};
  }
  if (!roleCan(profile.role, "managePhotos")) {
    return {ok: false, code: "FORBIDDEN"};
  }

  const supabase = await createClient();
  const {data, error} = await supabase
    .from("module_photos")
    .insert({
      module_id: input.moduleId,
      storage_path: input.storagePath,
      file_name: input.fileName,
      mime_type: input.mimeType,
      byte_size: input.byteSize,
      caption: input.caption,
      uploaded_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    const dbError = summarizePostgrestError(error);
    console.error("[photo-upload]", "METADATA_SAVE_FAILED", {
      stage: "module_photos.insert",
      moduleId: input.moduleId,
      storagePath: input.storagePath,
      fileName: input.fileName,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      uploadedBy: profile.id,
      actionCode: "UPLOAD_FAILED",
      dbCode: dbError.dbCode,
      dbMessage: dbError.dbMessage,
      dbDetails: dbError.dbDetails,
      dbHint: dbError.dbHint,
      noData: !data,
    });
    return {
      ok: false,
      code: "UPLOAD_FAILED",
      dbCode: dbError.dbCode ?? (!data ? "NO_ROW" : null),
      dbMessage: dbError.dbMessage,
      dbDetails: dbError.dbDetails,
      dbHint: dbError.dbHint,
    };
  }

  revalidatePath("/", "layout");
  return {ok: true, id: data.id};
}

export {MODULE_PHOTOS_BUCKET};
