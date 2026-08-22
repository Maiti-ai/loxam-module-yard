import type {
  DispatchDossierStatus,
  DispatchProductionStatus,
  DispatchSlotStatus,
  StackLevel,
} from "@/types/database";
import type {ModuleSummary} from "@/features/yard-locations/types";

export type DispatchReservationSummary = {
  dossierId: string;
  dossierNumber: string;
  customerName: string;
  siteLocation: string;
  placedCount: number;
  totalModules: number;
  status: DispatchDossierStatus;
};

export type DispatchSlotView = {
  id: string;
  sequenceNumber: number;
  level: StackLevel;
  status: DispatchSlotStatus;
  productionStatus: DispatchProductionStatus | null;
  placedInProductionAt: string | null;
  productionReadyAt: string | null;
  moduleId: string | null;
  moduleNumber: string | null;
  placedAt: string | null;
  positionId: string;
  positionOrder: number;
  blockCode: string;
  rowCode: string;
  positionCode: string;
  currentBlockCode: string | null;
};

export type DispatchDossierSummary = {
  id: string;
  dossierNumber: string;
  customerName: string;
  siteLocation: string;
  totalModules: number;
  status: DispatchDossierStatus;
  assignedCount: number;
  placedCount: number;
  inProductionCount: number;
  readyCount: number;
  createdAt: string;
};

export type DispatchDossierDetail = DispatchDossierSummary & {
  positions: Array<{
    id: string;
    positionId: string;
    positionOrder: number;
    blockCode: string;
    rowCode: string;
    positionCode: string;
  }>;
  slots: DispatchSlotView[];
};

export type DispatchAssignment = {
  dossierId: string;
  dossierNumber: string;
  customerName: string;
  siteLocation: string;
  totalModules: number;
  sequenceNumber: number;
  level: StackLevel;
  status: DispatchSlotStatus;
  productionStatus: DispatchProductionStatus | null;
  placedAt: string | null;
  positionId: string;
  blockCode: string;
  rowCode: string;
  positionCode: string;
  moduleId: string;
  moduleNumber: string;
};

export type DispatchModuleFlow =
  | {kind: "none"}
  | {kind: "to_production"; assignment: DispatchAssignment}
  | {kind: "in_production"; assignment: DispatchAssignment}
  | {kind: "ready_for_dispatch"; assignment: DispatchAssignment}
  | {kind: "in_dispatch"; assignment: DispatchAssignment};

export type DispatchSelectableModule = {
  module: ModuleSummary;
  selectable: boolean;
  reason: "in_other_dossier" | "unavailable" | "in_dispatch_zone" | null;
};
