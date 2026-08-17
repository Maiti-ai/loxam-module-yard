"use client";

import {useState} from "react";
import {useTranslations} from "next-intl";
import {SchelleYardMap, displayBlocks} from "@/components/yard/schelle-yard-map";
import {PositionDetailPanel} from "@/components/yard/position-detail";
import {YardLegend} from "@/components/yard/yard-legend";
import {YardPosition} from "@/components/yard/yard-position";
import {EmptyState} from "@/components/ui/page-state";
import {formatRowCode} from "@/lib/format";
import type {YardPositionNode, YardSnapshot} from "@/features/yard-locations/types";

export function YardMap({snapshot}: {snapshot: YardSnapshot}) {
  const t = useTranslations();
  const blocks = displayBlocks(snapshot);
  const [blockId, setBlockId] = useState<string | null>(
    blocks.length === 1 ? blocks[0].id : null,
  );
  const [rowId, setRowId] = useState<string | null>(null);
  const [position, setPosition] = useState<YardPositionNode | null>(null);

  const block = blocks.find((item) => item.id === blockId) ?? null;
  const row =
    block?.rows.find((item) => item.positions.some((entry) => entry.id === position?.id)) ??
    block?.rows.find((item) => item.id === rowId) ??
    null;

  if (snapshot.blocks.length === 0 && blocks.length === 0) {
    return <EmptyState title={t("empty.title")} body={t("yard.empty")} />;
  }

  return (
    <div className="space-y-6">
      <YardLegend />
      <p className="text-base font-bold text-loxam-muted">{t("yard.tapPosition")}</p>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SchelleYardMap
          snapshot={snapshot}
          selectedBlockId={blockId}
          selectedRowId={rowId}
          selectedPositionId={position?.id}
          onSelectBlock={(id) => {
            setBlockId(id);
            setRowId(null);
            setPosition(null);
          }}
          onSelectRow={(_blockId, nextRowId) => {
            setRowId(nextRowId);
            setPosition(null);
          }}
          onSelectPosition={(_blockId, nextPosition) => {
            setPosition(nextPosition);
          }}
        />
        {block && position && row ? (
          <PositionDetailPanel
            blockCode={block.code}
            rowCode={row.code}
            position={position}
            onClose={() => setPosition(null)}
          />
        ) : block ? (
          <div className="space-y-5 border-4 border-loxam-black bg-white p-4">
            <p className="text-xs font-bold tracking-[0.2em] text-loxam-muted uppercase">
              {t("move.block")} {block.code}
              {block.productionZone ? ` · ${t("move.productionZone")}` : ""}
            </p>
            <div className="flex flex-row-reverse flex-wrap justify-start gap-2">
              {block.rows.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setRowId(item.id);
                    setPosition(null);
                  }}
                  className={`min-h-12 min-w-14 border-4 px-3 text-lg font-black ${
                    item.id === rowId
                      ? "border-loxam-red bg-loxam-red text-white"
                      : "border-loxam-black bg-white"
                  }`}
                >
                  {formatRowCode(item.code)}
                </button>
              ))}
            </div>
            {row && !position ? (
              <div className="space-y-3">
                <p className="text-sm font-bold text-loxam-muted">
                  {formatRowCode(row.code)} · {t("move.position")}
                </p>
                <div className="flex flex-row-reverse flex-wrap justify-start gap-3">
                  {row.positions.map((item) => (
                    <YardPosition
                      key={item.id}
                      position={item}
                      selected={false}
                      onSelect={() => setPosition(item)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm font-bold text-loxam-muted">{t("yard.tapPosition")}</p>
            )}
          </div>
        ) : (
          <p className="border border-dashed border-loxam-line bg-white p-6 text-lg font-bold text-loxam-muted">
            {t("yard.tapPosition")}
          </p>
        )}
      </div>
    </div>
  );
}
