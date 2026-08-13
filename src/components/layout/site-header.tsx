import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";
import {LanguageSwitcher} from "@/components/layout/language-switcher";
import {SessionControls} from "@/components/auth/session-controls";

const navItems = [
  {href: "/", key: "home"},
  {href: "/modules", key: "modules"},
  {href: "/yard", key: "yard"},
  {href: "/movements", key: "movements"},
  {href: "/inventory", key: "inventory"},
] as const;

export async function SiteHeader() {
  const t = await getTranslations();

  return (
    <header className="border-b border-white/10 bg-loxam-black text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="bg-loxam-yellow px-2 py-1 text-sm font-black tracking-[0.18em] text-loxam-black">
            {t("brand.name")}
          </span>
          <span className="text-sm font-semibold tracking-[0.16em] uppercase">
            {t("brand.product")}
          </span>
        </Link>
        <nav className="hidden items-center gap-5 text-sm font-medium text-white/80 md:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-loxam-yellow">
              {t(`nav.${item.key}`)}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <SessionControls />
        </div>
      </div>
    </header>
  );
}
