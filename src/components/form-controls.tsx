"use client";

import { useFormStatus } from "react-dom";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

type FieldProps = {
  label: string;
  name: string;
  error?: string;
  children?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>;

export function Field({ label, name, error, children, ...rest }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children ?? <input id={name} name={name} className={inputClass} {...rest} />}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

type SelectFieldProps = {
  label: string;
  name: string;
  error?: string;
  options: readonly string[];
  labels?: Record<string, string>;
  defaultValue?: string;
};

export function SelectField({
  label,
  name,
  error,
  options,
  labels,
  defaultValue,
}: SelectFieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </span>
      <select name={name} defaultValue={defaultValue} className={inputClass}>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {labels?.[opt] ?? opt}
          </option>
        ))}
      </select>
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

type TextAreaFieldProps = {
  label: string;
  name: string;
  error?: string;
  defaultValue?: string;
  rows?: number;
};

export function TextAreaField({
  label,
  name,
  error,
  defaultValue,
  rows = 3,
}: TextAreaFieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </span>
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        className={inputClass}
      />
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving…" : children}
    </button>
  );
}
