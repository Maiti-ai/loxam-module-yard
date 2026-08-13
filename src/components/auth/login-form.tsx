"use client";

import {useState, type FormEvent} from "react";
import {useTranslations} from "next-intl";
import {useRouter} from "@/i18n/navigation";
import {createClient} from "@/lib/supabase/client";
import {TouchButton} from "@/components/ui/touch-button";

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
          className="mt-2 min-h-14 w-full border-2 border-loxam-black bg-white px-3 text-base text-loxam-black outline-none"
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
          className="mt-2 min-h-14 w-full border-2 border-loxam-black bg-white px-3 text-base text-loxam-black outline-none"
        />
      </label>
      {error ? (
        <p className="border-l-4 border-loxam-red pl-3 text-sm font-bold">{error}</p>
      ) : null}
      <TouchButton type="submit" disabled={pending}>
        {pending ? t("pending") : t("submit")}
      </TouchButton>
    </form>
  );
}
