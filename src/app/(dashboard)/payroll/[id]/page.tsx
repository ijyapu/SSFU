import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { PayrollDetail } from "./_components/payroll-detail";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await prisma.payrollRun.findUnique({ where: { id }, select: { month: true, year: true } });
  return {
    title: run
      ? `${MONTHS[run.month - 1]} ${run.year} Payroll`
      : "Payroll Run",
  };
}

export default async function PayrollRunPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  await requirePermission("payroll");
  const { id } = await params;
  const { print: autoPrint } = await searchParams;

  const run = await prisma.payrollRun.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          employee: { include: { department: true } },
          deductionEntries: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { employee: { firstName: "asc" } },
      },
    },
  });

  if (!run) notFound();

  // Fetch all SalaryWithdrawals for every employee in this run (any date — unapplied may be old)
  const employeeIds = run.items.map((i) => i.employee.id);
  const allWithdrawals = await prisma.salaryWithdrawal.findMany({
    where: { employeeId: { in: employeeIds } },
    include: {
      appliedDeduction: { select: { id: true, payrollItemId: true } },
    },
    orderBy: { takenAt: "asc" },
  });

  const serialised = {
    id:     run.id,
    month:  run.month,
    year:   run.year,
    status: run.status,
    notes:  run.notes,
    items:  run.items.map((item) => {
      const empWithdrawals = allWithdrawals.filter((w) => w.employeeId === item.employee.id);
      return {
        id:           item.id,
        employeeNo:   item.employee.employeeNo,
        employeeName: `${item.employee.firstName} ${item.employee.lastName}`,
        department:   item.employee.department.name,
        position:     item.employee.position,
        basicSalary:  Number(item.basicSalary),
        carryoverIn:  Number(item.carryoverIn),
        totalPaid:    Number(item.deductions),
        remaining:    Number(item.netPay),
        notes:        item.notes,
        deductionEntries: item.deductionEntries.map((d) => ({
          id:           d.id,
          amount:       Number(d.amount),
          givenBy:      d.givenBy,
          givenAt:      d.givenAt?.toISOString() ?? null,
          paymentMode:  d.paymentMode,
          notes:        d.notes,
          photoUrl:     d.photoUrl,
          createdAt:    d.createdAt.toISOString(),
          withdrawalId: d.withdrawalId ?? null,
        })),
        withdrawals: empWithdrawals.map((w) => ({
          id:                w.id,
          amount:            Number(w.amount),
          takenAt:           w.takenAt.toISOString(),
          notes:             w.notes,
          paymentMode:       w.paymentMode,
          isAppliedHere:     w.appliedDeduction?.payrollItemId === item.id,
          isAppliedElsewhere: w.appliedDeduction !== null && w.appliedDeduction.payrollItemId !== item.id,
        })),
      };
    }),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/payroll"
          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">
            {MONTHS[run.month - 1]} {run.year} Payroll
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {run.items.length} employee{run.items.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <PayrollDetail {...serialised} autoPrint={autoPrint === "1"} />
    </div>
  );
}
