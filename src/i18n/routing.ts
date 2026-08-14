import {defineRouting} from "next-intl/routing";

export const routing = defineRouting({
  locales: ["nl", "fr"],
  defaultLocale: "nl",
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];

export const localeLabels: Record<AppLocale, string> = {
  nl: "Nederlands",
  fr: "Français",
};
