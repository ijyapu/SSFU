import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { ProductTable } from "./_components/product-table";
import { StockSummaryCards } from "./_components/stock-summary-cards";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { SlidersHorizontal, BarChart2, Bell } from "lucide-react";

export const metadata = { title: "Inventory" };

export default async function InventoryPage() {
  await requirePermission("inventory");

  const [products, categories, units] = await Promise.all([
    prisma.product.findMany({
      where: { deletedAt: null },
      include: { category: true, unit: true },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      take: 500,
    }),
    prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.unit.findMany({ orderBy: { name: "asc" } }),
  ]);

  const serialised = products.map((p) => ({
    ...p,
    costPrice: Number(p.costPrice),
    sellingPrice: Number(p.sellingPrice),
    reorderLevel: Number(p.reorderLevel),
    currentStock: Number(p.currentStock),
  }));

  const lowStockCount = serialised.filter(
    (p) => p.reorderLevel > 0 && p.currentStock > 0 && p.currentStock <= p.reorderLevel
  ).length;
  const outOfStockCount = serialised.filter((p) => p.currentStock <= 0).length;
  const totalValue = serialised.reduce(
    (sum, p) => sum + p.currentStock * p.costPrice, 0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {serialised.length} products · {categories.length} categories
          </p>
        </div>
        <div className="flex gap-2">
          {(lowStockCount > 0 || outOfStockCount > 0) && (
            <Link
              href="/inventory/reorder"
              className={cn(buttonVariants({ variant: "outline" }), "text-amber-600 border-amber-300 hover:bg-amber-50")}
            >
              <Bell className="h-4 w-4" />
              Reorder Alerts
              <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-semibold">
                {lowStockCount + outOfStockCount}
              </span>
            </Link>
          )}
          <Link
            href="/inventory/stock-levels"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <BarChart2 className="h-4 w-4" />
            Stock Levels
          </Link>
          <Link
            href="/inventory/adjustments"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Adjustments
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <StockSummaryCards
        totalProducts={serialised.length}
        lowStockCount={lowStockCount}
        outOfStockCount={outOfStockCount}
        totalValue={totalValue}
      />

      {/* Product table */}
      <ProductTable
        products={serialised}
        categories={categories}
        units={units}
      />
    </div>
  );
}
