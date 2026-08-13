import type {Metadata} from "next";
import {Geist} from "next/font/google";
import {hasLocale, NextIntlClientProvider} from "next-intl";
import {getLocale, getTranslations} from "next-intl/server";
import {notFound} from "next/navigation";
import {SiteHeader} from "@/components/layout/site-header";
import {routing} from "@/i18n/routing";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const {locale} = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const currentLocale = await getLocale();

  return (
    <html lang={currentLocale} className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-loxam-paper font-sans text-loxam-ink">
        <NextIntlClientProvider>
          <div className="flex min-h-full flex-col">
            <div className="h-2 bg-loxam-yellow" />
            <SiteHeader />
            <main className="flex-1">{children}</main>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
