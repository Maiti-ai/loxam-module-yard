import {createClient} from "@/lib/supabase/server";
import type {EquipmentPlaceholderKey} from "@/config/equipment";
import type {ModuleTypeCode} from "@/types/database";

export type ModuleTypeRecord = {
  id: string;
  code: ModuleTypeCode;
  typeNumber: string | null;
  lengthM: number;
  widthM: number;
  name: string;
  notes: string | null;
  drawingUrl: string | null;
  drawingMimeType: string | null;
  equipment: EquipmentPlaceholderKey[];
};

export async function getModuleType(code: string): Promise<ModuleTypeRecord | null> {
  const supabase = await createClient();
  const typedCode: ModuleTypeCode = code === "3x3" ? "3x3" : "6x3";
  const {data, error} = await supabase
    .from("module_types")
    .select(
      "id, code, type_number, length_m, width_m, name, notes, drawing_storage_path, drawing_mime_type",
    )
    .eq("code", typedCode)
    .maybeSingle();

  if (error || !data) {
    const fallback = await supabase
      .from("module_types")
      .select("id, code, length_m, width_m, name")
      .eq("code", typedCode)
      .maybeSingle();
    if (fallback.error || !fallback.data) {
      return null;
    }
    return {
      id: fallback.data.id,
      code: fallback.data.code === "3x3" ? "3x3" : "6x3",
      typeNumber: null,
      lengthM: Number(fallback.data.length_m),
      widthM: Number(fallback.data.width_m),
      name: fallback.data.name,
      notes: null,
      drawingUrl: null,
      drawingMimeType: null,
      equipment: [],
    };
  }

  let drawingUrl: string | null = null;
  if (data.drawing_storage_path) {
    const signed = await supabase.storage
      .from("module-type-drawings")
      .createSignedUrl(data.drawing_storage_path, 60 * 60);
    drawingUrl = signed.data?.signedUrl ?? null;
  }

  const links = await supabase
    .from("module_type_equipment")
    .select("equipment_kind_id")
    .eq("module_type_id", data.id);

  const kindIds = (links.data ?? []).map((row) => row.equipment_kind_id);
  let equipment: EquipmentPlaceholderKey[] = [];
  if (kindIds.length > 0) {
    const kinds = await supabase.from("equipment_kinds").select("code").in("id", kindIds);
    equipment = (kinds.data ?? [])
      .map((row) => row.code as EquipmentPlaceholderKey)
      .filter((value) => Boolean(value));
  }

  return {
    id: data.id,
    code: data.code === "3x3" ? "3x3" : "6x3",
    typeNumber: data.type_number,
    lengthM: Number(data.length_m),
    widthM: Number(data.width_m),
    name: data.name,
    notes: data.notes,
    drawingUrl,
    drawingMimeType: data.drawing_mime_type,
    equipment,
  };
}

export async function listModuleTypes(): Promise<ModuleTypeRecord[]> {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from("module_types")
    .select("code")
    .order("code");
  if (error) {
    throw new Error("LOAD_FAILED");
  }
  const records = await Promise.all((data ?? []).map((row) => getModuleType(row.code)));
  return records.filter((item): item is ModuleTypeRecord => Boolean(item));
}
