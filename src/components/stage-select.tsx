"use client";

import { useRef } from "react";
import { updateLoanStageAction } from "@/app/actions/loans";
import { LOAN_STAGES, LOAN_STAGE_LABELS } from "@/lib/constants";

// Inline stage selector that submits on change.
export function StageSelect({ id, stage }: { id: string; stage: string }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form action={updateLoanStageAction} ref={formRef}>
      <input type="hidden" name="id" value={id} />
      <select
        name="stage"
        defaultValue={stage}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
        aria-label="Change loan stage"
      >
        {LOAN_STAGES.map((s) => (
          <option key={s} value={s}>
            {LOAN_STAGE_LABELS[s]}
          </option>
        ))}
      </select>
    </form>
  );
}
