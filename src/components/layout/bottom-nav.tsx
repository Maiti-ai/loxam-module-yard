"use client";

import {useTranslations} from "next-intl";
import {Link, usePathname} from "@/i18n/navigation";
import type {AppRole} from "@/types/database";

const driverItems = [
  {href: "/", key: "home"},
  {href: "/scan", key: "scan"},
  {href: "/yard", key: "yard"},
  {href: "/modules", key: "modules"},
] as const;

const officeItems = [
  {href: "/", key: "home"},
  {href: "/scan", key: "scan"},
  {href: "/yard", key: "yard"},
  {href: "/modules", key: "modules"},
  {href: "/inventory", key: "inventory"},
] as const;

export function BottomNav({role}: {role?: AppRole | null}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const items = role === "FORKLIFT_DRIVER" || role === "PRODUCTION" ? driverItems : officeItems;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-loxam-black pb-[env(safe-area-inset-bottom)] text-white lg:hidden">
      <ul className={`grid ${items.length === 4 ? "grid-cols-4" : "grid-cols-5"}`}>
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const scan = item.key === "scan";

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex min-h-16 flex-col items-center justify-center px-1 text-[11px] font-black uppercase ${
                  active ? "text-white" : "text-white/60"
                } ${scan ? "-mt-3 bg-loxam-red text-white" : ""}`}
              >
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
