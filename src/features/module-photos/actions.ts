"use server";

import {revalidatePath} from "next/cache";
import {unstable_rethrow} from "next/navigation";
import {getCurrentProfile} from "@/features/auth";
import {roleCan} from "@/features/roles";
import type {ActionResult} from "@/lib/errors";
import {MODULE_PHOTOS_BUCKET} from "@/lib/storage/module-photos";
import {
  classifyMetadataSaveThrow,
  summarizePostgrestError,
} from "@/lib/storage/prepare-module-photo";
import {createClient} from "@/lib/supabase/server";

export async function savePhotoMetadataAction(input: {
  moduleId: string;
  storagePath: string;
  fileName: string;
  mimeType: string | null;
  byteSize: number | null;
  caption: string | null;
}): Promise<ActionResult<{id: string}>> {
  let stage = "auth.session";
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return {ok: false, code: "UNAUTHENTICATED", stage, dbCode: "NONE"};
    }

    stage = "auth.role";
    if (!roleCan(profile.role, "managePhotos")) {
      return {ok: false, code: "FORBIDDEN", stage, dbCode: "NONE"};
    }

    stage = "supabase.client";
    const supabase = await createClient();

    stage = "module_photos.insert";
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
        stage,
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
        stage,
        dbCode: dbError.dbCode ?? (!data ? "NO_ROW" : "NONE"),
        dbMessage: dbError.dbMessage,
        dbDetails: dbError.dbDetails,
        dbHint: dbError.dbHint,
      };
    }

    stage = "revalidate";
    revalidatePath("/", "layout");
    return {ok: true, id: data.id};
  } catch (caught) {
    unstable_rethrow(caught);
    const classified = classifyMetadataSaveThrow(caught, stage);
    console.error("[photo-upload]", "METADATA_SAVE_FAILED", {
      stage: classified.stage,
      moduleId: input.moduleId,
      storagePath: input.storagePath,
      fileName: input.fileName,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      actionCode: "UPLOAD_FAILED",
      dbCode: classified.dbCode,
      dbMessage: classified.dbMessage,
      dbDetails: classified.dbDetails,
      dbHint: classified.dbHint,
    });
    return {
      ok: false,
      code: "UPLOAD_FAILED",
      stage: classified.stage,
      dbCode: classified.dbCode,
      dbMessage: classified.dbMessage,
      dbDetails: classified.dbDetails,
      dbHint: classified.dbHint,
    };
  }
}

export {MODULE_PHOTOS_BUCKET};
