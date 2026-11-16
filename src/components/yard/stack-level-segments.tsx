"use client";

import {YARD_MAP_FR} from "@/config/yard-geometry";
import {formatLevelCode} from "@/lib/format";
import type {DispatchLevelReservationSummary, DispatchReservationSummary} from "@/features/dispatch/types";
import {
  STACK_LEVELS_BOTTOM_UP,
  STACK_LEVEL_NUMBER,
  type StackOccupancyCell,
} from "@/features/yard-locations/stacking";
import type {Occupant, YardLevelCell} from "@/features/yard-locations/types";
import type {StackLevel} from "@/types/database";

function segmentFill(
  occupant: Occupant | null,
  reservation?: DispatchLevelReservationSummary | DispatchReservationSummary,
) {
  if (occupant) {
    if (occupant.status === "RENTED") {
      return "#0b5cab";
    }
    return "#c41e3a";
  }
  if (reservation) {
    return "#d97706";
  }
  return "#1f8a4c";
}

function segmentTitle(
  baseLabel: string,
  level: StackLevel,
  occupant: Occupant | null,
  reservation?: DispatchLevelReservationSummary,
) {
  const lines = [baseLabel, `Niveau ${formatLevelCode(level)}`];
  if (occupant) {
    lines.push(occupant.moduleNumber);
  } else if (reservation) {
    lines.push(YARD_MAP_FR.reserved, reservation.dossierNumber);
    if (reservation.moduleNumber) {
      lines.push(reservation.moduleNumber);
    }
  }
  return lines.join("\n");
}

export function StackLevelSegments({
  x,
  y,
  width,
  height,
  levels,
  maxStackLevels,
  baseLabel,
  positionReservation,
  selectedLevel,
  highlightLevel,
  levelSelectable,
  onSelectLevel,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  levels: YardLevelCell[];
  maxStackLevels: number;
  baseLabel: string;
  positionReservation?: DispatchReservationSummary;
  selectedLevel?: StackLevel | null;
  highlightLevel?: StackLevel | null;
  levelSelectable?: boolean;
  onSelectLevel?: (level: StackLevel) => void;
}) {
  const visibleLevels = STACK_LEVELS_BOTTOM_UP.filter(
    (level) => STACK_LEVEL_NUMBER[level] < maxStackLevels,
  );
  const segmentCount = Math.max(visibleLevels.length, 1);
  const gap = segmentCount > 1 ? 1.2 : 0;
  const segmentWidth = (width - gap * (segmentCount - 1)) / segmentCount;

  if (segmentCount === 1) {
    const level = visibleLevels[0] ?? "GROUND";
    const cell = levels.find((item) => item.level === level);
    const occupant = cell?.occupant ?? null;
    const reservation = cell?.reservation ?? positionReservation;
    const ring =
      selectedLevel === level || highlightLevel === level ? "#c41e3a" : "transparent";
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={segmentFill(occupant, reservation)}
          stroke={ring !== "transparent" ? ring : "#161616"}
          strokeWidth={ring !== "transparent" ? 3 : 2}
          strokeOpacity={ring !== "transparent" ? 1 : 0.22}
          rx={1.4}
          className={levelSelectable ? "yard-pos-hit" : undefined}
          onClick={
            levelSelectable
              ? (event) => {
                  event.stopPropagation();
                  onSelectLevel?.(level);
                }
              : undefined
          }
        >
          <title>{segmentTitle(baseLabel, level, occupant, cell?.reservation)}</title>
        </rect>
      </g>
    );
  }

  return (
    <g>
      {visibleLevels.map((level, index) => {
        const cell = levels.find((item) => item.level === level);
        const occupant = cell?.occupant ?? null;
        const reservation = cell?.reservation;
        const segX = x + index * (segmentWidth + gap);
        const selected = selectedLevel === level;
        const highlighted = highlightLevel === level;
        const ring = selected ? "#c41e3a" : highlighted ? "#d97706" : "#161616";
        const ringWidth = selected || highlighted ? 3 : 2;

        return (
          <g key={level}>
            {levelSelectable ? (
              <rect
                x={segX - 0.5}
                y={y - 0.5}
                width={segmentWidth + 1}
                height={height + 1}
                fill="transparent"
                className="yard-pos-hit"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectLevel?.(level);
                }}
              />
            ) : null}
            <rect
              x={segX}
              y={y}
              width={segmentWidth}
              height={height}
              fill={segmentFill(occupant, reservation)}
              stroke={ring}
              strokeWidth={ringWidth}
              strokeOpacity={selected || highlighted ? 1 : 0.22}
              rx={1.2}
              pointerEvents="none"
            >
              <title>{segmentTitle(baseLabel, level, occupant, reservation)}</title>
            </rect>
            {segmentWidth >= 10 ? (
              <text
                x={segX + segmentWidth / 2}
                y={y + height - 2}
                textAnchor="middle"
                fill="#ffffff"
                fontSize={Math.min(11, segmentWidth * 0.42)}
                fontWeight="800"
                pointerEvents="none"
                opacity={0.92}
              >
                {formatLevelCode(level)}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

export function levelCellForChoice(
  levels: YardLevelCell[],
  level: StackLevel,
): StackOccupancyCell | null {
  return levels.find((item) => item.level === level) ?? null;
}
