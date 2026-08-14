"use client";

import {useState} from "react";
import {useTranslations} from "next-intl";
import {useRouter} from "@/i18n/navigation";
import {TouchButton} from "@/components/ui/touch-button";
import {
  addYardPositionAction,
  addYardRowAction,
  updateYardBlockAction,
} from "@/features/yard-config/actions";
import type {YardBlockNode} from "@/features/yard-locations/types";

export function YardAdminForm({blocks}: {blocks: YardBlockNode[]}) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <p className="text-sm text-loxam-muted">{t("admin.yardHelp")}</p>
      {error ? (
        <p className="border-4 border-loxam-occupied bg-loxam-occupied-soft p-3 font-bold">{error}</p>
      ) : null}
      {blocks.map((block) => {
        const rowCount = block.rows.length;
        const positionCount = Math.max(0, ...block.rows.map((row) => row.positions.length));
        return (
          <form
            key={block.id}
            className="space-y-3 border-4 border-loxam-black bg-white p-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              setPending(block.id);
              setError(null);
              const result = await updateYardBlockAction({
                blockId: block.id,
                name: String(form.get("name") ?? block.name),
                isActive: form.get("isActive") === "on",
              });
              setPending(null);
              if (!result.ok) {
                setError(t(`errors.${result.code}`));
                return;
              }
              router.refresh();
            }}
          >
            <p className="text-4xl font-black">{block.code}</p>
            <label className="block">
              <span className="text-xs font-bold uppercase text-loxam-muted">{t("admin.blockName")}</span>
              <input
                name="name"
                defaultValue={block.name}
                className="mt-2 min-h-14 w-full border-2 border-loxam-line px-3 font-bold"
              />
            </label>
            <label className="flex min-h-12 items-center gap-3 text-sm font-black uppercase">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={block.isActive}
                className="h-6 w-6"
              />
              {t("admin.active")}
            </label>
            <p className="text-sm font-bold text-loxam-muted">
              {t("move.row")}: {rowCount} · {t("move.position")}: {positionCount}
              {block.productionZone ? ` · ${t("move.productionZone")}` : ""}
            </p>
            <TouchButton type="submit" disabled={pending === block.id}>
              {t("common.save")}
            </TouchButton>
            <div className="grid gap-3 sm:grid-cols-2">
              <TouchButton
                variant="secondary"
                disabled={pending === block.id}
                onClick={async () => {
                  setPending(block.id);
                  const result = await addYardRowAction(block.id);
                  setPending(null);
                  if (!result.ok) {
                    setError(t(`errors.${result.code}`));
                    return;
                  }
                  router.refresh();
                }}
              >
                {t("admin.addRow")}
              </TouchButton>
              <TouchButton
                variant="secondary"
                disabled={pending === block.id}
                onClick={async () => {
                  setPending(block.id);
                  const result = await addYardPositionAction(block.id);
                  setPending(null);
                  if (!result.ok) {
                    setError(t(`errors.${result.code}`));
                    return;
                  }
                  router.refresh();
                }}
              >
                {t("admin.addPosition")}
              </TouchButton>
            </div>
          </form>
        );
      })}
    </div>
  );
}
