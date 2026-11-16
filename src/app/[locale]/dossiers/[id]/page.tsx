import {redirect} from "@/i18n/navigation";

export default async function DossierRedirectPage({
  params,
}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale, id} = await params;
  redirect({href: `/zaken/${id}`, locale});
}
