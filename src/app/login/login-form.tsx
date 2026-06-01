"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { Field, SubmitButton } from "@/components/form-controls";
import type { FormState } from "@/lib/validators";

export function LoginForm() {
  const [state, action] = useActionState<FormState, FormData>(loginAction, {});

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
          {state.error}
        </p>
      )}
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue="op@sdlare.com"
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}
