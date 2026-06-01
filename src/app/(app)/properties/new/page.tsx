import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createPropertyAction } from "@/app/actions/properties";
import { PropertyForm } from "@/components/property-form";

export const metadata = { title: "New Property · SDLARE" };

export default async function NewPropertyPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/properties"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Properties
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          New property
        </h1>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <PropertyForm
          action={createPropertyAction}
          submitLabel="Create property"
          cancelHref="/properties"
        />
      </div>
    </div>
  );
}
