import {createClient} from "@/lib/supabase/server";
import type {DispatchDossierStatus, DispatchSlotStatus, StackLevel} from "@/types/database";
import type {
  DispatchAssignment,
  DispatchDossierDetail,
  DispatchDossierSummary,
  DispatchReservationSummary,
  DispatchSlotView,
} from "./types";

function asLevel(value: string): StackLevel {
  if (value === "LEVEL_1" || value === "LEVEL_2" || value === "GROUND") {
    return value;
  }
  return "GROUND";
}

function asDossierStatus(value: string): DispatchDossierStatus {
  if (
    value === "READY_FOR_SHIPPING" ||
    value === "SHIPPED" ||
    value === "CANCELLED" ||
    value === "ACTIVE"
  ) {
    return value;
  }
  return "ACTIVE";
}

function asSlotStatus(value: string): DispatchSlotStatus {
  if (value === "ASSIGNED" || value === "PLACED" || value === "EMPTY") {
    return value;
  }
  return "EMPTY";
}

function toSummary(
  row: {
    id: string;
    dossier_number: string;
    customer_name: string;
    site_location: string;
    total_modules: number;
    status: string;
    created_at: string;
  },
  assignedCount: number,
  placedCount: number,
): DispatchDossierSummary {
  return {
    id: row.id,
    dossierNumber: row.dossier_number,
    customerName: row.customer_name,
    siteLocation: row.site_location,
    totalModules: row.total_modules,
    status: asDossierStatus(row.status),
    assignedCount,
    placedCount,
    createdAt: row.created_at,
  };
}

export async function listActiveReservations(): Promise<
  Map<string, DispatchReservationSummary>
> {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from("dispatch_reserved_positions")
    .select("position_id, dossier_id")
    .eq("blocking", true);

  if (error || !data || data.length === 0) {
    return new Map();
  }

  const dossierIds = Array.from(new Set(data.map((row) => row.dossier_id)));
  const [{data: dossiers}, {data: slots}] = await Promise.all([
    supabase
      .from("dispatch_dossiers")
      .select("id, dossier_number, customer_name, site_location, total_modules, status")
      .in("id", dossierIds),
    supabase.from("dispatch_slots").select("dossier_id, status").in("dossier_id", dossierIds),
  ]);

  const placedByDossier = new Map<string, number>();
  for (const slot of slots ?? []) {
    if (slot.status === "PLACED") {
      placedByDossier.set(slot.dossier_id, (placedByDossier.get(slot.dossier_id) ?? 0) + 1);
    }
  }

  const dossierById = new Map((dossiers ?? []).map((row) => [row.id, row]));
  const map = new Map<string, DispatchReservationSummary>();
  for (const row of data) {
    const dossier = dossierById.get(row.dossier_id);
    if (!dossier) {
      continue;
    }
    map.set(row.position_id, {
      dossierId: dossier.id,
      dossierNumber: dossier.dossier_number,
      customerName: dossier.customer_name,
      siteLocation: dossier.site_location,
      placedCount: placedByDossier.get(dossier.id) ?? 0,
      totalModules: dossier.total_modules,
      status: asDossierStatus(dossier.status),
    });
  }
  return map;
}

async function countsForDossiers(dossierIds: string[]) {
  const assigned = new Map<string, number>();
  const placed = new Map<string, number>();
  if (dossierIds.length === 0) {
    return {assigned, placed};
  }
  const supabase = await createClient();
  const {data} = await supabase
    .from("dispatch_slots")
    .select("dossier_id, module_id, status")
    .in("dossier_id", dossierIds);
  for (const slot of data ?? []) {
    if (slot.module_id) {
      assigned.set(slot.dossier_id, (assigned.get(slot.dossier_id) ?? 0) + 1);
    }
    if (slot.status === "PLACED") {
      placed.set(slot.dossier_id, (placed.get(slot.dossier_id) ?? 0) + 1);
    }
  }
  return {assigned, placed};
}

export async function listDispatchDossiers(): Promise<DispatchDossierSummary[]> {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from("dispatch_dossiers")
    .select("id, dossier_number, customer_name, site_location, total_modules, status, created_at")
    .in("status", ["ACTIVE", "READY_FOR_SHIPPING"])
    .order("created_at", {ascending: false});

  if (error || !data) {
    return [];
  }

  const counts = await countsForDossiers(data.map((row) => row.id));
  return data.map((row) =>
    toSummary(row, counts.assigned.get(row.id) ?? 0, counts.placed.get(row.id) ?? 0),
  );
}

export async function listOpenDispatchDossiers(): Promise<DispatchDossierSummary[]> {
  const dossiers = await listDispatchDossiers();
  return dossiers.filter(
    (dossier) => dossier.status === "ACTIVE" && dossier.assignedCount < dossier.totalModules,
  );
}

export async function getDispatchDossier(id: string): Promise<DispatchDossierDetail | null> {
  const supabase = await createClient();
  const {data: dossier, error} = await supabase
    .from("dispatch_dossiers")
    .select("id, dossier_number, customer_name, site_location, total_modules, status, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error("LOAD_FAILED");
  }
  if (!dossier) {
    return null;
  }

  const [{data: reserved}, {data: slots}] = await Promise.all([
    supabase
      .from("dispatch_reserved_positions")
      .select("id, position_id, position_order")
      .eq("dossier_id", id)
      .order("position_order"),
    supabase
      .from("dispatch_slots")
      .select("id, reserved_position_id, sequence_number, level, module_id, status, placed_at")
      .eq("dossier_id", id)
      .order("sequence_number"),
  ]);

  const moduleIds = Array.from(
    new Set((slots ?? []).map((slot) => slot.module_id).filter((value): value is string => Boolean(value))),
  );
  const {data: modules} =
    moduleIds.length > 0
      ? await supabase.from("modules").select("id, module_number").in("id", moduleIds)
      : {data: [] as Array<{id: string; module_number: string}>};

  const positionsRes = await supabase.from("yard_positions").select("id, code, row_id");
  const rowsRes = await supabase.from("yard_rows").select("id, code, block_id");
  const blocksRes = await supabase.from("yard_blocks").select("id, code");

  const blockById = new Map((blocksRes.data ?? []).map((row) => [row.id, row.code]));
  const rowById = new Map(
    (rowsRes.data ?? []).map((row) => [row.id, {code: row.code, blockId: row.block_id}]),
  );
  const positionById = new Map(
    (positionsRes.data ?? []).map((row) => [row.id, {code: row.code, rowId: row.row_id}]),
  );

  function locationOf(positionId: string) {
    const position = positionById.get(positionId);
    const row = position ? rowById.get(position.rowId) : undefined;
    const blockCode = row ? (blockById.get(row.blockId) ?? "") : "";
    return {
      blockCode,
      rowCode: row?.code ?? "",
      positionCode: position?.code ?? "",
    };
  }

  const reservedById = new Map((reserved ?? []).map((row) => [row.id, row]));
  const moduleNumberById = new Map((modules ?? []).map((row) => [row.id, row.module_number]));

  const counts = await countsForDossiers([id]);
  const positions = (reserved ?? []).map((row) => ({
    id: row.id,
    positionId: row.position_id,
    positionOrder: row.position_order,
    ...locationOf(row.position_id),
  }));

  const slotViews: DispatchSlotView[] = (slots ?? []).map((slot) => {
    const reservedRow = reservedById.get(slot.reserved_position_id);
    const loc = reservedRow ? locationOf(reservedRow.position_id) : {blockCode: "", rowCode: "", positionCode: ""};
    return {
      id: slot.id,
      sequenceNumber: slot.sequence_number,
      level: asLevel(slot.level),
      status: asSlotStatus(slot.status),
      moduleId: slot.module_id,
      moduleNumber: slot.module_id ? (moduleNumberById.get(slot.module_id) ?? null) : null,
      placedAt: slot.placed_at,
      positionId: reservedRow?.position_id ?? "",
      positionOrder: reservedRow?.position_order ?? 0,
      ...loc,
    };
  });

  return {
    ...toSummary(dossier, counts.assigned.get(id) ?? 0, counts.placed.get(id) ?? 0),
    positions,
    slots: slotViews,
  };
}

export async function getPendingDispatchAssignment(
  moduleId: string,
): Promise<DispatchAssignment | null> {
  const supabase = await createClient();
  const {data: slot, error} = await supabase
    .from("dispatch_slots")
    .select("id, dossier_id, reserved_position_id, sequence_number, level, status, placed_at, module_id")
    .eq("module_id", moduleId)
    .maybeSingle();

  if (error || !slot || slot.status === "PLACED") {
    return null;
  }

  const {data: dossier} = await supabase
    .from("dispatch_dossiers")
    .select("id, dossier_number, customer_name, site_location, total_modules")
    .eq("id", slot.dossier_id)
    .maybeSingle();
  const {data: reserved} = await supabase
    .from("dispatch_reserved_positions")
    .select("position_id, position_order")
    .eq("id", slot.reserved_position_id)
    .maybeSingle();
  const {data: moduleRow} = await supabase
    .from("modules")
    .select("module_number")
    .eq("id", moduleId)
    .maybeSingle();

  if (!dossier || !reserved) {
    return null;
  }

  const {data: position} = await supabase
    .from("yard_positions")
    .select("id, code, row_id")
    .eq("id", reserved.position_id)
    .maybeSingle();
  const {data: row} = position
    ? await supabase.from("yard_rows").select("code, block_id").eq("id", position.row_id).maybeSingle()
    : {data: null};
  const {data: block} = row
    ? await supabase.from("yard_blocks").select("code").eq("id", row.block_id).maybeSingle()
    : {data: null};

  return {
    dossierId: dossier.id,
    dossierNumber: dossier.dossier_number,
    customerName: dossier.customer_name,
    siteLocation: dossier.site_location,
    totalModules: dossier.total_modules,
    sequenceNumber: slot.sequence_number,
    level: asLevel(slot.level),
    status: asSlotStatus(slot.status),
    placedAt: slot.placed_at,
    positionId: reserved.position_id,
    blockCode: block?.code ?? "A",
    rowCode: row?.code ?? "",
    positionCode: position?.code ?? "",
    moduleId,
    moduleNumber: moduleRow?.module_number ?? "",
  };
}

export async function findDossierByNumber(dossierNumber: string) {
  const supabase = await createClient();
  const {data} = await supabase
    .from("dispatch_dossiers")
    .select("id, dossier_number")
    .ilike("dossier_number", dossierNumber.trim())
    .maybeSingle();
  return data;
}
