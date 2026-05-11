"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import {
  receiptSchema, type ReceiptFormValues,
  receiptPaymentSchema, type ReceiptPaymentFormValues,
} from "@/lib/validators/receipts";
import { getNextDocumentNumber } from "@/lib/doc-counter";

type Db = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

async function requireAccess() {
  const user = await currentUser();
  if (!user) throw new Error("Unauthenticated");
  const role = user.publicMetadata?.role as string | undefined;
  if (!role || !["superadmin", "admin", "manager", "accountant"].includes(role)) {
    throw new Error("Unauthorized");
  }
  return user.id;
}

async function generateReceiptNumber(db: Db = prisma): Promise<string> {
  return getNextDocumentNumber(`REC-${new Date().getFullYear()}-`, db);
}

export async function createReceipt(values: ReceiptFormValues) {
  const userId = await requireAccess();
  const data   = receiptSchema.parse(values);

  await prisma.$transaction(async (tx) => {
    const receiptNumber = await generateReceiptNumber(tx as Db);
    await tx.receipt.create({
      data: {
        receiptNumber,
        receivedFrom:  data.receivedFrom,
        amount:        data.amount,
        method:        data.method,
        reference:     data.reference || null,
        notes:         data.notes || null,
        photoUrl:      data.photoUrl ?? null,
        receivedAt:    new Date(data.receivedAt),
        createdBy:     userId,
      },
    });
  });

  revalidatePath("/receipts");
}

export async function updateReceipt(id: string, values: ReceiptFormValues) {
  await requireAccess();
  const data = receiptSchema.parse(values);

  await prisma.receipt.update({
    where: { id },
    data: {
      receivedFrom: data.receivedFrom,
      amount:       data.amount,
      method:       data.method,
      reference:    data.reference || null,
      notes:        data.notes || null,
      photoUrl:     data.photoUrl ?? null,
      receivedAt:   new Date(data.receivedAt),
    },
  });

  revalidatePath("/receipts");
}

export async function deleteReceipt(id: string) {
  await requireAccess();
  await prisma.receipt.update({
    where: { id },
    data:  { deletedAt: new Date() },
  });
  revalidatePath("/receipts");
}

// ─── Receipt Payments (money paid back / disbursed) ────────────────────────────

async function generatePaymentNumber(db: Db = prisma): Promise<string> {
  return getNextDocumentNumber(`RPY-${new Date().getFullYear()}-`, db);
}

export async function createReceiptPayment(values: ReceiptPaymentFormValues) {
  const userId = await requireAccess();
  const data   = receiptPaymentSchema.parse(values);

  await prisma.$transaction(async (tx) => {
    const paymentNumber = await generatePaymentNumber(tx as Db);
    await tx.receiptPayment.create({
      data: {
        paymentNumber,
        paidTo:    data.paidTo,
        amount:    data.amount,
        method:    data.method,
        reference: data.reference || null,
        notes:     data.notes || null,
        photoUrl:  data.photoUrl ?? null,
        paidAt:    new Date(data.paidAt),
        createdBy: userId,
      },
    });
  });

  revalidatePath("/receipts");
}

export async function updateReceiptPayment(id: string, values: ReceiptPaymentFormValues) {
  await requireAccess();
  const data = receiptPaymentSchema.parse(values);

  await prisma.receiptPayment.update({
    where: { id },
    data: {
      paidTo:    data.paidTo,
      amount:    data.amount,
      method:    data.method,
      reference: data.reference || null,
      notes:     data.notes || null,
      photoUrl:  data.photoUrl ?? null,
      paidAt:    new Date(data.paidAt),
    },
  });

  revalidatePath("/receipts");
}

export async function deleteReceiptPayment(id: string) {
  await requireAccess();
  await prisma.receiptPayment.update({
    where: { id },
    data:  { deletedAt: new Date() },
  });
  revalidatePath("/receipts");
}

// ─── Duplicate guard ───────────────────────────────────────────────────────────

export type SalesmanDuplicateMatch = {
  id:          string;
  salesmanName: string;
  orderNumber: string;
  amount:      number;
  paidAt:      string; // ISO string
};

/**
 * Returns SalesmanPayment records that share the same amount and fall within
 * ±1 calendar day of the given date. Used to surface a soft duplicate warning
 * when recording a Receipt, since both models represent money-in cash events.
 */
export async function checkSalesmanPaymentDuplicate(
  amount: number,
  dateStr: string,
): Promise<SalesmanDuplicateMatch[]> {
  await requireAccess();

  // Build a ±1 day window around noon of the receipt date to avoid timezone edge cases
  const anchor      = new Date(dateStr + "T12:00:00Z");
  const windowStart = new Date(anchor.getTime() - 86_400_000);
  const windowEnd   = new Date(anchor.getTime() + 86_400_000);

  const matches = await prisma.salesmanPayment.findMany({
    where: {
      amount: { gte: amount - 0.005, lte: amount + 0.005 },
      paidAt: { gte: windowStart, lte: windowEnd },
    },
    include: {
      salesman:   { select: { name: true } },
      salesOrder: { select: { orderNumber: true } },
    },
    orderBy: { paidAt: "desc" },
    take: 5,
  });

  return matches.map((m) => ({
    id:           m.id,
    salesmanName: m.salesman.name,
    orderNumber:  m.salesOrder.orderNumber,
    amount:       Number(m.amount),
    paidAt:       m.paidAt.toISOString(),
  }));
}
