import type {ModuleStatus, ModuleTypeCode, StackLevel} from "@/types/database";

export type YardLocation = {
  slotId: string;
  blockId: string;
  blockCode: string;
  rowId: string;
  rowCode: string;
  positionId: string;
  positionCode: string;
  level: StackLevel;
};

export type AircoSummary = {
  id: string;
  brand: string;
  serialNumber: string;
  internalNumber: string;
  lastMaintenanceAt: string | null;
  notes: string | null;
};

export type ModuleSummary = {
  id: string;
  moduleNumber: string;
  moduleTypeCode: ModuleTypeCode;
  lengthM: number;
  widthM: number;
  status: ModuleStatus;
  rentedToProject: string | null;
  notes: string | null;
  location: YardLocation | null;
  airco: AircoSummary | null;
};

export type Occupant = {
  moduleId: string;
  moduleNumber: string;
  status: ModuleStatus;
};

export type YardLevelCell = {
  slotId: string;
  level: StackLevel;
  occupant: Occupant | null;
};

export type YardPositionNode = {
  id: string;
  code: string;
  sortOrder: number;
  levels: YardLevelCell[];
};

export type YardRowNode = {
  id: string;
  code: string;
  sortOrder: number;
  positions: YardPositionNode[];
};

export type YardBlockNode = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  productionZone: boolean;
  rows: YardRowNode[];
};

export type YardSnapshot = {
  blocks: YardBlockNode[];
  slotCount: number;
  occupiedSlotCount: number;
};
