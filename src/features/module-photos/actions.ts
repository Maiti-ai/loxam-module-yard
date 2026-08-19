"use server";

import {revalidatePath} from "next/cache";
import {getCurrentProfile} from "@/features/auth";
import {roleCan} from "@/features/roles";
import type {ActionErr, ActionResult} from "@/lib/errors";
import {MODULE_PHOTOS_BUCKET} from "@/lib/storage/module-photos";
import {
  classifyMetadataSaveThrow,
  summarizePostgrestError,
  type MetadataServerStage,
} from "@/lib/storage/prepare-module-photo";
import {createClient} from "@/lib/supabase/server";

function metadataSaveFailure(
  input: {
    moduleId: string;
    storagePath: string;
    fileName: string;
    mimeType: string | null;
    byteSize: number | null;
  },
  fields: Omit<ActionErr, "ok" | "code"> & {code?: ActionErr["code"]},
): ActionErr {
  const result: ActionErr = {
    ok: false,
    code: fields.code ?? "UPLOAD_FAILED",
    stage: fields.serverStage ?? fields.stage ?? null,
    serverStage: fields.serverStage ?? fields.stage ?? null,
    thrownName: fields.thrownName ?? "NONE",
    dbCode: fields.dbCode ?? "NONE",
    dbMessage: fields.dbMessage ?? null,
    dbDetails: fields.dbDetails ?? null,
    dbHint: fields.dbHint ?? null,
    insertReached: fields.insertReached ?? false,
    insertSucceeded: fields.insertSucceeded ?? false,
  };
  console.error("[photo-upload]", "METADATA_SAVE_FAILED", {
    serverStage: result.serverStage,
    moduleId: input.moduleId,
    storagePath: input.storagePath,
    fileName: input.fileName,
    mimeType: input.mimeType,
    byteSize: input.byteSize,
    actionCode: result.code,
    thrownName: result.thrownName,
    dbCode: result.dbCode,
    dbMessage: result.dbMessage,
    dbDetails: result.dbDetails,
    dbHint: result.dbHint,
    insertReached: result.insertReached,
    insertSucceeded: result.insertSucceeded,
  });
  return result;
}

export async function savePhotoMetadataAction(input: {
  moduleId: string;
  storagePath: string;
  fileName: string;
  mimeType: string | null;
  byteSize: number | null;
  caption: string | null;
}): Promise<ActionResult<{id: string}>> {
  let serverStage: MetadataServerStage = "AUTH_SESSION";
  let insertReached = false;
  let insertSucceeded = false;

  try {
    // AUTH_SESSION covers getCurrentProfile(): createClient + auth.getUser +
    // profiles lookup. PROFILE_LOOKUP is not a separate action step.
    // MODULE_VALIDATION does not exist in this action.
    const profile = await getCurrentProfile();
    if (!profile) {
      return metadataSaveFailure(input, {
        code: "UNAUTHENTICATED",
        serverStage,
        dbCode: "NONE",
      });
    }

    serverStage = "AUTH_ROLE";
    if (!roleCan(profile.role, "managePhotos")) {
      return metadataSaveFailure(input, {
        code: "FORBIDDEN",
        serverStage,
        dbCode: "NONE",
      });
    }

    serverStage = "SUPABASE_CLIENT";
    const supabase = await createClient();

    serverStage = "MODULE_PHOTOS_INSERT";
    insertReached = true;
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
      .select("id");

    if (error) {
      const dbError = summarizePostgrestError(error);
      return metadataSaveFailure(input, {
        serverStage: "MODULE_PHOTOS_INSERT",
        insertReached,
        insertSucceeded: false,
        dbCode: dbError.dbCode ?? "NONE",
        dbMessage: dbError.dbMessage,
        dbDetails: dbError.dbDetails,
        dbHint: dbError.dbHint,
      });
    }

    serverStage = "INSERT_RETURNING";
    const insertedId = data?.[0]?.id;
    if (!insertedId) {
      return metadataSaveFailure(input, {
        serverStage: "INSERT_RETURNING",
        insertReached,
        insertSucceeded: false,
        dbCode: "NONE",
        dbMessage: "insert returned no row id",
      });
    }
    insertSucceeded = true;

    serverStage = "REVALIDATE_PATH";
    revalidatePath("/", "layout");

    serverStage = "FINAL_RETURN";
    return {ok: true, id: insertedId};
  } catch (caught) {
    const classified = classifyMetadataSaveThrow(caught, serverStage);
    return metadataSaveFailure(input, {
      serverStage: classified.serverStage,
      thrownName: classified.thrownName,
      dbCode: classified.dbCode,
      dbMessage: classified.dbMessage,
      dbDetails: classified.dbDetails,
      dbHint: classified.dbHint,
      insertReached,
      insertSucceeded,
    });
  }
}

export {MODULE_PHOTOS_BUCKET};
