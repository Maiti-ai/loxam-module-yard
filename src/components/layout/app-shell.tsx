import type {ReactNode} from "react";
import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {LanguageSwitcher} from "@/components/layout/language-switcher";
import {SessionControls} from "@/components/auth/session-controls";
import {BottomNav} from "@/components/layout/bottom-nav";
import type {AppRole} from "@/types/database";

const managementNav = [
  {href: "/", key: "home"},
  {href: "/scan", key: "scan"},
  {href: "/yard", key: "yard"},
  {href: "/modules", key: "modules"},
  {href: "/inventory", key: "inventory"},
  {href: "/movements", key: "movements"},
  {href: "/airco", key: "airco"},
  {href: "/dossiers", key: "dossiers"},
] as const;

const driverNav = [
  {href: "/", key: "home"},
  {href: "/scan", key: "scan"},
  {href: "/yard", key: "yard"},
  {href: "/modules", key: "modules"},
  {href: "/dossiers", key: "dossiers"},
] as const;

export async function AppShell({
  children,
  showNav,
  role,
}: {
  children: ReactNode;
  showNav: boolean;
  role?: AppRole | null;
}) {
  const t = await getTranslations();
  const navItems = role === "FORKLIFT_DRIVER" || role === "PRODUCTION" ? driverNav : managementNav;

  return (
    <div className="flex min-h-full flex-col">
      <div className="h-2 bg-loxam-red" />
      <header className="border-b border-white/10 bg-loxam-black text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <span className="bg-loxam-red px-2 py-1 text-sm font-black tracking-[0.18em] text-white">
              {t("brand.name")}
            </span>
            <span className="text-sm font-semibold tracking-[0.12em] uppercase">
              {t("brand.product")}
            </span>
          </Link>
          {showNav ? (
            <nav className="hidden items-center gap-4 text-sm font-bold uppercase text-white/80 lg:flex">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-white">
                  {t(`nav.${item.key}`)}
                </Link>
              ))}
            </nav>
          ) : null}
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <SessionControls />
          </div>
        </div>
      </header>
      <main className={`flex-1 ${showNav ? "pb-24 lg:pb-8" : ""}`}>{children}</main>
      {showNav ? <BottomNav role={role} /> : null}
    </div>
  );
}
