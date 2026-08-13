"use client";

import {useState} from "react";
import {useTranslations} from "next-intl";
import {TouchButton} from "@/components/ui/touch-button";

export function LoginForm({locale}: {locale: string}) {
  const t = useTranslations("login");
  const [pending, setPending] = useState(false);

  return (
    <form
      action="/auth/login"
      method="post"
      className="mt-8 max-w-md space-y-4"
      onSubmit={() => setPending(true)}
    >
      <input type="hidden" name="locale" value={locale} />
      <label className="block">
        <span className="text-xs font-bold tracking-[0.18em] text-loxam-muted uppercase">
          {t("email")}
        </span>
        <input
          type="email"
          name="email"
          autoComplete="username"
          required
          className="mt-2 min-h-14 w-full border-2 border-loxam-black bg-white px-3 text-base text-loxam-black outline-none"
        />
      </label>
      <label className="block">
        <span className="text-xs font-bold tracking-[0.18em] text-loxam-muted uppercase">
          {t("password")}
        </span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          className="mt-2 min-h-14 w-full border-2 border-loxam-black bg-white px-3 text-base text-loxam-black outline-none"
        />
      </label>
      <TouchButton type="submit" disabled={pending}>
        {pending ? t("pending") : t("submit")}
      </TouchButton>
    </form>
  );
}
