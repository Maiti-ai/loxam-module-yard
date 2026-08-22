import type {
  DispatchDossierStatus,
  DispatchProductionStatus,
  DispatchSlotStatus,
  StackLevel,
} from "@/types/database";

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
  moduleId: string | null;
  moduleNumber: string | null;
  placedAt: string | null;
  shippedAt: string | null;
  returnedAt: string | null;
  returnBlockCode: string | null;
  returnRowCode: string | null;
  returnPositionCode: string | null;
  returnLevel: StackLevel | null;
  positionId: string;
  positionOrder: number;
  blockCode: string;
  rowCode: string;
  positionCode: string;
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
  shippedCount: number;
  returnedCount: number;
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
  shippedAt: string | null;
  returnedAt: string | null;
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
  | {kind: "ready_for_dispatch"; assignment: DispatchAssignment}
  | {kind: "ready_to_ship"; assignment: DispatchAssignment}
  | {kind: "on_rent"; assignment: DispatchAssignment}
  | {kind: "returned"; assignment: DispatchAssignment};
