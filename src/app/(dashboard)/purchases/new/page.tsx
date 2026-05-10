import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { ERPPageHeader } from "@/components/ui/erp-page-header";
import { PurchaseForm } from "./_components/po-form";
import { purchaseListHref } from "@/lib/purchase-nav";

export const metadata = { title: "New Purchase" };

export default async function NewPurchasePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requirePermission("purchases");
  const { from: rawFrom, to: rawTo } = await searchParams;

  const [suppliers, products, categories, units, openLog] = await Promise.all([
    prisma.supplier.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, contactName: true, phone: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, sku: true, costPrice: true, unit: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.unit.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.dailyLog.findFirst({
      where: { status: { in: ["OPEN", "REOPENED"] } },
      orderBy: { logDate: "desc" },
      select: { logDate: true },
    }),
  ]);

  const openLogDate = openLog?.logDate.toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <ERPPageHeader
        title="New Purchase"
        subtitle="Log a supplier invoice and update inventory"
        backHref={purchaseListHref(rawFrom, rawTo)}
      />

      <PurchaseForm
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, contactName: s.contactName, phone: s.phone }))}
        products={products.map((p) => ({ id: p.id, name: p.name, sku: p.sku, costPrice: Number(p.costPrice), unit: p.unit.name }))}
        categories={categories}
        units={units}
        openLogDate={openLogDate}
        detailHref={purchaseListHref(rawFrom, rawTo)}
      />
    </div>
  );
}
