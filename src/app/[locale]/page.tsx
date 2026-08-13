import {getTranslations} from "next-intl/server";
import {getFoundationStatus} from "@/lib/supabase/foundation-status";

const featureKeys = [
  "auth",
  "users",
  "modules",
  "yard",
  "movements",
  "photos",
  "ac",
  "excel",
] as const;

export default async function HomePage() {
  const t = await getTranslations();
  const status = await getFoundationStatus();

  return (
    <div>
      <section className="border-b border-loxam-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
          <div>
            <p className="text-xs font-bold tracking-[0.28em] text-loxam-muted uppercase">
              {t("home.eyebrow")}
            </p>
            <h1 className="mt-4 max-w-xl text-5xl font-black tracking-tight text-loxam-black sm:text-6xl">
              {t("home.title")}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-loxam-muted">
              {t("home.subtitle")}
            </p>
          </div>
          <aside
            id="environment"
            className="border border-loxam-line bg-loxam-paper p-6"
          >
            <p className="text-xs font-bold tracking-[0.2em] text-loxam-muted uppercase">
              {t("home.statusTitle")}
            </p>
            <p className="mt-3 text-sm leading-6 text-loxam-ink">
              {t("home.statusBody")}
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li className={status.configured ? "border-l-4 border-loxam-yellow pl-3" : "border-l-4 border-loxam-muted pl-3"}>
                {status.configured
                  ? t("home.supabaseReady")
                  : t("home.supabaseMissing")}
              </li>
              <li className={status.authReachable ? "border-l-4 border-loxam-yellow pl-3" : "border-l-4 border-loxam-muted pl-3"}>
                {status.authReachable ? t("home.authReady") : t("home.authMissing")}
              </li>
              <li className={status.schemaApplied ? "border-l-4 border-loxam-yellow pl-3" : "border-l-4 border-loxam-muted pl-3"}>
                {status.schemaApplied ? t("home.schemaReady") : t("home.schemaMissing")}
              </li>
              <li className={status.anonymousAccessBlocked ? "border-l-4 border-loxam-yellow pl-3" : "border-l-4 border-loxam-muted pl-3"}>
                {status.anonymousAccessBlocked
                  ? t("home.rlsReady")
                  : t("home.rlsPending")}
              </li>
            </ul>
            {status.detail ? (
              <p className="mt-3 text-xs text-loxam-muted">{status.detail}</p>
            ) : null}
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="text-2xl font-black tracking-tight text-loxam-black">
          {t("features.title")}
        </h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {featureKeys.map((key) => (
            <li
              key={key}
              className="border border-loxam-line bg-white p-5 shadow-[4px_4px_0_0_#111111]"
            >
              <h3 className="text-sm font-black tracking-wide uppercase">
                {t(`features.${key}.title`)}
              </h3>
              <p className="mt-3 text-sm leading-6 text-loxam-muted">
                {t(`features.${key}.body`)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <footer className="border-t border-loxam-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-xs text-loxam-muted">
          <span>{t("footer.note")}</span>
          <a href="#environment" className="font-bold tracking-wide text-loxam-black uppercase">
            {t("home.cta")}
          </a>
        </div>
      </footer>
    </div>
  );
}
