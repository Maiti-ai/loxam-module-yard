import {createClient} from "@/lib/supabase/server";
import {findLocationBySlot, getYardSnapshot} from "@/features/yard-locations/queries";
import type {YardLocation} from "@/features/yard-locations/types";

export type MovementRecord = {
  id: string;
  moduleId: string;
  moduleNumber: string;
  from: YardLocation | null;
  to: YardLocation | null;
  movedBy: string | null;
  moverName: string | null;
  movedAt: string;
  notes: string | null;
};

export async function listMovements(options?: {
  moduleId?: string;
  limit?: number;
}): Promise<MovementRecord[]> {
  const supabase = await createClient();
  const limit = options?.limit ?? 40;

  let query = supabase
    .from("module_movements")
    .select("id, module_id, from_slot_id, to_slot_id, moved_by, moved_at, notes")
    .order("moved_at", {ascending: false})
    .limit(limit);

  if (options?.moduleId) {
    query = query.eq("module_id", options.moduleId);
  }

  const [movementsRes, modulesRes, profilesRes, snapshot] = await Promise.all([
    query,
    supabase.from("modules").select("id, module_number"),
    supabase.from("profiles").select("id, full_name"),
    getYardSnapshot(),
  ]);

  if (movementsRes.error || modulesRes.error || profilesRes.error) {
    throw new Error("LOAD_FAILED");
  }

  const moduleNumberById = new Map(
    (modulesRes.data ?? []).map((module) => [module.id, module.module_number]),
  );
  const nameById = new Map((profilesRes.data ?? []).map((profile) => [profile.id, profile.full_name]));

  return (movementsRes.data ?? []).map((row) => ({
    id: row.id,
    moduleId: row.module_id,
    moduleNumber: moduleNumberById.get(row.module_id) ?? "—",
    from: row.from_slot_id ? findLocationBySlot(snapshot, row.from_slot_id) : null,
    to: row.to_slot_id ? findLocationBySlot(snapshot, row.to_slot_id) : null,
    movedBy: row.moved_by,
    moverName: row.moved_by ? (nameById.get(row.moved_by) ?? null) : null,
    movedAt: row.moved_at,
    notes: row.notes,
  }));
}
