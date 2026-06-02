"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2, RotateCcw, PackageCheck, Wallet, ChevronsUpDown, Check, AlertTriangle } from "lucide-react";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductComboboxField } from "@/components/ui/product-combobox-field";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { createSoSchema, type CreateSoValues } from "@/lib/validators/sales";
import { createSalesOrder } from "../../actions";

type Salesman = { id: string; name: string; commissionPct: number; outstanding: number };
type Product  = {
  id: string;
  name: string;
  sku: string;
  sellingPrice: number;
  currentStock: number;
  unit: { name: string };
};

type ReturnLine = { key: number; productId: string; quantity: number | ""; unitPrice: number | "" };

type Props = {
  salesmen:    Salesman[];
  products:    Product[];
  openLogDate?: string; // YYYY-MM-DD of the currently open daily log
};

export function SoForm({ salesmen, products, openLogDate }: Props) {
  const router = useRouter();
  const returnKeyRef = useRef(0);

  // Fresh return state
  const [freshLines, setFreshLines] = useState<ReturnLine[]>([]);
  const [freshNotes, setFreshNotes] = useState("");

  // Waste return state (independent from react-hook-form)
  const [wasteLines, setWasteLines] = useState<ReturnLine[]>([]);
  const [wasteNotes, setWasteNotes] = useState("");

  const [amountPaid, setAmountPaid] = useState(0);

  // Track open state for each product combobox by field index
  const [openCombobox, setOpenCombobox] = useState<Record<number, boolean>>({});

  const form = useForm<CreateSoValues>({
    resolver: zodResolver(createSoSchema),
    defaultValues: {
      customerId: "",
      orderDate:  openLogDate ?? new Date().toISOString().split("T")[0],
      notes:      "",
      items:      [{ productId: "", quantity: 1, unitPrice: 0 }],
      amountPaid: 0,
    },
  });

  const watchDate = form.watch("orderDate");

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchItems      = form.watch("items");
  const watchSalesmanId = form.watch("customerId");

  const subtotal         = watchItems.reduce((sum, i) => sum + (i.quantity || 0) * (i.unitPrice || 0), 0);
  const wasteTotal       = wasteLines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const freshTotal       = freshLines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const selectedSalesman = salesmen.find((c) => c.id === watchSalesmanId);
  const commissionPct    = selectedSalesman?.commissionPct ?? 0;
  const netAmount        = subtotal - wasteTotal - freshTotal;
  const commissionAmount = Math.round(netAmount * commissionPct) / 100;
  const factoryAmount    = netAmount - commissionAmount;


  function handleProductChange(index: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    if (product) {
      if (product.currentStock <= 0) {
        toast.error(`"${product.name}" is out of stock`, {
          description: "This product has no available stock. Restock before adding to an order.",
        });
        return;
      }
      form.setValue(`items.${index}.productId`, productId);
      form.setValue(`items.${index}.unitPrice`, product.sellingPrice);
      if (index === fields.length - 1) {
        append({ productId: "", quantity: 1, unitPrice: 0 });
      }
    }
  }

  function addFreshLine() {
    setFreshLines((prev) => [...prev, { key: returnKeyRef.current++, productId: "", quantity: "", unitPrice: "" }]);
  }
  function removeFreshLine(key: number) {
    setFreshLines((prev) => prev.filter((l) => l.key !== key));
  }
  function updateFreshLine(key: number, patch: Partial<ReturnLine>) {
    setFreshLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function addWasteLine() {
    setWasteLines((prev) => [...prev, { key: returnKeyRef.current++, productId: "", quantity: "", unitPrice: "" }]);
  }
  function removeWasteLine(key: number) {
    setWasteLines((prev) => prev.filter((l) => l.key !== key));
  }
  function updateWasteLine(key: number, patch: Partial<ReturnLine>) {
    setWasteLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function onSubmit(values: CreateSoValues) {
    const validWaste = wasteLines.filter(
      (l) => l.productId && Number(l.quantity) > 0 && Number(l.unitPrice) >= 0
    );
    const validFresh = freshLines.filter(
      (l) => l.productId && Number(l.quantity) > 0 && Number(l.unitPrice) >= 0
    );
    try {
      await createSalesOrder({
        ...values,
        amountPaid: Math.min(amountPaid, factoryAmount),
        returnItems: validWaste.length > 0
          ? validWaste.map((l) => ({ productId: l.productId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) }))
          : undefined,
        returnNotes: wasteNotes.trim() || undefined,
        freshReturnItems: validFresh.length > 0
          ? validFresh.map((l) => ({ productId: l.productId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) }))
          : undefined,
        freshReturnNotes: freshNotes.trim() || undefined,
      });
      toast.success("Sales order created");
      router.push("/sales");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create order");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={(e) => {
        e.preventDefault();
        const filled = form.getValues("items").filter((i) => i.productId !== "");
        if (filled.length === 0) {
          form.setError("items", { type: "manual", message: "Add at least one item" });
          return;
        }
        for (const item of filled) {
          const product = products.find((p) => p.id === item.productId);
          if (product && item.quantity > product.currentStock) {
            toast.error(`Not enough stock for "${product.name}"`, {
              description: `Available: ${product.currentStock.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${product.unit.name} — ordered: ${item.quantity.toLocaleString(undefined, { maximumFractionDigits: 3 })}`,
            });
            return;
          }
        }
        form.setValue("items", filled, { shouldValidate: false });
        form.handleSubmit(onSubmit)();
      }} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="customerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Salesman *</FormLabel>
                <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select salesman">
                        {salesmen.find(c => c.id === field.value)?.name}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent searchable>
                    {salesmen.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(() => {
                  const pct = salesmen.find(c => c.id === field.value)?.commissionPct;
                  return pct !== undefined
                    ? <p className="text-xs text-muted-foreground">Commission: {pct}%</p>
                    : null;
                })()}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="orderDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sale Date *</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
                {!openLogDate && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-600 mt-1">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    No daily log is currently open. This sale won&apos;t appear in a production log until one is opened.
                  </p>
                )}
                {openLogDate && watchDate && watchDate !== openLogDate && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-600 mt-1">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Date doesn&apos;t match the open daily log ({openLogDate}). The log will be auto-adjusted, but verify this is intentional.
                  </p>
                )}
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea {...field} rows={2} placeholder="Optional order notes..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ── Order Items ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">Order Items</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ productId: "", quantity: 1, unitPrice: 0 })}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Item
            </Button>
          </div>

          {form.formState.errors.items?.message && (
            <p className="text-sm text-destructive">{form.formState.errors.items.message}</p>
          )}

          <div className="rounded-lg border divide-y">
            <div className="grid grid-cols-[2fr_90px_100px_70px_32px] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/40">
              <span>Product</span>
              <span>Qty</span>
              <span>Unit Price (Rs)</span>
              <span className="text-right">Total</span>
              <span />
            </div>

            {fields.map((field, index) => {
              const qty   = watchItems[index]?.quantity || 0;
              const price = watchItems[index]?.unitPrice || 0;
              const lineTotal = qty * price;
              const selectedProduct = products.find(
                (p) => p.id === watchItems[index]?.productId
              );

              return (
                <div key={field.id} className="grid grid-cols-[2fr_90px_100px_70px_32px] gap-2 px-3 py-2 items-start">
                  <FormField
                    control={form.control}
                    name={`items.${index}.productId`}
                    render={({ field: f }) => (
                      <FormItem className="space-y-0">
                        <Popover
                          open={!!openCombobox[index]}
                          onOpenChange={(o) => setOpenCombobox((prev) => ({ ...prev, [index]: o }))}
                        >
                          <PopoverTrigger
                            nativeButton={false}
                            render={
                              <div
                                role="combobox"
                                aria-expanded={!!openCombobox[index]}
                                className={cn(
                                  "flex h-10 w-full cursor-pointer items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm hover:bg-accent",
                                  !f.value && "text-muted-foreground"
                                )}
                              >
                                <span className="truncate">
                                  {products.find(p => p.id === f.value)?.name ?? "Select product"}
                                </span>
                                <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                              </div>
                            }
                          />
                          <PopoverContent className="w-96 p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search products..." className="h-9" />
                              <CommandList>
                                <CommandEmpty>No products found.</CommandEmpty>
                                <CommandGroup>
                                  {products.map((p) => (
                                    <CommandItem
                                      key={p.id}
                                      value={p.name}
                                      onSelect={() => {
                                        handleProductChange(index, p.id);
                                        setOpenCombobox((prev) => ({ ...prev, [index]: false }));
                                      }}
                                      className={p.currentStock <= 0 ? "opacity-60" : ""}
                                    >
                                      <Check className={cn("mr-2 h-3.5 w-3.5 shrink-0", f.value === p.id ? "opacity-100" : "opacity-0")} />
                                      <div className="flex-1 min-w-0">
                                        <span className="truncate">{p.name}</span>
                                        {p.currentStock <= 0 ? (
                                          <span className="ml-1.5 text-xs text-destructive font-medium">Out of stock</span>
                                        ) : (
                                          <span className="ml-1.5 text-xs text-muted-foreground">
                                            {p.currentStock.toLocaleString(undefined, { maximumFractionDigits: 3 })} {p.unit.name}
                                          </span>
                                        )}
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {selectedProduct && (
                          <p className="text-xs pt-0.5">
                            {selectedProduct.currentStock <= 0 ? (
                              <span className="text-destructive font-medium">Out of stock</span>
                            ) : qty > 0 && qty > selectedProduct.currentStock ? (
                              <span className="text-destructive">
                                Only {selectedProduct.currentStock.toLocaleString(undefined, { maximumFractionDigits: 3 })} {selectedProduct.unit.name} available
                              </span>
                            ) : (
                              <span className="text-muted-foreground">
                                {selectedProduct.currentStock.toLocaleString(undefined, { maximumFractionDigits: 3 })} {selectedProduct.unit.name} available
                              </span>
                            )}
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`items.${index}.quantity`}
                    render={({ field: f }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input
                            className="h-8 text-sm"
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={f.value === 0 ? "" : f.value}
                            onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`items.${index}.unitPrice`}
                    render={({ field: f }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <Input
                            className="h-8 text-sm"
                            type="number"
                            min="0"
                            step="0.01"
                            value={f.value === 0 ? "" : f.value}
                            onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="text-right text-sm font-medium pt-1.5">
                    {lineTotal.toFixed(2)}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="mt-0.5"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              );
            })}

            {/* Add row button */}
            <button
              type="button"
              onClick={() => append({ productId: "", quantity: 1, unitPrice: 0 })}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add row
            </button>

            {/* Summary footer */}
            <div className="px-4 py-3 bg-muted/30 space-y-1.5 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Total Taken</span>
                <span className="font-semibold tabular-nums">Rs {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {wasteTotal > 0.001 && (
                <div className="flex justify-between gap-4 text-orange-600">
                  <span>Waste Deducted</span>
                  <span className="tabular-nums">− Rs {wasteTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {freshTotal > 0.001 && (
                <div className="flex justify-between gap-4 text-green-600">
                  <span>Fresh Return Deducted</span>
                  <span className="tabular-nums">− Rs {freshTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {subtotal > 0 && (
                <>
                  {(wasteTotal > 0.001 || freshTotal > 0.001) && (
                    <div className="flex justify-between gap-4 text-muted-foreground">
                      <span>Net Amount</span>
                      <span className="tabular-nums">Rs {netAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-4 text-amber-600">
                    <span>Commission ({commissionPct}%)</span>
                    <span className="tabular-nums">Rs {commissionAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between gap-4 text-green-700 font-semibold border-t pt-1.5">
                    <span>Factory Amount</span>
                    <span className="tabular-nums">Rs {factoryAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Waste Return ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-orange-500" />
              <h3 className="font-medium text-sm">Waste Return</h3>
              <span className="text-xs text-muted-foreground">(optional) — expired or damaged goods not restocked</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-orange-600 border-orange-200 hover:bg-orange-50 hover:border-orange-300"
              onClick={addWasteLine}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Item
            </Button>
          </div>

          <div className="rounded-lg border border-orange-200 divide-y bg-orange-50/20">
            <div className="grid grid-cols-[2fr_90px_100px_70px_32px] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-orange-100/40">
              <span>Product</span>
              <span>Qty</span>
              <span>Unit Price (Rs)</span>
              <span className="text-right">Total</span>
              <span />
            </div>

            {wasteLines.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground/50">
                No waste items — click &quot;Add Item&quot; to record returns
              </div>
            ) : (
              wasteLines.map((line) => {
                const lineTotal = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
                return (
                  <div
                    key={line.key}
                    className="grid grid-cols-[2fr_90px_100px_70px_32px] gap-2 px-3 py-2 items-start"
                  >
                    <ProductComboboxField
                      value={line.productId}
                      options={products.map((p) => ({ id: p.id, name: p.name, meta: p.unit.name }))}
                      onSelect={(id) => {
                        const p = products.find((p) => p.id === id);
                        updateWasteLine(line.key, { productId: id, ...(p ? { unitPrice: p.sellingPrice } : {}) });
                      }}
                      placeholder="Select product…"
                      triggerHeight="h-8"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      placeholder="0"
                      value={line.quantity}
                      onChange={(e) => updateWasteLine(line.key, {
                        quantity: e.target.value === "" ? "" : parseFloat(e.target.value),
                      })}
                      className="h-8 text-sm"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={line.unitPrice}
                      onChange={(e) => updateWasteLine(line.key, {
                        unitPrice: e.target.value === "" ? "" : parseFloat(e.target.value),
                      })}
                      className="h-8 text-sm"
                    />
                    <div className="text-right text-sm font-medium pt-1.5 text-orange-600">
                      {lineTotal > 0 ? lineTotal.toFixed(2) : <span className="text-muted-foreground/30">—</span>}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="mt-0.5 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
                      onClick={() => removeWasteLine(line.key)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })
            )}

            {wasteLines.length > 0 && wasteTotal > 0.001 && (
              <div className="px-3 py-2 bg-orange-100/40 text-sm">
                <div className="grid grid-cols-[2fr_90px_100px_70px_32px] gap-2">
                  <div className="col-span-3 text-right text-orange-700 font-medium">Total Waste Deducted</div>
                  <div className="text-right font-bold text-orange-700">Rs {wasteTotal.toFixed(2)}</div>
                  <div />
                </div>
              </div>
            )}
          </div>

          {wasteLines.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Waste Notes (optional)</Label>
              <Textarea
                value={wasteNotes}
                onChange={(e) => setWasteNotes(e.target.value)}
                rows={2}
                placeholder="e.g. expired, damaged packaging..."
                className="text-sm resize-none"
              />
            </div>
          )}
        </div>

        {/* ── Fresh Return ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PackageCheck className="h-4 w-4 text-green-600" />
              <h3 className="font-medium text-sm">Fresh Return</h3>
              <span className="text-xs text-muted-foreground">(optional) — good condition goods returned to inventory</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-green-600 border-green-200 hover:bg-green-50 hover:border-green-300"
              onClick={addFreshLine}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Item
            </Button>
          </div>

          <div className="rounded-lg border border-green-200 divide-y bg-green-50/20">
            <div className="grid grid-cols-[2fr_90px_100px_70px_32px] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-green-100/40">
              <span>Product</span>
              <span>Qty</span>
              <span>Unit Price (Rs)</span>
              <span className="text-right">Total</span>
              <span />
            </div>

            {freshLines.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground/50">
                No fresh returns — click &quot;Add Item&quot; to record
              </div>
            ) : (
              freshLines.map((line) => {
                const lineTotal = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
                return (
                  <div key={line.key} className="grid grid-cols-[2fr_90px_100px_70px_32px] gap-2 px-3 py-2 items-start">
                    <ProductComboboxField
                      value={line.productId}
                      options={products.map((p) => ({ id: p.id, name: p.name, meta: p.unit.name }))}
                      onSelect={(id) => {
                        const p = products.find((p) => p.id === id);
                        updateFreshLine(line.key, { productId: id, ...(p ? { unitPrice: p.sellingPrice } : {}) });
                      }}
                      placeholder="Select product…"
                      triggerHeight="h-8"
                    />
                    <Input
                      type="number" min="0" step="0.001" placeholder="0"
                      value={line.quantity}
                      onChange={(e) => updateFreshLine(line.key, { quantity: e.target.value === "" ? "" : parseFloat(e.target.value) })}
                      className="h-8 text-sm"
                    />
                    <Input
                      type="number" min="0" step="0.01" placeholder="0.00"
                      value={line.unitPrice}
                      onChange={(e) => updateFreshLine(line.key, { unitPrice: e.target.value === "" ? "" : parseFloat(e.target.value) })}
                      className="h-8 text-sm"
                    />
                    <div className="text-right text-sm font-medium pt-1.5 text-green-600">
                      {lineTotal > 0 ? lineTotal.toFixed(2) : <span className="text-muted-foreground/30">—</span>}
                    </div>
                    <Button
                      type="button" variant="ghost" size="icon-sm"
                      className="mt-0.5 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
                      onClick={() => removeFreshLine(line.key)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })
            )}

            {freshLines.length > 0 && freshTotal > 0.001 && (
              <div className="px-3 py-2 bg-green-100/40 text-sm">
                <div className="grid grid-cols-[2fr_90px_100px_70px_32px] gap-2">
                  <div className="col-span-3 text-right text-green-700 font-medium">Total Fresh Return</div>
                  <div className="text-right font-bold text-green-700">Rs {freshTotal.toFixed(2)}</div>
                  <div />
                </div>
              </div>
            )}
          </div>

          {freshLines.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Fresh Return Notes (optional)</Label>
              <Textarea
                value={freshNotes}
                onChange={(e) => setFreshNotes(e.target.value)}
                rows={2}
                placeholder="e.g. customer rejected, wrong product..."
                className="text-sm resize-none"
              />
            </div>
          )}
        </div>

        {/* ── Payment ── */}
        {selectedSalesman && factoryAmount > 0 && (
          <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium text-sm">Payment Received</h3>
            </div>

            {selectedSalesman.outstanding !== 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current outstanding balance</span>
                <span className={selectedSalesman.outstanding > 0 ? "font-medium text-amber-600" : "font-medium text-green-600"}>
                  Rs {Math.abs(selectedSalesman.outstanding).toFixed(2)}
                  {selectedSalesman.outstanding > 0 ? " owed" : " credit"}
                </span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  Amount paid now (Rs)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountPaid === 0 ? "" : amountPaid}
                  onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
              <div className="pt-5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAmountPaid(factoryAmount)}
                >
                  Full amount
                </Button>
              </div>
            </div>

            <div className="border-t pt-3 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">This order (factory amount)</span>
                <span>Rs {factoryAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Paid now</span>
                <span className="text-green-600">− Rs {Math.min(amountPaid, factoryAmount).toFixed(2)}</span>
              </div>
              {selectedSalesman.outstanding > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Previous balance</span>
                  <span className="text-amber-600">+ Rs {selectedSalesman.outstanding.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center justify-between font-semibold border-t pt-1 mt-1">
                <span>Closing balance</span>
                {(() => {
                  const closing = selectedSalesman.outstanding + factoryAmount - Math.min(amountPaid, factoryAmount);
                  return (
                    <span className={closing > 0.005 ? "text-amber-600" : "text-green-600"}>
                      Rs {closing.toFixed(2)} {closing > 0.005 ? "owed" : "settled"}
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        <Separator />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/sales")}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Creating..." : "Create Sales Order"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
