import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
  materializePhotoFile,
  normalizePhotoMimeType,
  PhotoUploadTimeoutError,
  createLocalPhotoPreviewUrl,
  revokeLocalPhotoPreviewUrl,
  summarizePostgrestError,
  summarizeStorageError,
  withTimeout,
  classifyMetadataSaveThrow,
  summarizeThrownException,
  parsePhotoMetadataActionInput,
  toJsonSafeMetadataActionFailure,
  toJsonSafeMetadataActionSuccess,
  buildPhotoMetadataActionThrowLog,
} from "./prepare-module-photo";

describe("module photo upload preparation", () => {
  it("TEST 4: image/jpg is normalized to image/jpeg", () => {
    assert.equal(normalizePhotoMimeType("image/jpg", "shot.jpg"), "image/jpeg");
    assert.equal(normalizePhotoMimeType("IMAGE/JPG", "shot.JPG"), "image/jpeg");
  });

  it("TEST 5: empty MIME + .jpg filename is recognized as image/jpeg", () => {
    assert.equal(normalizePhotoMimeType("", "IMG_2000.jpg"), "image/jpeg");
    assert.equal(normalizePhotoMimeType("   ", "photo.jpeg"), "image/jpeg");
    assert.equal(normalizePhotoMimeType(undefined, "photo.PNG"), "image/png");
    assert.equal(normalizePhotoMimeType("", "scan.webp"), "image/webp");
  });

  it("TEST 6: unsupported files are rejected before upload", () => {
    assert.equal(normalizePhotoMimeType("image/heic", "photo.heic"), null);
    assert.equal(normalizePhotoMimeType("image/heif", "photo.heif"), null);
    assert.equal(normalizePhotoMimeType("application/pdf", "doc.pdf"), null);
    assert.equal(normalizePhotoMimeType("", "notes.txt"), null);
    assert.equal(normalizePhotoMimeType("", "photo"), null);
  });

  it("TEST 3: camera JPEG is materialized into a new File before upload", async () => {
    const original = new File([new Uint8Array([1, 2, 3, 4])], "image.jpg", {type: "image/jpeg"});
    const materialized = await materializePhotoFile(original, "image/jpeg");

    assert.notEqual(materialized, original);
    assert.equal(materialized.type, "image/jpeg");
    assert.equal(materialized.name, "image.jpg");
    assert.equal(materialized.size, original.size);
    assert.deepEqual(new Uint8Array(await materialized.arrayBuffer()), new Uint8Array([1, 2, 3, 4]));
  });

  it("creates a local blob preview URL and revokes it without uploading", () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], "image.jpg", {type: "image/jpeg"});
    const url = createLocalPhotoPreviewUrl(file);
    assert.match(url, /^blob:/);
    revokeLocalPhotoPreviewUrl(url);
    revokeLocalPhotoPreviewUrl(null);
    revokeLocalPhotoPreviewUrl("https://example.invalid/photo.jpg");
  });

  it("keeps jpeg/png/webp types as-is", () => {
    assert.equal(normalizePhotoMimeType("image/jpeg", "a.jpg"), "image/jpeg");
    assert.equal(normalizePhotoMimeType("image/png", "a.png"), "image/png");
    assert.equal(normalizePhotoMimeType("image/webp", "a.webp"), "image/webp");
  });

  it("TEST 8: a hanging promise times out and rejects", async () => {
    const hanging = new Promise<string>(() => undefined);
    await assert.rejects(() => withTimeout(hanging, 20), PhotoUploadTimeoutError);
  });

  it("resolves when the wrapped promise finishes before the timeout", async () => {
    const value = await withTimeout(Promise.resolve("ok"), 100);
    assert.equal(value, "ok");
  });

  it("summarizes Storage errors without URLs or tokens", () => {
    const summary = summarizeStorageError({
      name: "StorageApiError",
      message: "new row violates row-level security policy https://example.supabase.co/storage/v1/object?token=secret",
      status: 403,
      statusCode: "403",
      code: "AccessDenied",
    });
    assert.equal(summary.name, "StorageApiError");
    assert.equal(summary.status, 403);
    assert.equal(summary.statusCode, "403");
    assert.equal(summary.code, "AccessDenied");
    assert.equal(summary.message?.includes("https://"), false);
    assert.equal(summary.message?.includes("secret"), false);
  });

  it("summarizes PostgREST errors without URLs or tokens", () => {
    const summary = summarizePostgrestError({
      code: "42501",
      message: "new row violates row-level security policy https://example.supabase.co/rest/v1/module_photos?apikey=secret",
      details: "Failing row contains (token=abc).",
      hint: "Grant INSERT on public.module_photos to authenticated.",
    });
    assert.equal(summary.dbCode, "42501");
    assert.equal(summary.dbHint, "Grant INSERT on public.module_photos to authenticated.");
    assert.equal(summary.dbMessage?.includes("https://"), false);
    assert.equal(summary.dbMessage?.includes("secret"), false);
    assert.equal(summary.dbDetails?.includes("token="), false);
  });

  it("classifies a thrown server-action error without leaking secrets", () => {
    const classified = classifyMetadataSaveThrow(
      new Error("revalidate failed https://example.supabase.co?apikey=secret"),
      "REVALIDATE_PATH",
    );
    assert.equal(classified.stage, "REVALIDATE_PATH");
    assert.equal(classified.serverStage, "REVALIDATE_PATH");
    assert.equal(classified.thrownName, "Error");
    assert.equal(classified.dbCode, "NONE");
    assert.equal(classified.dbMessage?.includes("https://"), false);
    assert.equal(classified.dbMessage?.includes("secret"), false);
    assert.equal(classified.dbMessage?.includes("revalidate failed"), true);
  });

  it("preserves thrown PostgREST fields without converting them first", () => {
    const classified = classifyMetadataSaveThrow(
      {
        name: "PostgrestError",
        code: "42501",
        message: "new row violates row-level security policy",
        details: "Failing row contains ().",
        hint: "Check RLS policies.",
      },
      "MODULE_PHOTOS_INSERT",
    );
    assert.equal(classified.serverStage, "MODULE_PHOTOS_INSERT");
    assert.equal(classified.thrownName, "PostgrestError");
    assert.equal(classified.dbCode, "42501");
    assert.equal(classified.dbMessage, "new row violates row-level security policy");
    assert.equal(classified.dbDetails, "Failing row contains ().");
    assert.equal(classified.dbHint, "Check RLS policies.");
  });

  it("summarizes a thrown client exception without leaking secrets", () => {
    const error = new Error("Failed to fetch https://example.supabase.co/rest/v1?apikey=secret");
    error.name = "TypeError";
    const summary = summarizeThrownException(error);
    assert.equal(summary.thrownName, "TypeError");
    assert.equal(summary.thrownMessage?.includes("https://"), false);
    assert.equal(summary.thrownMessage?.includes("secret"), false);
    assert.equal(summary.thrownMessage?.includes("Failed to fetch"), true);
    assert.equal(summary.thrownStack?.includes("secret"), false);
  });

  it("accepts the PhotoUploader server-action payload and rejects File/Blob fields", () => {
    const parsed = parsePhotoMetadataActionInput({
      moduleId: "11111111-1111-1111-1111-111111111111",
      storagePath: "11111111-1111-1111-1111-111111111111/photo.jpg",
      fileName: "photo.jpg",
      mimeType: "image/jpeg",
      byteSize: 12,
      caption: null,
    });
    assert.equal(parsed.caption, null);
    assert.equal(parsed.byteSize, 12);
    assert.throws(
      () => parsePhotoMetadataActionInput(new File([new Uint8Array([1])], "photo.jpg")),
      /PHOTO_METADATA_INPUT_HAS_FILE/,
    );
    assert.throws(
      () =>
        parsePhotoMetadataActionInput({
          moduleId: "id",
          storagePath: "path",
          fileName: "photo.jpg",
          mimeType: "image/jpeg",
          byteSize: 1,
          caption: null,
          file: new File([new Uint8Array([1])], "photo.jpg"),
        }),
      /PHOTO_METADATA_INPUT_HAS_FILE/,
    );
  });

  it("returns only JSON-safe primitives from metadata action results", () => {
    const failure = toJsonSafeMetadataActionFailure({
      serverStage: "MODULE_PHOTOS_INSERT",
      thrownName: "PostgrestError",
      dbCode: "42501",
      dbMessage: "new row violates row-level security policy https://example.supabase.co?apikey=secret",
      dbDetails: "Failing row contains (token=abc).",
      dbHint: "Check RLS policies.",
      insertReached: true,
      insertSucceeded: false,
    });
    assert.equal(failure.ok, false);
    assert.equal(failure.code, "UPLOAD_FAILED");
    assert.equal(failure.serverStage, "MODULE_PHOTOS_INSERT");
    assert.equal(failure.dbCode, "42501");
    assert.equal(failure.dbMessage?.includes("https://"), false);
    assert.equal(failure.dbMessage?.includes("secret"), false);
    assert.equal(failure.dbDetails?.includes("token="), false);
    assert.equal(JSON.stringify(failure).includes("[object"), false);

    const success = toJsonSafeMetadataActionSuccess("row-id");
    assert.deepEqual(success, {ok: true, id: "row-id"});
  });

  it("builds a PHOTO_METADATA_ACTION_THROW log without secrets", () => {
    const log = buildPhotoMetadataActionThrowLog({
      stage: "AUTH_SESSION",
      thrownName: "Error",
      thrownMessage: "cookies failed https://example.supabase.co?apikey=secret",
      dbCode: "NONE",
      dbDetails: null,
      dbHint: null,
      flags: {
        actionEntered: true,
        supabaseClientCreated: false,
        authLookupStarted: true,
        authLookupSucceeded: false,
        insertReached: false,
        insertSucceeded: false,
      },
    });
    assert.equal(log.event, "PHOTO_METADATA_ACTION_THROW");
    assert.equal(log.stage, "AUTH_SESSION");
    assert.equal(log.actionEntered, true);
    assert.equal(log.insertReached, false);
    assert.equal(String(log.thrownMessage).includes("https://"), false);
    assert.equal(String(log.thrownMessage).includes("secret"), false);
  });
});
