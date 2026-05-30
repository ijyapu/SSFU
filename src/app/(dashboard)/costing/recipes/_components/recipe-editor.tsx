"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, AlertCircle, Save, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { upsertRecipe, deleteRecipe } from "../actions";
import type { RecipeIngredientCategory, RecipeOverheadCategory } from "@/lib/validators/recipe";

// ─── Types ────────────────────────────────────────────────────────────────────

type AvailableProduct = { id: string; name: string; sku: string; unitName: string; costPrice: number; categoryName: string };

type IngredientLine = {
  key:          number;
  productId:    string;
  quantity:     number | "";
  costCategory: RecipeIngredientCategory;
};

type OverheadLine = {
  key:         number;
  description: string;
  quantity:    number | "";
  unit:        string;
  unitCost:    number | "";
  category:    RecipeOverheadCategory;
};

// ─── Category config ──────────────────────────────────────────────────────────

const INGREDIENT_CATEGORIES: { value: RecipeIngredientCategory; label: string }[] = [
  { value: "RAW_MATERIAL", label: "Raw Material" },
  { value: "PACKAGING",    label: "Packaging" },
  { value: "OTHER_DIRECT", label: "Other Direct" },
];

const OVERHEAD_CATEGORIES: { value: RecipeOverheadCategory; label: string }[] = [
  { value: "FUEL",           label: "Fuel / Diesel" },
  { value: "ELECTRICITY",    label: "Electricity" },
  { value: "OTHER_OVERHEAD", label: "Other Overhead" },
];

const CATEGORY_BADGE: Record<RecipeIngredientCategory, string> = {
  RAW_MATERIAL: "bg-amber-100 text-amber-800",
  PACKAGING:    "bg-sky-100 text-sky-800",
  OTHER_DIRECT: "bg-violet-100 text-violet-800",
};

const CATEGORY_DOT: Record<RecipeIngredientCategory, string> = {
  RAW_MATERIAL: "bg-amber-400",
  PACKAGING:    "bg-sky-400",
  OTHER_DIRECT: "bg-violet-400",
};

const CATEGORY_LABEL: Record<RecipeIngredientCategory, string> = {
  RAW_MATERIAL: "Raw Material",
  PACKAGING:    "Packaging",
  OTHER_DIRECT: "Other Direct",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

let nextKey = 1;

function emptyIngredient(): IngredientLine {
  return { key: nextKey++, productId: "", quantity: "", costCategory: "RAW_MATERIAL" };
}

function emptyOverhead(): OverheadLine {
  return { key: nextKey++, description: "", quantity: "", unit: "", unitCost: "", category: "FUEL" };
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function detectCategory(productCategoryName: string): RecipeIngredientCategory | null {
  const n = productCategoryName.toLowerCase();
  if (n.includes("packag"))                                         return "PACKAGING";
  if (n.includes("raw") || n.includes("material") || n.includes("ingredient")) return "RAW_MATERIAL";
  if (n.includes("direct") || n.includes("consumable") || n.includes("other")) return "OTHER_DIRECT";
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RecipeEditor({
  product,
  existingRecipe,
  availableIngredients,
}: {
  product: {
    id:           string;
    name:         string;
    sku:          string;
    unitName:     string;
    costPrice:    number;
    sellingPrice: number;
    categoryName: string;
  };
  existingRecipe: {
    yieldQty:     number;
    deductionPct: number;
    notes:        string | null;
    ingredients: {
      productId:    string;
      productName:  string;
      unitName:     string;
      quantity:     number;
      costPrice:    number;
      costCategory: RecipeIngredientCategory;
    }[];
    overheadLines: {
      description: string;
      quantity:    number;
      unit:        string;
      unitCost:    number;
      lineCost:    number;
      category:    RecipeOverheadCategory;
    }[];
  } | null;
  availableIngredients: AvailableProduct[];
}) {
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────

  const [yieldQty,     setYieldQty]     = useState<number | "">(existingRecipe?.yieldQty ?? 1);
  const [deductionPct, setDeductionPct] = useState<number | "">(existingRecipe?.deductionPct ?? 35);
  const [notes,        setNotes]        = useState(existingRecipe?.notes ?? "");

  const [lines, setLines] = useState<IngredientLine[]>(() =>
    existingRecipe && existingRecipe.ingredients.length > 0
      ? existingRecipe.ingredients.map((i) => ({
          key:          nextKey++,
          productId:    i.productId,
          quantity:     i.quantity,
          costCategory: i.costCategory,
        }))
      : [emptyIngredient()]
  );

  const [overheadLines, setOverheadLines] = useState<OverheadLine[]>(() =>
    existingRecipe && existingRecipe.overheadLines.length > 0
      ? existingRecipe.overheadLines.map((l) => ({
          key:         nextKey++,
          description: l.description,
          quantity:    l.quantity,
          unit:        l.unit,
          unitCost:    l.unitCost,
          category:    l.category,
        }))
      : []
  );

  const [errors,              setErrors]              = useState<Record<string, string>>({});
  const [saving,              setSaving]              = useState(false);
  const [deleting,            setDeleting]            = useState(false);
  const [categoryNeedsReview, setCategoryNeedsReview] = useState<Set<number>>(new Set());

  const productMap = useMemo(
    () => new Map(availableIngredients.map((p) => [p.id, p])),
    [availableIngredients]
  );

  // ── Real-time cost calculations ────────────────────────────────────────────

  const costs = useMemo(() => {
    const rawMaterialCost = lines
      .filter((l) => l.costCategory === "RAW_MATERIAL")
      .reduce((s, l) => s + (Number(l.quantity) || 0) * (productMap.get(l.productId)?.costPrice ?? 0), 0);

    const packagingCost = lines
      .filter((l) => l.costCategory === "PACKAGING")
      .reduce((s, l) => s + (Number(l.quantity) || 0) * (productMap.get(l.productId)?.costPrice ?? 0), 0);

    const otherDirectCost = lines
      .filter((l) => l.costCategory === "OTHER_DIRECT")
      .reduce((s, l) => s + (Number(l.quantity) || 0) * (productMap.get(l.productId)?.costPrice ?? 0), 0);

    const ingredientCost = rawMaterialCost + packagingCost + otherDirectCost;

    const overheadCost = overheadLines.reduce(
      (s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0),
      0
    );

    const totalBatchCost = ingredientCost + overheadCost;
    const yieldNum       = Number(yieldQty) || 0;
    const costPerUnit    = yieldNum > 0 ? totalBatchCost / yieldNum : 0;

    const deductionNum    = Number(deductionPct) || 0;
    const grossRevenue    = product.sellingPrice * yieldNum;
    const deductionAmount = grossRevenue * (deductionNum / 100);
    const netRevenue      = grossRevenue - deductionAmount;
    const profitPerBatch  = netRevenue - totalBatchCost;
    const profitPerUnit   = yieldNum > 0 ? profitPerBatch / yieldNum : 0;
    const trueMargin      = grossRevenue > 0 ? (profitPerBatch / grossRevenue) * 100 : 0;

    return {
      rawMaterialCost, packagingCost, otherDirectCost,
      ingredientCost, overheadCost, totalBatchCost,
      yieldNum, costPerUnit,
      grossRevenue, deductionAmount, netRevenue,
      profitPerBatch, profitPerUnit, trueMargin,
    };
  }, [lines, overheadLines, yieldQty, deductionPct, product.sellingPrice, productMap]);

  const {
    rawMaterialCost, packagingCost, otherDirectCost,
    ingredientCost, overheadCost, totalBatchCost,
    yieldNum, costPerUnit,
    grossRevenue, deductionAmount, netRevenue,
    profitPerBatch, profitPerUnit, trueMargin,
  } = costs;

  // ── Ingredient mutations ───────────────────────────────────────────────────

  function addIngredient() {
    setLines((prev) => [...prev, emptyIngredient()]);
  }

  function removeIngredient(key: number) {
    setLines((prev) => prev.length > 1 ? prev.filter((l) => l.key !== key) : prev);
  }

  function updateIngredient(key: number, patch: Partial<Omit<IngredientLine, "key">>) {
    setLines((prev) => prev.map((l) => l.key === key ? { ...l, ...patch } : l));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`ing_${key}_productId`];
      delete next[`ing_${key}_quantity`];
      delete next["_global"];
      return next;
    });
  }

  // ── Overhead mutations ─────────────────────────────────────────────────────

  function addOverhead() {
    setOverheadLines((prev) => [...prev, emptyOverhead()]);
  }

  function removeOverhead(key: number) {
    setOverheadLines((prev) => prev.filter((l) => l.key !== key));
  }

  function updateOverhead(key: number, patch: Partial<Omit<OverheadLine, "key">>) {
    setOverheadLines((prev) => prev.map((l) => l.key === key ? { ...l, ...patch } : l));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`ovh_${key}_description`];
      delete next[`ovh_${key}_quantity`];
      delete next[`ovh_${key}_unit`];
      delete next["_global"];
      return next;
    });
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  function validate() {
    const errs: Record<string, string> = {};

    if (!yieldQty || Number(yieldQty) <= 0) errs["yieldQty"] = "Must be > 0";
    if (deductionPct !== "" && (Number(deductionPct) < 0 || Number(deductionPct) > 100)) {
      errs["deductionPct"] = "Must be 0 – 100";
    }

    let hasValidIngredient = false;
    for (const l of lines) {
      if (!l.productId) errs[`ing_${l.key}_productId`] = "Select an ingredient";
      if (l.quantity === "" || Number(l.quantity) <= 0) errs[`ing_${l.key}_quantity`] = "Must be > 0";
      if (l.productId && Number(l.quantity) > 0) hasValidIngredient = true;
    }
    if (!hasValidIngredient) errs["_global"] = "Add at least one ingredient";

    for (const l of overheadLines) {
      if (!l.description.trim())                        errs[`ovh_${l.key}_description`] = "Required";
      if (l.quantity === "" || Number(l.quantity) <= 0) errs[`ovh_${l.key}_quantity`]    = "Must be > 0";
      if (!l.unit.trim())                               errs[`ovh_${l.key}_unit`]         = "Required";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const validIngredients = lines.filter((l) => l.productId && Number(l.quantity) > 0);
      await upsertRecipe(product.id, {
        yieldQty:     Number(yieldQty),
        deductionPct: Number(deductionPct) || 35,
        notes:        notes.trim() || undefined,
        ingredients: validIngredients.map((l) => ({
          productId:    l.productId,
          quantity:     Number(l.quantity),
          costCategory: l.costCategory,
        })),
        overheadLines: overheadLines
          .filter((l) => l.description.trim() && Number(l.quantity) > 0 && l.unit.trim())
          .map((l) => ({
            description: l.description.trim(),
            quantity:    Number(l.quantity),
            unit:        l.unit.trim(),
            unitCost:    Number(l.unitCost) || 0,
            category:    l.category,
          })),
      });
      toast.success("Recipe saved");
      router.push("/costing/recipes");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save recipe");
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteRecipe(product.id);
      toast.success("Recipe deleted");
      router.push("/costing/recipes");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete recipe");
    } finally {
      setDeleting(false);
    }
  }

  // ── Section header ─────────────────────────────────────────────────────────

  const sectionHead = (n: number, title: string, desc: string) => (
    <div className="flex items-start gap-3">
      <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground mt-0.5">
        {n}
      </span>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* ── How this works ── */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-sm font-semibold text-foreground/80">How product costing works</p>
        </div>
        <div className="pl-6 space-y-1 text-xs text-muted-foreground leading-relaxed">
          <p>
            <span className="font-medium text-foreground/60">Steps 1 – 3:</span>{" "}
            Enter yield, then add all ingredients/packaging, then add overhead costs (diesel, electricity, etc.).
          </p>
          <p>
            <span className="font-medium text-foreground/60">Step 4:</span>{" "}
            Ingredients + Overhead = Total Batch Cost ÷ Yield ={" "}
            <span className="font-semibold text-foreground/70">Cost Per Pack</span>{" "}
            — saved to the product automatically on Save.
          </p>
          <p>
            <span className="font-medium text-foreground/60">Step 5:</span>{" "}
            Selling Price × Yield − Deduction = Net Revenue − Batch Cost ={" "}
            <span className="font-semibold text-foreground/70">Profit Preview</span>{" "}
            — for decision-making only, not saved.
          </p>
          <p className="pt-1.5 border-t border-border/40 text-muted-foreground/60">
            Deduction % does not affect accounting, P&L, payroll, or commission.
            Overhead does not create stock movements or expense records.
          </p>
        </div>
      </div>

      {/* ── Section 1: Yield ── */}
      <div className="space-y-4">
        {sectionHead(1, "Product Yield", "How many units does one batch of this product produce?")}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Batch Yield ({product.unitName})
            </Label>
            <Input
              type="number" min="0.001" step="0.001" placeholder="1"
              value={yieldQty}
              onChange={(e) => {
                setYieldQty(e.target.value === "" ? "" : parseFloat(e.target.value));
                setErrors((prev) => { const n = { ...prev }; delete n["yieldQty"]; return n; });
              }}
              className={errors["yieldQty"] ? "border-destructive" : ""}
            />
            <p className="text-[11px] text-muted-foreground/70">
              Enter how many {product.unitName}s this batch makes. Example: 10 packs → enter 10.
            </p>
            {errors["yieldQty"] && (
              <p className="text-[11px] text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />{errors["yieldQty"]}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Notes <span className="normal-case font-normal tracking-normal">(optional)</span>
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Production notes, batch instructions…"
              className="text-sm resize-none"
            />
          </div>
        </div>
      </div>

      {/* ── Section 2: Ingredients ── */}
      <div className="space-y-4">
        {sectionHead(
          2,
          "Ingredients & Packaging",
          "All raw materials, packaging items, and direct costs used per batch. Mark each item with the correct category."
        )}

        {/* Category legend */}
        <div className="rounded-md border bg-muted/20 px-3 py-2.5 space-y-1.5 text-xs text-muted-foreground">
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <span className="flex items-center gap-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800">Raw Material</span>
              flour, sugar, oil, milk, spices
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-sky-100 text-sky-800">Packaging</span>
              plastic bags, boxes, stickers, labels
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-violet-100 text-violet-800">Other Direct</span>
              cleaning agents, direct-use items
            </span>
          </div>
          <p className="text-muted-foreground/60">
            Qty tip: enter in the product&apos;s inventory unit. Example — if unit is <strong>kg</strong>, enter <strong>0.1</strong> for 100 g.
          </p>
        </div>

        {/* Ingredient table */}
        <div className="rounded-lg border overflow-x-auto">
          <div style={{ minWidth: "44rem" }}>
            {/* Header */}
            <div
              className="grid bg-muted/10 border-b"
              style={{ gridTemplateColumns: "2.5rem minmax(14rem,1fr) 10rem 8rem 8rem 2.5rem" }}
            >
              <div className="px-3 py-2.5 text-xs font-medium text-muted-foreground">#</div>
              <div className="px-3 py-2.5 text-xs font-medium text-muted-foreground">Ingredient / Item</div>
              <div className="px-3 py-2.5 text-xs font-medium text-muted-foreground">Category</div>
              <div className="px-3 py-2.5 text-xs font-medium text-muted-foreground text-right">Qty / Batch</div>
              <div className="px-3 py-2.5 text-xs font-medium text-muted-foreground text-right">Line Cost (Rs)</div>
              <div />
            </div>

            {/* Rows */}
            <div className="divide-y">
              {lines.map((line, idx) => {
                const ing      = productMap.get(line.productId);
                const qty      = Number(line.quantity) || 0;
                const lineCost = qty * (ing?.costPrice ?? 0);
                const errProd  = errors[`ing_${line.key}_productId`];
                const errQty   = errors[`ing_${line.key}_quantity`];

                return (
                  <div
                    key={line.key}
                    className={`grid items-start ${errProd || errQty ? "bg-destructive/5" : "hover:bg-muted/10"}`}
                    style={{ gridTemplateColumns: "2.5rem minmax(14rem,1fr) 10rem 8rem 8rem 2.5rem" }}
                  >
                    <div className="px-3 py-3 text-sm text-muted-foreground/50 tabular-nums self-center">{idx + 1}</div>

                    <div className="px-2 py-2 space-y-1">
                      <Select
                        value={line.productId}
                        onValueChange={(v) => {
                          if (!v) return;
                          const selected  = productMap.get(v);
                          const detected  = selected ? detectCategory(selected.categoryName) : null;
                          updateIngredient(line.key, {
                            productId: v,
                            ...(detected !== null ? { costCategory: detected } : {}),
                          });
                          setCategoryNeedsReview((prev) => {
                            const next = new Set(prev);
                            if (detected === null) { next.add(line.key); } else { next.delete(line.key); }
                            return next;
                          });
                        }}
                      >
                        <SelectTrigger className={`h-8 w-full text-sm ${errProd ? "border-destructive" : ""}`}>
                          <SelectValue placeholder="Choose ingredient…">
                            {ing ? `${ing.name} (${ing.unitName})` : undefined}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent searchable>
                          {availableIngredients.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}{" "}
                              <span className="text-xs text-muted-foreground">
                                ({p.unitName} · Rs {p.costPrice.toFixed(2)})
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errProd && (
                        <p className="flex items-center gap-1 text-[11px] text-destructive">
                          <AlertCircle className="h-3 w-3" />{errProd}
                        </p>
                      )}
                    </div>

                    {/* Category — auto-detected from product category; amber hint when unknown */}
                    <div className="px-2 py-2 space-y-1">
                      <Select
                        value={line.costCategory}
                        onValueChange={(v) => {
                          updateIngredient(line.key, { costCategory: v as RecipeIngredientCategory });
                          setCategoryNeedsReview((prev) => {
                            const next = new Set(prev);
                            next.delete(line.key);
                            return next;
                          });
                        }}
                      >
                        <SelectTrigger className={`h-8 w-full text-xs ${categoryNeedsReview.has(line.key) ? "border-amber-400" : ""}`}>
                          <SelectValue>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${CATEGORY_BADGE[line.costCategory]}`}>
                              {CATEGORY_LABEL[line.costCategory]}
                            </span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {INGREDIENT_CATEGORIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${CATEGORY_BADGE[c.value]}`}>
                                {c.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {categoryNeedsReview.has(line.key) && (
                        <p className="text-[11px] text-amber-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          Category not recognised — please select one.
                        </p>
                      )}
                    </div>

                    <div className="px-2 py-2 space-y-1">
                      <div className="relative">
                        <Input
                          type="number" min="0.001" step="0.001" placeholder="0"
                          value={line.quantity}
                          onChange={(e) => updateIngredient(line.key, {
                            quantity: e.target.value === "" ? "" : parseFloat(e.target.value),
                          })}
                          className={`h-8 text-sm text-right tabular-nums ${ing ? "pr-9" : ""} ${errQty ? "border-destructive" : ""}`}
                        />
                        {ing && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/50 pointer-events-none">
                            {ing.unitName}
                          </span>
                        )}
                      </div>
                      {errQty && <p className="text-[11px] text-destructive text-right">{errQty}</p>}
                    </div>

                    <div className="px-2 py-2 flex items-center justify-end min-h-10">
                      {lineCost > 0 ? (
                        <span className="text-sm tabular-nums font-semibold text-blue-600">{fmt(lineCost)}</span>
                      ) : (
                        <span className="text-muted-foreground/30 text-sm">—</span>
                      )}
                    </div>

                    <div className="flex items-center justify-center min-h-10">
                      <Button
                        type="button" variant="ghost" size="icon"
                        disabled={lines.length === 1}
                        onClick={() => removeIngredient(line.key)}
                        className="h-7 w-7 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 disabled:opacity-20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t flex items-center justify-between bg-muted/5">
              <Button type="button" variant="outline" size="sm" onClick={addIngredient} className="gap-1.5 text-muted-foreground">
                <Plus className="h-3.5 w-3.5" />
                Add Ingredient
              </Button>
              <div className="text-sm text-muted-foreground tabular-nums">
                Ingredients total:{" "}
                <span className="font-semibold text-foreground">Rs {fmt(ingredientCost)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 3: Overhead ── */}
      <div className="space-y-4">
        {sectionHead(
          3,
          "Batch Overhead / Fuel",
          "Non-inventory costs like diesel, electricity, or LPG used per batch. Does not create stock movements."
        )}

        {/* Overhead guide */}
        <div className="rounded-md border bg-muted/20 px-3 py-2.5 space-y-1 text-xs text-muted-foreground">
          <p className="font-medium text-foreground/60">Use this for costs that are NOT tracked as inventory:</p>
          <p>Diesel, electricity, LPG, generator fuel, water charges, or any per-batch running cost.</p>
          <p className="font-mono text-foreground/50">
            Example → Description: Diesel for boiler &nbsp;|&nbsp; Unit: litre &nbsp;|&nbsp; Qty: 10 &nbsp;|&nbsp; Rs 234 &nbsp;= Rs 2,340
          </p>
          <p className="pt-1 border-t border-border/40 text-muted-foreground/60">
            Overhead is included in Cost Per Pack (Step 4) but does not affect accounting entries.
          </p>
        </div>

        {/* Overhead table */}
        <div className="rounded-lg border overflow-x-auto">
          <div style={{ minWidth: overheadLines.length > 0 ? "54rem" : undefined }}>

            {overheadLines.length > 0 && (
              <>
                {/* Header */}
                <div
                  className="grid bg-muted/10 border-b"
                  style={{ gridTemplateColumns: "minmax(14rem,1fr) 10rem 6rem 7rem 7rem 8rem 2.5rem" }}
                >
                  <div className="px-3 py-2.5 text-xs font-medium text-muted-foreground">Description</div>
                  <div className="px-3 py-2.5 text-xs font-medium text-muted-foreground">Category</div>
                  <div className="px-3 py-2.5 text-xs font-medium text-muted-foreground">Unit</div>
                  <div className="px-3 py-2.5 text-xs font-medium text-muted-foreground text-right">Qty</div>
                  <div className="px-3 py-2.5 text-xs font-medium text-muted-foreground text-right">Unit Cost (Rs)</div>
                  <div className="px-3 py-2.5 text-xs font-medium text-muted-foreground text-right">Line Cost (Rs)</div>
                  <div />
                </div>

                {/* Rows */}
                <div className="divide-y">
                  {overheadLines.map((line) => {
                    const lineCost = (Number(line.quantity) || 0) * (Number(line.unitCost) || 0);
                    const errDesc  = errors[`ovh_${line.key}_description`];
                    const errQty   = errors[`ovh_${line.key}_quantity`];
                    const errUnit  = errors[`ovh_${line.key}_unit`];

                    return (
                      <div
                        key={line.key}
                        className={`grid items-start ${errDesc || errQty || errUnit ? "bg-destructive/5" : "hover:bg-muted/10"}`}
                        style={{ gridTemplateColumns: "minmax(14rem,1fr) 10rem 6rem 7rem 7rem 8rem 2.5rem" }}
                      >
                        <div className="px-2 py-2 space-y-1">
                          <Input
                            placeholder="e.g. Diesel for boiler"
                            value={line.description}
                            onChange={(e) => updateOverhead(line.key, { description: e.target.value })}
                            className={`h-8 text-sm ${errDesc ? "border-destructive" : ""}`}
                          />
                          {errDesc && <p className="text-[11px] text-destructive">{errDesc}</p>}
                        </div>

                        <div className="px-2 py-2">
                          <Select
                            value={line.category}
                            onValueChange={(v) => updateOverhead(line.key, { category: v as RecipeOverheadCategory })}
                          >
                            <SelectTrigger className="h-8 w-full text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {OVERHEAD_CATEGORIES.map((c) => (
                                <SelectItem key={c.value} value={c.value} className="text-xs">
                                  {c.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="px-2 py-2 space-y-1">
                          <Input
                            placeholder="L, kWh, kg…"
                            value={line.unit}
                            onChange={(e) => updateOverhead(line.key, { unit: e.target.value })}
                            className={`h-8 text-sm ${errUnit ? "border-destructive" : ""}`}
                          />
                          {errUnit && <p className="text-[11px] text-destructive">{errUnit}</p>}
                        </div>

                        <div className="px-2 py-2 space-y-1">
                          <Input
                            type="number" min="0.001" step="0.001" placeholder="0"
                            value={line.quantity}
                            onChange={(e) => updateOverhead(line.key, {
                              quantity: e.target.value === "" ? "" : parseFloat(e.target.value),
                            })}
                            className={`h-8 text-sm text-right tabular-nums ${errQty ? "border-destructive" : ""}`}
                          />
                          {errQty && <p className="text-[11px] text-destructive text-right">{errQty}</p>}
                        </div>

                        <div className="px-2 py-2">
                          <Input
                            type="number" min="0" step="0.01" placeholder="0.00"
                            value={line.unitCost}
                            onChange={(e) => updateOverhead(line.key, {
                              unitCost: e.target.value === "" ? "" : parseFloat(e.target.value),
                            })}
                            className="h-8 text-sm text-right tabular-nums"
                          />
                        </div>

                        <div className="px-2 py-2 flex items-center justify-end min-h-10">
                          {lineCost > 0 ? (
                            <span className="text-sm tabular-nums font-semibold text-orange-600">{fmt(lineCost)}</span>
                          ) : (
                            <span className="text-muted-foreground/30 text-sm">—</span>
                          )}
                        </div>

                        <div className="flex items-center justify-center min-h-10">
                          <Button
                            type="button" variant="ghost" size="icon"
                            onClick={() => removeOverhead(line.key)}
                            className="h-7 w-7 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {overheadLines.length === 0 && (
              <p className="px-4 py-5 text-sm text-muted-foreground/60 italic text-center">
                No overhead lines added yet. Click &ldquo;Add Overhead Line&rdquo; to add diesel, electricity, etc.
              </p>
            )}

            <div className={`px-4 py-3 flex items-center justify-between bg-muted/5 ${overheadLines.length > 0 ? "border-t" : ""}`}>
              <Button type="button" variant="outline" size="sm" onClick={addOverhead} className="gap-1.5 text-muted-foreground">
                <Plus className="h-3.5 w-3.5" />
                Add Overhead Line
              </Button>
              {overheadLines.length > 0 && (
                <div className="text-sm text-muted-foreground tabular-nums">
                  Overhead total:{" "}
                  <span className="font-semibold text-foreground">Rs {fmt(overheadCost)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Sections 4 + 5: side by side on lg ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* ── Section 4: Cost Breakdown ── */}
        <div className="space-y-4">
          {sectionHead(
            4,
            "Cost Breakdown",
            "Updates live. Cost Per Pack is written to the product when you click Save."
          )}

          <Card>
            <CardContent className="pt-5 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${CATEGORY_DOT.RAW_MATERIAL}`} />
                  Raw Material
                </span>
                <span className="tabular-nums">Rs {fmt(rawMaterialCost)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${CATEGORY_DOT.PACKAGING}`} />
                  Packaging
                </span>
                <span className="tabular-nums">Rs {fmt(packagingCost)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${CATEGORY_DOT.OTHER_DIRECT}`} />
                  Other Direct
                </span>
                <span className="tabular-nums">Rs {fmt(otherDirectCost)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Ingredients</span>
                <span className="tabular-nums font-medium">Rs {fmt(ingredientCost)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Overhead / Fuel</span>
                <span className="tabular-nums font-medium text-orange-600">Rs {fmt(overheadCost)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between font-semibold">
                <span>Total Batch Cost</span>
                <span className="tabular-nums">Rs {fmt(totalBatchCost)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>÷ Yield</span>
                <span className="tabular-nums">
                  {yieldNum > 0
                    ? `${yieldNum.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${product.unitName}`
                    : "—"}
                </span>
              </div>

              {/* Cost Per Pack — prominent */}
              <div className="mt-2 rounded-lg border-2 border-blue-200 bg-blue-50/50 px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-blue-900/80">
                    = Cost Per {product.unitName}
                  </p>
                  <p className="text-[11px] text-blue-700/60 mt-0.5">
                    Saved to product on Save
                  </p>
                </div>
                <p className="text-2xl font-bold text-blue-700 tabular-nums shrink-0">
                  {costPerUnit > 0 ? `Rs ${fmt(costPerUnit)}` : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Section 5: Profitability Preview ── */}
        <div className="space-y-4">
          {sectionHead(
            5,
            "Profitability Preview",
            "Preview only — does not affect accounting, P&L, commission, or payroll."
          )}

          <Card>
            <CardContent className="pt-5 space-y-2 text-sm">
              {/* Deduction % */}
              <div className="rounded-md border bg-muted/20 px-3 py-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground/80">Deduction %</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                    Distributor margin, commission, or wastage allowance.
                    Preview only — does not affect accounting.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Input
                    type="number" min="0" max="100" step="0.1" placeholder="35"
                    value={deductionPct}
                    onChange={(e) => {
                      setDeductionPct(e.target.value === "" ? "" : parseFloat(e.target.value));
                      setErrors((prev) => { const n = { ...prev }; delete n["deductionPct"]; return n; });
                    }}
                    className={`h-7 w-20 text-sm text-right tabular-nums ${errors["deductionPct"] ? "border-destructive" : ""}`}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
              {errors["deductionPct"] && (
                <p className="text-[11px] text-destructive">{errors["deductionPct"]}</p>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Selling Price</span>
                <span className="tabular-nums font-medium">Rs {fmt(product.sellingPrice)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  × Yield ({yieldNum > 0
                    ? yieldNum.toLocaleString(undefined, { maximumFractionDigits: 3 })
                    : "—"} {product.unitName})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">= Gross Revenue</span>
                <span className="tabular-nums font-medium">
                  {grossRevenue > 0 ? `Rs ${fmt(grossRevenue)}` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  − Deduction ({Number(deductionPct) || 0}%)
                </span>
                <span className="tabular-nums text-destructive/60">
                  {grossRevenue > 0 ? `− Rs ${fmt(deductionAmount)}` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between font-medium">
                <span className="text-muted-foreground">= Net Revenue</span>
                <span className="tabular-nums">
                  {grossRevenue > 0 ? `Rs ${fmt(netRevenue)}` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">− Batch Cost</span>
                <span className="tabular-nums text-destructive/60">
                  {totalBatchCost > 0 ? `− Rs ${fmt(totalBatchCost)}` : "—"}
                </span>
              </div>

              <Separator />

              <div className={`flex items-center justify-between font-semibold ${
                grossRevenue > 0
                  ? profitPerBatch >= 0 ? "text-green-700" : "text-destructive"
                  : "text-muted-foreground/40"
              }`}>
                <span>= Profit / Batch</span>
                <span className="tabular-nums">
                  {grossRevenue > 0 ? `Rs ${fmt(profitPerBatch)}` : "—"}
                </span>
              </div>
              <div className={`flex items-center justify-between text-xs ${
                grossRevenue > 0 && yieldNum > 0
                  ? profitPerUnit >= 0 ? "text-green-600/80" : "text-destructive/80"
                  : "text-muted-foreground/40"
              }`}>
                <span>Profit / {product.unitName}</span>
                <span className="tabular-nums">
                  {grossRevenue > 0 && yieldNum > 0 ? `Rs ${fmt(profitPerUnit)}` : "—"}
                </span>
              </div>

              {/* True Margin — prominent */}
              <div className={`mt-2 rounded-lg border-2 px-4 py-3 flex items-center justify-between gap-3 ${
                grossRevenue > 0
                  ? trueMargin >= 20
                    ? "border-green-200 bg-green-50/50"
                    : trueMargin >= 0
                      ? "border-amber-200 bg-amber-50/50"
                      : "border-red-200 bg-red-50/50"
                  : "border-muted bg-muted/20"
              }`}>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${
                    grossRevenue > 0
                      ? trueMargin >= 20 ? "text-green-900/80" : trueMargin >= 0 ? "text-amber-900/80" : "text-red-900/80"
                      : "text-muted-foreground/50"
                  }`}>
                    True Margin
                  </p>
                  <p className={`text-[11px] mt-0.5 ${
                    grossRevenue > 0
                      ? trueMargin >= 20 ? "text-green-700/60" : trueMargin >= 0 ? "text-amber-700/60" : "text-red-700/60"
                      : "text-muted-foreground/40"
                  }`}>
                    After deduction · preview only
                  </p>
                </div>
                <p className={`text-2xl font-bold tabular-nums shrink-0 ${
                  grossRevenue > 0
                    ? trueMargin >= 20 ? "text-green-700" : trueMargin >= 0 ? "text-amber-700" : "text-destructive"
                    : "text-muted-foreground/30"
                }`}>
                  {grossRevenue > 0 ? `${trueMargin.toFixed(1)}%` : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Global error ── */}
      {errors["_global"] && (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />{errors["_global"]}
        </p>
      )}

      <Separator />

      {/* ── Actions ── */}
      <div className="flex items-center justify-between">
        {existingRecipe ? (
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="outline"
                  className="text-destructive border-destructive/40 hover:bg-destructive/5"
                  disabled={deleting}
                />
              }
            >
              {deleting ? "Deleting…" : "Delete Recipe"}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Recipe?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove the recipe for <strong>{product.name}</strong>.
                  The product&apos;s cost price will not be automatically updated.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <div />
        )}

        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : existingRecipe ? "Update Recipe" : "Save Recipe"}
        </Button>
      </div>
    </div>
  );
}
