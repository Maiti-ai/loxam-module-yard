export type Movement = {
  id: string;
  moduleId: string;
  fromLocationId: string | null;
  toLocationId: string | null;
  movedBy: string | null;
  movedAt: string;
  notes: string | null;
};
