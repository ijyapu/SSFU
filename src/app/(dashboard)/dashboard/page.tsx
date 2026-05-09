import Link from "next/link";
import { startOfMonth, subMonths, format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireMinRole } from "@/lib/auth";
import { currentUser } from "@clerk/nextjs/server";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  TrendingUp, TrendingDown, ShoppingCart, Receipt,
  Package, ArrowUpRight, CheckCircle2, Clock,
  BookOpen, Users,
} from "lucide-react";
import { RevenueChart } from "./_components/revenue-chart";
import { RecentActivity } from "./_components/recent-activity";
import { ProductInsights } from "./_components/product-insights";
import { SalesmanInsights } from "./_components/salesman-insights";
import { toNepaliDateString } from "@/lib/nepali-date";
import { COMPANY } from "@/lib/company";
import { formatAmount } from "@/lib/format";

export const metadata = { title: "Dashboard" };

function pctChange(current: number, previous: number) {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export default async function DashboardPage() {
  await requireMinRole("employee");

  const user           = await currentUser();
  const firstName      = user?.firstName ?? user?.username ?? "there";
  const now            = new Date();
  const monthStart     = startOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));

  const [
    monthSales,
    lastMonthSales,
    monthPurchases,
    lastMonthPurchases,
    openPOs,
    pendingExpenses,
    pendingPayroll,
    lowStockProducts,
    receivables,
    payables,
    recentSalesOrders,
    recentPurchaseOrders,
    inventoryProducts,
    todayLog,
  ] = await Promise.all([
    prisma.salesOrder.aggregate({
      where: { status: { not: "CANCELLED" }, orderDate: { gte: monthStart }, deletedAt: null },
      _sum: { totalAmount: true },
    }),
    prisma.salesOrder.aggregate({
      where: { status: { not: "CANCELLED" }, orderDate: { gte: lastMonthStart, lt: monthStart }, deletedAt: null },
      _sum: { totalAmount: true },
    }),
    prisma.purchaseOrder.aggregate({
      where: { status: { in: ["RECEIVED", "PARTIALLY_RECEIVED"] }, orderDate: { gte: monthStart }, deletedAt: null },
      _sum: { totalAmount: true },
    }),
    prisma.purchaseOrder.aggregate({
      where: { status: { in: ["RECEIVED", "PARTIALLY_RECEIVED"] }, orderDate: { gte: lastMonthStart, lt: monthStart }, deletedAt: null },
      _sum: { totalAmount: true },
    }),
    prisma.purchaseOrder.count({
      where: { status: { in: ["CONFIRMED", "PARTIALLY_RECEIVED"] }, deletedAt: null },
    }),
    prisma.expense.count({ where: { status: "SUBMITTED", deletedAt: null } }),
    prisma.payrollRun.count({ where: { status: "DRAFT" } }),
    prisma.product.findMany({
      where: { deletedAt: null, reorderLevel: { gt: 0 } },
      select: { currentStock: true, reorderLevel: true },
    }),
    prisma.salesOrder.aggregate({
      where: { status: { notIn: ["CANCELLED", "DRAFT"] }, deletedAt: null },
      _sum: { factoryAmount: true, amountPaid: true },
    }),
    prisma.purchaseOrder.aggregate({
      where: { status: { notIn: ["CANCELLED", "DRAFT"] }, deletedAt: null },
      _sum: { totalAmount: true, amountPaid: true },
    }),
    prisma.salesOrder.findMany({
      where: { deletedAt: null },
      include: { salesman: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.purchaseOrder.findMany({
      where: { deletedAt: null },
      include: { supplier: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.product.findMany({
      where: { deletedAt: null },
      select: { currentStock: true, costPrice: true },
    }),
    prisma.dailyLog.findFirst({
      where: {
        logDate: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt:  new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
      select: { status: true },
    }),
  ]);

  // Derived stats
  const revenue       = Number(monthSales._sum.totalAmount ?? 0);
  const lastRevenue   = Number(lastMonthSales._sum.totalAmount ?? 0);
  const purchases     = Number(monthPurchases._sum.totalAmount ?? 0);
  const lastPurchases = Number(lastMonthPurchases._sum.totalAmount ?? 0);
  const grossProfit   = revenue - purchases;
  const revPct        = pctChange(revenue, lastRevenue);
  const purPct        = pctChange(purchases, lastPurchases);

  const totalReceivables = Number(receivables._sum.factoryAmount ?? 0) - Number(receivables._sum.amountPaid ?? 0);
  const totalPayables    = Number(payables._sum.totalAmount ?? 0)    - Number(payables._sum.amountPaid ?? 0);
  const netPosition      = totalReceivables - totalPayables;

  const inventoryValue = inventoryProducts.reduce(
    (sum: number, p: { currentStock: unknown; costPrice: unknown }) =>
      sum + Number(p.currentStock) * Number(p.costPrice), 0
  );

  const lowStockCount = lowStockProducts.filter(
    (p: { currentStock: unknown; reorderLevel: unknown }) =>
      Number(p.currentStock) <= Number(p.reorderLevel)
  ).length;

  // Chart data — last 6 months
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i);
    return { month: format(d, "MMM"), year: d.getFullYear(), monthNum: d.getMonth() + 1, revenue: 0, purchases: 0 };
  });

  const [sixMonthSales, sixMonthPurchases] = await Promise.all([
    prisma.salesOrder.findMany({
      where: { status: { not: "CANCELLED" }, orderDate: { gte: subMonths(monthStart, 5) }, deletedAt: null },
      select: { orderDate: true, totalAmount: true },
    }),
    prisma.purchaseOrder.findMany({
      where: { status: { in: ["RECEIVED", "PARTIALLY_RECEIVED"] }, orderDate: { gte: subMonths(monthStart, 5) }, deletedAt: null },
      select: { orderDate: true, totalAmount: true },
    }),
  ]);

  for (const so of sixMonthSales) {
    const pt = chartData.find((d) => d.monthNum === so.orderDate.getMonth() + 1 && d.year === so.orderDate.getFullYear());
    if (pt) pt.revenue += Number(so.totalAmount);
  }
  for (const po of sixMonthPurchases) {
    const pt = chartData.find((d) => d.monthNum === po.orderDate.getMonth() + 1 && d.year === po.orderDate.getFullYear());
    if (pt) pt.purchases += Number(po.totalAmount);
  }

  // Product + salesman insights for this month
  const [soldGroupBy, returnedGroupBy, salesmanSalesGroupBy, salesmanReturnsRaw] = await Promise.all([
    prisma.salesOrderItem.groupBy({
      by: ["productId"],
      where: {
        salesOrder: {
          status:    { in: ["CONFIRMED", "PARTIALLY_PAID", "PAID"] },
          deletedAt: null,
          orderDate: { gte: monthStart },
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
    }),
    prisma.salesReturnItem.groupBy({
      by: ["productId"],
      where: {
        salesReturn: {
          salesOrder: { deletedAt: null },
          createdAt:  { gte: monthStart },
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
    }),
    prisma.salesOrder.groupBy({
      by: ["customerId"],
      where: {
        status:    { in: ["CONFIRMED", "PARTIALLY_PAID", "PAID"] },
        deletedAt: null,
        orderDate: { gte: monthStart },
      },
      _sum: { totalAmount: true },
      orderBy: { _sum: { totalAmount: "desc" } },
      take: 5,
    }),
    prisma.salesReturn.findMany({
      where: {
        salesOrder: { deletedAt: null },
        createdAt:  { gte: monthStart },
      },
      select: {
        totalAmount: true,
        salesOrder: {
          select: { salesman: { select: { id: true, name: true } } },
        },
      },
    }),
  ]);

  const insightIds = [...new Set([
    ...soldGroupBy.map((s) => s.productId),
    ...returnedGroupBy.map((r) => r.productId),
  ])];
  const insightProducts = insightIds.length > 0
    ? await prisma.product.findMany({
        where:  { id: { in: insightIds } },
        select: { id: true, name: true, unit: { select: { name: true } } },
      })
    : [];
  const pMap = new Map(insightProducts.map((p) => [p.id, { name: p.name, unit: p.unit.name }]));

  const topSellers = soldGroupBy.slice(0, 5).map((s) => ({
    name: pMap.get(s.productId)?.name ?? "Unknown",
    unit: pMap.get(s.productId)?.unit ?? "",
    qty:  Number(s._sum.quantity ?? 0),
  }));

  const mostReturned = returnedGroupBy.slice(0, 5).map((r) => ({
    name: pMap.get(r.productId)?.name ?? "Unknown",
    unit: pMap.get(r.productId)?.unit ?? "",
    qty:  Number(r._sum.quantity ?? 0),
  }));

  const returnQtyMap = new Map(returnedGroupBy.map((r) => [r.productId, Number(r._sum.quantity ?? 0)]));
  const fewestReturned = soldGroupBy
    .map((s) => ({
      name: pMap.get(s.productId)?.name ?? "Unknown",
      unit: pMap.get(s.productId)?.unit ?? "",
      qty:  returnQtyMap.get(s.productId) ?? 0,
    }))
    .sort((a, b) => a.qty - b.qty)
    .slice(0, 5);

  // Salesman insights
  const salesmanIds = salesmanSalesGroupBy.map((s) => s.customerId);
  const salesmenNames = salesmanIds.length > 0
    ? await prisma.salesman.findMany({
        where:  { id: { in: salesmanIds } },
        select: { id: true, name: true },
      })
    : [];
  const smMap = new Map(salesmenNames.map((s) => [s.id, s.name]));

  const topSalesmenBySales = salesmanSalesGroupBy.map((s) => ({
    name:   smMap.get(s.customerId) ?? "Unknown",
    amount: Number(s._sum.totalAmount ?? 0),
  }));

  const smReturnAccum = new Map<string, { name: string; amount: number }>();
  for (const ret of salesmanReturnsRaw) {
    const sm = ret.salesOrder.salesman;
    const prev = smReturnAccum.get(sm.id);
    smReturnAccum.set(sm.id, {
      name:   sm.name,
      amount: (prev?.amount ?? 0) + Number(ret.totalAmount),
    });
  }
  const topSalesmenByReturns = [...smReturnAccum.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return (
    <div className="space-y-6 pb-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-muted-foreground font-medium">{COMPANY.name}</p>
          <h1 className="text-xl font-semibold tracking-tight mt-0.5">Welcome, {firstName}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{format(now, "EEEE, d MMMM yyyy")}</p>
          <p className="text-muted-foreground/60 text-xs mt-0.5">{toNepaliDateString(now)}</p>
        </div>
        <Link href="/profit-loss" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          <TrendingUp className="h-4 w-4" />
          P&amp;L Report
        </Link>
      </div>

      {/* ── 1. Top Summary Strip ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card px-4 py-3 transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-1 hover:shadow-md motion-reduce:transition-none">
          <div className="text-xs text-muted-foreground font-medium mb-1">Revenue · {format(now, "MMM")}</div>
          <div className="text-xl font-bold tabular-nums">{formatAmount(revenue)}</div>
          {revPct !== null && (
            <div className={`text-xs mt-1 flex items-center gap-1 ${revPct >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {revPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(revPct).toFixed(1)}% vs last month
            </div>
          )}
        </div>
        <div className="rounded-lg border bg-card px-4 py-3 transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-1 hover:shadow-md motion-reduce:transition-none">
          <div className="text-xs text-muted-foreground font-medium mb-1">Purchases · {format(now, "MMM")}</div>
          <div className="text-xl font-bold tabular-nums">{formatAmount(purchases)}</div>
          {purPct !== null && (
            <div className={`text-xs mt-1 flex items-center gap-1 ${purPct <= 0 ? "text-emerald-600" : "text-amber-600"}`}>
              {purPct <= 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
              {Math.abs(purPct).toFixed(1)}% vs last month
            </div>
          )}
        </div>
        <div className="rounded-lg border bg-card px-4 py-3 transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-1 hover:shadow-md motion-reduce:transition-none">
          <div className="text-xs text-muted-foreground font-medium mb-1">Gross Profit · {format(now, "MMM")}</div>
          <div className={`text-xl font-bold tabular-nums ${grossProfit < 0 ? "text-destructive" : ""}`}>{formatAmount(grossProfit)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {revenue > 0 ? `${((grossProfit / revenue) * 100).toFixed(1)}% margin` : "No revenue yet"}
          </div>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3 transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-1 hover:shadow-md motion-reduce:transition-none">
          <div className="text-xs text-muted-foreground font-medium mb-1">Inventory Value</div>
          <div className="text-xl font-bold tabular-nums">{formatAmount(inventoryValue)}</div>
          <div className="text-xs text-muted-foreground mt-1">At cost price</div>
        </div>
      </div>

      {/* ── 2 + 3. Today's Operations + Financial Position ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Today's Operations */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Today&apos;s Operations</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/daily-log" className="rounded-lg border bg-card px-4 py-3 hover:bg-muted/30 transition-[transform,box-shadow,background-color] duration-150 ease-out hover:-translate-y-1 hover:shadow-md active:translate-y-0 motion-reduce:transition-none">
              <div className="text-xs text-muted-foreground font-medium mb-1.5">Daily Log</div>
              {!todayLog ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                    <span className="text-sm font-semibold text-amber-600">Not started</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Today&apos;s log pending</div>
                </>
              ) : todayLog.status === "OPEN" || todayLog.status === "REOPENED" ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-foreground/60 shrink-0" />
                    <span className="text-sm font-semibold">In progress</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Open — not yet closed</div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span className="text-sm font-semibold text-emerald-600">Closed</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">Today&apos;s log complete</div>
                </>
              )}
            </Link>

            <Link href="/purchases" className="rounded-lg border bg-card px-4 py-3 hover:bg-muted/30 transition-[transform,box-shadow,background-color] duration-150 ease-out hover:-translate-y-1 hover:shadow-md active:translate-y-0 motion-reduce:transition-none">
              <div className="text-xs text-muted-foreground font-medium mb-1.5">Open POs</div>
              <div className={`text-xl font-bold tabular-nums ${openPOs > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                {openPOs}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {openPOs > 0 ? "Awaiting delivery" : "All clear"}
              </div>
            </Link>

            <Link href="/inventory/reorder" className="rounded-lg border bg-card px-4 py-3 hover:bg-muted/30 transition-[transform,box-shadow,background-color] duration-150 ease-out hover:-translate-y-1 hover:shadow-md active:translate-y-0 motion-reduce:transition-none">
              <div className="text-xs text-muted-foreground font-medium mb-1.5">Low Stock</div>
              <div className={`text-xl font-bold tabular-nums ${lowStockCount > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                {lowStockCount}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {lowStockCount > 0 ? "Below reorder level" : "Levels healthy"}
              </div>
            </Link>

            <Link href="/expenses" className="rounded-lg border bg-card px-4 py-3 hover:bg-muted/30 transition-[transform,box-shadow,background-color] duration-150 ease-out hover:-translate-y-1 hover:shadow-md active:translate-y-0 motion-reduce:transition-none">
              <div className="text-xs text-muted-foreground font-medium mb-1.5">Pending Expenses</div>
              <div className={`text-xl font-bold tabular-nums ${pendingExpenses > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                {pendingExpenses}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {pendingExpenses > 0 ? "Awaiting approval" : "All reviewed"}
              </div>
            </Link>
          </div>
        </div>

        {/* Financial Position */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Financial Position</h2>
          <div className="rounded-lg border bg-card overflow-hidden divide-y">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-xs font-medium">Receivables</div>
                <div className="text-xs text-muted-foreground mt-0.5">Owed by salesmen</div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-bold tabular-nums ${totalReceivables > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                  {formatAmount(totalReceivables)}
                </div>
                {totalReceivables > 0 && (
                  <Link href="/sales" className="text-xs text-primary hover:underline flex items-center justify-end gap-0.5">
                    View <ArrowUpRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-xs font-medium">Payables</div>
                <div className="text-xs text-muted-foreground mt-0.5">Owed to suppliers</div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-bold tabular-nums ${totalPayables > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  {formatAmount(totalPayables)}
                </div>
                {totalPayables > 0 && (
                  <Link href="/purchases" className="text-xs text-primary hover:underline flex items-center justify-end gap-0.5">
                    View <ArrowUpRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-3 bg-muted/20">
              <div>
                <div className="text-xs font-semibold">Net Position</div>
                <div className="text-xs text-muted-foreground mt-0.5">Receivables − Payables</div>
              </div>
              <div className={`text-lg font-bold tabular-nums ${netPosition >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                {netPosition >= 0 ? "+" : ""}{formatAmount(netPosition)}
              </div>
            </div>
            {pendingPayroll > 0 && (
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-xs font-medium">Draft Payrolls</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Pending finalization</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold tabular-nums text-amber-600">{pendingPayroll}</div>
                  <Link href="/payroll" className="text-xs text-primary hover:underline flex items-center justify-end gap-0.5">
                    View <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 4. Revenue Chart ── */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
          <p className="text-sm font-semibold">Revenue vs Purchases</p>
          <span className="text-xs text-muted-foreground">Last 6 months</span>
        </div>
        <div className="px-4 py-4">
          <RevenueChart data={chartData.map(({ month, revenue, purchases }) => ({ month, revenue, purchases }))} />
        </div>
      </div>

      {/* ── 5. Product Insights ── */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Product Insights · {format(now, "MMM")}
        </h2>
        <ProductInsights
          topSellers={topSellers}
          mostReturned={mostReturned}
          fewestReturned={fewestReturned}
          monthLabel={format(now, "MMM")}
        />
      </div>

      {/* ── 6. Salesman Insights ── */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Salesman Insights · {format(now, "MMM")}
        </h2>
        <SalesmanInsights
          topBySales={topSalesmenBySales}
          topByReturns={topSalesmenByReturns}
          monthLabel={format(now, "MMM")}
        />
      </div>

      {/* ── 7. Recent Activity ── */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Recent Activity</h2>
        <RecentActivity
          recentSales={recentSalesOrders.map((so: (typeof recentSalesOrders)[0]) => ({
            id:           so.id,
            orderNumber:  so.orderNumber,
            salesmanName: so.salesman.name,
            totalAmount:  Number(so.totalAmount),
            status:       so.status,
            orderDate:    so.orderDate.toISOString(),
          }))}
          recentPurchases={recentPurchaseOrders.map((po: (typeof recentPurchaseOrders)[0]) => ({
            id:           po.id,
            orderNumber:  po.orderNumber,
            supplierName: po.supplier.name,
            totalAmount:  Number(po.totalAmount),
            status:       po.status,
            orderDate:    po.orderDate.toISOString(),
          }))}
        />
      </div>

      {/* ── 8. Quick Access ── */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quick Access</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {([
            { href: "/daily-log",  label: "Daily Log",  Icon: BookOpen },
            { href: "/sales",      label: "Sales",      Icon: TrendingUp },
            { href: "/purchases",  label: "Purchases",  Icon: ShoppingCart },
            { href: "/inventory",  label: "Inventory",  Icon: Package },
            { href: "/expenses",   label: "Expenses",   Icon: Receipt },
            { href: "/payroll",    label: "Payroll",    Icon: Users },
          ] as const).map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex-col h-auto py-3 gap-1.5 text-xs")}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
