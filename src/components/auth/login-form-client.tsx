"use client";

import dynamic from "next/dynamic";
import {useTranslations} from "next-intl";

function LoginFormSkeleton() {
  const t = useTranslations("login");

  return (
    <div className="mt-8 max-w-md space-y-4" aria-busy="true" aria-live="polite">
      <p className="text-sm font-bold text-loxam-muted">{t("pending")}</p>
      <div className="min-h-14 border-2 border-loxam-line bg-loxam-paper" />
      <div className="min-h-14 border-2 border-loxam-line bg-loxam-paper" />
      <div className="min-h-16 bg-loxam-line" />
    </div>
  );
}

export const LoginFormClient = dynamic(
  () => import("@/components/auth/login-form").then((mod) => mod.LoginForm),
  {ssr: false, loading: LoginFormSkeleton},
);
