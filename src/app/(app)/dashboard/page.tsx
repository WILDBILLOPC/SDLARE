import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  ACTIVE_LOAN_STAGES,
  LOAN_STAGES,
  LOAN_STAGE_LABELS,
  type LoanStage,
} from "@/lib/constants";
import { StageBadge } from "@/components/badges";

export const metadata = { title: "Dashboard · SDLARE" };

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const [loansByStage, propertiesByStatus, recentLoans] = await Promise.all([
    prisma.loan.groupBy({
      by: ["stage"],
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.property.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { listPrice: true },
    }),
    prisma.loan.findMany({
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: { property: true },
    }),
  ]);

  const stageCount = (stage: LoanStage) =>
    loansByStage.find((g) => g.stage === stage)?._count._all ?? 0;
  const stageSum = (stage: LoanStage) =>
    loansByStage.find((g) => g.stage === stage)?._sum.amount ?? 0;

  const activePipelineCount = ACTIVE_LOAN_STAGES.reduce(
    (n, s) => n + stageCount(s),
    0,
  );
  const activePipelineVolume = ACTIVE_LOAN_STAGES.reduce(
    (n, s) => n + stageSum(s),
    0,
  );
  const fundedVolume = stageSum("FUNDED") + stageSum("CLOSED");
  const totalLoans = loansByStage.reduce((n, g) => n + g._count._all, 0);

  const activeProperties =
    propertiesByStatus.find((g) => g.status === "ACTIVE")?._count._all ?? 0;
  const activeListingVolume =
    propertiesByStatus.find((g) => g.status === "ACTIVE")?._sum.listPrice ?? 0;
  const totalProperties = propertiesByStatus.reduce(
    (n, g) => n + g._count._all,
    0,
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Pipeline and portfolio at a glance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Pipeline"
          value={String(activePipelineCount)}
          sub={`${formatCurrency(activePipelineVolume)} in volume`}
        />
        <StatCard
          label="Funded / Closed"
          value={formatCurrency(fundedVolume)}
          sub={`${stageCount("FUNDED") + stageCount("CLOSED")} loans`}
        />
        <StatCard
          label="Active Listings"
          value={String(activeProperties)}
          sub={`${formatCurrency(activeListingVolume)} list value`}
        />
        <StatCard
          label="Total Records"
          value={`${totalLoans} loans`}
          sub={`${totalProperties} properties`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            Pipeline by stage
          </h2>
          <ul className="mt-4 space-y-2">
            {LOAN_STAGES.map((stage) => {
              const count = stageCount(stage);
              const max = Math.max(totalLoans, 1);
              return (
                <li key={stage} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs text-slate-500">
                    {LOAN_STAGE_LABELS[stage]}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-800"
                      style={{ width: `${(count / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs font-medium text-slate-700">
                    {count}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Recent loan activity
            </h2>
            <Link
              href="/loans"
              className="text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              View all →
            </Link>
          </div>
          {recentLoans.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No loans yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {recentLoans.map((loan) => (
                <li key={loan.id}>
                  <Link
                    href={`/loans/${loan.id}`}
                    className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 transition hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {loan.borrowerName}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {loan.loanType} · {formatCurrency(loan.amount)} ·{" "}
                        {formatDate(loan.updatedAt)}
                      </p>
                    </div>
                    <StageBadge stage={loan.stage} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
