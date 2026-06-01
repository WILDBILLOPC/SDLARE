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
  PROPERTY_STATUSES,
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPES,
} from "@/lib/constants";
import type { FormState } from "@/lib/validators";

type PropertyLike = {
  address: string;
  city: string;
  state: string;
  zip: string | null;
  propertyType: string;
  status: string;
  listPrice: number;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  notes: string | null;
};

export function PropertyForm({
  action,
  property,
  submitLabel,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  property?: PropertyLike;
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

      <Field
        label="Address"
        name="address"
        required
        defaultValue={property?.address}
        error={fe.address}
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Field
          label="City"
          name="city"
          defaultValue={property?.city ?? "San Diego"}
          error={fe.city}
        />
        <Field
          label="State"
          name="state"
          defaultValue={property?.state ?? "CA"}
          error={fe.state}
        />
        <Field
          label="ZIP"
          name="zip"
          defaultValue={property?.zip ?? ""}
          error={fe.zip}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <SelectField
          label="Property type"
          name="propertyType"
          options={PROPERTY_TYPES}
          defaultValue={property?.propertyType}
          error={fe.propertyType}
        />
        <SelectField
          label="Status"
          name="status"
          options={PROPERTY_STATUSES}
          labels={PROPERTY_STATUS_LABELS}
          defaultValue={property?.status ?? "ACTIVE"}
          error={fe.status}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
        <Field
          label="List price ($)"
          name="listPrice"
          type="number"
          min="0"
          step="1000"
          defaultValue={property ? String(property.listPrice) : ""}
          error={fe.listPrice}
        />
        <Field
          label="Beds"
          name="beds"
          type="number"
          min="0"
          defaultValue={property?.beds != null ? String(property.beds) : ""}
          error={fe.beds}
        />
        <Field
          label="Baths"
          name="baths"
          type="number"
          min="0"
          step="0.5"
          defaultValue={property?.baths != null ? String(property.baths) : ""}
          error={fe.baths}
        />
        <Field
          label="Sq ft"
          name="sqft"
          type="number"
          min="0"
          defaultValue={property?.sqft != null ? String(property.sqft) : ""}
          error={fe.sqft}
        />
      </div>

      <TextAreaField
        label="Notes"
        name="notes"
        defaultValue={property?.notes ?? ""}
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
