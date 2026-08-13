import {Link} from "@/i18n/navigation";

export function LoadingState({label}: {label: string}) {
  return (
    <div className="flex min-h-64 items-center justify-center px-6">
      <p className="text-lg font-bold text-loxam-muted">{label}</p>
    </div>
  );
}

export function ErrorState({
  title,
  body,
  retryHref,
  retryLabel,
}: {
  title: string;
  body: string;
  retryHref?: string;
  retryLabel?: string;
}) {
  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-3xl font-black text-loxam-black">{title}</h1>
      <p className="mt-3 text-base text-loxam-muted">{body}</p>
      {retryHref && retryLabel ? (
        <Link
          href={retryHref}
          className="mt-8 inline-flex min-h-14 items-center bg-loxam-red px-6 text-base font-black text-white uppercase"
        >
          {retryLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function EmptyState({title, body}: {title: string; body: string}) {
  return (
    <div className="border border-dashed border-loxam-line bg-white px-5 py-10 text-center">
      <p className="text-lg font-black text-loxam-black">{title}</p>
      <p className="mt-2 text-sm text-loxam-muted">{body}</p>
    </div>
  );
}
