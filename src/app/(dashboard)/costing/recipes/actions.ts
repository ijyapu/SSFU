"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { upsertRecipeSchema, type UpsertRecipeValues } from "@/lib/validators/recipe";
import type { RecipeIngredientCategory, RecipeOverheadCategory } from "@/lib/validators/recipe";
import { recalcProductCostFromRecipe } from "@/lib/recipe-cost";

async function requireCostingAccess() {
  const user = await currentUser();
  if (!user) throw new Error("Unauthenticated");
  const role = user.publicMetadata?.role as string | undefined;
  if (role !== "admin" && role !== "superadmin") throw new Error("Unauthorized");
  return user.id;
}

// ─── Upsert ───────────────────────────────────────────────────────────────────

export async function upsertRecipe(productId: string, values: UpsertRecipeValues) {
  await requireCostingAccess();
  const data = upsertRecipeSchema.parse(values);

  // Apply server-side defaults for fields the current UI may not send yet.
  const deductionPct  = data.deductionPct  ?? 35;
  const overheadLines = data.overheadLines ?? [];

  // lineCost is computed server-side so the client cannot inject wrong values.
  const overheadCreate = overheadLines.map((l) => ({
    description: l.description,
    quantity:    l.quantity,
    unit:        l.unit,
    unitCost:    l.unitCost,
    lineCost:    Number((l.quantity * l.unitCost).toFixed(2)),
    category:    l.category ?? "FUEL" as const,
  }));

  const ingredientCreate = data.ingredients.map((i) => ({
    productId:    i.productId,
    quantity:     i.quantity,
    costCategory: i.costCategory ?? "RAW_MATERIAL" as const,
  }));

  const existing = await prisma.recipe.findUnique({ where: { productId } });

  if (existing) {
    await prisma.$transaction(async (tx) => {
      // Delete-and-recreate both child collections inside the transaction.
      await tx.recipeIngredient.deleteMany({   where: { recipeId: existing.id } });
      await tx.recipeOverheadLine.deleteMany({ where: { recipeId: existing.id } });

      await tx.recipe.update({
        where: { id: existing.id },
        data: {
          yieldQty:     data.yieldQty,
          deductionPct,
          notes:        data.notes || null,
          ingredients:   { create: ingredientCreate },
          overheadLines: { create: overheadCreate },
        },
      });

      await recalcProductCostFromRecipe(productId, tx);
    });
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.recipe.create({
        data: {
          productId,
          yieldQty:     data.yieldQty,
          deductionPct,
          notes:        data.notes || null,
          ingredients:   { create: ingredientCreate },
          overheadLines: { create: overheadCreate },
        },
      });

      await recalcProductCostFromRecipe(productId, tx);
    });
  }

  revalidatePath("/costing/recipes");
  revalidatePath(`/costing/recipes/${productId}`);
  revalidatePath("/costing");
  revalidatePath("/inventory");
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteRecipe(productId: string) {
  await requireCostingAccess();
  // Cascade on Recipe → RecipeIngredient and RecipeOverheadLine is defined in schema.
  await prisma.recipe.delete({ where: { productId } });
  revalidatePath("/costing/recipes");
  revalidatePath("/costing");
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type OverheadLineRow = {
  id:          string;
  description: string;
  quantity:    number;
  unit:        string;
  unitCost:    number;
  lineCost:    number;
  category:    RecipeOverheadCategory;
};

export type RecipeIngredientRow = {
  id:           string;
  productId:    string;
  productName:  string;
  unitName:     string;
  quantity:     number;
  costPrice:    number;
  lineCost:     number;
  costCategory: RecipeIngredientCategory;
};

export type RecipeRow = {
  productId:      string;
  productName:    string;
  productSku:     string;
  unitName:       string;
  /** Current Product.costPrice (= totalBatchCost ÷ yieldQty, written by recalc). */
  costPrice:      number;
  yieldQty:       number;
  deductionPct:   number;
  /** Σ(ingredient.quantity × ingredient.costPrice) — raw + packaging + other_direct. */
  ingredientCost: number;
  /** Σ(overheadLine.lineCost) — fuel, electricity, other overhead. */
  overheadCost:   number;
  /** ingredientCost + overheadCost. */
  batchCost:      number;
  /** batchCost ÷ yieldQty — matches Product.costPrice when freshly recalculated. */
  costPerUnit:    number;
  notes:          string | null;
  ingredients:    RecipeIngredientRow[];
  overheadLines:  OverheadLineRow[];
};

// ─── Query ───────────────────────────────────────────────────────────────────

export async function getRecipes(): Promise<RecipeRow[]> {
  await requireCostingAccess();

  const recipes = await prisma.recipe.findMany({
    include: {
      product:       { include: { unit: true } },
      ingredients:   { include: { product: { include: { unit: true } } } },
      overheadLines: true,
    },
    orderBy: { product: { name: "asc" } },
  });

  return recipes.map((r) => {
    const ingredientCost = r.ingredients.reduce(
      (sum, i) => sum + Number(i.quantity) * Number(i.product.costPrice),
      0
    );
    const overheadCost = r.overheadLines.reduce(
      (sum, l) => sum + Number(l.lineCost),
      0
    );
    const batchCost = ingredientCost + overheadCost;
    const yieldQty  = Number(r.yieldQty);

    return {
      productId:      r.productId,
      productName:    r.product.name,
      productSku:     r.product.sku,
      unitName:       r.product.unit.name,
      costPrice:      Number(r.product.costPrice),
      yieldQty,
      deductionPct:   Number(r.deductionPct),
      ingredientCost,
      overheadCost,
      batchCost,
      costPerUnit:    yieldQty > 0 ? batchCost / yieldQty : 0,
      notes:          r.notes,
      ingredients: r.ingredients.map((i) => ({
        id:           i.id,
        productId:    i.productId,
        productName:  i.product.name,
        unitName:     i.product.unit.name,
        quantity:     Number(i.quantity),
        costPrice:    Number(i.product.costPrice),
        lineCost:     Number(i.quantity) * Number(i.product.costPrice),
        costCategory: i.costCategory as RecipeIngredientCategory,
      })),
      overheadLines: r.overheadLines.map((l) => ({
        id:          l.id,
        description: l.description,
        quantity:    Number(l.quantity),
        unit:        l.unit,
        unitCost:    Number(l.unitCost),
        lineCost:    Number(l.lineCost),
        category:    l.category as RecipeOverheadCategory,
      })),
    };
  });
}
