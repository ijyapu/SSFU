"use server";

import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { expenseSchema, type ExpenseFormValues } from "@/lib/validators/expense";

async function getUser() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");
  const user = await currentUser();
  const role = (user?.publicMetadata?.role as string | undefined) ?? null;
  return { userId, role };
}

function canApprove(role: string | null) {
  return role !== null && ["superadmin", "admin", "manager", "accountant"].includes(role);
}

export async function submitExpense(values: ExpenseFormValues) {
  const { userId } = await getUser();
  const data = expenseSchema.parse(values);

  await prisma.expense.create({
    data: {
      categoryId:    data.categoryId,
      description:   data.description,
      amount:        data.amount,
      date:          new Date(data.date),
      notes:         data.notes || null,
      attachmentUrl: data.attachmentUrl || null,
      submittedBy:   userId,
    },
  });

  revalidatePath("/expenses");
}

export async function updateExpense(id: string, values: ExpenseFormValues) {
  const { userId, role } = await getUser();
  const data = expenseSchema.parse(values);

  const expense = await prisma.expense.findUnique({
    where: { id },
    select: { submittedBy: true, status: true },
  });
  if (!expense) throw new Error("Expense not found");

  const isOwner   = expense.submittedBy === userId;
  const isPending = expense.status === "SUBMITTED";

  if (!isOwner && !canApprove(role)) throw new Error("Unauthorized");
  if (isOwner && !isPending && !canApprove(role)) {
    throw new Error("Cannot edit an expense that has already been reviewed");
  }

  await prisma.expense.update({
    where: { id },
    data: {
      categoryId:    data.categoryId,
      description:   data.description,
      amount:        data.amount,
      date:          new Date(data.date),
      notes:         data.notes || null,
      attachmentUrl: data.attachmentUrl ?? null,
    },
  });

  revalidatePath("/expenses");
}

export async function approveExpense(id: string) {
  const { userId, role } = await getUser();
  if (!canApprove(role)) throw new Error("Unauthorized");

  const expense = await prisma.expense.findUnique({ where: { id }, select: { status: true } });
  if (!expense) throw new Error("Expense not found");
  if (expense.status !== "SUBMITTED") throw new Error("Only submitted expenses can be approved");

  await prisma.expense.update({
    where: { id },
    data: { status: "APPROVED", approvedBy: userId },
  });

  revalidatePath("/expenses");
}

export async function rejectExpense(id: string) {
  const { userId, role } = await getUser();
  if (!canApprove(role)) throw new Error("Unauthorized");

  const expense = await prisma.expense.findUnique({ where: { id }, select: { status: true } });
  if (!expense) throw new Error("Expense not found");
  if (expense.status !== "SUBMITTED") throw new Error("Only submitted expenses can be rejected");

  await prisma.expense.update({
    where: { id },
    data: { status: "REJECTED", approvedBy: userId },
  });

  revalidatePath("/expenses");
}

export async function deleteExpense(id: string) {
  const { userId, role } = await getUser();

  const expense = await prisma.expense.findUnique({
    where: { id },
    select: { submittedBy: true, status: true },
  });
  if (!expense) throw new Error("Expense not found");
  if (expense.submittedBy !== userId && !canApprove(role)) throw new Error("Unauthorized");
  if (expense.status === "APPROVED" && !canApprove(role)) {
    throw new Error("Cannot delete an approved expense");
  }

  await prisma.expense.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath("/expenses");
}
