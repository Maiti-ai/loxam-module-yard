export type Movement = {
  id: string;
  moduleId: string;
  fromSlotId: string | null;
  toSlotId: string | null;
  movedBy: string | null;
  movedAt: string;
  notes: string | null;
};
