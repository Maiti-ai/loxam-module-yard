"use client";

import {useLocale} from "next-intl";
import {localeLabels, type AppLocale, routing} from "@/i18n/routing";
import {usePathname, useRouter} from "@/i18n/navigation";

export function LanguageSwitcher({variant = "dark"}: {variant?: "dark" | "light"}) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1" aria-label="Language">
      {routing.locales.map((value) => {
        const active = value === locale;
        const base =
          variant === "light"
            ? active
              ? "bg-loxam-red text-white"
              : "text-loxam-black"
            : active
              ? "bg-white text-loxam-red"
              : "text-white/80";

        return (
          <button
            key={value}
            type="button"
            onClick={() => router.replace(pathname, {locale: value})}
            className={`min-h-11 min-w-11 px-2 text-sm font-black ${base}`}
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
