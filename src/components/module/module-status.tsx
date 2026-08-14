"use client";

import {useTranslations} from "next-intl";
import type {ModuleStatus} from "@/types/database";

export function ModuleStatusBadge({status}: {status: ModuleStatus}) {
  const t = useTranslations("status");
  const rented = status === "RENTED";

  return (
    <span
      className={`inline-flex min-h-8 items-center px-3 text-xs font-black tracking-wide uppercase ${
        rented
          ? "bg-loxam-rented-soft text-loxam-rented"
          : "bg-loxam-free-soft text-loxam-free"
      }`}
    >
      {t(status)}
    </span>
  );
}
