"use client";

import {useLocale, useTranslations} from "next-intl";
import {localeLabels, type AppLocale, routing} from "@/i18n/routing";
import {usePathname, useRouter} from "@/i18n/navigation";

export function LanguageSwitcher() {
  const t = useTranslations("home");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-2">
      <span className="sr-only">{t("languageHint")}</span>
      {routing.locales.map((value) => {
        const active = value === locale;

        return (
          <button
            key={value}
            type="button"
            onClick={() => router.replace(pathname, {locale: value})}
            className={
              active
                ? "rounded-sm bg-loxam-yellow px-2.5 py-1 text-xs font-bold tracking-wide text-loxam-black"
                : "rounded-sm px-2.5 py-1 text-xs font-bold tracking-wide text-white/80 hover:text-white"
            }
            aria-pressed={active}
          >
            {value.toUpperCase()}
            <span className="sr-only"> {localeLabels[value as AppLocale]}</span>
          </button>
        );
      })}
    </div>
  );
}
