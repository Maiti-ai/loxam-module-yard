"use client";

import {useState, type FormEvent} from "react";
import {useTranslations} from "next-intl";
import {useRouter} from "@/i18n/navigation";
import {createClient} from "@/lib/supabase/client";

export function LoginForm() {
  const t = useTranslations("login");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createClient();
    const {error: signInError} = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setPending(false);

    if (signInError) {
      setError(t("invalidCredentials"));
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 max-w-md space-y-4">
      <label className="block">
        <span className="text-xs font-bold tracking-[0.18em] text-loxam-muted uppercase">
          {t("email")}
        </span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full border border-loxam-line bg-white px-3 py-2 text-sm text-loxam-black outline-none focus:border-loxam-black"
        />
      </label>
      <label className="block">
        <span className="text-xs font-bold tracking-[0.18em] text-loxam-muted uppercase">
          {t("password")}
        </span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full border border-loxam-line bg-white px-3 py-2 text-sm text-loxam-black outline-none focus:border-loxam-black"
        />
      </label>
      {error ? (
        <p className="border-l-4 border-loxam-black pl-3 text-sm text-loxam-ink">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="bg-loxam-yellow px-4 py-2 text-sm font-bold tracking-wide text-loxam-black uppercase disabled:opacity-60"
      >
        {pending ? t("pending") : t("submit")}
      </button>
    </form>
  );
}
