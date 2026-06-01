import {
  LOAN_STAGE_LABELS,
  PROPERTY_STATUS_LABELS,
  type LoanStage,
  type PropertyStatus,
} from "@/lib/constants";

const STAGE_STYLES: Record<LoanStage, string> = {
  LEAD: "bg-slate-100 text-slate-700 ring-slate-200",
  APPLICATION: "bg-blue-50 text-blue-700 ring-blue-200",
  PROCESSING: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  UNDERWRITING: "bg-amber-50 text-amber-700 ring-amber-200",
  APPROVED: "bg-teal-50 text-teal-700 ring-teal-200",
  FUNDED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CLOSED: "bg-green-50 text-green-700 ring-green-200",
  DENIED: "bg-rose-50 text-rose-700 ring-rose-200",
};

const STATUS_STYLES: Record<PropertyStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  SOLD: "bg-slate-100 text-slate-600 ring-slate-200",
  OFF_MARKET: "bg-rose-50 text-rose-700 ring-rose-200",
};

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

export function StageBadge({ stage }: { stage: string }) {
  const key = stage as LoanStage;
  return (
    <Pill className={STAGE_STYLES[key] ?? STAGE_STYLES.LEAD}>
      {LOAN_STAGE_LABELS[key] ?? stage}
    </Pill>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const key = status as PropertyStatus;
  return (
    <Pill className={STATUS_STYLES[key] ?? STATUS_STYLES.ACTIVE}>
      {PROPERTY_STATUS_LABELS[key] ?? status}
    </Pill>
  );
}
