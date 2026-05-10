import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, PackageX } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { ReturnFormPage } from "./_components/return-form-page";
import { salesOrderHref } from "@/lib/sales-nav";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const so = await prisma.salesOrder.findUnique({
    where: { id },
    select: { orderNumber: true },
  });
  return { title: so ? `Record Waste — ${so.orderNumber}` : "Record Waste" };
}

export default async function RecordWastePage({
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
      select: {
        id: true,
        orderNumber: true,
        status: true,
        salesman: { select: { name: true } },
      },
    }),
    prisma.product.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, sellingPrice: true, unit: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!so) notFound();
  if (so.status === "DRAFT" || so.status === "CANCELLED" || so.status === "LOST") notFound();

  const products = rawProducts.map((p) => ({
    id: p.id,
    name: p.name,
    unitName: p.unit.name,
    sellingPrice: Number(p.sellingPrice),
  }));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Link
          href={salesOrderHref(id, from, to)}
          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
            <PackageX className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold leading-tight">Record Waste Return</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {so.orderNumber} · {so.salesman.name} —{" "}
              <span className="font-medium text-foreground">not restocked</span>
            </p>
          </div>
        </div>
      </div>

      <ReturnFormPage soId={id} products={products} detailHref={salesOrderHref(id, from, to)} />
    </div>
  );
}
