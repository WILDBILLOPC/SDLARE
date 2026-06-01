import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { updateLoanAction, deleteLoanAction } from "@/app/actions/loans";
import { LoanForm } from "@/components/loan-form";
import { DeleteButton } from "@/components/delete-button";

export default async function LoanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const [loan, properties] = await Promise.all([
    prisma.loan.findUnique({ where: { id } }),
    prisma.property.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, address: true, city: true },
    }),
  ]);

  if (!loan) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/loans"
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            ← Loan pipeline
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {loan.borrowerName}
          </h1>
        </div>
        <DeleteButton
          action={deleteLoanAction}
          id={loan.id}
          label="Delete loan"
          confirmMessage={`Delete the loan for ${loan.borrowerName}? This cannot be undone.`}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <LoanForm
          action={updateLoanAction.bind(null, loan.id)}
          loan={loan}
          properties={properties}
          submitLabel="Save changes"
          cancelHref="/loans"
        />
      </div>
    </div>
  );
}
