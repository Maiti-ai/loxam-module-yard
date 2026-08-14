"use client";

import {useState} from "react";
import {useTranslations} from "next-intl";
import {useRouter} from "@/i18n/navigation";
import {SchelleYardMap} from "@/components/yard/schelle-yard-map";
import {YardLegend} from "@/components/yard/yard-legend";
import {YardPosition} from "@/components/yard/yard-position";
import {LevelStack} from "@/components/yard/level-stack";
import {EmptyState} from "@/components/ui/page-state";
import {TouchButton} from "@/components/ui/touch-button";
import {formatCodeNumber} from "@/lib/format";
import type {YardPositionNode, YardSnapshot} from "@/features/yard-locations/types";

export function YardMap({snapshot}: {snapshot: YardSnapshot}) {
  const t = useTranslations();
  const router = useRouter();
  const [blockId, setBlockId] = useState<string | null>(
    snapshot.blocks.length === 1 ? snapshot.blocks[0].id : null,
  );
  const [position, setPosition] = useState<YardPositionNode | null>(null);

  const block = snapshot.blocks.find((item) => item.id === blockId) ?? null;

  if (snapshot.blocks.length === 0) {
    return <EmptyState title={t("empty.title")} body={t("yard.empty")} />;
  }

  return (
    <div className="space-y-6">
      <YardLegend />
      <p className="text-base font-bold text-loxam-muted">{t("yard.tapHint")}</p>
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SchelleYardMap
          snapshot={snapshot}
          selectedBlockId={blockId}
          onSelectBlock={(id) => {
            setBlockId(id);
            setPosition(null);
          }}
        />
        {block ? (
          <div className="space-y-5 border-4 border-loxam-black bg-white p-4">
            <p className="text-xs font-bold tracking-[0.2em] text-loxam-muted uppercase">
              {t("move.block")} {block.code}
              {block.productionZone ? ` · ${t("move.productionZone")}` : ""}
            </p>
            <p className="text-sm font-bold text-loxam-muted">{t("move.backOfYard")}</p>
            {block.rows.map((row, index) => (
              <div key={row.id}>
                <p className="mb-3 text-xl font-black">
                  {t("move.row")} {formatCodeNumber(row.code)}
                </p>
                <div className="flex flex-wrap gap-3">
                  {row.positions.map((item) => (
                    <YardPosition
                      key={item.id}
                      position={item}
                      selected={position?.id === item.id}
                      onSelect={() => setPosition(item)}
                    />
                  ))}
                </div>
                {index === block.rows.length - 1 ? (
                  <p className="mt-3 text-sm font-bold text-loxam-muted">
                    {t("move.frontOfYard")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="border border-dashed border-loxam-line bg-white p-6 text-lg font-bold text-loxam-muted">
            {t("yard.tapHint")}
          </p>
        )}
      </div>
      {block && position ? (
        <div className="space-y-4">
          <h2 className="text-3xl font-black">
            {block.code} · {t("move.row")} {formatCodeNumber(
              block.rows.find((row) => row.positions.some((item) => item.id === position.id))
                ?.code ?? "",
            )}{" "}
            · {t("move.position")} {formatCodeNumber(position.code)}
          </h2>
          <LevelStack
            levels={position.levels}
            onSelect={(cell) => {
              if (cell.occupant) {
                router.push(`/modules/${cell.occupant.moduleNumber}`);
              }
            }}
          />
          <TouchButton variant="ghost" onClick={() => setPosition(null)}>
            {t("common.back")}
          </TouchButton>
        </div>
      ) : null}
    </div>
  );
}
