"use client";

import {useEffect, useRef, useState} from "react";
import {useTranslations} from "next-intl";

export function LoginForm({locale}: {locale: string}) {
  const t = useTranslations("login");
  const formRef = useRef<HTMLFormElement>(null);
  const [stuck, setStuck] = useState(false);
  const submittingLabel = t.has("submitting")
    ? t("submitting")
    : locale === "fr"
      ? "Connexion..."
      : "Aanmelden...";
  const submitFailedLabel = t.has("submitFailed")
    ? t("submitFailed")
    : locale === "fr"
      ? "La connexion a échoué. Réessayez."
      : "Aanmelden is niet gelukt. Probeer opnieuw.";

  useEffect(() => {
    const form = formRef.current;
    if (!form) {
      return;
    }

    let stuckTimer: number | null = null;

    const onSubmit = () => {
      const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
      if (button) {
        button.textContent = submittingLabel;
      }
      if (stuckTimer !== null) {
        window.clearTimeout(stuckTimer);
      }
      stuckTimer = window.setTimeout(() => setStuck(true), 15000);
    };

    form.addEventListener("submit", onSubmit);
    return () => {
      form.removeEventListener("submit", onSubmit);
      if (stuckTimer !== null) {
        window.clearTimeout(stuckTimer);
      }
    };
  }, [submittingLabel]);

  return (
    <form
      ref={formRef}
      action="/auth/login"
      method="post"
      encType="application/x-www-form-urlencoded"
      className="mt-8 max-w-md space-y-4"
    >
      <input type="hidden" name="locale" value={locale} />
      {stuck ? (
        <p className="border-l-4 border-loxam-red pl-3 text-sm font-bold" role="alert">
          {submitFailedLabel}
        </p>
      ) : null}
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
      <button
        type="submit"
        className="inline-flex min-h-16 w-full items-center justify-center bg-loxam-red px-5 text-lg font-black tracking-wide uppercase text-white"
      >
        {t("submit")}
      </button>
    </form>
  );
}
