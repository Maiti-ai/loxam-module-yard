"use client";

import {useEffect, useRef, useState, useSyncExternalStore} from "react";
import {useTranslations} from "next-intl";
import {useRouter} from "@/i18n/navigation";
import {TouchButton} from "@/components/ui/touch-button";

function readNdefText(event: NDEFReadingEvent) {
  for (const record of event.message.records) {
    if (record.recordType === "text" && record.data) {
      const decoder = new TextDecoder(record.encoding || "utf-8");
      return decoder.decode(record.data).trim();
    }
    if (record.recordType === "url" && record.data) {
      const decoder = new TextDecoder(record.encoding || "utf-8");
      const url = decoder.decode(record.data);
      const parts = url.split("/").filter(Boolean);
      return (parts.at(-1) ?? "").trim();
    }
  }
  return event.serialNumber.trim();
}

function nfcSubscribe() {
  return () => undefined;
}

function nfcSnapshot() {
  return "NDEFReader" in window;
}

function nfcServerSnapshot() {
  return false;
}

export function NFCScanner({demoNumbers}: {demoNumbers: string[]}) {
  const t = useTranslations("scan");
  const router = useRouter();
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const nfcSupported = useSyncExternalStore(nfcSubscribe, nfcSnapshot, nfcServerSnapshot);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  function openModule(raw: string) {
    const value = raw.trim();
    if (!value) {
      return;
    }
    router.push(`/modules/${encodeURIComponent(value)}?scanned=1`);
  }

  async function startNfc() {
    if (!window.NDEFReader) {
      setError(t("nfcUnsupported"));
      return;
    }

    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setError(null);
    setScanning(true);

    try {
      const reader = new window.NDEFReader();
      reader.addEventListener("reading", (event) => {
        const value = readNdefText(event);
        if (value) {
          abort.abort();
          setScanning(false);
          openModule(value);
        }
      });
      reader.addEventListener("readingerror", () => {
        setError(t("nfcError"));
      });
      await reader.scan({signal: abort.signal});
    } catch {
      setScanning(false);
      setError(t("nfcError"));
    }
  }

  function stopNfc() {
    abortRef.current?.abort();
    setScanning(false);
  }

  return (
    <div className="space-y-8">
      <div className="border-4 border-loxam-black bg-white p-6">
        <p className="text-sm font-black uppercase text-loxam-red">
          {nfcSupported ? (scanning ? t("nfcScanning") : t("nfcReady")) : t("nfcUnsupported")}
        </p>
        {nfcSupported ? (
          <div className="mt-6">
            {scanning ? (
              <TouchButton variant="secondary" onClick={stopNfc}>
                {t("stopNfc")}
              </TouchButton>
            ) : (
              <TouchButton onClick={startNfc}>{t("startNfc")}</TouchButton>
            )}
          </div>
        ) : null}
      </div>

      <form
        className="border border-loxam-line bg-white p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!manual.trim()) {
            setError(t("notFound"));
            return;
          }
          openModule(manual);
        }}
      >
        <p className="text-lg font-black">{t("fallbackTitle")}</p>
        <p className="mt-2 text-sm text-loxam-muted">{t("fallbackBody")}</p>
        <label className="mt-5 block">
          <span className="sr-only">{t("placeholder")}</span>
          <input
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            inputMode="numeric"
            placeholder={t("placeholder")}
            className="min-h-16 w-full border-4 border-loxam-black bg-loxam-paper px-4 text-3xl font-black tracking-wide"
          />
        </label>
        <div className="mt-4">
          <TouchButton type="submit">{t("open")}</TouchButton>
        </div>
        {error ? <p className="mt-4 text-sm font-bold text-loxam-occupied">{error}</p> : null}
      </form>

      {demoNumbers.length > 0 ? (
        <div>
          <p className="mb-3 text-sm font-black uppercase text-loxam-muted">{t("demoHint")}</p>
          <div className="flex flex-wrap gap-3">
            {demoNumbers.map((number) => (
              <button
                key={number}
                type="button"
                onClick={() => openModule(number)}
                className="min-h-14 min-w-20 border-2 border-loxam-black bg-white px-4 text-xl font-black"
              >
                {number}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
