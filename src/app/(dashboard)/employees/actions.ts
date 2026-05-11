"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import {
  departmentSchema, employeeSchema, payrollRunSchema, payrollItemSchema,
  type DepartmentFormValues, type EmployeeFormValues,
  type PayrollRunFormValues, type PayrollItemFormValues,
} from "@/lib/validators/employee";
import { z } from "zod/v4";

async function requireEmployeesAccess() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");
  const user = await currentUser();
  const role = user?.publicMetadata?.role as string | undefined;
  if (!role || !["admin", "manager"].includes(role)) throw new Error("Unauthorized");
  return userId;
}

async function requirePayrollAccess() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");
  const user = await currentUser();
  const role = user?.publicMetadata?.role as string | undefined;
  if (!role || !["admin", "accountant", "manager"].includes(role)) throw new Error("Unauthorized");
  return userId;
}

async function generateEmployeeNo(): Promise<string> {
  const count = await prisma.employee.count();
  return `EMP-${String(count + 1).padStart(3, "0")}`;
}

// ─── Departments ──────────────────────────────

export async function createDepartment(values: DepartmentFormValues) {
  await requireEmployeesAccess();
  const data = departmentSchema.parse(values);
  await prisma.department.create({ data: { name: data.name } });
  revalidatePath("/employees");
}

export async function deleteDepartment(id: string) {
  await requireEmployeesAccess();
  const count = await prisma.employee.count({
    where: { departmentId: id, deletedAt: null, endDate: null },
  });
  if (count > 0) throw new Error("Cannot delete a department with active employees");
  await prisma.department.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath("/employees");
}

// ─── Employees ────────────────────────────────

export async function createEmployee(values: EmployeeFormValues) {
  await requireEmployeesAccess();
  const data = employeeSchema.parse(values);
  const employeeNo = await generateEmployeeNo();

  const email = data.email || null;
  if (email) {
    const existing = await prisma.employee.findUnique({ where: { email } });
    if (existing) throw new Error(`Email "${email}" is already registered`);
  }

  await prisma.employee.create({
    data: {
      employeeNo,
      firstName:      data.firstName,
      lastName:       data.lastName,
      email,
      phone:          data.phone,
      citizenshipId:  data.citizenshipId || null,
      address:        data.address || null,
      departmentId:   data.departmentId,
      position:       data.position,
      basicSalary:    data.basicSalary,
      openingBalance: data.openingBalance ?? 0,
      startDate:      new Date(data.startDate),
      endDate:        data.endDate ? new Date(data.endDate) : null,
    },
  });

  revalidatePath("/employees");
}

export async function updateEmployee(id: string, values: EmployeeFormValues) {
  await requireEmployeesAccess();
  const data = employeeSchema.parse(values);

  const email = data.email || null;
  if (email) {
    const conflict = await prisma.employee.findFirst({
      where: { email, id: { not: id } },
    });
    if (conflict) throw new Error(`Email "${email}" is already registered`);
  }

  await prisma.employee.update({
    where: { id },
    data: {
      firstName:      data.firstName,
      lastName:       data.lastName,
      email,
      phone:          data.phone,
      citizenshipId:  data.citizenshipId || null,
      address:        data.address || null,
      departmentId:   data.departmentId,
      position:       data.position,
      basicSalary:    data.basicSalary,
      openingBalance: data.openingBalance ?? 0,
      startDate:      new Date(data.startDate),
      endDate:        data.endDate ? new Date(data.endDate) : null,
    },
  });

  revalidatePath("/employees");
  revalidatePath(`/employees/${id}`);
}

export async function terminateEmployee(id: string, endDate: string) {
  await requireEmployeesAccess();
  await prisma.employee.update({
    where: { id },
    data: { endDate: new Date(endDate) },
  });
  revalidatePath("/employees");
}

export async function deleteEmployee(id: string) {
  await requireEmployeesAccess();
  await prisma.employee.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/employees");
}

// ─── Salary Withdrawals ───────────────────────

const withdrawalSchema = z.object({
  amount:      z.number().positive("Amount must be greater than 0"),
  takenAt:     z.string().min(1, "Date is required"),
  filedBy:     z.string().optional(),
  givenBy:     z.string().optional(),
  paymentMode: z.enum(["CASH", "ONLINE"]).default("CASH"),
  notes:       z.string().optional(),
  photoUrl:    z.string().optional(),
});

export async function createWithdrawal(
  employeeId: string,
  values: {
    amount: number;
    takenAt: string;
    filedBy?: string;
    givenBy?: string;
    paymentMode?: "CASH" | "ONLINE";
    notes?: string;
    photoUrl?: string;
  }
) {
  const userId = await requirePayrollAccess();
  const data   = withdrawalSchema.parse(values);

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId, deletedAt: null },
    select: { id: true },
  });
  if (!employee) throw new Error("Employee not found");

  await prisma.salaryWithdrawal.create({
    data: {
      employeeId,
      amount:      data.amount,
      takenAt:     new Date(data.takenAt),
      filedBy:     data.filedBy || null,
      givenBy:     data.givenBy || null,
      paymentMode: data.paymentMode,
      notes:       data.notes || null,
      photoUrl:    data.photoUrl || null,
      recordedBy:  userId,
    },
  });

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/employees");
}

export async function deleteWithdrawal(id: string, employeeId: string) {
  await requirePayrollAccess();
  const record = await prisma.salaryWithdrawal.findUnique({
    where: { id },
    include: { appliedDeduction: { select: { id: true } } },
  });
  if (!record || record.employeeId !== employeeId) throw new Error("Not found");
  if (record.appliedDeduction) {
    throw new Error("This advance has been applied to a payroll run. Remove the payroll entry first.");
  }
  await prisma.salaryWithdrawal.delete({ where: { id } });
  revalidatePath(`/employees/${employeeId}`);
}

export async function applyWithdrawalToPayroll(withdrawalId: string, payrollItemId: string) {
  const userId = await requirePayrollAccess();

  const withdrawal = await prisma.salaryWithdrawal.findUnique({
    where: { id: withdrawalId },
    include: { appliedDeduction: { select: { id: true } } },
  });
  if (!withdrawal) throw new Error("Withdrawal not found");
  if (withdrawal.appliedDeduction) throw new Error("This advance is already applied to a payroll run");

  const item = await prisma.payrollItem.findUnique({
    where: { id: payrollItemId },
    select: {
      basicSalary: true, carryoverIn: true, deductions: true,
      employeeId: true, payrollRunId: true,
      payrollRun: { select: { status: true } },
    },
  });
  if (!item) throw new Error("Payroll item not found");
  if (item.payrollRun.status === "FINALIZED") throw new Error("Cannot modify a finalized payroll run");
  if (withdrawal.employeeId !== item.employeeId) throw new Error("Withdrawal belongs to a different employee");

  const amount        = Number(withdrawal.amount);
  const newDeductions = Number(item.deductions) + amount;
  const totalOwed     = Number(item.basicSalary) + Number(item.carryoverIn);
  if (newDeductions > totalOwed + 0.005) {
    throw new Error(`Amount (Rs ${amount.toFixed(2)}) exceeds total owed (Rs ${totalOwed.toFixed(2)})`);
  }
  const newNetPay = calcNetPay(Number(item.basicSalary), Number(item.carryoverIn), newDeductions);

  await prisma.$transaction(async (tx) => {
    await tx.payrollDeduction.create({
      data: {
        payrollItemId,
        withdrawalId,
        amount:      withdrawal.amount,
        givenBy:     withdrawal.givenBy,
        givenAt:     withdrawal.takenAt,
        paymentMode: withdrawal.paymentMode,
        notes:       withdrawal.notes ?? `Advance applied (taken ${withdrawal.takenAt.toISOString().slice(0, 10)})`,
        recordedBy:  userId,
      },
    });
    await tx.payrollItem.update({
      where: { id: payrollItemId },
      data: { deductions: newDeductions, netPay: newNetPay },
    });
    await tx.payrollRun.update({
      where: { id: item.payrollRunId },
      data: { updatedBy: userId },
    });
  });

  revalidatePath("/payroll");
}

// ─── Payroll Runs ─────────────────────────────

export async function createPayrollRun(values: PayrollRunFormValues) {
  const userId = await requirePayrollAccess();
  const data = payrollRunSchema.parse(values);

  const employees = await prisma.employee.findMany({
    where: { deletedAt: null, endDate: null },
    select: {
      id: true, basicSalary: true, openingBalance: true,
    },
  });

  if (employees.length === 0) {
    throw new Error("No active employees found. Add employees before creating a payroll run.");
  }

  // ── Auto-carryover: find previous month's remaining balances ──────────────
  const prevMonth = data.month === 1 ? 12 : data.month - 1;
  const prevYear  = data.month === 1 ? data.year - 1 : data.year;
  const prevRun   = await prisma.payrollRun.findFirst({
    where: { month: prevMonth, year: prevYear },
    include: { items: { select: { employeeId: true, netPay: true } } },
  });

  const carryoverMap = new Map<string, number>();
  if (prevRun) {
    for (const item of prevRun.items) {
      const remaining = Number(item.netPay);
      if (remaining > 0.005) carryoverMap.set(item.employeeId, remaining);
    }
  }

  // For employees who have NEVER appeared in any payroll run, use their
  // openingBalance as the initial carryover (represents pre-system salary dues).
  const employeeIds = employees.map((e) => e.id);
  const alreadyInPayroll = new Set(
    (await prisma.payrollItem.findMany({
      where:  { employeeId: { in: employeeIds } },
      select: { employeeId: true },
      distinct: ["employeeId"],
    })).map((i) => i.employeeId)
  );
  for (const emp of employees) {
    if (!carryoverMap.has(emp.id) && !alreadyInPayroll.has(emp.id)) {
      const openingBal = Number(emp.openingBalance);
      if (openingBal > 0.005) carryoverMap.set(emp.id, openingBal);
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const run = await prisma.$transaction(async (tx) => {
      const payrollRun = await tx.payrollRun.create({
        data: {
          month:     data.month,
          year:      data.year,
          notes:     data.notes || null,
          createdBy: userId,
        },
      });

      await tx.payrollItem.createMany({
        data: employees.map((emp) => {
          const carryover = carryoverMap.get(emp.id) ?? 0;
          return {
            payrollRunId: payrollRun.id,
            employeeId:   emp.id,
            basicSalary:  emp.basicSalary,
            carryoverIn:  carryover,
            allowances:   0,
            deductions:   0,
            netPay:       Number(emp.basicSalary) + carryover,
          };
        }),
      });

      return payrollRun;
    });

    revalidatePath("/payroll");
    return run.id;
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      throw new Error(`A payroll run for ${MONTHS[data.month - 1]} ${data.year} already exists`);
    }
    throw e;
  }
}

// netPay = basicSalary + carryoverIn − totalPaid (always recalculated from carryoverIn)
function calcNetPay(basicSalary: number, carryoverIn: number, totalPaid: number): number {
  return basicSalary + carryoverIn - totalPaid;
}

export async function updatePayrollItem(id: string, values: PayrollItemFormValues) {
  const userId = await requirePayrollAccess();
  const data = payrollItemSchema.parse(values);

  const item = await prisma.payrollItem.findUnique({
    where: { id },
    select: { basicSalary: true, carryoverIn: true, payrollRunId: true },
  });
  if (!item) throw new Error("Payroll item not found");

  const netPay = calcNetPay(Number(item.basicSalary), Number(item.carryoverIn), data.deductions);
  if (netPay < 0) throw new Error("Total paid cannot exceed total owed");

  await prisma.$transaction(async (tx) => {
    await tx.payrollItem.update({
      where: { id },
      data: { allowances: 0, deductions: data.deductions, netPay, notes: data.notes || null },
    });
    await tx.payrollRun.update({
      where: { id: item.payrollRunId },
      data: { updatedBy: userId },
    });
  });

  revalidatePath("/payroll");
}

const payrollDeductionSchema = z.object({
  amount:      z.number().positive("Amount must be greater than 0"),
  givenBy:     z.string().optional(),
  givenAt:     z.string().min(1, "Date is required"),
  paymentMode: z.enum(["CASH", "ONLINE"]),
  notes:       z.string().optional(),
  photoUrl:    z.string().optional(),
});

export async function addPayrollDeduction(
  payrollItemId: string,
  values: {
    amount: number;
    givenBy?: string;
    givenAt: string;
    paymentMode: "CASH" | "ONLINE";
    notes?: string;
    photoUrl?: string;
  }
) {
  const userId = await requirePayrollAccess();
  const data   = payrollDeductionSchema.parse(values);

  const item = await prisma.payrollItem.findUnique({
    where: { id: payrollItemId },
    select: { basicSalary: true, carryoverIn: true, deductions: true, payrollRunId: true, payrollRun: { select: { status: true } } },
  });
  if (!item) throw new Error("Payroll item not found");
  if (item.payrollRun.status === "FINALIZED") throw new Error("Cannot modify a finalized payroll run");

  const newDeductions = Number(item.deductions) + data.amount;
  const totalOwed     = Number(item.basicSalary) + Number(item.carryoverIn);
  if (newDeductions > totalOwed + 0.005) {
    throw new Error(`Payment exceeds total owed (Rs ${totalOwed.toFixed(2)})`);
  }
  const newNetPay = calcNetPay(Number(item.basicSalary), Number(item.carryoverIn), newDeductions);

  await prisma.$transaction(async (tx) => {
    await tx.payrollDeduction.create({
      data: {
        payrollItemId,
        amount:      data.amount,
        givenBy:     data.givenBy || null,
        givenAt:     new Date(data.givenAt),
        paymentMode: data.paymentMode,
        notes:       data.notes || null,
        photoUrl:    data.photoUrl || null,
        recordedBy:  userId,
      },
    });
    await tx.payrollItem.update({
      where: { id: payrollItemId },
      data: { deductions: newDeductions, netPay: newNetPay },
    });
    await tx.payrollRun.update({
      where: { id: item.payrollRunId },
      data: { updatedBy: userId },
    });
  });

  revalidatePath("/payroll");
}

export async function deletePayrollDeduction(id: string, payrollItemId: string) {
  const userId = await requirePayrollAccess();

  const deduction = await prisma.payrollDeduction.findUnique({
    where: { id },
    select: { amount: true },
  });
  if (!deduction) throw new Error("Deduction not found");

  const item = await prisma.payrollItem.findUnique({
    where: { id: payrollItemId },
    select: { basicSalary: true, carryoverIn: true, deductions: true, payrollRunId: true, payrollRun: { select: { status: true } } },
  });
  if (!item) throw new Error("Payroll item not found");
  if (item.payrollRun.status === "FINALIZED") throw new Error("Cannot modify a finalized payroll run");

  const newDeductions = Math.max(0, Number(item.deductions) - Number(deduction.amount));
  const newNetPay     = calcNetPay(Number(item.basicSalary), Number(item.carryoverIn), newDeductions);

  await prisma.$transaction(async (tx) => {
    await tx.payrollDeduction.delete({ where: { id } });
    await tx.payrollItem.update({
      where: { id: payrollItemId },
      data: { deductions: newDeductions, netPay: newNetPay },
    });
    await tx.payrollRun.update({
      where: { id: item.payrollRunId },
      data: { updatedBy: userId },
    });
  });

  revalidatePath("/payroll");
}

export async function finalizePayrollRun(id: string) {
  const userId = await requirePayrollAccess();

  const run = await prisma.payrollRun.findUnique({
    where: { id },
    select: { status: true, month: true, year: true },
  });
  if (!run) throw new Error("Payroll run not found");
  if (run.status === "FINALIZED") throw new Error("Payroll run is already finalized");

  await prisma.$transaction(async (tx) => {
    await tx.payrollRun.update({ where: { id }, data: { status: "FINALIZED", updatedBy: userId } });
    await tx.auditLog.create({
      data: {
        userId,
        action:     "FINALIZE_PAYROLL",
        entityType: "PayrollRun",
        entityId:   id,
        after:      { month: run.month, year: run.year, status: "FINALIZED" },
      },
    });
  });

  revalidatePath(`/payroll/${id}`);
  revalidatePath("/payroll");
}

export async function deletePayrollRun(id: string) {
  await requirePayrollAccess();

  const run = await prisma.payrollRun.findUnique({
    where: { id },
    select: { month: true, year: true },
  });
  if (!run) throw new Error("Payroll run not found");

  // Find next month's run (if any) — its carryover needs to be recalculated
  const nextMonth = run.month === 12 ? 1  : run.month + 1;
  const nextYear  = run.month === 12 ? run.year + 1 : run.year;
  const nextRun   = await prisma.payrollRun.findFirst({
    where: { month: nextMonth, year: nextYear },
    include: { items: { select: { id: true, employeeId: true, basicSalary: true, deductions: true } } },
  });

  // Find the run two months back — that becomes the new source of carryover for next month
  const prevMonth = run.month === 1 ? 12 : run.month - 1;
  const prevYear  = run.month === 1 ? run.year - 1 : run.year;
  const prevRun   = await prisma.payrollRun.findFirst({
    where: { month: prevMonth, year: prevYear },
    include: { items: { select: { employeeId: true, netPay: true } } },
  });

  const prevCarryoverMap = new Map<string, number>();
  if (prevRun) {
    for (const item of prevRun.items) {
      const remaining = Number(item.netPay);
      if (remaining > 0.005) prevCarryoverMap.set(item.employeeId, remaining);
    }
  }

  // If there's no prevRun (we're deleting the very first run), fall back to each
  // employee's openingBalance so carryover in the next run is still correct.
  let openingBalanceMap = new Map<string, number>();
  if (!prevRun && nextRun) {
    const empIds = nextRun.items.map((i) => i.employeeId);
    const emps   = await prisma.employee.findMany({
      where:  { id: { in: empIds } },
      select: { id: true, openingBalance: true },
    });
    for (const emp of emps) {
      const bal = Number(emp.openingBalance);
      if (bal > 0.005) openingBalanceMap.set(emp.id, bal);
    }
  }

  await prisma.$transaction(async (tx) => {
    // Delete deduction entries first (cascade should handle it, but be explicit)
    await tx.payrollDeduction.deleteMany({
      where: { payrollItem: { payrollRunId: id } },
    });
    await tx.payrollItem.deleteMany({ where: { payrollRunId: id } });
    await tx.payrollRun.delete({ where: { id } });

    // Cascade: update next month's carryover from the now-previous month
    if (nextRun) {
      for (const item of nextRun.items) {
        const newCarryover = prevCarryoverMap.get(item.employeeId)
          ?? openingBalanceMap.get(item.employeeId)
          ?? 0;
        const newNetPay    = calcNetPay(Number(item.basicSalary), newCarryover, Number(item.deductions));
        await tx.payrollItem.update({
          where: { id: item.id },
          data:  { carryoverIn: newCarryover, netPay: newNetPay },
        });
      }
    }
  });

  revalidatePath("/payroll");
  if (nextRun) revalidatePath(`/payroll/${nextRun.id}`);
}
