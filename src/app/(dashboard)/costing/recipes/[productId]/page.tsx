import { notFound } from "next/navigation";
import Link from "next/link";
import { requireMinRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import { RecipeEditor } from "../_components/recipe-editor";
import type { RecipeIngredientCategory, RecipeOverheadCategory } from "@/lib/validators/recipe";

export const metadata = { title: "Edit Recipe" };

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  await requireMinRole("admin");

  const { productId } = await params;

  const [product, recipe, allProducts] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId, deletedAt: null },
      include: { unit: true, category: true },
    }),
    prisma.recipe.findUnique({
      where: { productId },
      include: {
        ingredients: {
          include: { product: { include: { unit: true } } },
        },
        overheadLines: true,
      },
    }),
    prisma.product.findMany({
      where: { deletedAt: null, NOT: { category: { name: { contains: "consumable", mode: "insensitive" } } } },
      include: { unit: true, category: true },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    }),
  ]);

  if (!product) notFound();

  const serialisedProduct = {
    id:           product.id,
    name:         product.name,
    sku:          product.sku,
    categoryName: product.category.name,
    unitName:     product.unit.name,
    costPrice:    Number(product.costPrice),
    sellingPrice: Number(product.sellingPrice),
  };

  const serialisedRecipe = recipe
    ? {
        yieldQty:     Number(recipe.yieldQty),
        deductionPct: Number(recipe.deductionPct),
        notes:        recipe.notes,
        ingredients: recipe.ingredients.map((i) => ({
          productId:    i.productId,
          productName:  i.product.name,
          unitName:     i.product.unit.name,
          quantity:     Number(i.quantity),
          costPrice:    Number(i.product.costPrice),
          costCategory: i.costCategory as RecipeIngredientCategory,
        })),
        overheadLines: recipe.overheadLines.map((l) => ({
          description: l.description,
          quantity:    Number(l.quantity),
          unit:        l.unit,
          unitCost:    Number(l.unitCost),
          lineCost:    Number(l.lineCost),
          category:    l.category as RecipeOverheadCategory,
        })),
      }
    : null;

  const serialisedProducts = allProducts
    .filter((p) => p.id !== productId)
    .map((p) => ({
      id:           p.id,
      name:         p.name,
      sku:          p.sku,
      unitName:     p.unit.name,
      costPrice:    Number(p.costPrice),
      categoryName: p.category.name,
    }));

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/costing/recipes" className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}>
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{product.name}</h1>
          <p className="text-muted-foreground text-sm mt-0.5 font-mono">
            {product.sku} · {product.category.name} · {product.unit.name}
          </p>
        </div>
      </div>

      <RecipeEditor
        product={serialisedProduct}
        existingRecipe={serialisedRecipe}
        availableIngredients={serialisedProducts}
      />
    </div>
  );
}
