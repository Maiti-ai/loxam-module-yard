export const APP_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "SLOT_OCCUPIED",
  "SLOT_MISSING",
  "POSITION_FULL",
  "MOVE_FAILED",
  "UPLOAD_FAILED",
  "SAVE_FAILED",
  "LOAD_FAILED",
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

export type ActionOk<T = object> = {ok: true} & T;
export type ActionErr = {
  ok: false;
  code: AppErrorCode;
  occupantNumber?: string | null;
  dbCode?: string | null;
  dbMessage?: string | null;
  dbDetails?: string | null;
  dbHint?: string | null;
};
export type ActionResult<T = object> = ActionOk<T> | ActionErr;

export function isUniqueViolation(error: {code?: string; message?: string} | null) {
  if (!error) {
    return false;
  }

  return (
    error.code === "23505" ||
    /duplicate key|unique constraint/i.test(error.message ?? "")
  );
}
