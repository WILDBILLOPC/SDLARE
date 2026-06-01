import { z } from "zod";
import {
  LOAN_STAGES,
  LOAN_TYPES,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
} from "@/lib/constants";

// Treat empty form fields as "not provided".
const emptyToUndefined = (v: unknown) =>
  v === "" || v === null ? undefined : v;

const optionalString = z.preprocess(
  emptyToUndefined,
  z.string().trim().optional(),
);

const optionalNumber = z.preprocess(
  emptyToUndefined,
  z.coerce.number().nonnegative().optional(),
);

export const loanSchema = z.object({
  borrowerName: z.string().trim().min(1, "Borrower name is required"),
  borrowerEmail: z.preprocess(
    emptyToUndefined,
    z.string().trim().email("Enter a valid email").optional(),
  ),
  borrowerPhone: optionalString,
  loanType: z.enum(LOAN_TYPES),
  amount: z.coerce.number().nonnegative("Amount must be 0 or more"),
  interestRate: optionalNumber,
  stage: z.enum(LOAN_STAGES),
  notes: optionalString,
  targetCloseAt: z.preprocess(
    emptyToUndefined,
    z.coerce.date().optional(),
  ),
  propertyId: optionalString,
});

export type LoanInput = z.infer<typeof loanSchema>;

export const propertySchema = z.object({
  address: z.string().trim().min(1, "Address is required"),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().min(1, "State is required"),
  zip: optionalString,
  propertyType: z.enum(PROPERTY_TYPES),
  status: z.enum(PROPERTY_STATUSES),
  listPrice: z.coerce.number().nonnegative("List price must be 0 or more"),
  beds: z.preprocess(emptyToUndefined, z.coerce.number().int().nonnegative().optional()),
  baths: optionalNumber,
  sqft: z.preprocess(emptyToUndefined, z.coerce.number().int().nonnegative().optional()),
  notes: optionalString,
});

export type PropertyInput = z.infer<typeof propertySchema>;

// Shared shape returned by form server actions for useActionState.
export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

// Flatten a ZodError into a simple field -> message map.
export function fieldErrorsFromZod(
  error: z.ZodError,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}
