import {createClient} from "@/lib/supabase/server";
import {MODULE_PHOTOS_BUCKET} from "@/lib/storage/module-photos";

export type ModulePhotoRecord = {
  id: string;
  moduleId: string;
  storagePath: string;
  fileName: string;
  caption: string | null;
  createdAt: string;
  uploadedBy: string | null;
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

  const {data: signed, error: signedError} = await supabase.storage
    .from(MODULE_PHOTOS_BUCKET)
    .createSignedUrls(
      rows.map((row) => row.storage_path),
      60 * 60,
    );

  if (signedError) {
    return rows.map((row) => ({
      id: row.id,
      moduleId: row.module_id,
      storagePath: row.storage_path,
      fileName: row.file_name,
      caption: row.caption,
      createdAt: row.created_at,
      uploadedBy: row.uploaded_by,
      signedUrl: null,
    }));
  }

  const urlByPath = new Map(
    (signed ?? []).map((item) => [item.path, item.signedUrl ?? null]),
  );

  return rows.map((row) => ({
    id: row.id,
    moduleId: row.module_id,
    storagePath: row.storage_path,
    fileName: row.file_name,
    caption: row.caption,
    createdAt: row.created_at,
    uploadedBy: row.uploaded_by,
    signedUrl: urlByPath.get(row.storage_path) ?? null,
  }));
}
