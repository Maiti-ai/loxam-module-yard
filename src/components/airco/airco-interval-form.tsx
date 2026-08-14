"use client";

import {useState} from "react";
import {useTranslations} from "next-intl";
import {useRouter} from "@/i18n/navigation";
import {TouchButton} from "@/components/ui/touch-button";
import {saveAircoIntervalAction} from "@/features/air-conditioning/actions";

export function AircoIntervalForm({current}: {current: number | null}) {
  const t = useTranslations("airco");
  const router = useRouter();
  const [value, setValue] = useState(current ? String(current) : "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-wrap items-end gap-3 border border-loxam-line bg-white p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        const parsed = value.trim() ? Number(value) : null;
        const months = parsed && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        const result = await saveAircoIntervalAction(months);
        setPending(false);
        if (!result.ok) {
          setError(result.code);
          return;
        }
        router.refresh();
      }}
    >
      <label className="block">
        <span className="text-xs font-bold uppercase text-loxam-muted">{t("interval")}</span>
        <input
          inputMode="numeric"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t("intervalPlaceholder")}
          className="mt-2 min-h-14 w-40 border-2 border-loxam-black px-3 font-bold"
        />
      </label>
      <TouchButton type="submit" disabled={pending} className="w-auto min-w-40">
        {t("intervalSave")}
      </TouchButton>
      {error ? <p className="w-full text-sm font-bold text-loxam-occupied">{error}</p> : null}
    </form>
  );
}
