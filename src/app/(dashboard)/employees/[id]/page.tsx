import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { ArrowLeft, Building2, Phone, Mail, Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { toNepaliDateString } from "@/lib/nepali-date";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmployeeDetail } from "./_components/employee-detail";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const emp = await prisma.employee.findUnique({
    where: { id },
    select: { firstName: true, lastName: true },
  });
  return {
    title: emp ? `${emp.firstName} ${emp.lastName}` : "Employee",
  };
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtRs(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  await requirePermission("employees");
  const { id } = await params;
  const { month: rawMonth, year: rawYear } = await searchParams;

  const now           = new Date();
  const selectedMonth = rawMonth ? parseInt(rawMonth, 10) : now.getMonth() + 1;
  const selectedYear  = rawYear  ? parseInt(rawYear,  10) : now.getFullYear();

  const employee = await prisma.employee.findUnique({
    where: { id, deletedAt: null },
    include: { department: true },
  });
  if (!employee) notFound();

  const monthStart = startOfMonth(new Date(selectedYear, selectedMonth - 1));
  const monthEnd   = endOfMonth(new Date(selectedYear, selectedMonth - 1));

  // ── This-month withdrawals for the deductions card ──
  const [withdrawals, payrollItems, allWithdrawals] = await Promise.all([
    prisma.salaryWithdrawal.findMany({
      where:   { employeeId: id, takenAt: { gte: monthStart, lte: monthEnd } },
      include: { appliedDeduction: { select: { id: true } } },
      orderBy: { takenAt: "desc" },
    }),
    prisma.payrollItem.findMany({
      where: { employeeId: id },
      include: {
        payrollRun:       { select: { month: true, year: true, status: true } },
        deductionEntries: { orderBy: { givenAt: "asc" } },
      },
      orderBy: [{ payrollRun: { year: "asc" } }, { payrollRun: { month: "asc" } }],
    }),
    prisma.salaryWithdrawal.findMany({
      where:   { employeeId: id },
      include: { appliedDeduction: { select: { id: true } } },
      orderBy: { takenAt: "asc" },
    }),
  ]);

  const totalWithdrawn = withdrawals.reduce((s, w) => s + Number(w.amount), 0);

  const serialisedWithdrawals = withdrawals.map((w) => ({
    id: w.id, amount: Number(w.amount), takenAt: w.takenAt.toISOString(),
    filedBy: w.filedBy, givenBy: w.givenBy,
    paymentMode: w.paymentMode as "CASH" | "ONLINE",
    notes: w.notes, photoUrl: w.photoUrl,
    isApplied: !!w.appliedDeduction,
  }));

  // Build prev/next month links
  const prevMonth = selectedMonth === 1
    ? { month: 12, year: selectedYear - 1 }
    : { month: selectedMonth - 1, year: selectedYear };
  const nextMonth = selectedMonth === 12
    ? { month: 1, year: selectedYear + 1 }
    : { month: selectedMonth + 1, year: selectedYear };

  // ── Build ledger entries ──────────────────────────────────────────────────
  type LedgerEntry = {
    sortKey: string;
    date: Date;
    type: "opening" | "salary" | "withdrawal" | "payroll_payment";
    description: string;
    paymentMode?: "CASH" | "ONLINE";
    credit: number;
    debit: number;
    balance: number;
  };

  const raw: Omit<LedgerEntry, "balance">[] = [];

  const openingBalance = Number(employee.openingBalance);
  if (openingBalance > 0) {
    raw.push({
      date: employee.createdAt,
      sortKey: employee.createdAt.toISOString() + "_0",
      type: "opening",
      description: "Opening Balance (pre-system dues)",
      credit: openingBalance,
      debit: 0,
    });
  }

  for (const item of payrollItems) {
    const { month, year } = item.payrollRun;
    const salaryDate = new Date(Date.UTC(year, month - 1, 1));
    raw.push({
      date: salaryDate,
      sortKey: salaryDate.toISOString() + "_1",
      type: "salary",
      description: `Salary — ${MONTHS[month - 1]} ${year}${item.payrollRun.status === "DRAFT" ? " (draft)" : ""}`,
      credit: Number(item.basicSalary),
      debit: 0,
    });
    for (const ded of item.deductionEntries) {
      // Skip applied-advance deductions — already debited when the SalaryWithdrawal was recorded
      if (ded.withdrawalId) continue;
      raw.push({
        date: ded.givenAt,
        sortKey: ded.givenAt.toISOString() + "_2",
        type: "payroll_payment",
        description: `Salary payment${ded.notes ? ` — ${ded.notes}` : ""}${ded.givenBy ? ` (by ${ded.givenBy})` : ""}`,
        paymentMode: ded.paymentMode as "CASH" | "ONLINE",
        credit: 0,
        debit: Number(ded.amount),
      });
    }
  }

  for (const w of allWithdrawals) {
    raw.push({
      date: w.takenAt,
      sortKey: w.takenAt.toISOString() + "_3",
      type: "withdrawal",
      description: `Cash withdrawal${w.notes ? ` — ${w.notes}` : ""}${w.givenBy ? ` (by ${w.givenBy})` : ""}`,
      paymentMode: w.paymentMode as "CASH" | "ONLINE",
      credit: 0,
      debit: Number(w.amount),
    });
  }

  raw.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  let runningBalance = 0;
  const ledgerEntries: LedgerEntry[] = raw.map((e) => {
    runningBalance += e.credit - e.debit;
    return { ...e, balance: runningBalance };
  });

  const currentBalance = runningBalance;
  const totalEarned    = ledgerEntries.reduce((s, e) => s + e.credit, 0);
  const totalPaid      = ledgerEntries.reduce((s, e) => s + e.debit, 0);

  // Group ledger by month for section headers
  type MonthGroup = { label: string; entries: LedgerEntry[] };
  const monthGroups: MonthGroup[] = [];
  for (const entry of ledgerEntries) {
    const label = entry.type === "opening"
      ? "Opening"
      : `${MONTHS[entry.date.getUTCMonth()]} ${entry.date.getUTCFullYear()}`;
    const last = monthGroups[monthGroups.length - 1];
    if (!last || last.label !== label) monthGroups.push({ label, entries: [entry] });
    else last.entries.push(entry);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/employees" className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">
            {employee.firstName} {employee.lastName}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {employee.employeeNo} · {employee.position}
          </p>
        </div>
      </div>

      {/* Employee info strip */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground rounded-lg border bg-muted/20 px-4 py-3">
        <span className="flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5" />
          {employee.department.name}
        </span>
        {employee.phone && (
          <span className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" />
            {employee.phone}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5" />
          {employee.email}
        </span>
        <span className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          Joined {format(employee.startDate, "d MMM yyyy")} ({toNepaliDateString(new Date(employee.startDate))})
        </span>
      </div>

      {/* Month navigator */}
      <div className="flex items-center gap-3">
        <Link
          href={`/employees/${id}?month=${prevMonth.month}&year=${prevMonth.year}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          ← {MONTHS[prevMonth.month - 1]} {prevMonth.year}
        </Link>
        <span className="font-semibold text-sm px-2">
          {MONTHS[selectedMonth - 1]} {selectedYear}
        </span>
        <Link
          href={`/employees/${id}?month=${nextMonth.month}&year=${nextMonth.year}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          {MONTHS[nextMonth.month - 1]} {nextMonth.year} →
        </Link>
      </div>

      {/* Monthly deductions widget */}
      <EmployeeDetail
        employeeId={id}
        employeeName={`${employee.firstName} ${employee.lastName}`}
        monthlySalary={Number(employee.basicSalary)}
        withdrawals={serialisedWithdrawals}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        totalWithdrawn={totalWithdrawn}
        allTimeWithdrawals={[]}
      />

      {/* ── Salary Ledger ────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Salary Ledger</h2>
          <span className="text-sm text-muted-foreground">All-time running balance</span>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground font-medium">Current Balance</p>
            <p className={`text-2xl font-bold tabular-nums mt-0.5 ${currentBalance > 0 ? "text-amber-600" : "text-green-600"}`}>
              Rs {fmtRs(currentBalance)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {currentBalance > 0 ? "Owed to employee" : "Fully settled"}
            </p>
          </div>
          <div className="rounded-lg border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground font-medium">Total Earned</p>
            <p className="text-2xl font-bold tabular-nums text-emerald-700 mt-0.5">Rs {fmtRs(totalEarned)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">salary + opening balance</p>
          </div>
          <div className="rounded-lg border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground font-medium">Total Paid Out</p>
            <p className="text-2xl font-bold tabular-nums text-rose-600 mt-0.5">Rs {fmtRs(totalPaid)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">withdrawals + payments</p>
          </div>
        </div>

        {/* Ledger table */}
        {ledgerEntries.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground text-sm">
            No ledger entries yet. Entries appear once payroll runs are created or withdrawals are recorded.
          </div>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-28">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-20 text-center">Mode</TableHead>
                  <TableHead numeric className="text-emerald-700 w-32">Credit (+)</TableHead>
                  <TableHead numeric className="text-rose-600 w-32">Debit (−)</TableHead>
                  <TableHead numeric className="font-bold w-36">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthGroups.map(({ label, entries: groupEntries }) => (
                  <React.Fragment key={label}>
                    <TableRow className="bg-muted/30 hover:bg-muted/30 border-y border-border/60">
                      <TableCell colSpan={6} className="py-1.5 px-4">
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          {label}
                        </span>
                      </TableCell>
                    </TableRow>
                    {groupEntries.map((entry, i) => (
                      <TableRow
                        key={`${label}-${i}`}
                        className={
                          entry.type === "salary"
                            ? "bg-emerald-50/40 hover:bg-emerald-50/60"
                            : entry.type === "opening"
                            ? "bg-muted/20 hover:bg-muted/30"
                            : ""
                        }
                      >
                        <TableCell className="text-xs text-muted-foreground tabular-nums">
                          {entry.date.toLocaleDateString("en-IN", {
                            day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {entry.type === "salary" && (
                              <TrendingUp className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            )}
                            {(entry.type === "withdrawal" || entry.type === "payroll_payment") && (
                              <TrendingDown className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                            )}
                            <span className={`text-sm ${entry.type === "salary" ? "font-medium" : ""}`}>
                              {entry.description}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {entry.paymentMode && (
                            <Badge
                              variant="secondary"
                              className={`text-[10px] px-1.5 py-0 ${
                                entry.paymentMode === "ONLINE"
                                  ? "bg-slate-100 text-slate-700"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {entry.paymentMode}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell numeric>
                          {entry.credit > 0 ? (
                            <span className="text-emerald-700 font-medium tabular-nums">+{fmtRs(entry.credit)}</span>
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </TableCell>
                        <TableCell numeric>
                          {entry.debit > 0 ? (
                            <span className="text-rose-600 tabular-nums">−{fmtRs(entry.debit)}</span>
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </TableCell>
                        <TableCell numeric>
                          <span className={`font-semibold tabular-nums ${
                            entry.balance < 0 ? "text-red-600"
                            : entry.balance === 0 ? "text-muted-foreground"
                            : "text-foreground"
                          }`}>
                            Rs {fmtRs(entry.balance)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Balance = unpaid salary owed to employee. Includes all payroll payments and ad-hoc withdrawals.
        </p>
      </div>
    </div>
  );
}
