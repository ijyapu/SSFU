import Link from "next/link";
import { startOfMonth, subMonths, format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireMinRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp, TrendingDown, ShoppingCart, Receipt,
  DollarSign, CreditCard, Bell, Package, ArrowUpRight,
  AlertCircle, CheckCircle2, Clock, Minus,
} from "lucide-react";
import { RevenueChart } from "./_components/revenue-chart";
import { RecentActivity } from "./_components/recent-activity";
import { ProductInsights } from "./_components/product-insights";
import { SalesmanInsights } from "./_components/salesman-insights";
import { toNepaliDateString } from "@/lib/nepali-date";
import { COMPANY } from "@/lib/company";

export const metadata = { title: "Dashboard" };

function fmt(n: number) {
  return `Rs ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export default async function DashboardPage() {
  await requireMinRole("employee");

  const now          = new Date();
  const monthStart   = startOfMonth(now);
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
  const revenue      = Number(monthSales._sum.totalAmount ?? 0);
  const lastRevenue  = Number(lastMonthSales._sum.totalAmount ?? 0);
  const purchases    = Number(monthPurchases._sum.totalAmount ?? 0);
  const lastPurchases = Number(lastMonthPurchases._sum.totalAmount ?? 0);
  const grossProfit  = revenue - purchases;
  const revPct       = pctChange(revenue, lastRevenue);
  const purPct       = pctChange(purchases, lastPurchases);

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

  const totalAlerts = lowStockCount + pendingExpenses + pendingPayroll + openPOs;

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

  // Aggregate returns by salesman in memory
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

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{COMPANY.name}</h1>
          <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {format(now, "EEEE, d MMMM yyyy")}
          </p>
          <p className="text-muted-foreground/70 text-xs mt-0.5">
            {toNepaliDateString(now)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalAlerts > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 text-destructive px-3 py-1 text-xs font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              {totalAlerts} action{totalAlerts !== 1 ? "s" : ""} needed
            </span>
          )}
          <Link
            href="/profit-loss"
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-muted transition-colors"
          >
            <TrendingUp className="h-4 w-4" />
            P&amp;L Report
          </Link>
        </div>
      </div>

      {/* ── Financial KPIs ── */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {/* Revenue */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Revenue — {format(now, "MMM")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{fmt(revenue)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total billed on sales orders</p>
            {revPct !== null && (
              <p className={`text-xs mt-1 flex items-center gap-1 ${revPct >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                {revPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(revPct).toFixed(1)}% vs last month
              </p>
            )}
          </CardContent>
        </Card>

        {/* Purchases */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Purchases — {format(now, "MMM")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{fmt(purchases)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Cost of goods received</p>
            {purPct !== null && (
              <p className={`text-xs mt-1 flex items-center gap-1 ${purPct <= 0 ? "text-emerald-600" : "text-amber-600"}`}>
                {purPct <= 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                {Math.abs(purPct).toFixed(1)}% vs last month
              </p>
            )}
          </CardContent>
        </Card>

        {/* Gross Profit */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Gross Profit — {format(now, "MMM")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold tabular-nums ${grossProfit < 0 ? "text-destructive" : ""}`}>
              {fmt(grossProfit)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Revenue minus purchase cost</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {revenue > 0 ? `${((grossProfit / revenue) * 100).toFixed(1)}% margin` : "No revenue yet"}
            </p>
          </CardContent>
        </Card>

        {/* Inventory Value */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Inventory Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{fmt(inventoryValue)}</p>
            <p className="text-xs text-muted-foreground mt-1">At cost price</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Cash Position ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Receivables</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold tabular-nums ${totalReceivables > 0 ? "text-amber-600" : "text-emerald-600"}`}>
              {fmt(totalReceivables)}
            </p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground">Owed by salesmen</p>
              {totalReceivables > 0 && (
                <Link href="/sales" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                  View <ArrowUpRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Payables</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold tabular-nums ${totalPayables > 0 ? "text-destructive" : "text-emerald-600"}`}>
              {fmt(totalPayables)}
            </p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground">Owed to suppliers</p>
              {totalPayables > 0 && (
                <Link href="/purchases" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                  View <ArrowUpRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={`border-0 shadow-sm ${netPosition >= 0 ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-red-50 dark:bg-red-950/20"}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Net Position</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold tabular-nums ${netPosition >= 0 ? "text-emerald-700" : "text-destructive"}`}>
              {netPosition >= 0 ? "+" : ""}{fmt(netPosition)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Receivables minus payables</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Operational Alerts ── */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Link href="/inventory/reorder">
          <Card className={`border-0 shadow-sm transition-colors hover:bg-muted/40 cursor-pointer ${lowStockCount > 0 ? "border-l-2 border-l-amber-500" : ""}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Low Stock</CardTitle>
                <Bell className={`h-4 w-4 ${lowStockCount > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
              </div>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${lowStockCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                {lowStockCount}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {lowStockCount > 0 ? "Items below reorder level" : "All levels healthy"}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/purchases">
          <Card className={`border-0 shadow-sm transition-colors hover:bg-muted/40 cursor-pointer ${openPOs > 0 ? "border-l-2 border-l-blue-500" : ""}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Open POs</CardTitle>
                <ShoppingCart className={`h-4 w-4 ${openPOs > 0 ? "text-blue-500" : "text-muted-foreground"}`} />
              </div>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${openPOs > 0 ? "text-blue-600" : ""}`}>{openPOs}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {openPOs > 0 ? "Awaiting delivery" : "No pending orders"}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/expenses">
          <Card className={`border-0 shadow-sm transition-colors hover:bg-muted/40 cursor-pointer ${pendingExpenses > 0 ? "border-l-2 border-l-amber-500" : ""}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pending Expenses</CardTitle>
                <Receipt className={`h-4 w-4 ${pendingExpenses > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
              </div>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${pendingExpenses > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                {pendingExpenses}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {pendingExpenses > 0 ? "Awaiting approval" : "All reviewed"}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/daily-log">
          <Card className={`border-0 shadow-sm transition-colors hover:bg-muted/40 cursor-pointer`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Daily Log</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {!todayLog ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-5 w-5 text-amber-500" />
                    <p className="text-sm font-semibold text-amber-600">Not started</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Today&apos;s log pending</p>
                </>
              ) : todayLog.status === "OPEN" ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <Minus className="h-5 w-5 text-blue-500" />
                    <p className="text-sm font-semibold text-blue-600">In progress</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Open — not yet closed</p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <p className="text-sm font-semibold text-emerald-600">Closed</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Today&apos;s log complete</p>
                </>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ── Chart ── */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Revenue vs Purchases</CardTitle>
            <span className="text-xs text-muted-foreground">Last 6 months</span>
          </div>
        </CardHeader>
        <CardContent>
          <RevenueChart data={chartData.map(({ month, revenue, purchases }) => ({ month, revenue, purchases }))} />
        </CardContent>
      </Card>

      {/* ── Product Insights ── */}
      <ProductInsights
        topSellers={topSellers}
        mostReturned={mostReturned}
        fewestReturned={fewestReturned}
        monthLabel={format(now, "MMM")}
      />

      {/* ── Salesman Insights ── */}
      <SalesmanInsights
        topBySales={topSalesmenBySales}
        topByReturns={topSalesmenByReturns}
        monthLabel={format(now, "MMM")}
      />

      {/* ── Recent Activity ── */}
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
  );
}
