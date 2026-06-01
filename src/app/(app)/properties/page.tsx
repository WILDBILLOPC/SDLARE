import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { StatusBadge } from "@/components/badges";

export const metadata = { title: "Properties · SDLARE" };

export default async function PropertiesPage() {
  const properties = await prisma.property.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { loans: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Properties
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {properties.length}{" "}
            {properties.length === 1 ? "listing" : "listings"}
          </p>
        </div>
        <Link
          href="/properties/new"
          className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
        >
          New property
        </Link>
      </div>

      {properties.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          No properties yet.{" "}
          <Link
            href="/properties/new"
            className="font-medium text-slate-900 underline"
          >
            Add the first one
          </Link>
          .
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <Link
              key={p.id}
              href={`/properties/${p.id}`}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-slate-900">{p.address}</h2>
                <StatusBadge status={p.status} />
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {p.city}, {p.state} {p.zip ?? ""}
              </p>
              <p className="mt-3 text-xl font-bold tracking-tight text-slate-900">
                {formatCurrency(p.listPrice)}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {p.propertyType}
                {p.beds != null && ` · ${p.beds} bd`}
                {p.baths != null && ` · ${p.baths} ba`}
                {p.sqft != null && ` · ${p.sqft.toLocaleString()} sqft`}
              </p>
              {p._count.loans > 0 && (
                <p className="mt-2 text-xs font-medium text-slate-400">
                  {p._count.loans} linked{" "}
                  {p._count.loans === 1 ? "loan" : "loans"}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
