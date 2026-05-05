import { Suspense } from "react";
import {
  startOfDay, subDays,
  startOfWeek, subWeeks, getISOWeek,
  startOfMonth, endOfMonth, subMonths,
  startOfQuarter, subQuarters, getQuarter,
  startOfYear, subYears,
  format,
} from "date-fns";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, ShoppingCart, Receipt, RotateCcw, Package } from "lucide-react";
import {
  TrendChart, TopProductsSoldChart, TopPurchasedChart,
  TopSalesmenChart, ExpensesByCategoryChart, ReturnsByTypeChart,
  type MonthlyTrendPoint, type ProductSoldItem, type TopPurchasedItem,
  type SalesmanItem, type ExpenseCatItem, type ReturnTypeItem,
} from "./_components/analytics-charts";
import { PeriodSelector, type Period } from "./_components/period-selector";

export const metadata = { title: "Analytics — Reports" };

// ─── Period config ──────────────────────────────────────────────────────────

type TrendBucket = MonthlyTrendPoint & { _key: string };

function buildPeriodConfig(period: Period, now: Date) {
  switch (period) {

    case "daily": {
      const periodStart = startOfDay(now);
      const prevStart   = startOfDay(subDays(now, 1));
      const trendStart  = startOfDay(subDays(now, 29));
      const buckets: TrendBucket[] = Array.from({ length: 30 }, (_, i) => {
        const key = format(subDays(now, 29 - i), "d MMM");
        return { month: key, _key: key, revenue: 0, purchases: 0, expenses: 0 };
      });
      return {
        periodStart, prevStart, trendStart, buckets,
        label:      format(now, "EEEE, d MMMM yyyy"),
        shortLabel: "Today",
        trendTitle: "Last 30 Days",
        getBucketKey: (d: Date) => format(d, "d MMM"),
      };
    }

    case "weekly": {
      const periodStart = startOfWeek(now, { weekStartsOn: 1 });
      const prevStart   = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      const trendStart  = startOfWeek(subWeeks(now, 11), { weekStartsOn: 1 });
      const getBucketKey = (d: Date) => {
        const ws = startOfWeek(d, { weekStartsOn: 1 });
        return `W${getISOWeek(ws)} '${format(ws, "yy")}`;
      };
      const buckets: TrendBucket[] = Array.from({ length: 12 }, (_, i) => {
        const key = getBucketKey(subWeeks(now, 11 - i));
        return { month: key, _key: key, revenue: 0, purchases: 0, expenses: 0 };
      });
      return {
        periodStart, prevStart, trendStart, buckets,
        label:      `Week ${getISOWeek(now)}, ${format(now, "yyyy")}`,
        shortLabel: `W${getISOWeek(now)} '${format(now, "yy")}`,
        trendTitle: "Last 12 Weeks",
        getBucketKey,
      };
    }

    case "monthly": {
      const periodStart = startOfMonth(now);
      const prevStart   = startOfMonth(subMonths(now, 1));
      const trendStart  = startOfMonth(subMonths(now, 11));
      const getBucketKey = (d: Date) => format(d, "MMM ''yy");
      const buckets: TrendBucket[] = Array.from({ length: 12 }, (_, i) => {
        const key = getBucketKey(subMonths(now, 11 - i));
        return { month: key, _key: key, revenue: 0, purchases: 0, expenses: 0 };
      });
      return {
        periodStart, prevStart, trendStart, buckets,
        label:      format(now, "MMMM yyyy"),
        shortLabel: format(now, "MMM ''yy"),
        trendTitle: "Last 12 Months",
        getBucketKey,
      };
    }

    case "quarterly": {
      const periodStart  = startOfQuarter(now);
      const prevStart    = startOfQuarter(subQuarters(now, 1));
      const trendStart   = startOfQuarter(subQuarters(now, 7));
      const getBucketKey = (d: Date) => `Q${getQuarter(d)} '${format(d, "yy")}`;
      const buckets: TrendBucket[] = Array.from({ length: 8 }, (_, i) => {
        const key = getBucketKey(subQuarters(now, 7 - i));
        return { month: key, _key: key, revenue: 0, purchases: 0, expenses: 0 };
      });
      return {
        periodStart, prevStart, trendStart, buckets,
        label:      `Q${getQuarter(now)} ${format(now, "yyyy")}`,
        shortLabel: `Q${getQuarter(now)} '${format(now, "yy")}`,
        trendTitle: "Last 8 Quarters",
        getBucketKey,
      };
    }

    case "yearly": {
      const periodStart  = startOfYear(now);
      const prevStart    = startOfYear(subYears(now, 1));
      const trendStart   = startOfYear(subYears(now, 4));
      const getBucketKey = (d: Date) => format(d, "yyyy");
      const buckets: TrendBucket[] = Array.from({ length: 5 }, (_, i) => {
        const key = getBucketKey(subYears(now, 4 - i));
        return { month: key, _key: key, revenue: 0, purchases: 0, expenses: 0 };
      });
      return {
        periodStart, prevStart, trendStart, buckets,
        label:      format(now, "yyyy"),
        shortLabel: format(now, "yyyy"),
        trendTitle: "Last 5 Years",
        getBucketKey,
      };
    }
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

function fmtRs(n: number) {
  return `Rs ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function pctChange(cur: number, prev: number) {
  if (prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

const VALID_PERIODS: Period[] = ["daily", "weekly", "monthly", "quarterly", "yearly"];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: rawPeriod } = await searchParams;
  const period: Period = VALID_PERIODS.includes(rawPeriod as Period)
    ? (rawPeriod as Period)
    : "monthly";

  const now = new Date();
  const { periodStart, prevStart, trendStart, buckets, label, shortLabel, trendTitle, getBucketKey } =
    buildPeriodConfig(period, now);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const [
    curSalesAgg,
    curPurchasesAgg,
    curExpensesAgg,
    curReturnsAgg,
    prevSalesAgg,
    prevPurchasesAgg,
    rawSalesOrders,
    rawPurchaseOrders,
    rawExpenses,
    productSalesGroups,
    productPurchaseGroups,
    salesmanGroups,
    salesmanReturnsRaw,
    expCatGroups,
    returnTypeGroups,
  ] = await Promise.all([
    // Current period KPIs
    prisma.salesOrder.aggregate({
      where: { status: { notIn: ["CANCELLED", "DRAFT"] }, deletedAt: null, orderDate: { gte: periodStart } },
      _sum:  { totalAmount: true },
    }),
    prisma.purchaseOrder.aggregate({
      where: { status: { in: ["RECEIVED", "PARTIALLY_RECEIVED"] }, deletedAt: null, orderDate: { gte: periodStart } },
      _sum:  { totalAmount: true },
    }),
    prisma.expense.aggregate({
      where: { status: { not: "REJECTED" }, deletedAt: null, date: { gte: periodStart } },
      _sum:  { amount: true },
    }),
    prisma.salesReturn.aggregate({
      where: { salesOrder: { deletedAt: null }, createdAt: { gte: periodStart } },
      _sum:  { totalAmount: true },
      _count: { id: true },
    }),
    // Previous period (for % change)
    prisma.salesOrder.aggregate({
      where: { status: { notIn: ["CANCELLED", "DRAFT"] }, deletedAt: null, orderDate: { gte: prevStart, lt: periodStart } },
      _sum:  { totalAmount: true },
    }),
    prisma.purchaseOrder.aggregate({
      where: { status: { in: ["RECEIVED", "PARTIALLY_RECEIVED"] }, deletedAt: null, orderDate: { gte: prevStart, lt: periodStart } },
      _sum:  { totalAmount: true },
    }),
    // Raw data for trend (wider range)
    prisma.salesOrder.findMany({
      where: { status: { notIn: ["CANCELLED", "DRAFT"] }, deletedAt: null, orderDate: { gte: trendStart } },
      select: { orderDate: true, totalAmount: true },
    }),
    prisma.purchaseOrder.findMany({
      where: { status: { in: ["RECEIVED", "PARTIALLY_RECEIVED"] }, deletedAt: null, orderDate: { gte: trendStart } },
      select: { orderDate: true, totalAmount: true },
    }),
    prisma.expense.findMany({
      where: { status: { not: "REJECTED" }, deletedAt: null, date: { gte: trendStart } },
      select: { date: true, amount: true },
    }),
    // Top products sold in period
    prisma.salesOrderItem.groupBy({
      by:      ["productId"],
      where:   { salesOrder: { status: { notIn: ["CANCELLED", "DRAFT"] }, deletedAt: null, orderDate: { gte: periodStart } } },
      _sum:    { quantity: true, totalPrice: true },
      orderBy: { _sum: { quantity: "desc" } },
      take:    10,
    }),
    // Top purchased products in period
    prisma.purchaseOrderItem.groupBy({
      by:      ["productId"],
      where:   { purchaseOrder: { status: { in: ["RECEIVED", "PARTIALLY_RECEIVED"] }, deletedAt: null, orderDate: { gte: periodStart } } },
      _sum:    { quantity: true, totalCost: true },
      orderBy: { _sum: { quantity: "desc" } },
      take:    10,
    }),
    // Top salesmen in period
    prisma.salesOrder.groupBy({
      by:      ["customerId"],
      where:   { status: { notIn: ["CANCELLED", "DRAFT"] }, deletedAt: null, orderDate: { gte: periodStart } },
      _sum:    { totalAmount: true },
      _count:  { id: true },
      orderBy: { _sum: { totalAmount: "desc" } },
      take:    8,
    }),
    // Salesman returns in period
    prisma.salesReturn.findMany({
      where:  { salesOrder: { deletedAt: null }, createdAt: { gte: periodStart } },
      select: { totalAmount: true, salesOrder: { select: { salesman: { select: { id: true, name: true } } } } },
    }),
    // Expenses by category in period
    prisma.expense.groupBy({
      by:      ["categoryId"],
      where:   { status: { not: "REJECTED" }, deletedAt: null, date: { gte: periodStart } },
      _sum:    { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take:    10,
    }),
    // Returns by type in period
    prisma.salesReturn.groupBy({
      by:      ["returnType"],
      where:   { salesOrder: { deletedAt: null }, createdAt: { gte: periodStart } },
      _sum:    { totalAmount: true },
      _count:  { id: true },
    }),
  ]);

  // ── Name lookups ──────────────────────────────────────────────────────────
  const [productNames, purchaseProductNames, salesmanNames, expCatNames] = await Promise.all([
    productSalesGroups.length > 0
      ? prisma.product.findMany({ where: { id: { in: productSalesGroups.map((p) => p.productId) } }, select: { id: true, name: true } })
      : ([] as { id: string; name: string }[]),
    productPurchaseGroups.length > 0
      ? prisma.product.findMany({ where: { id: { in: productPurchaseGroups.map((p) => p.productId!).filter(Boolean) } }, select: { id: true, name: true } })
      : ([] as { id: string; name: string }[]),
    salesmanGroups.length > 0
      ? prisma.salesman.findMany({ where: { id: { in: salesmanGroups.map((s) => s.customerId) } }, select: { id: true, name: true } })
      : ([] as { id: string; name: string }[]),
    expCatGroups.length > 0
      ? prisma.expenseCategory.findMany({ where: { id: { in: expCatGroups.map((e) => e.categoryId) } }, select: { id: true, name: true } })
      : ([] as { id: string; name: string }[]),
  ]);

  const prodMap    = new Map(productNames.map((p)  => [p.id, p.name]));
  const purProdMap = new Map(purchaseProductNames.map((p) => [p.id, p.name]));
  const smMap      = new Map(salesmanNames.map((s) => [s.id, s.name]));
  const catMap     = new Map(expCatNames.map((c)   => [c.id, c.name]));

  // ── KPI values ────────────────────────────────────────────────────────────
  const curRevenue   = Number(curSalesAgg._sum.totalAmount    ?? 0);
  const curPurchases = Number(curPurchasesAgg._sum.totalAmount ?? 0);
  const curExpenses  = Number(curExpensesAgg._sum.amount       ?? 0);
  const curReturns   = Number(curReturnsAgg._sum.totalAmount   ?? 0);
  // Gross profit = revenue minus cost of goods (purchases). Expenses shown separately.
  const curGrossProfit = curRevenue - curPurchases;
  const prevRevenue    = Number(prevSalesAgg._sum.totalAmount     ?? 0);
  const prevPurchases  = Number(prevPurchasesAgg._sum.totalAmount ?? 0);
  const revPct  = pctChange(curRevenue,   prevRevenue);
  const purPct  = pctChange(curPurchases, prevPurchases);

  // ── Build trend buckets ───────────────────────────────────────────────────
  const bucketMap = new Map(buckets.map((b, i) => [b._key, i]));

  for (const so of rawSalesOrders) {
    const i = bucketMap.get(getBucketKey(so.orderDate));
    if (i !== undefined) buckets[i]!.revenue += Number(so.totalAmount);
  }
  for (const po of rawPurchaseOrders) {
    const i = bucketMap.get(getBucketKey(po.orderDate));
    if (i !== undefined) buckets[i]!.purchases += Number(po.totalAmount);
  }
  for (const ex of rawExpenses) {
    const i = bucketMap.get(getBucketKey(ex.date));
    if (i !== undefined) buckets[i]!.expenses += Number(ex.amount);
  }
  const trendData = buckets.map(({ month, revenue, purchases, expenses }) => ({ month, revenue, purchases, expenses }));

  // ── Chart data ────────────────────────────────────────────────────────────
  const topProductsSold: ProductSoldItem[] = productSalesGroups.map((p) => ({
    name:    prodMap.get(p.productId) ?? "Unknown",
    qty:     Number(p._sum.quantity   ?? 0),
    revenue: Number(p._sum.totalPrice ?? 0),
  }));

  const topPurchased: TopPurchasedItem[] = productPurchaseGroups
    .filter((p) => p.productId != null)
    .map((p) => ({
      name: purProdMap.get(p.productId!) ?? "Unknown",
      qty:  Number(p._sum.quantity ?? 0),
      cost: Number(p._sum.totalCost ?? 0),
    }));

  const topSalesmen: SalesmanItem[] = salesmanGroups.map((s) => ({
    name:    smMap.get(s.customerId) ?? "Unknown",
    revenue: Number(s._sum.totalAmount ?? 0),
    orders:  s._count.id,
  }));

  const smReturnAmt = new Map<string, number>();
  for (const r of salesmanReturnsRaw) {
    const id = r.salesOrder.salesman.id;
    smReturnAmt.set(id, (smReturnAmt.get(id) ?? 0) + Number(r.totalAmount));
  }

  const expensesByCategory: ExpenseCatItem[] = expCatGroups.map((e) => ({
    name:   catMap.get(e.categoryId) ?? "Unknown",
    amount: Number(e._sum.amount ?? 0),
  }));

  const returnsByType: ReturnTypeItem[] = returnTypeGroups.map((r) => ({
    type:   r.returnType,
    amount: Number(r._sum.totalAmount ?? 0),
    count:  r._count.id,
  }));

  // ── Previous period label ─────────────────────────────────────────────────
  const prevLabels: Record<Period, string> = {
    daily:     `vs yesterday`,
    weekly:    `vs last week`,
    monthly:   `vs ${format(endOfMonth(prevStart), "MMM yyyy")}`,
    quarterly: `vs Q${getQuarter(prevStart)} '${format(prevStart, "yy")}`,
    yearly:    `vs ${format(prevStart, "yyyy")}`,
  };
  const prevLabel = prevLabels[period];

  const grossMarginPct = curRevenue > 0 ? (curGrossProfit / curRevenue) * 100 : 0;

  return (
    <div className="space-y-6 pb-8">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Analytics</h2>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
        <Suspense>
          <PeriodSelector current={period} />
        </Suspense>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <KpiCard
          label="Revenue"
          desc="Total billed on sales orders"
          value={fmtRs(curRevenue)}
          sub={revPct !== null ? `${revPct >= 0 ? "+" : ""}${revPct.toFixed(1)}% ${prevLabel}` : shortLabel}
          trend={revPct !== null ? (revPct >= 0 ? "up" : "down") : undefined}
          color="emerald"
          note="Includes salesman commission"
        />
        <KpiCard
          label="Purchases"
          desc="Cost of goods received"
          value={fmtRs(curPurchases)}
          sub={purPct !== null ? `${purPct >= 0 ? "+" : ""}${purPct.toFixed(1)}% ${prevLabel}` : shortLabel}
          trend={purPct !== null ? (purPct <= 0 ? "up" : "down") : undefined}
          color="blue"
          note="Confirmed & received orders"
        />
        <KpiCard
          label="Gross Profit"
          desc="Revenue minus purchase cost"
          value={fmtRs(curGrossProfit)}
          sub={`${grossMarginPct.toFixed(1)}% margin`}
          color={curGrossProfit >= 0 ? "emerald" : "red"}
          note="Before expenses & payroll"
        />
        <KpiCard
          label="Expenses"
          desc="Approved operating costs"
          value={fmtRs(curExpenses)}
          color="amber"
          note="Excludes payroll"
        />
        <KpiCard
          label="Returns"
          desc="Goods brought back unsold"
          value={fmtRs(curReturns)}
          sub={`${curReturnsAgg._count.id} return${curReturnsAgg._count.id !== 1 ? "s" : ""}`}
          color="rose"
          note="Fresh + waste combined"
        />
      </div>

      {/* ── Trend chart ── */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm font-semibold">Revenue vs Purchases vs Expenses</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                How much came in, how much was spent on stock, and operating costs — side by side
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{trendTitle}</span>
          </div>
        </CardHeader>
        <CardContent>
          <TrendChart data={trendData} />
        </CardContent>
      </Card>

      {/* ── Top Products + Top Salesmen ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Top 10 Products Sold</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">By quantity dispatched — {label}</p>
              </div>
              <Package className="h-4 w-4 text-emerald-500 shrink-0" />
            </div>
          </CardHeader>
          <CardContent>
            <TopProductsSoldChart data={topProductsSold} />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Top Salesmen by Revenue</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Ranked by total order value — {label}</p>
              </div>
              <TrendingUp className="h-4 w-4 text-indigo-500 shrink-0" />
            </div>
          </CardHeader>
          <CardContent>
            <TopSalesmenChart data={topSalesmen} />
          </CardContent>
        </Card>
      </div>

      {/* ── Top Purchased Products ── */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm font-semibold">Top 10 Purchased Products</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                By quantity received from suppliers — {label}. Helps you see what you're restocking most.
              </p>
            </div>
            <ShoppingCart className="h-4 w-4 text-blue-500 shrink-0" />
          </div>
        </CardHeader>
        <CardContent>
          <TopPurchasedChart data={topPurchased} />
        </CardContent>
      </Card>

      {/* ── Expenses + Returns ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Expenses by Category</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Where your money is going — submitted &amp; approved — {label}
                </p>
              </div>
              <Receipt className="h-4 w-4 text-amber-500 shrink-0" />
            </div>
          </CardHeader>
          <CardContent>
            <ExpensesByCategoryChart data={expensesByCategory} />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">Returns by Type</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Fresh = resellable stock back. Waste = spoiled, written off. — {label}
                </p>
              </div>
              <RotateCcw className="h-4 w-4 text-rose-500 shrink-0" />
            </div>
          </CardHeader>
          <CardContent>
            <ReturnsByTypeChart data={returnsByType} />
            {returnsByType.length > 0 && (
              <div className="mt-3 flex justify-center gap-6 text-xs text-muted-foreground border-t pt-3">
                {returnsByType.map((r) => (
                  <div key={r.type} className="text-center">
                    <p className="font-semibold text-foreground text-sm">
                      {r.count} order{r.count !== 1 ? "s" : ""}
                    </p>
                    <p>{r.type === "FRESH" ? "Fresh (back to stock)" : "Waste (written off)"}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label, desc, value, sub, note, trend, color,
}: {
  label: string;
  desc: string;
  value: string;
  sub?: string;
  note?: string;
  trend?: "up" | "down";
  color: "emerald" | "blue" | "amber" | "rose" | "red";
}) {
  const valueColor = {
    emerald: "text-emerald-700",
    blue:    "text-blue-700",
    amber:   "text-amber-700",
    rose:    "text-rose-700",
    red:     "text-destructive",
  }[color];

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-1 space-y-0.5">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </CardTitle>
        <p className="text-[11px] text-muted-foreground/80 leading-tight">{desc}</p>
      </CardHeader>
      <CardContent>
        <p className={`text-xl font-bold tabular-nums leading-tight ${valueColor}`}>{value}</p>
        {sub && (
          <p className={`text-xs mt-1 flex items-center gap-1 ${
            trend === "up"   ? "text-emerald-600" :
            trend === "down" ? "text-destructive"  :
            "text-muted-foreground"
          }`}>
            {trend === "up"   && <TrendingUp   className="h-3 w-3" />}
            {trend === "down" && <TrendingDown className="h-3 w-3" />}
            {sub}
          </p>
        )}
        {note && <p className="text-[10px] text-muted-foreground/60 mt-0.5 italic">{note}</p>}
      </CardContent>
    </Card>
  );
}
