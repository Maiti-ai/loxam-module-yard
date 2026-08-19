"use server";

import {revalidatePath} from "next/cache";
import {getCurrentProfile} from "@/features/auth";
import {roleCan} from "@/features/roles";
import type {ActionResult} from "@/lib/errors";
import {
  buildPhotoMetadataActionThrowLog,
  classifyMetadataSaveThrow,
  parsePhotoMetadataActionInput,
  summarizePostgrestError,
  toJsonSafeMetadataActionFailure,
  toJsonSafeMetadataActionSuccess,
  type MetadataServerStage,
  type PhotoMetadataActionFlags,
} from "@/lib/storage/prepare-module-photo";
import {createClient} from "@/lib/supabase/server";

export async function savePhotoMetadataAction(
  input: unknown,
): Promise<ActionResult<{id: string}>> {
  // Flag initializers only. Catch must still see progress if a later step throws.
  let serverStage: MetadataServerStage = "ACTION_ENTERED";
  const flags: PhotoMetadataActionFlags = {
    actionEntered: false,
    supabaseClientCreated: false,
    authLookupStarted: false,
    authLookupSucceeded: false,
    insertReached: false,
    insertSucceeded: false,
  };

  try {
    flags.actionEntered = true;
    console.error("PHOTO_METADATA_ACTION_ENTERED");

    serverStage = "INPUT_PARSE";
    const parsed = parsePhotoMetadataActionInput(input);

    // AUTH_SESSION covers getCurrentProfile(): createClient + auth.getUser +
    // profiles lookup. PROFILE_LOOKUP is not a separate action step.
    // MODULE_VALIDATION does not exist in this action.
    serverStage = "AUTH_SESSION";
    flags.authLookupStarted = true;
    const profile = await getCurrentProfile();
    if (!profile) {
      return toJsonSafeMetadataActionFailure({
        code: "UNAUTHENTICATED",
        serverStage,
        dbCode: "NONE",
        insertReached: flags.insertReached,
        insertSucceeded: flags.insertSucceeded,
      });
    }
    flags.authLookupSucceeded = true;

    serverStage = "AUTH_ROLE";
    if (!roleCan(profile.role, "managePhotos")) {
      return toJsonSafeMetadataActionFailure({
        code: "FORBIDDEN",
        serverStage,
        dbCode: "NONE",
        insertReached: flags.insertReached,
        insertSucceeded: flags.insertSucceeded,
      });
    }

    serverStage = "SUPABASE_CLIENT";
    const supabase = await createClient();
    flags.supabaseClientCreated = true;

    serverStage = "MODULE_PHOTOS_INSERT";
    flags.insertReached = true;
    const {data, error} = await supabase
      .from("module_photos")
      .insert({
        module_id: parsed.moduleId,
        storage_path: parsed.storagePath,
        file_name: parsed.fileName,
        mime_type: parsed.mimeType,
        byte_size: parsed.byteSize,
        caption: parsed.caption,
        uploaded_by: profile.id,
      })
      .select("id");

    if (error) {
      const dbError = summarizePostgrestError(error);
      return toJsonSafeMetadataActionFailure({
        serverStage: "MODULE_PHOTOS_INSERT",
        insertReached: flags.insertReached,
        insertSucceeded: false,
        dbCode: dbError.dbCode,
        dbMessage: dbError.dbMessage,
        dbDetails: dbError.dbDetails,
        dbHint: dbError.dbHint,
      });
    }

    serverStage = "INSERT_RETURNING";
    const insertedId = data?.[0]?.id;
    if (!insertedId) {
      return toJsonSafeMetadataActionFailure({
        serverStage: "INSERT_RETURNING",
        insertReached: flags.insertReached,
        insertSucceeded: false,
        dbCode: "NONE",
        dbMessage: "insert returned no row id",
      });
    }
    flags.insertSucceeded = true;

    serverStage = "REVALIDATE_PATH";
    revalidatePath("/", "layout");

    serverStage = "FINAL_RETURN";
    return toJsonSafeMetadataActionSuccess(insertedId);
  } catch (caught) {
    try {
      const classified = classifyMetadataSaveThrow(caught, serverStage);
      console.error(
        "PHOTO_METADATA_ACTION_THROW",
        buildPhotoMetadataActionThrowLog({
          stage: classified.serverStage,
          thrownName: classified.thrownName,
          thrownMessage: classified.dbMessage,
          dbCode: classified.dbCode,
          dbDetails: classified.dbDetails,
          dbHint: classified.dbHint,
          flags,
        }),
      );
      return toJsonSafeMetadataActionFailure({
        serverStage: classified.serverStage,
        thrownName: classified.thrownName,
        dbCode: classified.dbCode,
        dbMessage: classified.dbMessage,
        dbDetails: classified.dbDetails,
        dbHint: classified.dbHint,
        insertReached: flags.insertReached,
        insertSucceeded: flags.insertSucceeded,
      });
    } catch {
      try {
        console.error("PHOTO_METADATA_ACTION_THROW", {
          event: "PHOTO_METADATA_ACTION_THROW",
          stage: serverStage,
          thrownName: "CATCH_HANDLER_FAILED",
          thrownMessage: null,
          dbCode: "NONE",
          dbDetails: null,
          dbHint: null,
          actionEntered: flags.actionEntered,
          supabaseClientCreated: flags.supabaseClientCreated,
          authLookupStarted: flags.authLookupStarted,
          authLookupSucceeded: flags.authLookupSucceeded,
          insertReached: flags.insertReached,
          insertSucceeded: flags.insertSucceeded,
        });
      } catch {
        console.error("PHOTO_METADATA_ACTION_THROW");
      }
      return {
        ok: false,
        code: "UPLOAD_FAILED",
        stage: serverStage,
        serverStage,
        thrownName: "Error",
        dbCode: "NONE",
        dbMessage: null,
        dbDetails: null,
        dbHint: null,
        insertReached: flags.insertReached,
        insertSucceeded: flags.insertSucceeded,
      };
    }
  }
}
