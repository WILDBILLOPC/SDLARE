"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  propertySchema,
  fieldErrorsFromZod,
  type FormState,
} from "@/lib/validators";

function dataFromForm(formData: FormData) {
  return {
    address: formData.get("address"),
    city: formData.get("city"),
    state: formData.get("state"),
    zip: formData.get("zip"),
    propertyType: formData.get("propertyType"),
    status: formData.get("status"),
    listPrice: formData.get("listPrice"),
    beds: formData.get("beds"),
    baths: formData.get("baths"),
    sqft: formData.get("sqft"),
    notes: formData.get("notes"),
  };
}

export async function createPropertyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = propertySchema.safeParse(dataFromForm(formData));
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  await prisma.property.create({
    data: { ...parsed.data, ownerId: user.id },
  });

  revalidatePath("/properties");
  revalidatePath("/dashboard");
  redirect("/properties");
}

export async function updatePropertyAction(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const parsed = propertySchema.safeParse(dataFromForm(formData));
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  await prisma.property.update({ where: { id }, data: parsed.data });

  revalidatePath("/properties");
  revalidatePath(`/properties/${id}`);
  revalidatePath("/dashboard");
  redirect(`/properties/${id}`);
}

export async function deletePropertyAction(formData: FormData): Promise<void> {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.property.delete({ where: { id } });
  revalidatePath("/properties");
  revalidatePath("/dashboard");
  redirect("/properties");
}
