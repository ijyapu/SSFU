import { z } from "zod";

// ─── Cost-category enums (string literals — safe for client + server) ─────────

export const recipeIngredientCategorySchema = z.enum([
  "RAW_MATERIAL",
  "PACKAGING",
  "OTHER_DIRECT",
]);

export const recipeOverheadCategorySchema = z.enum([
  "FUEL",
  "ELECTRICITY",
  "OTHER_OVERHEAD",
]);

export type RecipeIngredientCategory = z.infer<typeof recipeIngredientCategorySchema>;
export type RecipeOverheadCategory   = z.infer<typeof recipeOverheadCategorySchema>;

// ─── Ingredient line ──────────────────────────────────────────────────────────

export const recipeIngredientSchema = z.object({
  productId:    z.string().min(1, "Select an ingredient"),
  quantity:     z.number().min(0.001, "Must be > 0").max(999_999),
  // Optional so existing editor (Step 2) compiles; Step 3 UI will always send it.
  costCategory: recipeIngredientCategorySchema.optional(),
});

// ─── Overhead line ────────────────────────────────────────────────────────────

export const recipeOverheadLineSchema = z.object({
  description: z.string().min(1, "Enter a description").max(200),
  quantity:    z.number().min(0.001, "Must be > 0").max(999_999),
  unit:        z.string().min(1, "Enter a unit").max(50),
  // unitCost may be 0 (free electricity etc.) — but not negative
  unitCost:    z.number().min(0, "Must be ≥ 0").max(999_999_999),
  // Optional so callers can omit; action defaults to FUEL
  category:    recipeOverheadCategorySchema.optional(),
});

// ─── Full recipe upsert ───────────────────────────────────────────────────────

export const upsertRecipeSchema = z.object({
  yieldQty:    z.number().min(0.001, "Must be > 0").max(999_999),
  // Optional so existing editor (which doesn't know about this yet) still works.
  // Action defaults to 35 when absent.
  deductionPct: z.number().min(0).max(100).optional(),
  notes:        z.string().max(1000).optional(),
  ingredients:  z
    .array(recipeIngredientSchema)
    .min(1, "Add at least one ingredient")
    .max(100),
  // Optional so existing editor (which doesn't send overhead) still works.
  overheadLines: z.array(recipeOverheadLineSchema).max(50).optional(),
});

export type UpsertRecipeValues = z.infer<typeof upsertRecipeSchema>;
