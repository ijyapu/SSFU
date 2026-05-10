import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { SoTable } from "./_components/so-table";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { DateFilter } from "@/components/ui/date-filter";
import { formatAmount } from "@/lib/format";
import { Plus, Users, TrendingUp, AlertCircle } from "lucide-react";

export const metadata = { title: "Sales" };

type Props = { searchParams: Promise<{ from?: string; to?: string }> };

export default async function SalesPage({ searchParams }: Props) {
  await requirePermission("sales");

  const { from: rawFrom, to: rawTo } = await searchParams;

  const dateWhere = rawFrom || rawTo ? {
    ...(rawFrom ? { gte: new Date(rawFrom + "T00:00:00.000Z") } : {}),
    ...(rawTo   ? { lte: new Date(rawTo   + "T23:59:59.999Z") } : {}),
  } : undefined;

  const [orders, salesmen] = await Promise.all([
    prisma.salesOrder.findMany({
      where: { deletedAt: null, ...(dateWhere ? { orderDate: dateWhere } : {}) },
      include: { salesman: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.salesman.findMany({
      where: { deletedAt: null },
      select: { openingBalance: true },
    }),
  ]);

  const serialised = orders.map((o) => ({
    id:            o.id,
    orderNumber:   o.orderNumber,
    status:        o.status,
    salesmanId:    o.customerId,
    customerName:  o.salesman.name,
    orderDate:     o.orderDate.toISOString(),
    totalAmount:   Number(o.totalAmount),
    factoryAmount: Number(o.factoryAmount),
    amountPaid:    Number(o.amountPaid),
  }));

  const totalCommission  = orders
    .filter((o) => o.status !== "CANCELLED" && o.status !== "DRAFT" && o.status !== "LOST")
    .reduce((sum, o) => sum + Number(o.commissionAmount), 0);
  const totalRevenue     = serialised
    .filter((o) => o.status !== "CANCELLED" && o.status !== "DRAFT" && o.status !== "LOST")
    .reduce((sum, o) => sum + o.factoryAmount, 0);
  const openingBalanceTotal = salesmen.reduce((sum, s) => sum + Number(s.openingBalance), 0);
  const totalOutstanding =
    openingBalanceTotal +
    serialised
      .filter((o) => o.status !== "CANCELLED" && o.status !== "DRAFT" && o.status !== "LOST")
      .reduce((sum, o) => sum + (o.factoryAmount - o.amountPaid), 0);
  const totalCollected   = serialised.reduce((sum, o) => sum + o.amountPaid, 0);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-semibold">Sales</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{serialised.length} orders total</p>
        </div>
        <div className="flex gap-2">
          <Link href="/sales/salesmen" className={cn(buttonVariants({ variant: "outline" }))}>
            <Users className="h-4 w-4" />
            Salesmen
          </Link>
          <Link href="/sales/new" className={cn(buttonVariants({}))}>
            <Plus className="h-4 w-4" />
            New Order
          </Link>
        </div>
      </div>

      {/* Date filter */}
      <div className="shrink-0">
        <Suspense>
          <DateFilter from={rawFrom} to={rawTo} />
        </Suspense>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 shrink-0">
        <div className="rounded-lg border bg-card px-4 py-3 transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-1 hover:shadow-md active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Commission Given</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatAmount(totalCommission)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total paid to salesmen</p>
        </div>

        <div className="rounded-lg border bg-card px-4 py-3 transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-1 hover:shadow-md active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Factory Revenue</p>
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold mt-1">{formatAmount(totalRevenue)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">After commission deductions</p>
        </div>

        <div className="rounded-lg border bg-card px-4 py-3 transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-1 hover:shadow-md active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Collected</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatAmount(totalCollected)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Payments received</p>
        </div>

        <div className="rounded-lg border bg-card px-4 py-3 transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-1 hover:shadow-md active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Outstanding</p>
            <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className={`text-2xl font-bold mt-1 ${totalOutstanding > 0 ? "text-destructive" : "text-green-600"}`}>
            {formatAmount(totalOutstanding)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Incl. opening balances</p>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <SoTable orders={serialised} from={rawFrom} to={rawTo} />
      </div>
    </div>
  );
}
