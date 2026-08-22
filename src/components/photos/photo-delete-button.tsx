"use client";

import {useRef, useState} from "react";
import {useTranslations} from "next-intl";
import {useRouter} from "@/i18n/navigation";
import {deleteModulePhotoAction} from "@/features/module-photos/delete-photo-action";
import {TouchButton} from "@/components/ui/touch-button";

export function PhotoDeleteButton({
  photoId,
  onDeleted,
}: {
  photoId: string;
  onDeleted?: (photoId: string) => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);

  function onCancel() {
    if (pendingRef.current) {
      return;
    }
    setConfirming(false);
    setError(null);
  }

  async function onConfirm() {
    if (pendingRef.current) {
      return;
    }

    pendingRef.current = true;
    setPending(true);
    setError(null);

    try {
      const result = await deleteModulePhotoAction({photoId});
      if (!result.ok) {
        setError(t("photos.deleteFailed"));
        return;
      }
      setConfirming(false);
      onDeleted?.(photoId);
      router.refresh();
    } catch {
      setError(t("photos.deleteFailed"));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  if (!confirming) {
    return (
      <TouchButton
        variant="danger"
        className="min-h-16 text-base"
        disabled={pending}
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
      >
        {t("photos.delete")}
      </TouchButton>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-base font-black">{t("photos.deleteConfirmTitle")}</p>
      <p className="text-sm text-loxam-muted">{t("photos.deleteConfirmBody")}</p>
      <TouchButton variant="secondary" className="min-h-16 text-base" disabled={pending} onClick={onCancel}>
        {t("common.cancel")}
      </TouchButton>
      <TouchButton
        variant="danger"
        className="min-h-16 text-base"
        disabled={pending}
        onClick={() => void onConfirm()}
      >
        {pending ? t("photos.deleting") : t("photos.delete")}
      </TouchButton>
      {error ? <p className="text-sm font-bold text-loxam-occupied">{error}</p> : null}
    </div>
  );
}
