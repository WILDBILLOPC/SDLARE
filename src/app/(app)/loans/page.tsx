import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatCurrency, formatPercent } from "@/lib/format";
import {
  LOAN_STAGES,
  LOAN_STAGE_LABELS,
  type LoanStage,
} from "@/lib/constants";
import { StageSelect } from "@/components/stage-select";

export const metadata = { title: "Loan Pipeline · SDLARE" };

export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const { stage } = await searchParams;
  const activeStage = LOAN_STAGES.includes(stage as LoanStage)
    ? (stage as LoanStage)
    : undefined;

  const loans = await prisma.loan.findMany({
    where: activeStage ? { stage: activeStage } : undefined,
    orderBy: { updatedAt: "desc" },
    include: { property: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Loan Pipeline
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {loans.length} {loans.length === 1 ? "loan" : "loans"}
            {activeStage ? ` · ${LOAN_STAGE_LABELS[activeStage]}` : ""}
          </p>
        </div>
        <Link
          href="/loans/new"
          className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
        >
          New loan
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip label="All" href="/loans" active={!activeStage} />
        {LOAN_STAGES.map((s) => (
          <FilterChip
            key={s}
            label={LOAN_STAGE_LABELS[s]}
            href={`/loans?stage=${s}`}
            active={activeStage === s}
          />
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loans.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No loans yet.{" "}
            <Link href="/loans/new" className="font-medium text-slate-900 underline">
              Add the first one
            </Link>
            .
          </p>
        ) : (
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Borrower</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Rate</th>
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3">Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loans.map((loan) => (
                <tr key={loan.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/loans/${loan.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {loan.borrowerName}
                    </Link>
                    {loan.borrowerEmail && (
                      <span className="block text-xs text-slate-400">
                        {loan.borrowerEmail}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{loan.loanType}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">
                    {formatCurrency(loan.amount)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {formatPercent(loan.interestRate)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {loan.property ? loan.property.address : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StageSelect id={loan.id} stage={loan.stage} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition ${
        active
          ? "bg-slate-900 text-white ring-slate-900"
          : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {label}
    </Link>
  );
}
