import {createClient} from "@/lib/supabase/server";
import {yardCapacity} from "@/features/yard-locations/capacity";
import {displayBlocks} from "@/features/yard-locations/display-blocks";
import {getYardSnapshot, locationFromView} from "@/features/yard-locations/queries";
import type {AircoSummary, ModuleSummary} from "@/features/yard-locations/types";
import type {ModuleStatus, ModuleTypeCode} from "@/types/database";

function asTypeCode(value: string | null): ModuleTypeCode {
  return value === "3x3" ? "3x3" : "6x3";
}

export async function listModuleSummaries(): Promise<ModuleSummary[]> {
  const supabase = await createClient();

  const [viewRes, aircoRes, notesRes, lastMoveRes] = await Promise.all([
    supabase.from("module_location_view").select("*"),
    supabase
      .from("air_conditioning_units")
      .select("id, module_id, brand, serial_number, internal_number, last_maintenance_at, notes"),
    supabase.from("modules").select("id, notes, module_type_id"),
    supabase.from("module_last_movement_view").select("module_id, moved_at"),
  ]);

  if (viewRes.error || aircoRes.error || notesRes.error) {
    throw new Error("LOAD_FAILED");
  }

  const notesById = new Map((notesRes.data ?? []).map((row) => [row.id, row]));
  const lastMoveById = new Map(
    (lastMoveRes.error ? [] : (lastMoveRes.data ?? [])).map((row) => [row.module_id, row.moved_at]),
  );

  const aircoByModule = new Map<string, AircoSummary>();
  for (const unit of aircoRes.data ?? []) {
    aircoByModule.set(unit.module_id, {
      id: unit.id,
      brand: unit.brand,
      serialNumber: unit.serial_number,
      internalNumber: unit.internal_number,
      lastMaintenanceAt: unit.last_maintenance_at,
      notes: unit.notes,
    });
  }

  return (viewRes.data ?? [])
    .filter((row) => row.module_id && row.module_number)
    .map((row) => {
      const extra = notesById.get(row.module_id as string);
      return {
        id: row.module_id as string,
        moduleNumber: row.module_number as string,
        moduleTypeId: extra?.module_type_id ?? "",
        moduleTypeCode: asTypeCode(row.module_type_code),
        moduleTypeNumber: (row.module_type_number as string | null | undefined) ?? null,
        lengthM: Number(row.length_m ?? 0),
        widthM: Number(row.width_m ?? 0),
        status: (row.status === "RENTED" ? "RENTED" : "AVAILABLE") as ModuleStatus,
        rentedToProject: row.rented_to_project,
        notes: extra?.notes ?? null,
        location: locationFromView(row),
        airco: aircoByModule.get(row.module_id as string) ?? null,
        lastMovedAt: lastMoveById.get(row.module_id as string) ?? row.located_at ?? null,
      };
    })
    .sort((a, b) => a.moduleNumber.localeCompare(b.moduleNumber, undefined, {numeric: true}));
}

export async function getModuleByNumber(moduleNumber: string): Promise<ModuleSummary | null> {
  const normalized = moduleNumber.trim();
  if (!normalized) {
    return null;
  }

  const modules = await listModuleSummaries();
  return (
    modules.find((module) => module.moduleNumber.toLowerCase() === normalized.toLowerCase()) ??
    null
  );
}

export async function getDashboardStats() {
  const [modules, yard] = await Promise.all([listModuleSummaries(), getYardSnapshot()]);
  const capacity = yardCapacity(displayBlocks(yard));

  return {
    total: modules.length,
    available: modules.filter((module) => module.status === "AVAILABLE").length,
    rented: modules.filter((module) => module.status === "RENTED").length,
    withoutLocation: modules.filter((module) => !module.location).length,
    physicalPositions: capacity.physicalPositions,
    totalCapacity: capacity.total,
    occupiedSlots: capacity.occupied,
    freeSlots: capacity.available,
  };
}
