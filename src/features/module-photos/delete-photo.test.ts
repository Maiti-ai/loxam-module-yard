import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {APP_ROLES, canDeleteModulePhotos, roleCan} from "@/features/roles";
import {
  isPhotoDeleteComplete,
  parseModulePhotoId,
  photoStoragePathsToRemove,
} from "./delete-photo";

describe("module photo delete", () => {
  it("parses a photo id and rejects anything else", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    assert.equal(parseModulePhotoId(id), id);
    assert.equal(parseModulePhotoId({photoId: id}), id);
    assert.equal(parseModulePhotoId(""), null);
    assert.equal(parseModulePhotoId("not-an-id"), null);
    assert.equal(parseModulePhotoId({photoId: "photo.jpg"}), null);
    assert.equal(parseModulePhotoId({storagePath: "module/photo.jpg"}), null);
  });

  it("removes only the stored storage_path and never reconstructs it from the filename", () => {
    assert.deepEqual(
      photoStoragePathsToRemove({
        storagePath: "module-id/1234-photo.jpg",
      }),
      ["module-id/1234-photo.jpg"],
    );
    assert.deepEqual(photoStoragePathsToRemove({storagePath: "  "}), []);
    assert.deepEqual(photoStoragePathsToRemove({storagePath: null}), []);
  });

  it("does not claim success unless Storage and the database record were both deleted", () => {
    assert.equal(isPhotoDeleteComplete({storageDeleted: true, recordDeleted: true}), true);
    assert.equal(isPhotoDeleteComplete({storageDeleted: false, recordDeleted: true}), false);
    assert.equal(isPhotoDeleteComplete({storageDeleted: true, recordDeleted: false}), false);
  });

  it("temporarily allows the same roles that can manage photos", () => {
    for (const role of APP_ROLES) {
      assert.equal(canDeleteModulePhotos(role), roleCan(role, "managePhotos"));
    }
    assert.equal(canDeleteModulePhotos(null), false);
  });
});
