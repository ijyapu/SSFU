import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { ERPPageHeader } from "@/components/ui/erp-page-header";
import { PurchaseForm } from "../../new/_components/po-form";
import { purchaseListHref } from "@/lib/purchase-nav";

export const metadata = { title: "Edit Purchase" };

export default async function EditPurchasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requirePermission("purchases");
  const { id } = await params;
  const { from: rawFrom, to: rawTo } = await searchParams;

  const [purchase, suppliers, products, categories, units] = await Promise.all([
    prisma.purchase.findUnique({
      where: { id, deletedAt: null },
      include: {
        items: { orderBy: { id: "asc" } },
      },
    }),
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
  ]);

  if (!purchase) notFound();

  const initialValues = {
    invoiceNo:     purchase.invoiceNo,
    supplierId:    purchase.supplierId,
    date:          purchase.date.toISOString().split("T")[0],
    paymentMethod: purchase.paymentMethod as "CASH" | "CREDIT",
    amountPaid:    Number(purchase.amountPaid),
    notes:         purchase.notes ?? "",
    invoiceUrl:    purchase.invoiceUrl ?? "",
    items: purchase.items.map((i) => ({
      productId:   i.productId ?? "",
      productName: i.productName,
      categoryId:  i.categoryId ?? "",
      unitId:      i.unitId ?? "",
      description: i.description ?? "",
      quantity:    Number(i.quantity),
      unitPrice:   Number(i.unitPrice),
      vatPct:      Number(i.vatPct),
      excisePct:   Number(i.excisePct ?? 0),
    })),
  };

  return (
    <div className="space-y-6">
      <ERPPageHeader
        title="Edit Purchase"
        subtitle={purchase.invoiceNo}
        backHref={purchaseListHref(rawFrom, rawTo)}
      />

      <PurchaseForm
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, contactName: s.contactName, phone: s.phone }))}
        products={products.map((p) => ({ id: p.id, name: p.name, sku: p.sku, costPrice: Number(p.costPrice), unit: p.unit.name }))}
        categories={categories}
        units={units}
        purchaseId={id}
        initialValues={initialValues}
        detailHref={purchaseListHref(rawFrom, rawTo)}
      />
    </div>
  );
}
