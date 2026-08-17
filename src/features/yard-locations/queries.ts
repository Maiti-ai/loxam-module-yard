import {isProductionBlock} from "@/config/yard";
import {createClient} from "@/lib/supabase/server";
import {yardCapacity} from "./capacity";
import type {ModuleStatus, ModuleTypeCode, StackLevel} from "@/types/database";
import type {
  Occupant,
  YardBlockNode,
  YardLevelCell,
  YardLocation,
  YardSnapshot,
} from "./types";

async function ensureSchellePhysicalPositions(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  await supabase.rpc("ensure_schelle_physical_positions");
}

const LEVEL_ORDER: StackLevel[] = ["LEVEL_2", "LEVEL_1", "GROUND"];

function asLevel(value: string): StackLevel {
  if (value === "LEVEL_1" || value === "LEVEL_2" || value === "GROUND") {
    return value;
  }
  return "GROUND";
}

function asTypeCode(value: string | null | undefined): ModuleTypeCode {
  return value === "3x3" ? "3x3" : "6x3";
}

export async function getYardSnapshot(): Promise<YardSnapshot> {
  const supabase = await createClient();
  await ensureSchellePhysicalPositions(supabase);

  const [blocksRes, rowsRes, positionsRes, slotsRes, locationsRes, modulesRes] =
    await Promise.all([
      supabase
        .from("yard_blocks")
        .select("id, code, name, sort_order, is_active")
        .order("sort_order")
        .then(async (result) => {
          if (!result.error) {
            return result;
          }
          return supabase.from("yard_blocks").select("id, code, name, sort_order").order("sort_order");
        }),
      supabase.from("yard_rows").select("id, block_id, code, sort_order").order("sort_order"),
      supabase
        .from("yard_positions")
        .select("id, row_id, code, sort_order")
        .order("sort_order"),
      supabase.from("yard_slots").select("id, block_id, row_id, position_id, level"),
      supabase.from("module_locations").select("module_id, slot_id"),
      supabase
        .from("modules")
        .select("id, module_number, status, module_type_id, module_types(code, length_m, width_m)"),
    ]);

  const firstError =
    blocksRes.error ||
    rowsRes.error ||
    positionsRes.error ||
    slotsRes.error ||
    locationsRes.error ||
    modulesRes.error;

  if (firstError) {
    throw new Error("LOAD_FAILED");
  }

  const modulesById = new Map(
    (modulesRes.data ?? []).map((module) => {
      const typeRow = module.module_types as
        | {code: string; length_m: number; width_m: number}
        | {code: string; length_m: number; width_m: number}[]
        | null;
      const type = Array.isArray(typeRow) ? typeRow[0] : typeRow;
      return [
        module.id,
        {
          moduleId: module.id,
          moduleNumber: module.module_number,
          status: module.status,
          moduleTypeCode: asTypeCode(type?.code),
          lengthM: Number(type?.length_m ?? 6),
          widthM: Number(type?.width_m ?? 3),
        } satisfies Occupant,
      ];
    }),
  );

  const occupantBySlot = new Map<string, Occupant>();
  for (const location of locationsRes.data ?? []) {
    const occupant = modulesById.get(location.module_id);
    if (occupant) {
      occupantBySlot.set(location.slot_id, occupant);
    }
  }

  const slotsByPosition = new Map<string, YardLevelCell[]>();
  for (const slot of slotsRes.data ?? []) {
    const cell: YardLevelCell = {
      slotId: slot.id,
      level: asLevel(slot.level),
      occupant: occupantBySlot.get(slot.id) ?? null,
    };
    const current = slotsByPosition.get(slot.position_id) ?? [];
    current.push(cell);
    slotsByPosition.set(slot.position_id, current);
  }

  const positionsByRow = new Map<
    string,
    YardSnapshot["blocks"][number]["rows"][number]["positions"]
  >();
  for (const position of positionsRes.data ?? []) {
    const levels = (slotsByPosition.get(position.id) ?? []).sort(
      (a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level),
    );
    const node = {
      id: position.id,
      code: position.code,
      sortOrder: position.sort_order,
      levels,
    };
    const current = positionsByRow.get(position.row_id) ?? [];
    current.push(node);
    positionsByRow.set(position.row_id, current);
  }

  const rowsByBlock = new Map<string, YardSnapshot["blocks"][number]["rows"]>();
  for (const row of rowsRes.data ?? []) {
    const positions = (positionsByRow.get(row.id) ?? []).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    const node = {
      id: row.id,
      code: row.code,
      sortOrder: row.sort_order,
      positions,
    };
    const current = rowsByBlock.get(row.block_id) ?? [];
    current.push(node);
    rowsByBlock.set(row.block_id, current);
  }

  const blocks: YardBlockNode[] = (blocksRes.data ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((block) => ({
      id: block.id,
      code: block.code,
      name: block.name,
      sortOrder: block.sort_order,
      isActive: (block as {is_active?: boolean | null}).is_active !== false,
      productionZone: isProductionBlock(block.code),
      rows: (rowsByBlock.get(block.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
    }));

  const capacity = yardCapacity(blocks);

  return {
    blocks,
    slotCount: capacity.total,
    occupiedSlotCount: capacity.occupied,
  };
}

export function findLocationBySlot(
  snapshot: YardSnapshot,
  slotId: string,
): YardLocation | null {
  for (const block of snapshot.blocks) {
    for (const row of block.rows) {
      for (const position of row.positions) {
        const level = position.levels.find((item) => item.slotId === slotId);
        if (level) {
          return {
            slotId,
            blockId: block.id,
            blockCode: block.code,
            rowId: row.id,
            rowCode: row.code,
            positionId: position.id,
            positionCode: position.code,
            level: level.level,
          };
        }
      }
    }
  }
  return null;
}

export function findBlockCodeForPosition(snapshot: YardSnapshot, positionId: string) {
  for (const block of snapshot.blocks) {
    for (const row of block.rows) {
      if (row.positions.some((position) => position.id === positionId)) {
        return block.code;
      }
    }
  }
  return null;
}

export function occupantAtSlot(snapshot: YardSnapshot, slotId: string) {
  for (const block of snapshot.blocks) {
    for (const row of block.rows) {
      for (const position of row.positions) {
        const level = position.levels.find((item) => item.slotId === slotId);
        if (level) {
          return level.occupant;
        }
      }
    }
  }
  return null;
}

export function locationFromView(row: {
  slot_id: string | null;
  block_code: string | null;
  row_code: string | null;
  position_code: string | null;
  level: StackLevel | null;
}): YardLocation | null {
  if (!row.slot_id || !row.block_code || !row.row_code || !row.position_code || !row.level) {
    return null;
  }

  return {
    slotId: row.slot_id,
    blockId: "",
    blockCode: row.block_code,
    rowId: "",
    rowCode: row.row_code,
    positionId: "",
    positionCode: row.position_code,
    level: row.level,
  };
}

export function primaryOccupant(position: {levels: YardLevelCell[]}): Occupant | null {
  const ground = position.levels.find((level) => level.level === "GROUND");
  return ground?.occupant ?? position.levels.find((level) => level.occupant)?.occupant ?? null;
}

export type {ModuleStatus};
