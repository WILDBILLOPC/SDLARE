"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  loanSchema,
  fieldErrorsFromZod,
  type FormState,
} from "@/lib/validators";
import { LOAN_STAGES, type LoanStage } from "@/lib/constants";

function dataFromForm(formData: FormData) {
  return {
    borrowerName: formData.get("borrowerName"),
    borrowerEmail: formData.get("borrowerEmail"),
    borrowerPhone: formData.get("borrowerPhone"),
    loanType: formData.get("loanType"),
    amount: formData.get("amount"),
    interestRate: formData.get("interestRate"),
    stage: formData.get("stage"),
    notes: formData.get("notes"),
    targetCloseAt: formData.get("targetCloseAt"),
    propertyId: formData.get("propertyId"),
  };
}

export async function createLoanAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = loanSchema.safeParse(dataFromForm(formData));
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const { propertyId, ...rest } = parsed.data;
  await prisma.loan.create({
    data: { ...rest, propertyId: propertyId || null, ownerId: user.id },
  });

  revalidatePath("/loans");
  revalidatePath("/dashboard");
  redirect("/loans");
}

export async function updateLoanAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const parsed = loanSchema.safeParse(dataFromForm(formData));
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const { propertyId, ...rest } = parsed.data;
  await prisma.loan.update({
    where: { id },
    data: { ...rest, propertyId: propertyId || null },
  });

  revalidatePath("/loans");
  revalidatePath(`/loans/${id}`);
  revalidatePath("/dashboard");
  redirect(`/loans/${id}`);
}

// Quick inline stage change from the pipeline list.
export async function updateLoanStageAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const stage = String(formData.get("stage") ?? "");
  if (!id || !LOAN_STAGES.includes(stage as LoanStage)) return;

  await prisma.loan.update({ where: { id }, data: { stage } });
  revalidatePath("/loans");
  revalidatePath("/dashboard");
}

export async function deleteLoanAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.loan.delete({ where: { id } });
  revalidatePath("/loans");
  revalidatePath("/dashboard");
  redirect("/loans");
}
