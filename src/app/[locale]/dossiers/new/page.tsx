import {redirect} from "@/i18n/navigation";

export default async function NewDossierRedirectPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  redirect({href: "/zaken/new", locale});
}
