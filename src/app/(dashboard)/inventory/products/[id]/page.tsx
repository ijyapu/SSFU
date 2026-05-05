import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import { StockChart } from "./_components/stock-chart";
import { ProductMovementHistory } from "./_components/product-movement-history";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id }, select: { name: true } });
  return { title: product ? `${product.name}` : "Product" };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("inventory");
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id, deletedAt: null },
    include: { category: true, unit: true },
  });

  if (!product) notFound();

  const movements = await prisma.stockMovement.findMany({
    where: { productId: id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const currentStock = Number(product.currentStock);
  const reorderLevel = Number(product.reorderLevel);
  const costPrice = Number(product.costPrice);
  const sellingPrice = Number(product.sellingPrice);

  const status =
    currentStock <= 0 ? "out" :
    currentStock <= reorderLevel ? "low" : "ok";

  // Build chart data: replay movements in chronological order to get stock over time
  const chronological = [...movements].reverse();
  type ChartPoint = { date: string; stock: number };
  const chartData: ChartPoint[] = [];
  for (const m of chronological) {
    chartData.push({
      date: m.createdAt.toISOString(),
      stock: Number(m.quantityAfter),
    });
  }

  const serialisedMovements = movements.map((m) => ({
    id: m.id,
    type: m.type,
    quantity: Number(m.quantity),
    stockBefore: Number(m.quantityBefore),
    stockAfter: Number(m.quantityAfter),
    notes: m.notes,
    createdAt: m.createdAt.toISOString(),
    referenceType: m.referenceType,
    referenceId: m.referenceId,
  }));

  const statusConfig = {
    ok:  { label: "In Stock",     className: "bg-emerald-100 text-emerald-700" },
    low: { label: "Low Stock",    className: "bg-amber-100 text-amber-700" },
    out: { label: "Out of Stock", className: "bg-red-100 text-red-700" },
  };
  const cfg = statusConfig[status];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/inventory"
              className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-2xl font-semibold">{product.name}</h1>
            <Badge variant="secondary" className={cfg.className}>{cfg.label}</Badge>
          </div>
          <p className="text-muted-foreground text-sm ml-9 font-mono">{product.sku}</p>
        </div>
        <Link
          href="/inventory/adjustments"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Adjust Stock
        </Link>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${status !== "ok" ? (status === "out" ? "text-destructive" : "text-amber-600") : ""}`}>
              {currentStock.toLocaleString(undefined, { maximumFractionDigits: 3 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{product.unit.name}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reorder Level</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {reorderLevel > 0 ? reorderLevel.toLocaleString() : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {reorderLevel > 0 ? product.unit.name : "Not set"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cost Price</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">Rs {costPrice.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Value: Rs {(currentStock * costPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Selling Price</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {sellingPrice > 0 ? `Rs ${sellingPrice.toFixed(2)}` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {product.category.name}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stock chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stock Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <StockChart data={chartData} unit={product.unit.name} />
          </CardContent>
        </Card>
      )}

      {/* Movement history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movement History</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductMovementHistory movements={serialisedMovements} unit={product.unit.name} />
        </CardContent>
      </Card>
    </div>
  );
}
