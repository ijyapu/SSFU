import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { SoDetail } from "./_components/so-detail";
import { salesListHref, salesEditHref } from "@/lib/sales-nav";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const so = await prisma.salesOrder.findUnique({
    where: { id },
    select: { orderNumber: true },
  });
  return {
    title: so ? `${so.orderNumber}` : "Sales Order",
  };
}

export default async function SalesOrderDetailPage({
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
        salesman: {
          include: {
            salesOrders: {
              where: { deletedAt: null, status: { notIn: ["CANCELLED", "DRAFT", "LOST"] } },
              select: { factoryAmount: true, amountPaid: true },
            },
          },
        },
        items: {
          include: { product: { include: { unit: true } } },
          orderBy: { product: { name: "asc" } },
        },
        payments: { orderBy: { paidAt: "desc" } },
        returns: {
          include: { items: { include: { product: { include: { unit: true } } } } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.product.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, sellingPrice: true, unit: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!so) notFound();

  const salesmanTotalOutstanding =
    Number(so.salesman.openingBalance) +
    so.salesman.salesOrders.reduce(
      (sum, o) => sum + Number(o.factoryAmount) - Number(o.amountPaid),
      0
    );

  const products = rawProducts.map((p) => ({ id: p.id, name: p.name, unitName: p.unit.name, sellingPrice: Number(p.sellingPrice) }));

  const serialised = {
    id:           so.id,
    orderNumber:  so.orderNumber,
    status:       so.status,
    customerName: so.salesman.name,
    orderDate:    so.orderDate.toISOString(),
    notes:        so.notes,
    subtotal:         Number(so.subtotal),
    totalAmount:      Number(so.totalAmount),
    commissionPct:    Number(so.commissionPct),
    commissionAmount: Number(so.commissionAmount),
    factoryAmount:    Number(so.factoryAmount),
    amountPaid:       Number(so.amountPaid),
    items: so.items.map((i) => ({
      id:          i.id,
      productId:   i.productId,
      productName: i.product?.name ?? "Deleted Product",
      unitName:    i.product?.unit?.name ?? "—",
      quantity:    Number(i.quantity),
      unitPrice:   Number(i.unitPrice),
      totalPrice:  Number(i.totalPrice),
    })),
    payments: so.payments.map((p) => ({
      id:        p.id,
      amount:    Number(p.amount),
      method:    p.method,
      reference: p.reference,
      notes:     p.notes,
      paidAt:    p.paidAt.toISOString(),
    })),
    returns: so.returns.map((r) => ({
      id:           r.id,
      returnNumber: r.returnNumber,
      returnType:   r.returnType as "WASTE" | "FRESH",
      notes:        r.notes,
      totalAmount:  Number(r.totalAmount),
      createdAt:    r.createdAt.toISOString(),
      items: r.items.map((i) => ({
        id:          i.id,
        productId:   i.productId,
        productName: i.product?.name ?? "Deleted Product",
        unitName:    i.product?.unit?.name ?? "—",
        quantity:    Number(i.quantity),
        unitPrice:   Number(i.unitPrice),
        totalPrice:  Number(i.quantity) * Number(i.unitPrice),
      })),
    })),
    products,
    salesmanTotalOutstanding,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href={salesListHref(from, to)}
          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{so.orderNumber}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{so.salesman.name}</p>
        </div>
      </div>

      <SoDetail {...serialised} editHref={salesEditHref(id, from, to)} />
    </div>
  );
}
