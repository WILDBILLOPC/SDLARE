import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  updatePropertyAction,
  deletePropertyAction,
} from "@/app/actions/properties";
import { PropertyForm } from "@/components/property-form";
import { DeleteButton } from "@/components/delete-button";
import { StageBadge } from "@/components/badges";
import { formatCurrency } from "@/lib/format";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const property = await prisma.property.findUnique({
    where: { id },
    include: { loans: { orderBy: { updatedAt: "desc" } } },
  });

  if (!property) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/properties"
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            ← Properties
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {property.address}
          </h1>
        </div>
        <DeleteButton
          action={deletePropertyAction}
          id={property.id}
          label="Delete property"
          confirmMessage={`Delete ${property.address}? This cannot be undone.`}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <PropertyForm
          action={updatePropertyAction.bind(null, property.id)}
          property={property}
          submitLabel="Save changes"
          cancelHref="/properties"
        />
      </div>

      {property.loans.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Linked loans</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {property.loans.map((loan) => (
              <li key={loan.id}>
                <Link
                  href={`/loans/${loan.id}`}
                  className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 transition hover:bg-slate-50"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {loan.borrowerName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {loan.loanType} · {formatCurrency(loan.amount)}
                    </p>
                  </div>
                  <StageBadge stage={loan.stage} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
