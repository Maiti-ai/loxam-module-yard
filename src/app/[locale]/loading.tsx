import {getTranslations} from "next-intl/server";
import {LoadingState} from "@/components/ui/page-state";

export default async function Loading() {
  const t = await getTranslations("common");
  return <LoadingState label={t("loading")} />;
}
