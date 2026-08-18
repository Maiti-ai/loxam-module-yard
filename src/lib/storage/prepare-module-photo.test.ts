import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
  materializePhotoFile,
  normalizePhotoMimeType,
  PhotoUploadTimeoutError,
  summarizeStorageError,
  withTimeout,
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
});
