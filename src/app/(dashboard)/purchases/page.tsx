import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { PurchaseTable } from "./_components/purchase-table";
import { ERPPageHeader } from "@/components/ui/erp-page-header";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { DateFilter } from "@/components/ui/date-filter";
import { Plus } from "lucide-react";
import { purchaseNewHref } from "@/lib/purchase-nav";

export const metadata = { title: "Purchases" };

type Props = { searchParams: Promise<{ from?: string; to?: string }> };

export default async function PurchasesPage({ searchParams }: Props) {
  await requirePermission("purchases");

  const { from: rawFrom, to: rawTo } = await searchParams;

  const dateWhere = rawFrom || rawTo ? {
    ...(rawFrom ? { gte: new Date(rawFrom + "T00:00:00.000Z") } : {}),
    ...(rawTo   ? { lte: new Date(rawTo   + "T23:59:59.999Z") } : {}),
  } : undefined;

  const [purchases, suppliers] = await Promise.all([
    prisma.purchase.findMany({
      where: { deletedAt: null, ...(dateWhere ? { date: dateWhere } : {}) },
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.supplier.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const serialised = purchases.map((p) => ({
    id:           p.id,
    invoiceNo:    p.invoiceNo,
    supplierId:   p.supplier.id,
    supplierName: p.supplier.name,
    date:         p.date.toISOString(),
    totalCost:    Number(p.totalCost),
  }));

  const totalSpend = serialised.reduce((s, p) => s + p.totalCost, 0);

  return (
    <div className="space-y-6">
      <ERPPageHeader
        title="Purchases"
        subtitle={`${serialised.length} invoice${serialised.length !== 1 ? "s" : ""}`}
        action={
          <Link href={purchaseNewHref(rawFrom, rawTo)} className={cn(buttonVariants({}))}>
            <Plus className="h-4 w-4" />
            New Purchase
          </Link>
        }
      />

      <Suspense>
        <DateFilter from={rawFrom} to={rawTo} />
      </Suspense>

      <div className="max-w-xs rounded-lg border bg-card px-4 py-3 transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-1 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0">
        <p className="text-xs text-muted-foreground">Total Spend</p>
        <p className="text-2xl font-bold tabular-nums mt-1">
          Rs {totalSpend.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-muted-foreground mt-1">All invoice totals · payments tracked in Vendor Ledger</p>
      </div>

      <PurchaseTable purchases={serialised} suppliers={suppliers} from={rawFrom} to={rawTo} />
    </div>
  );
}
