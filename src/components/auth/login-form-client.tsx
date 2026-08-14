"use client";

import {useSyncExternalStore} from "react";
import {useTranslations} from "next-intl";
import {LoginForm} from "@/components/auth/login-form";

const subscribe = () => () => {};

function useIsClient() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

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

export function LoginFormClient({locale}: {locale: string}) {
  const isClient = useIsClient();

  if (!isClient) {
    return <LoginFormSkeleton />;
  }

  return <LoginForm locale={locale} />;
}
