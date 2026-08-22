export const APP_ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "SLOT_OCCUPIED",
  "SLOT_MISSING",
  "POSITION_FULL",
  "MOVE_FAILED",
  "DISPATCH_REQUIRED",
  "DOSSIER_EXISTS",
  "DOSSIER_FULL",
  "INSUFFICIENT_SPACE",
  "POSITION_RESERVED",
  "MODULE_IN_DOSSIER",
  "MODULE_UNAVAILABLE",
  "DISPATCH_FAILED",
  "DISPATCH_INCOMPLETE",
  "DISPATCH_WRONG_COUNT",
  "DISPATCH_ALREADY_ACTIVE",
  "DISPATCH_DESTINATION_MUST_BE_F",
  "DISPATCH_NOT_IN_F",
  "PRODUCTION_NOT_READY",
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
  stage?: string | null;
  serverStage?: string | null;
  thrownName?: string | null;
  dbCode?: string | null;
  dbMessage?: string | null;
  dbDetails?: string | null;
  dbHint?: string | null;
  insertReached?: boolean;
  insertSucceeded?: boolean;
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
