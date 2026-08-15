"use client";

import {useTranslations} from "next-intl";
import {SCHELLE_YARD, geometryForBlock, polygonPoints} from "@/config/yard-geometry";
import type {BlockGeometry, YardLandmark} from "@/config/yard-geometry";
import {primaryOccupant} from "@/features/yard-locations/queries-client";
import {formatRowCode} from "@/lib/format";
import type {YardBlockNode, YardSnapshot} from "@/features/yard-locations/types";

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

function fillForBlock(block: YardBlockNode, selected: boolean) {
  if (selected) {
    return "#c41e3a";
  }
  if (block.productionZone) {
    return "#0b5cab";
  }
  const {occupied, total} = occupancy(block);
  if (total > 0 && occupied === 0) {
    return "#1f8a4c";
  }
  if (occupied > 0) {
    return "#161616";
  }
  return "#5c5c5c";
}

function LandmarkShape({landmark}: {landmark: YardLandmark}) {
  const t = useTranslations();
  if (landmark.kind === "pavement" || landmark.kind === "road") {
    return (
      <rect
        x={landmark.x}
        y={landmark.y}
        width={landmark.width}
        height={landmark.height}
        fill={landmark.kind === "road" ? "#8f8a84" : "#cfc8be"}
      />
    );
  }
  if (landmark.kind === "building") {
    const shape = landmark.points ? (
      <polygon
        points={polygonPoints(landmark.points)}
        fill="#f4f2f0"
        stroke="#161616"
        strokeWidth="4"
      />
    ) : (
      <rect
        x={landmark.x}
        y={landmark.y}
        width={landmark.width}
        height={landmark.height}
        fill="#f4f2f0"
        stroke="#161616"
        strokeWidth="4"
      />
    );
    return (
      <g>
        {shape}
        <text
          x={landmark.x + landmark.width / 2}
          y={landmark.y + Math.min(landmark.height, 400) / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#161616"
          fontSize="22"
          fontWeight="800"
          style={{textTransform: "uppercase"}}
        >
          {t("yard.building")}
        </text>
      </g>
    );
  }
  if (landmark.kind === "gate") {
    return (
      <g>
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
          fontSize="14"
          fontWeight="800"
        >
          {t("yard.gate")}
        </text>
      </g>
    );
  }
  const cx = landmark.x + landmark.width / 2;
  const cy = landmark.y + landmark.height / 2;
  const rotate = landmark.rotate
    ? `rotate(${landmark.rotate} ${cx} ${cy})`
    : undefined;
  return (
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      dominantBaseline="middle"
      fill="#161616"
      fontSize="18"
      fontWeight="800"
      transform={rotate}
      style={{textTransform: "uppercase", letterSpacing: "0.14em"}}
    >
      {landmark.label}
    </text>
  );
}

export function SchelleYardMap({
  snapshot,
  selectedBlockId,
  onSelectBlock,
}: {
  snapshot: YardSnapshot;
  selectedBlockId?: string | null;
  onSelectBlock: (blockId: string) => void;
}) {
  const t = useTranslations();
  const {width, height} = SCHELLE_YARD.viewBox;
  const visibleBlocks = snapshot.blocks.filter((block) => block.isActive);

  return (
    <div className="overflow-x-auto border-4 border-loxam-black bg-[#ece7e0]">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full min-h-72"
        role="img"
        aria-label={t("yard.title")}
      >
        <rect width={width} height={height} fill="#d9d3cb" />
        <polygon
          points={polygonPoints(SCHELLE_YARD.site.polygon)}
          fill="#8faf7a"
          stroke="#161616"
          strokeWidth="5"
        />
        <polygon points={polygonPoints(SCHELLE_YARD.pavement.polygon)} fill="#cfc8be" />

        {SCHELLE_YARD.landmarks.map((landmark) => (
          <LandmarkShape key={landmark.id} landmark={landmark} />
        ))}

        <text x={width / 2} y={38} textAnchor="middle" fill="#3d4a38" fontSize="16" fontWeight="700">
          {t("move.backOfYard")}
        </text>
        <text
          x={width / 2}
          y={height - 18}
          textAnchor="middle"
          fill="#5c5c5c"
          fontSize="16"
          fontWeight="700"
        >
          {t("move.frontOfYard")}
        </text>

        {visibleBlocks.map((block) => {
          const geom = geometryForBlock(block.code);
          if (!geom) {
            return null;
          }
          const selected = block.id === selectedBlockId;
          const {occupied, total} = occupancy(block);
          const fill = fillForBlock(block, selected);
          const compact = geom.width < 160 || geom.height < 160;
          return (
            <g key={block.id}>
              <rect
                x={geom.x}
                y={geom.y}
                width={geom.width}
                height={geom.height}
                fill={selected ? "#c41e3a" : "#ffffff"}
                stroke={fill}
                strokeWidth={selected ? 8 : 5}
                className="cursor-pointer"
                onClick={() => onSelectBlock(block.id)}
              />
              <BlockMiniGrid
                block={block}
                geom={geom}
                x={geom.x}
                y={geom.y}
                width={geom.width}
                height={geom.height}
              />
              <text
                x={geom.x + (compact ? 8 : 14)}
                y={geom.y + (compact ? 22 : 32)}
                fill={selected ? "#ffffff" : "#161616"}
                fontSize={compact ? 22 : 34}
                fontWeight="900"
                className="pointer-events-none"
              >
                {block.code}
              </text>
              {geom.zoneLabel && geom.zoneLabel !== "storage" && geom.zoneLabel !== "production" ? (
                <text
                  x={geom.x + (compact ? 28 : 56)}
                  y={geom.y + (compact ? 20 : 30)}
                  fill={selected ? "#ffffff" : "#5c5c5c"}
                  fontSize={compact ? 10 : 13}
                  fontWeight="800"
                  className="pointer-events-none"
                >
                  {geom.zoneLabel}
                </text>
              ) : null}
              {block.productionZone ? (
                <text
                  x={geom.x + 8}
                  y={geom.y + geom.height - 10}
                  fill={selected ? "#ffffff" : "#0b5cab"}
                  fontSize="12"
                  fontWeight="800"
                  className="pointer-events-none"
                >
                  {t("move.productionZone")}
                </text>
              ) : (
                <text
                  x={geom.x + geom.width - 10}
                  y={geom.y + (compact ? 20 : 28)}
                  textAnchor="end"
                  fill={selected ? "#ffffff" : "#5c5c5c"}
                  fontSize={compact ? 11 : 14}
                  fontWeight="700"
                  className="pointer-events-none"
                >
                  {occupied}/{total}
                </text>
              )}
              <rect
                x={geom.x}
                y={geom.y}
                width={geom.width}
                height={geom.height}
                fill="transparent"
                className="cursor-pointer"
                onClick={() => onSelectBlock(block.id)}
              >
                <title>
                  {t("move.block")} {block.code}
                </title>
              </rect>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function BlockMiniGrid({
  block,
  geom,
  x,
  y,
  width,
  height,
}: {
  block: YardBlockNode;
  geom: BlockGeometry;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const rows = block.rows;
  if (rows.length === 0) {
    return null;
  }
  const compact = width < 160;
  const padX = compact ? 22 : 36;
  const padTop = compact ? 26 : 40;
  const padBottom = block.productionZone ? 26 : 12;
  const innerW = width - padX - 10;
  const innerH = height - padTop - padBottom;
  const rowH = innerH / rows.length;

  return (
    <g className="pointer-events-none">
      {rows.map((row, rowIndex) => {
        const maxPositions = Math.max(row.positions.length, 1);
        const cellW = innerW / maxPositions;
        const rowY = y + padTop + rowIndex * rowH;
        return (
          <g key={row.id}>
            <text
              x={x + 6}
              y={rowY + rowH / 2 + 4}
              fill="#161616"
              fontSize={Math.min(13, Math.max(8, rowH - 4))}
              fontWeight="800"
            >
              {formatRowCode(row.code)}
            </text>
            {row.positions.map((position, posIndex) => {
              const occupant = primaryOccupant(position);
              const is3x3 = occupant?.moduleTypeCode === "3x3";
              const drawIndex = geom.positionsLeftToRight ? posIndex : maxPositions - 1 - posIndex;
              const cellX = x + padX + drawIndex * cellW;
              const moduleW = is3x3 ? cellW * 0.48 : cellW * 0.86;
              const moduleH = rowH * 0.62;
              const occupied = position.levels.some((level) => level.occupant);
              const rented = position.levels.some((level) => level.occupant?.status === "RENTED");
              return (
                <rect
                  key={position.id}
                  x={cellX + (cellW - moduleW) / 2}
                  y={rowY + (rowH - moduleH) / 2}
                  width={Math.max(moduleW, 3)}
                  height={Math.max(moduleH, 3)}
                  fill={occupied ? (rented ? "#0b5cab" : "#c41e3a") : "#1f8a4c"}
                  opacity={occupied ? 0.9 : 0.35}
                />
              );
            })}
          </g>
        );
      })}
    </g>
  );
}
