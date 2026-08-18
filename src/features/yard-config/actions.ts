"use server";

import {revalidatePath} from "next/cache";
import {getCurrentProfile} from "@/features/auth";
import {roleCan} from "@/features/roles";
import type {ActionResult} from "@/lib/errors";
import {createClient} from "@/lib/supabase/server";

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return {ok: false as const, code: "UNAUTHENTICATED" as const};
  }
  if (!roleCan(profile.role, "manageYardLayout")) {
    return {ok: false as const, code: "FORBIDDEN" as const};
  }
  return {ok: true as const, profile};
}

export async function updateYardBlockAction(input: {
  blockId: string;
  name: string;
  isActive: boolean;
}): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth;
  }

  const supabase = await createClient();
  const {error} = await supabase
    .from("yard_blocks")
    .update({name: input.name.trim() || "Block", is_active: input.isActive})
    .eq("id", input.blockId);

  if (error) {
    return {ok: false, code: "SAVE_FAILED"};
  }

  revalidatePath("/", "layout");
  return {ok: true};
}

export async function addYardRowAction(blockId: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth;
  }

  const supabase = await createClient();
  const {data: rows, error} = await supabase
    .from("yard_rows")
    .select("code, sort_order")
    .eq("block_id", blockId)
    .order("sort_order");

  if (error) {
    return {ok: false, code: "SAVE_FAILED"};
  }

  const nextOrder = (rows?.at(-1)?.sort_order ?? 0) + 1;
  const nextCode = `P${nextOrder}`;
  const {error: insertError} = await supabase.from("yard_rows").insert({
    block_id: blockId,
    code: nextCode,
    sort_order: nextOrder,
  });

  if (insertError) {
    return {ok: false, code: "SAVE_FAILED"};
  }

  const {data: sample} = await supabase
    .from("yard_rows")
    .select("id")
    .eq("block_id", blockId)
    .neq("code", nextCode)
    .limit(1)
    .maybeSingle();

  if (sample) {
    const {data: positions} = await supabase
      .from("yard_positions")
      .select("code, sort_order")
      .eq("row_id", sample.id);
    const {data: newRow} = await supabase
      .from("yard_rows")
      .select("id")
      .eq("block_id", blockId)
      .eq("code", nextCode)
      .maybeSingle();
    if (newRow && positions && positions.length > 0) {
      await supabase.from("yard_positions").insert(
        positions.map((position) => ({
          row_id: newRow.id,
          code: position.code,
          sort_order: position.sort_order,
        })),
      );
    }
  }

  revalidatePath("/", "layout");
  return {ok: true};
}

export async function addYardPositionAction(blockId: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth;
  }

  const supabase = await createClient();
  const {data: rows, error} = await supabase
    .from("yard_rows")
    .select("id")
    .eq("block_id", blockId);

  if (error || !rows) {
    return {ok: false, code: "SAVE_FAILED"};
  }

  for (const row of rows) {
    const {data: positions} = await supabase
      .from("yard_positions")
      .select("code, sort_order")
      .eq("row_id", row.id)
      .order("sort_order");
    const nextOrder = (positions?.at(-1)?.sort_order ?? 0) + 1;
    const nextCode = String(nextOrder).padStart(2, "0");
    const {error: insertError} = await supabase.from("yard_positions").insert({
      row_id: row.id,
      code: nextCode,
      sort_order: nextOrder,
    });
    if (insertError) {
      return {ok: false, code: "SAVE_FAILED"};
    }
  }

  revalidatePath("/", "layout");
  return {ok: true};
}
