"use client";

// STATIC DEMO BUILD — same markup and data-cy hooks as the real LoginForm, with
// two differences: the identifier is a plain text field (the demo login is
// "admin", not an e-mail) and both fields are pre-filled so a visitor can just
// click through.

import { useActionState } from "react";
import { login, type LoginState } from "@/app/admin/login/actions";
import { DEMO_LOGIN, DEMO_PASSWORD } from "@/lib/demo-data";
import { Button } from "@/components/ui/Button";

const inputClasses =
  "w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 focus:border-ink";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Identifiant
        </label>
        <input
          id="email"
          name="email"
          type="text"
          autoComplete="username"
          required
          defaultValue={DEMO_LOGIN}
          data-cy="login-email"
          className={inputClasses}
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          defaultValue={DEMO_PASSWORD}
          data-cy="login-password"
          className={inputClasses}
        />
      </div>
      {state.error && (
        <p className="text-sm text-accent-deep" role="alert" data-cy="login-error">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={isPending} className="w-full" data-cy="login-submit">
        {isPending ? "Connexion…" : "Se connecter"}
      </Button>
      <p className="rounded-md border border-line bg-surface px-3 py-2 text-xs text-ink-muted">
        Démo publique — identifiant <strong>{DEMO_LOGIN}</strong>, mot de passe{" "}
        <strong>{DEMO_PASSWORD}</strong>.
      </p>
    </form>
  );
}
