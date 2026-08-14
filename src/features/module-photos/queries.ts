import {createClient} from "@/lib/supabase/server";
import {MODULE_PHOTOS_BUCKET} from "@/lib/storage/module-photos";
import type {PhotoCategory} from "@/types/database";

export type ModulePhotoRecord = {
  id: string;
  moduleId: string;
  storagePath: string;
  fileName: string;
  caption: string | null;
  category: PhotoCategory | null;
  createdAt: string;
  uploadedBy: string | null;
  uploaderName: string | null;
  signedUrl: string | null;
};

export async function listModulePhotos(
  moduleId: string,
  limit?: number,
): Promise<ModulePhotoRecord[]> {
  const supabase = await createClient();
  let query = supabase
    .from("module_photos")
    .select("id, module_id, storage_path, file_name, caption, created_at, uploaded_by")
    .eq("module_id", moduleId)
    .order("created_at", {ascending: false});

  if (limit) {
    query = query.limit(limit);
  }

  const {data, error} = await query;
  if (error) {
    throw new Error("LOAD_FAILED");
  }

  const rows = data ?? [];
  if (rows.length === 0) {
    return [];
  }

  const uploaderIds = Array.from(
    new Set(rows.map((row) => row.uploaded_by).filter((id): id is string => Boolean(id))),
  );
  const names = new Map<string, string | null>();
  if (uploaderIds.length > 0) {
    const {data: profiles} = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", uploaderIds);
    for (const profile of profiles ?? []) {
      names.set(profile.id, profile.full_name);
    }
  }

  const {data: signed, error: signedError} = await supabase.storage
    .from(MODULE_PHOTOS_BUCKET)
    .createSignedUrls(
      rows.map((row) => row.storage_path),
      60 * 60,
    );

  const urlByPath = new Map(
    (signedError ? [] : (signed ?? [])).map((item) => [item.path, item.signedUrl ?? null]),
  );

  return rows.map((row) => ({
    id: row.id,
    moduleId: row.module_id,
    storagePath: row.storage_path,
    fileName: row.file_name,
    caption: row.caption,
    category: null,
    createdAt: row.created_at,
    uploadedBy: row.uploaded_by,
    uploaderName: row.uploaded_by ? (names.get(row.uploaded_by) ?? null) : null,
    signedUrl: urlByPath.get(row.storage_path) ?? null,
  }));
}
