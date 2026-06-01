"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  Field,
  SelectField,
  TextAreaField,
  SubmitButton,
} from "@/components/form-controls";
import {
  LOAN_STAGES,
  LOAN_STAGE_LABELS,
  LOAN_TYPES,
} from "@/lib/constants";
import { toDateInputValue } from "@/lib/format";
import type { FormState } from "@/lib/validators";

type LoanLike = {
  id: string;
  borrowerName: string;
  borrowerEmail: string | null;
  borrowerPhone: string | null;
  loanType: string;
  amount: number;
  interestRate: number | null;
  stage: string;
  notes: string | null;
  targetCloseAt: Date | string | null;
  propertyId: string | null;
};

type PropertyOption = { id: string; address: string; city: string };

export function LoanForm({
  action,
  loan,
  properties,
  submitLabel,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  loan?: LoanLike;
  properties: PropertyOption[];
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          label="Borrower name"
          name="borrowerName"
          required
          defaultValue={loan?.borrowerName}
          error={fe.borrowerName}
        />
        <SelectField
          label="Loan type"
          name="loanType"
          options={LOAN_TYPES}
          defaultValue={loan?.loanType}
          error={fe.loanType}
        />
        <Field
          label="Borrower email"
          name="borrowerEmail"
          type="email"
          defaultValue={loan?.borrowerEmail ?? ""}
          error={fe.borrowerEmail}
        />
        <Field
          label="Borrower phone"
          name="borrowerPhone"
          defaultValue={loan?.borrowerPhone ?? ""}
          error={fe.borrowerPhone}
        />
        <Field
          label="Loan amount ($)"
          name="amount"
          type="number"
          min="0"
          step="1000"
          defaultValue={loan ? String(loan.amount) : ""}
          error={fe.amount}
        />
        <Field
          label="Interest rate (%)"
          name="interestRate"
          type="number"
          min="0"
          step="0.01"
          defaultValue={loan?.interestRate != null ? String(loan.interestRate) : ""}
          error={fe.interestRate}
        />
        <SelectField
          label="Stage"
          name="stage"
          options={LOAN_STAGES}
          labels={LOAN_STAGE_LABELS}
          defaultValue={loan?.stage ?? "LEAD"}
          error={fe.stage}
        />
        <Field
          label="Target close date"
          name="targetCloseAt"
          type="date"
          defaultValue={toDateInputValue(loan?.targetCloseAt)}
          error={fe.targetCloseAt}
        />
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          Subject property
        </span>
        <select
          name="propertyId"
          defaultValue={loan?.propertyId ?? ""}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
        >
          <option value="">— None —</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.address}, {p.city}
            </option>
          ))}
        </select>
      </label>

      <TextAreaField
        label="Notes"
        name="notes"
        defaultValue={loan?.notes ?? ""}
        error={fe.notes}
      />

      <div className="flex items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link
          href={cancelHref}
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
