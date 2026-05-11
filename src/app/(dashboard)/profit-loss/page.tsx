import { Suspense } from "react";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { toNepaliDateString } from "@/lib/nepali-date";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { DateRangePicker } from "./_components/date-range-picker";
import { PlBreakdown } from "./_components/pl-breakdown";

export const metadata = { title: "Profit & Loss" };

export default async function ProfitLossPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requirePermission("profitLoss");

  const params = await searchParams;
  const now    = new Date();

  // Parse or default to current month
  const fromDate = params.from
    ? startOfDay(new Date(params.from))
    : startOfMonth(now);
  const toDate = params.to
    ? endOfDay(new Date(params.to))
    : endOfMonth(now);

  const fromStr = format(fromDate, "yyyy-MM-dd");
  const toStr   = format(toDate,   "yyyy-MM-dd");

  // ── Data queries ──────────────────────────────

  const [salesOrders, purchaseMovements, expenses, payrollItems] = await Promise.all([
    // Revenue: active sales in period (exclude draft, cancelled, and written-off orders)
    prisma.salesOrder.findMany({
      where: {
        status:    { notIn: ["CANCELLED", "DRAFT", "LOST"] },
        orderDate: { gte: fromDate, lte: toDate },
        deletedAt: null,
      },
      select: { totalAmount: true, commissionAmount: true, factoryAmount: true },
    }),

    // COGS: stock movements of type PURCHASE in period (goods actually received)
    prisma.stockMovement.findMany({
      where: {
        type:      "PURCHASE",
        createdAt: { gte: fromDate, lte: toDate },
      },
      select: { quantity: true, unitCost: true },
    }),

    // Operating expenses: approved in period, grouped by category
    prisma.expense.findMany({
      where: {
        status:    "APPROVED",
        date:      { gte: fromDate, lte: toDate },
        deletedAt: null,
      },
      include: { category: true },
    }),

    // Payroll: finalized runs whose month/year falls in period
    prisma.payrollItem.findMany({
      where: {
        payrollRun: {
          status: "FINALIZED",
          // Filter runs that overlap with the date range by year+month
          AND: [
            {
              OR: [
                { year: { gt: fromDate.getFullYear() } },
                {
                  year:  fromDate.getFullYear(),
                  month: { gte: fromDate.getMonth() + 1 },
                },
              ],
            },
            {
              OR: [
                { year: { lt: toDate.getFullYear() } },
                {
                  year:  toDate.getFullYear(),
                  month: { lte: toDate.getMonth() + 1 },
                },
              ],
            },
          ],
        },
      },
      select: { basicSalary: true },
    }),
  ]);

  // Revenue breakdown
  const grossSales = salesOrders.reduce((s, o) => s + Number(o.totalAmount),      0);
  const commission = salesOrders.reduce((s, o) => s + Number(o.commissionAmount), 0);
  const revenue    = salesOrders.reduce((s, o) => s + Number(o.factoryAmount),    0);
  // Invariant: grossSales − commission === revenue (guaranteed by DB fields)

  // Aggregate COGS
  const cogs = purchaseMovements.reduce((s, m) => {
    const qty  = Number(m.quantity);
    const cost = m.unitCost ? Number(m.unitCost) : 0;
    return s + qty * cost;
  }, 0);

  // Group expenses by category
  const expenseMap = new Map<string, number>();
  for (const exp of expenses) {
    const prev = expenseMap.get(exp.category.name) ?? 0;
    expenseMap.set(exp.category.name, prev + Number(exp.amount));
  }
  const expenseLines = Array.from(expenseMap.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Payroll total
  const payroll = payrollItems.reduce((s, i) => s + Number(i.basicSalary), 0);

  const periodLabel =
    fromStr === toStr
      ? `${format(fromDate, "d MMMM yyyy")} (${toNepaliDateString(fromDate)})`
      : `${format(fromDate, "d MMM yyyy")} — ${format(toDate, "d MMM yyyy")} · ${toNepaliDateString(fromDate)} — ${toNepaliDateString(toDate)}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Profit &amp; Loss</h1>
        <p className="text-muted-foreground text-sm mt-1">{periodLabel}</p>
      </div>

      <Suspense>
        <DateRangePicker from={fromStr} to={toStr} />
      </Suspense>

      <PlBreakdown
        grossSales={grossSales}
        commission={commission}
        revenue={revenue}
        cogs={cogs}
        expenses={expenseLines}
        payroll={payroll}
      />
    </div>
  );
}
