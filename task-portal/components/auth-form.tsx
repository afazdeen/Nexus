'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { api, ApiError } from '@/lib/api-client';
import { loginSchema, registerSchema } from '@/lib/validators';

type Mode = 'login' | 'register';

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const isRegister = mode === 'register';

  const mutation = useMutation({
    mutationFn: (body: unknown) => api(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      router.replace('/tasks');
      router.refresh(); // re-run the server layouts with the new cookie
    },
    onError: (err) => {
      if (err instanceof ApiError && err.issues) setFieldErrors(err.issues);
    },
  });

  function onSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.currentTarget));
    const schema = isRegister ? registerSchema : loginSchema;
    const parsed = schema.safeParse(values); // same rules as the server, for instant feedback
    if (!parsed.success) {
      mutation.reset(); // drop a stale server banner (e.g. "Invalid email or password") from the last attempt
      setFieldErrors(z.flattenError(parsed.error).fieldErrors);
      return;
    }
    setFieldErrors({});
    mutation.mutate(parsed.data);
  }

  // Field-level errors show under their inputs; anything else (wrong password, email taken) shows as a banner.
  const error = mutation.error;
  const formError = error && !(error instanceof ApiError && error.issues) ? error.message : null;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <h1 className="text-xl font-semibold">{isRegister ? 'Create an account' : 'Sign in'}</h1>

      {formError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </p>
      )}

      {isRegister && <Field name="name" label="Name" autoComplete="name" errors={fieldErrors.name} />}
      <Field name="email" label="Email" type="email" autoComplete="email" errors={fieldErrors.email} />
      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete={isRegister ? 'new-password' : 'current-password'}
        errors={fieldErrors.password}
      />

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {mutation.isPending ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
      </button>

      <p className="text-center text-sm text-slate-600">
        {isRegister ? 'Already have an account? ' : 'No account yet? '}
        <Link href={isRegister ? '/login' : '/register'} className="font-medium text-slate-900 underline">
          {isRegister ? 'Sign in' : 'Create one'}
        </Link>
      </p>
    </form>
  );
}

function Field({
  name,
  label,
  errors,
  ...props
}: { name: string; label: string; errors?: string[] } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `field-${name}`;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={!!errors?.length}
        aria-describedby={errors?.length ? `${id}-error` : undefined}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 aria-[invalid=true]:border-red-500"
        {...props}
      />
      {errors?.[0] && (
        <p id={`${id}-error`} className="text-xs text-red-600">
          {errors[0]}
        </p>
      )}
    </div>
  );
}
