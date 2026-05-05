import Link from "next/link";
import { requireMinRole } from "@/lib/auth";
import { getRecipes } from "./actions";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, Plus, ChevronRight } from "lucide-react";

export const metadata = { title: "Recipes" };

export default async function RecipesPage() {
  await requireMinRole("admin");

  const [recipes, products] = await Promise.all([
    getRecipes(),
    prisma.product.findMany({
      where: { deletedAt: null, category: { name: { contains: "consumable", mode: "insensitive" } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const recipeProductIds = new Set(recipes.map((r) => r.productId));
  const withoutRecipe = products.filter((p) => !recipeProductIds.has(p.id));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Recipes</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {recipes.length} recipe{recipes.length !== 1 ? "s" : ""} — batch costs calculated from current ingredient prices
          </p>
        </div>
      </div>

      {recipes.length > 0 && (
        <div className="rounded-lg border divide-y">
          <div className="grid grid-cols-[minmax(0,1fr)_8rem_8rem_8rem_8rem_3rem] px-4 py-2.5 bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Product</span>
            <span className="text-right">Yield / Batch</span>
            <span className="text-right">Batch Cost</span>
            <span className="text-right">Cost / Unit</span>
            <span className="text-right">Selling Price</span>
            <span />
          </div>
          {recipes.map((r) => {
            const margin = r.costPerUnit > 0
              ? ((r.costPrice - r.costPerUnit) / r.costPrice) * 100
              : null;
            return (
              <Link
                key={r.productId}
                href={`/costing/recipes/${r.productId}`}
                className="grid grid-cols-[minmax(0,1fr)_8rem_8rem_8rem_8rem_3rem] px-4 py-3 items-center hover:bg-muted/30 transition-colors"
              >
                <div>
                  <p className="font-medium text-sm">{r.productName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{r.productSku} · {r.ingredients.length} ingredient{r.ingredients.length !== 1 ? "s" : ""}</p>
                </div>
                <p className="text-right text-sm tabular-nums">
                  {r.yieldQty.toLocaleString(undefined, { maximumFractionDigits: 3 })} {r.unitName}
                </p>
                <p className="text-right text-sm tabular-nums font-medium">
                  Rs {r.batchCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-right text-sm tabular-nums text-blue-600 font-semibold">
                  Rs {r.costPerUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <div className="text-right">
                  {margin !== null ? (
                    <Badge
                      variant="secondary"
                      className={margin >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}
                    >
                      {margin >= 0 ? "+" : ""}{margin.toFixed(1)}%
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground justify-self-end" />
              </Link>
            );
          })}
        </div>
      )}

      {withoutRecipe.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              Products without a recipe
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {withoutRecipe.map((p) => (
              <Link
                key={p.id}
                href={`/costing/recipes/${p.id}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
              >
                <Plus className="h-3.5 w-3.5" />
                {p.name}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {recipes.length === 0 && withoutRecipe.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
          <FlaskConical className="h-10 w-10 opacity-30" />
          <p className="text-sm">No products yet. Add products in Inventory first.</p>
        </div>
      )}
    </div>
  );
}
