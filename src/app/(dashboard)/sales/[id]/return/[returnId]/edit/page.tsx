import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { ReturnEditPageForm } from "./_components/return-edit-page-form";
import { salesOrderHref } from "@/lib/sales-nav";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; returnId: string }>;
}) {
  const { returnId } = await params;
  const r = await prisma.salesReturn.findUnique({
    where: { id: returnId },
    select: { returnNumber: true },
  });
  return { title: r ? `Edit ${r.returnNumber}` : "Edit Return" };
}

export default async function EditReturnPage({
  params,
}: {
  params: Promise<{ id: string; returnId: string }>;
}) {
  await requirePermission("sales");
  const { id: soId, returnId } = await params;

  const [salesReturn, rawProducts] = await Promise.all([
    prisma.salesReturn.findUnique({
      where: { id: returnId },
      include: {
        items: { include: { product: { include: { unit: true } } } },
        salesOrder: { select: { id: true, orderNumber: true, status: true } },
      },
    }),
    prisma.product.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, sellingPrice: true, unit: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!salesReturn) notFound();
  if (salesReturn.salesOrderId !== soId) notFound();
  if (["DRAFT", "CANCELLED", "LOST"].includes(salesReturn.salesOrder.status)) notFound();

  const returnData = {
    id:           salesReturn.id,
    returnNumber: salesReturn.returnNumber,
    returnType:   salesReturn.returnType as "WASTE" | "FRESH",
    notes:        salesReturn.notes,
    totalAmount:  Number(salesReturn.totalAmount),
    items: salesReturn.items.map((i) => ({
      id:          i.id,
      productId:   i.productId,
      productName: i.product?.name ?? "Deleted Product",
      unitName:    i.product?.unit?.name ?? "—",
      quantity:    Number(i.quantity),
      unitPrice:   Number(i.unitPrice),
      totalPrice:  Number(i.quantity) * Number(i.unitPrice),
    })),
  };

  const products = rawProducts.map((p) => ({
    id:           p.id,
    name:         p.name,
    unitName:     p.unit.name,
    sellingPrice: Number(p.sellingPrice),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/sales/${soId}`}
          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">
            Edit {returnData.returnType === "FRESH" ? "Fresh" : "Waste"} Return
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {salesReturn.returnNumber} · {salesReturn.salesOrder.orderNumber}
          </p>
        </div>
      </div>

      <ReturnEditPageForm soId={soId} returnData={returnData} products={products} />
    </div>
  );
}
