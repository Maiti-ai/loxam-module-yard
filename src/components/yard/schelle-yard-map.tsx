"use client";

import {useTranslations} from "next-intl";
import {
  SCHELLE_YARD,
  geometryForBlock,
  layoutSpecForBlock,
  polygonPoints,
} from "@/config/yard-geometry";
import type {BlockGeometry} from "@/config/yard-geometry";
import {isProductionBlock} from "@/config/yard";
import {primaryOccupant} from "@/features/yard-locations/queries-client";
import {formatRowCode} from "@/lib/format";
import type {
  Occupant,
  YardBlockNode,
  YardPositionNode,
  YardRowNode,
  YardSnapshot,
} from "@/features/yard-locations/types";

function occupancy(block: YardBlockNode) {
  let occupied = 0;
  let total = 0;
  for (const row of block.rows) {
    for (const position of row.positions) {
      total += position.levels.length;
      occupied += position.levels.filter((level) => level.occupant).length;
    }
  }
  return {occupied, total};
}

function rowKey(code: string) {
  return formatRowCode(code).toUpperCase();
}

function positionKey(code: string) {
  const numeric = Number(code);
  return Number.isFinite(numeric) ? String(numeric) : code.trim();
}

function emptyPosition(blockCode: string, rowCode: string, index: number): YardPositionNode {
  return {
    id: `visual:${blockCode}:${rowCode}:${index + 1}`,
    code: String(index + 1).padStart(2, "0"),
    sortOrder: index + 1,
    levels: [],
  };
}

/** Plan grid from the spec, with live occupancy overlaid when the DB has matching cells. */
export function displayBlocks(snapshot: YardSnapshot): YardBlockNode[] {
  const liveByCode = new Map(
    snapshot.blocks
      .filter((block) => block.isActive)
      .map((block) => [block.code.trim().toUpperCase(), block]),
  );

  return Object.keys(SCHELLE_YARD.blocks).map((code, sortOrder) => {
    const spec = layoutSpecForBlock(code);
    const live = liveByCode.get(code);
    if (!spec) {
      return (
        live ?? {
          id: `visual:${code}`,
          code,
          name: `Block ${code}`,
          sortOrder,
          isActive: true,
          productionZone: isProductionBlock(code),
          rows: [],
        }
      );
    }

    const liveRows = new Map((live?.rows ?? []).map((row) => [rowKey(row.code), row]));
    const rows: YardRowNode[] = spec.pRows.map((pCode, rowIndex) => {
      const liveRow = liveRows.get(pCode);
      const livePositions = new Map(
        (liveRow?.positions ?? []).map((position) => [positionKey(position.code), position]),
      );
      const positions = Array.from({length: spec.positionsPerRow}, (_, index) => {
        return livePositions.get(String(index + 1)) ?? emptyPosition(code, pCode, index);
      });
      return {
        id: liveRow?.id ?? `visual:${code}:${pCode}`,
        code: liveRow?.code ?? pCode,
        sortOrder: rowIndex + 1,
        positions,
      };
    });

    return {
      id: live?.id ?? `visual:${code}`,
      code,
      name: live?.name ?? `Block ${code}`,
      sortOrder: live?.sortOrder ?? sortOrder,
      isActive: true,
      productionZone: isProductionBlock(code) || Boolean(live?.productionZone),
      rows,
    };
  });
}

function slotFill(occupant: Occupant | null, selected: boolean) {
  if (selected) {
    return "#c41e3a";
  }
  if (!occupant) {
    return "#1f8a4c";
  }
  if (occupant.status === "RENTED") {
    return "#0b5cab";
  }
  return "#c41e3a";
}

function LandmarkLayer() {
  const t = useTranslations();
  return (
    <>
      {SCHELLE_YARD.landmarks.map((landmark) => {
        if (landmark.kind === "building") {
          return (
            <g key={landmark.id}>
              <rect
                x={landmark.x}
                y={landmark.y}
                width={landmark.width}
                height={landmark.height}
                fill="#f3f4f6"
                stroke="#161616"
                strokeWidth="5"
              />
              <text
                x={landmark.x + landmark.width / 2}
                y={landmark.y + landmark.height / 2 - 12}
                textAnchor="middle"
                fill="#161616"
                fontSize="28"
                fontWeight="800"
                style={{textTransform: "uppercase"}}
              >
                {t("yard.building")}
              </text>
              <text
                x={landmark.x + landmark.width / 2}
                y={landmark.y + landmark.height / 2 + 22}
                textAnchor="middle"
                fill="#5c5c5c"
                fontSize="16"
                fontWeight="700"
                style={{textTransform: "uppercase"}}
              >
                {t("yard.office")}
              </text>
            </g>
          );
        }
        if (landmark.kind === "gate") {
          return (
            <g key={landmark.id}>
              <rect
                x={landmark.x}
                y={landmark.y}
                width={landmark.width}
                height={landmark.height}
                fill="#c41e3a"
              />
              <text
                x={landmark.x + landmark.width / 2}
                y={landmark.y + landmark.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#ffffff"
                fontSize="22"
                fontWeight="800"
              >
                {t("yard.gate")}
              </text>
            </g>
          );
        }
        const cx = landmark.x + landmark.width / 2;
        const cy = landmark.y + landmark.height / 2;
        return (
          <text
            key={landmark.id}
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#161616"
            fontSize="22"
            fontWeight="800"
            transform={landmark.rotate ? `rotate(${landmark.rotate} ${cx} ${cy})` : undefined}
            style={{textTransform: "uppercase", letterSpacing: "0.16em"}}
          >
            {landmark.label}
          </text>
        );
      })}
    </>
  );
}

export function SchelleYardMap({
  snapshot,
  selectedBlockId,
  selectedRowId,
  selectedPositionId,
  onSelectBlock,
  onSelectRow,
  onSelectPosition,
}: {
  snapshot: YardSnapshot;
  selectedBlockId?: string | null;
  selectedRowId?: string | null;
  selectedPositionId?: string | null;
  onSelectBlock: (blockId: string) => void;
  onSelectRow?: (blockId: string, rowId: string) => void;
  onSelectPosition?: (blockId: string, position: YardPositionNode) => void;
}) {
  const t = useTranslations();
  const {width, height} = SCHELLE_YARD.viewBox;
  const blocks = displayBlocks(snapshot);

  return (
    <div className="overflow-auto border-4 border-loxam-black bg-[#d4cfc6]">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full min-h-[70vh] min-w-[920px] lg:min-h-[82vh]"
        role="img"
        aria-label={t("yard.title")}
      >
        <rect width={width} height={height} fill="#cfc8be" />
        <polygon
          points={polygonPoints(SCHELLE_YARD.site.polygon)}
          fill="#7f9a6c"
          stroke="#161616"
          strokeWidth="7"
        />
        <polygon points={polygonPoints(SCHELLE_YARD.yardSurface.polygon)} fill="#8d8983" />
        {SCHELLE_YARD.roads.map((road) => (
          <rect
            key={road.id}
            x={road.x}
            y={road.y}
            width={road.width}
            height={road.height}
            fill="#7f7b76"
            rx="10"
          />
        ))}

        <text x={width / 2} y={64} textAnchor="middle" fill="#2f3d2c" fontSize="26" fontWeight="800">
          {t("move.backOfYard")}
        </text>
        <text
          x={width / 2}
          y={height - 24}
          textAnchor="middle"
          fill="#161616"
          fontSize="24"
          fontWeight="800"
        >
          {t("move.frontOfYard")}
        </text>

        {blocks.map((block) => {
          const geom = geometryForBlock(block.code);
          if (!geom) {
            return null;
          }
          return (
            <BlockPad
              key={block.id}
              block={block}
              geom={geom}
              selected={block.id === selectedBlockId}
              selectedRowId={selectedRowId}
              selectedPositionId={selectedPositionId}
              onSelectBlock={onSelectBlock}
              onSelectRow={onSelectRow}
              onSelectPosition={onSelectPosition}
            />
          );
        })}

        <LandmarkLayer />
      </svg>
    </div>
  );
}

function BlockPad({
  block,
  geom,
  selected,
  selectedRowId,
  selectedPositionId,
  onSelectBlock,
  onSelectRow,
  onSelectPosition,
}: {
  block: YardBlockNode;
  geom: BlockGeometry;
  selected: boolean;
  selectedRowId?: string | null;
  selectedPositionId?: string | null;
  onSelectBlock: (blockId: string) => void;
  onSelectRow?: (blockId: string, rowId: string) => void;
  onSelectPosition?: (blockId: string, position: YardPositionNode) => void;
}) {
  const t = useTranslations();
  const {occupied, total} = occupancy(block);
  const production = block.productionZone;
  const padFill = selected ? "#f8d5d8" : production ? "#d5e4f4" : "#f7f4ef";
  const stroke = selected ? "#c41e3a" : production ? "#0b5cab" : "#161616";

  return (
    <g>
      <rect
        x={geom.x}
        y={geom.y}
        width={geom.width}
        height={geom.height}
        fill={padFill}
        stroke={stroke}
        strokeWidth={selected ? 8 : 5}
        className="cursor-pointer"
        onClick={() => onSelectBlock(block.id)}
      />
      <BlockSlotGrid
        block={block}
        geom={geom}
        selectedRowId={selectedRowId}
        selectedPositionId={selectedPositionId}
        onSelectBlock={onSelectBlock}
        onSelectRow={onSelectRow}
        onSelectPosition={onSelectPosition}
      />
      <text
        x={geom.x + 18}
        y={geom.y + 44}
        fill="#161616"
        fontSize="42"
        fontWeight="900"
        className="pointer-events-none"
      >
        {block.code}
      </text>
      {geom.zoneLabel ? (
        <text
          x={geom.x + 78}
          y={geom.y + 42}
          fill={production ? "#0b5cab" : "#5c5c5c"}
          fontSize="18"
          fontWeight="800"
          className="pointer-events-none"
          style={{textTransform: "uppercase"}}
        >
          {geom.zoneLabel === "production" ? t("move.productionZone") : geom.zoneLabel}
        </text>
      ) : null}
      <text
        x={geom.x + geom.width - 16}
        y={geom.y + 40}
        textAnchor="end"
        fill="#5c5c5c"
        fontSize="18"
        fontWeight="700"
        className="pointer-events-none"
      >
        {occupied}/{total}
      </text>
    </g>
  );
}

function BlockSlotGrid({
  block,
  geom,
  selectedRowId,
  selectedPositionId,
  onSelectBlock,
  onSelectRow,
  onSelectPosition,
}: {
  block: YardBlockNode;
  geom: BlockGeometry;
  selectedRowId?: string | null;
  selectedPositionId?: string | null;
  onSelectBlock: (blockId: string) => void;
  onSelectRow?: (blockId: string, rowId: string) => void;
  onSelectPosition?: (blockId: string, position: YardPositionNode) => void;
}) {
  const rows = block.rows;
  if (rows.length === 0) {
    return null;
  }

  const padLeft = 16;
  const padRight = geom.pRowAxis === "y" ? 52 : 16;
  const padTop = 56;
  const padBottom = 44;
  const innerX = geom.x + padLeft;
  const innerY = geom.y + padTop;
  const innerW = geom.width - padLeft - padRight;
  const innerH = geom.height - padTop - padBottom;

  function selectSlot(row: YardRowNode, position: YardPositionNode) {
    onSelectBlock(block.id);
    onSelectRow?.(block.id, row.id);
    onSelectPosition?.(block.id, position);
  }

  if (geom.pRowAxis === "x") {
    const colW = innerW / rows.length;
    const maxPositions = Math.max(...rows.map((row) => row.positions.length), 1);
    const cellH = innerH / maxPositions;
    return (
      <g>
        {rows.map((row, rowIndex) => {
          const colIndex = rows.length - 1 - rowIndex;
          const colX = innerX + colIndex * colW;
          const rowSelected = row.id === selectedRowId;
          return (
            <g key={row.id}>
              <rect
                x={colX}
                y={innerY}
                width={colW}
                height={innerH}
                fill={rowSelected ? "rgba(196,30,58,0.08)" : "transparent"}
                className="cursor-pointer"
                onClick={() => {
                  onSelectBlock(block.id);
                  onSelectRow?.(block.id, row.id);
                }}
              />
              {row.positions.map((position, posIndex) => {
                const occupant = primaryOccupant(position);
                const is3x3 = occupant?.moduleTypeCode === "3x3";
                const cellY = innerY + posIndex * cellH;
                const slotW = colW * (is3x3 ? 0.42 : 0.72);
                const slotH = cellH * 0.7;
                const selected = position.id === selectedPositionId;
                return (
                  <rect
                    key={position.id}
                    x={colX + (colW - slotW) / 2}
                    y={cellY + (cellH - slotH) / 2}
                    width={Math.max(slotW, 8)}
                    height={Math.max(slotH, 8)}
                    fill={slotFill(occupant, selected)}
                    opacity={occupant ? 0.92 : 0.38}
                    stroke={selected ? "#161616" : "#161616"}
                    strokeWidth={selected ? 3 : 0.6}
                    strokeOpacity={selected ? 1 : 0.15}
                    className="cursor-pointer"
                    onClick={() => selectSlot(row, position)}
                  >
                    <title>
                      {block.code} {formatRowCode(row.code)} {positionKey(position.code)}
                    </title>
                  </rect>
                );
              })}
              <text
                x={colX + colW / 2}
                y={geom.y + geom.height - 12}
                textAnchor="middle"
                fill="#161616"
                fontSize={Math.min(22, Math.max(12, colW * 0.28))}
                fontWeight="800"
                className="pointer-events-none"
              >
                {formatRowCode(row.code)}
              </text>
            </g>
          );
        })}
      </g>
    );
  }

  const rowH = innerH / rows.length;
  const maxPositions = Math.max(...rows.map((row) => row.positions.length), 1);
  const cellW = innerW / maxPositions;

  return (
    <g>
      {rows.map((row, rowIndex) => {
        const rowY = innerY + rowIndex * rowH;
        const rowSelected = row.id === selectedRowId;
        return (
          <g key={row.id}>
            <rect
              x={innerX}
              y={rowY}
              width={innerW}
              height={rowH}
              fill={rowSelected ? "rgba(196,30,58,0.08)" : "transparent"}
              className="cursor-pointer"
              onClick={() => {
                onSelectBlock(block.id);
                onSelectRow?.(block.id, row.id);
              }}
            />
            <text
              x={geom.x + geom.width - 10}
              y={rowY + rowH / 2 + 6}
              textAnchor="end"
              fill="#161616"
              fontSize={Math.min(20, Math.max(11, rowH * 0.45))}
              fontWeight="800"
              className="pointer-events-none"
            >
              {formatRowCode(row.code)}
            </text>
            {row.positions.map((position, posIndex) => {
              const occupant = primaryOccupant(position);
              const is3x3 = occupant?.moduleTypeCode === "3x3";
              const drawIndex = geom.positionsLeftToRight ? posIndex : maxPositions - 1 - posIndex;
              const cellX = innerX + drawIndex * cellW;
              const slotW = cellW * (is3x3 ? 0.42 : 0.78);
              const slotH = rowH * 0.62;
              const selected = position.id === selectedPositionId;
              return (
                <rect
                  key={position.id}
                  x={cellX + (cellW - slotW) / 2}
                  y={rowY + (rowH - slotH) / 2}
                  width={Math.max(slotW, 6)}
                  height={Math.max(slotH, 6)}
                  fill={slotFill(occupant, selected)}
                  opacity={occupant ? 0.92 : 0.38}
                  stroke={selected ? "#161616" : "none"}
                  strokeWidth={selected ? 3 : 0}
                  className="cursor-pointer"
                  onClick={() => selectSlot(row, position)}
                >
                  <title>
                    {block.code} {formatRowCode(row.code)} {positionKey(position.code)}
                  </title>
                </rect>
              );
            })}
          </g>
        );
      })}
      {Array.from({length: maxPositions}, (_, index) => {
        const drawIndex = geom.positionsLeftToRight ? index : maxPositions - 1 - index;
        const cellX = innerX + drawIndex * cellW;
        return (
          <text
            key={`pos-label-${index}`}
            x={cellX + cellW / 2}
            y={geom.y + geom.height - 12}
            textAnchor="middle"
            fill="#161616"
            fontSize={Math.min(18, Math.max(11, cellW * 0.22))}
            fontWeight="800"
            className="pointer-events-none"
          >
            {index + 1}
          </text>
        );
      })}
    </g>
  );
}
