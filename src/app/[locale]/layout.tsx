import type {Metadata, Viewport} from "next";
import {Geist} from "next/font/google";
import {hasLocale, NextIntlClientProvider} from "next-intl";
import {getLocale, getTranslations} from "next-intl/server";
import {notFound} from "next/navigation";
import {AppShell} from "@/components/layout/app-shell";
import {getCurrentProfile} from "@/features/auth";
import {routing} from "@/i18n/routing";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export const viewport: Viewport = {
  themeColor: "#c41e3a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");

  return {
    title: t("title"),
    description: t("description"),
    applicationName: "Loxam Module Yard",
    appleWebApp: {
      capable: true,
      title: "Module Yard",
      statusBarStyle: "black-translucent",
    },
    icons: {
      icon: [
        {url: "/icon-192.png", sizes: "192x192", type: "image/png"},
        {url: "/icon-512.png", sizes: "512x512", type: "image/png"},
      ],
      apple: "/apple-touch-icon.png",
    },
    formatDetection: {
      telephone: false,
    },
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
  const profile = await getCurrentProfile();

  return (
    <html lang={currentLocale} className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-loxam-paper font-sans text-loxam-ink">
        <NextIntlClientProvider>
          <AppShell showNav={Boolean(profile)}>{children}</AppShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
