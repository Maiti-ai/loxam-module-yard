import type {DispatchDossierStatus, DispatchSlotStatus, StackLevel} from "@/types/database";

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
  moduleId: string | null;
  moduleNumber: string | null;
  placedAt: string | null;
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
  placedAt: string | null;
  positionId: string;
  blockCode: string;
  rowCode: string;
  positionCode: string;
  moduleId: string;
  moduleNumber: string;
};
