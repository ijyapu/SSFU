import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { SoEditForm } from "./_components/so-edit-form";
import { salesOrderHref } from "@/lib/sales-nav";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const so = await prisma.salesOrder.findUnique({ where: { id }, select: { orderNumber: true } });
  return { title: so ? `Edit ${so.orderNumber}` : "Edit Sales Order" };
}

export default async function EditSalesOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requirePermission("sales");
  const { id } = await params;
  const { from, to } = await searchParams;

  const [so, rawProducts] = await Promise.all([
    prisma.salesOrder.findUnique({
      where: { id, deletedAt: null },
      include: {
        salesman: true,
        items: {
          include: { product: { include: { unit: true } } },
          orderBy: { product: { name: "asc" } },
        },
        returns: { select: { totalAmount: true } },
      },
    }),
    prisma.product.findMany({
      where: { deletedAt: null },
      include: { unit: true },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    }),
  ]);

  if (!so) notFound();
  if (so.status === "CANCELLED" || so.status === "LOST") redirect(`/sales/${id}`);

  const serialised = {
    id:           so.id,
    orderNumber:  so.orderNumber,
    status:       so.status,
    salesmanName: so.salesman.name,
    commissionPct: Number(so.commissionPct),
    orderDate:    so.orderDate.toISOString().split("T")[0],
    notes:        so.notes ?? "",
    amountPaid:   Number(so.amountPaid),
    existingReturnTotal: so.returns.reduce((sum, r) => sum + Number(r.totalAmount), 0),
    items: so.items.map((i) => ({
      productId: i.productId,
      quantity:  Number(i.quantity),
      unitPrice: Number(i.unitPrice),
    })),
  };

  const products = rawProducts.map((p) => ({
    id:           p.id,
    name:         p.name,
    sku:          p.sku,
    sellingPrice: Number(p.sellingPrice),
    currentStock: Number(p.currentStock),
    unit:         { name: p.unit.name },
  }));

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center gap-2">
        <Link
          href={salesOrderHref(id, from, to)}
          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Edit {so.orderNumber}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{so.salesman.name}</p>
        </div>
      </div>

      <div className="max-w-4xl">
        <SoEditForm so={serialised} products={products} detailHref={salesOrderHref(id, from, to)} />
      </div>
    </div>
  );
}
