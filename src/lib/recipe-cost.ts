import { type PrismaClient } from "@prisma/client";

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Recomputes a product's costPrice from its recipe (if one exists).
 *
 * Formula:
 *   ingredientCost = Σ(ingredient.quantity × ingredient.product.costPrice)
 *   overheadCost   = Σ(overheadLine.lineCost)          ← stored, not recomputed
 *   batchCost      = ingredientCost + overheadCost
 *   costPerUnit    = batchCost ÷ yieldQty
 *   Product.costPrice ← costPerUnit
 *
 * deductionPct is stored on the recipe but intentionally NOT used here —
 * it is a profitability-preview field only and must never enter costPrice.
 *
 * No-op when the product has no recipe.
 */
export async function recalcProductCostFromRecipe(
  productId: string,
  tx: Tx
): Promise<void> {
  const recipe = await tx.recipe.findUnique({
    where: { productId },
    include: {
      ingredients:   { include: { product: { select: { costPrice: true } } } },
      overheadLines: { select: { lineCost: true } },
    },
  });
  if (!recipe) return;

  const yieldQty = Number(recipe.yieldQty);
  if (yieldQty <= 0) return;

  const ingredientCost = recipe.ingredients.reduce(
    (sum, i) => sum + Number(i.quantity) * Number(i.product.costPrice),
    0
  );

  // lineCost is pre-computed and stored when each overhead line is saved,
  // so we read the stored value rather than recomputing here. This is
  // intentional: overhead line unitCosts are not linked to Product.costPrice
  // and therefore do not cascade when purchase prices change.
  const overheadCost = recipe.overheadLines.reduce(
    (sum, l) => sum + Number(l.lineCost),
    0
  );

  const batchCost = ingredientCost + overheadCost;

  await tx.product.update({
    where: { id: productId },
    data:  { costPrice: batchCost / yieldQty },
  });
}

/**
 * After an ingredient product's costPrice changes (e.g. new purchase received),
 * find every recipe that uses it and recompute the parent product's costPrice.
 *
 * Overhead lines are NOT cascaded — their unitCost is a fixed value entered
 * by the user, not derived from any Product.costPrice.
 */
export async function recalcRecipesUsingIngredient(
  ingredientProductId: string,
  tx: Tx
): Promise<void> {
  const usages = await tx.recipeIngredient.findMany({
    where:  { productId: ingredientProductId },
    select: { recipe: { select: { productId: true } } },
  });

  for (const usage of usages) {
    await recalcProductCostFromRecipe(usage.recipe.productId, tx);
  }
}
