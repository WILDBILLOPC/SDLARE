import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createLoanAction } from "@/app/actions/loans";
import { LoanForm } from "@/components/loan-form";

export const metadata = { title: "New Loan · SDLARE" };

export default async function NewLoanPage() {
  await requireUser();
  const properties = await prisma.property.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, address: true, city: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/loans"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Loan pipeline
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          New loan
        </h1>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <LoanForm
          action={createLoanAction}
          properties={properties}
          submitLabel="Create loan"
          cancelHref="/loans"
        />
      </div>
    </div>
  );
}
