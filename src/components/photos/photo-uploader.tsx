"use client";

import {useState} from "react";
import {useTranslations} from "next-intl";
import {useRouter} from "@/i18n/navigation";
import {savePhotoMetadataAction} from "@/features/module-photos/actions";
import {createClient} from "@/lib/supabase/client";
import {
  MODULE_PHOTO_MIME_TYPES,
  MODULE_PHOTOS_BUCKET,
  modulePhotoObjectPath,
} from "@/lib/storage/module-photos";

export function PhotoUploader({moduleId}: {moduleId: string}) {
  const t = useTranslations();
  const router = useRouter();
  const [caption, setCaption] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) {
      return;
    }
    if (!MODULE_PHOTO_MIME_TYPES.includes(file.type as (typeof MODULE_PHOTO_MIME_TYPES)[number])) {
      setError(t("errors.UPLOAD_FAILED"));
      return;
    }

    setPending(true);
    setError(null);

    const path = modulePhotoObjectPath(moduleId, file.name);
    const supabase = createClient();
    const upload = await supabase.storage.from(MODULE_PHOTOS_BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

    if (upload.error) {
      setPending(false);
      setError(t("errors.UPLOAD_FAILED"));
      return;
    }

    const saved = await savePhotoMetadataAction({
      moduleId,
      storagePath: path,
      fileName: file.name,
      mimeType: file.type,
      byteSize: file.size,
      caption: caption.trim() || null,
    });

    setPending(false);
    if (!saved.ok) {
      setError(t(`errors.${saved.code}`));
      return;
    }

    setCaption("");
    router.refresh();
  }

  return (
    <form className="space-y-3" onSubmit={(event) => event.preventDefault()}>
      <label className="block">
        <span className="text-xs font-bold uppercase text-loxam-muted">{t("photos.caption")}</span>
        <input
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          className="mt-2 min-h-14 w-full border-2 border-loxam-line px-3 text-base"
        />
      </label>
      <label className="flex min-h-20 cursor-pointer items-center justify-center bg-loxam-red text-xl font-black uppercase text-white">
        {pending ? t("photos.uploading") : t("photos.capture")}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          disabled={pending}
          className="sr-only"
          onChange={(event) => {
            void onFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>
      <label className="flex min-h-16 cursor-pointer items-center justify-center border-2 border-loxam-black bg-white text-sm font-black uppercase">
        {t("photos.gallery")}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={pending}
          className="sr-only"
          onChange={(event) => {
            void onFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>
      {error ? <p className="text-sm font-bold text-loxam-occupied">{error}</p> : null}
    </form>
  );
}
