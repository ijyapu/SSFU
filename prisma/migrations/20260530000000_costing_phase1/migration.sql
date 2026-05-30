-- Costing Phase 1: recipe ingredient categories, overhead lines, deduction %

-- CreateEnum
CREATE TYPE "RecipeIngredientCategory" AS ENUM ('RAW_MATERIAL', 'PACKAGING', 'OTHER_DIRECT');

-- CreateEnum
CREATE TYPE "RecipeOverheadCategory" AS ENUM ('FUEL', 'ELECTRICITY', 'OTHER_OVERHEAD');

-- AlterTable: add deductionPct to Recipe (default 35 — existing recipes inherit this)
ALTER TABLE "Recipe" ADD COLUMN "deductionPct" DECIMAL(5,2) NOT NULL DEFAULT 35;

-- AlterTable: add costCategory to RecipeIngredient (default RAW_MATERIAL — existing rows inherit this)
ALTER TABLE "RecipeIngredient" ADD COLUMN "costCategory" "RecipeIngredientCategory" NOT NULL DEFAULT 'RAW_MATERIAL';

-- CreateTable: RecipeOverheadLine (non-inventory batch costs like diesel, electricity)
CREATE TABLE "RecipeOverheadLine" (
    "id"          TEXT NOT NULL,
    "recipeId"    TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity"    DECIMAL(10,3) NOT NULL,
    "unit"        TEXT NOT NULL,
    "unitCost"    DECIMAL(10,2) NOT NULL,
    "lineCost"    DECIMAL(10,2) NOT NULL,
    "category"    "RecipeOverheadCategory" NOT NULL DEFAULT 'FUEL',

    CONSTRAINT "RecipeOverheadLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecipeOverheadLine_recipeId_idx" ON "RecipeOverheadLine"("recipeId");

-- AddForeignKey
ALTER TABLE "RecipeOverheadLine" ADD CONSTRAINT "RecipeOverheadLine_recipeId_fkey"
    FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
