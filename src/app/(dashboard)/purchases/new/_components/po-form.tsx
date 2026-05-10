"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2, UserPlus, PackagePlus, ChevronDown, AlertTriangle } from "lucide-react";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { PhotoUpload } from "@/components/ui/photo-upload";
import {
  createPurchaseSchema, newSupplierSchema, newProductSchema,
  type CreatePurchaseValues, type NewSupplierValues, type NewProductValues,
} from "@/lib/validators/purchase";
import { createPurchase, updatePurchase, createSupplierInline, createProductInline } from "../../actions";
import { getNextSkuPreview } from "@/app/(dashboard)/inventory/actions";

type Supplier  = { id: string; name: string; contactName: string | null; phone: string | null };
type Product   = { id: string; name: string; sku: string; costPrice: number; unit: string };
type Category  = { id: string; name: string };
type Unit      = { id: string; name: string };

type Props = {
  suppliers:     Supplier[];
  products:      Product[];
  categories:    Category[];
  units:         Unit[];
  purchaseId?:   string;
  initialValues?: Partial<CreatePurchaseValues>;
  openLogDate?:  string; // YYYY-MM-DD of the currently open daily log
  detailHref?:   string;
};

// ── Product Combobox ─────────────────────────────────────────────────────────
function ProductCombobox({
  value,
  productId,
  products,
  onChange,
  onProductSelect,
}: {
  value: string;
  productId?: string;
  products: Product[];
  onChange: (name: string) => void;
  onProductSelect: (product: Product) => void;
}) {
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState(value);
  const wrapRef             = useRef<HTMLDivElement>(null);

  // Keep local query in sync if value is changed externally (e.g. reset)
  useEffect(() => { setQuery(value); }, [value]);

  const matches = query.trim().length > 0
    ? products.filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.sku.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10)
    : products.slice(0, 10);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    onChange(v);
    setOpen(true);
  }

  function handleSelect(p: Product) {
    setQuery(p.name);
    onChange(p.name);
    onProductSelect(p);
    setOpen(false);
  }

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const linkedProduct = productId ? products.find((p) => p.id === productId) : undefined;

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex gap-1 items-center">
        <div className="relative flex-1">
          <Input
            className="h-8 text-sm pr-6"
            placeholder="Type or select product…"
            value={query}
            onChange={handleInput}
            onFocus={() => setOpen(true)}
          />
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setOpen((o) => !o)}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {linkedProduct && (
        <p className="text-xs text-muted-foreground pt-0.5">{linkedProduct.unit}</p>
      )}
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full min-w-56 rounded-md border bg-popover shadow-md overflow-hidden">
          {matches.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No product found — use the{" "}
              <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
                <PackagePlus className="h-3.5 w-3.5" /> button
              </span>{" "}
              next to this field to add it to inventory first.
            </div>
          ) : (
            <ul className="max-h-52 overflow-y-auto">
              {matches.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center justify-between gap-2"
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(p); }}
                  >
                    <span>{p.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{p.sku}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Form ────────────────────────────────────────────────────────────────
export function PurchaseForm({ suppliers: initSuppliers, products: initProducts, categories, units, purchaseId, initialValues, openLogDate, detailHref }: Props) {
  const router = useRouter();
  const [suppliers, setSuppliers]       = useState(initSuppliers);
  const [products,  setProducts]        = useState(initProducts);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [productOpen,  setProductOpen]  = useState(false);
  const [invoiceUrl, setInvoiceUrl]     = useState<string | null>(initialValues?.invoiceUrl ?? "");

  const form = useForm<CreatePurchaseValues>({
    resolver: zodResolver(createPurchaseSchema),
    defaultValues: {
      invoiceNo:  initialValues?.invoiceNo  ?? "",
      supplierId: initialValues?.supplierId ?? "",
      date:       initialValues?.date       ?? openLogDate ?? new Date().toISOString().split("T")[0],
      notes:      initialValues?.notes      ?? "",
      invoiceUrl: initialValues?.invoiceUrl ?? "",
      items:      initialValues?.items      ?? [{ productId: "", productName: "", categoryId: "", unitId: "", description: "", quantity: 1, unitPrice: 0, vatPct: 0, excisePct: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  // eslint-disable-next-line react-hooks/incompatible-library
  const watchItems = form.watch("items");
  const watchDate  = form.watch("date");

  const computedItems = watchItems.map((item) => {
    const gross       = (item.quantity || 0) * (item.unitPrice || 0);
    const vat         = gross * ((item.vatPct || 0) / 100);
    const excise      = gross * ((item.excisePct || 0) / 100);
    return { gross, vat, excise, total: gross + vat + excise };
  });
  const subtotal    = computedItems.reduce((s, i) => s + i.gross, 0);
  const vatTotal    = computedItems.reduce((s, i) => s + i.vat, 0);
  const exciseTotal = computedItems.reduce((s, i) => s + i.excise, 0);
  const totalCost   = subtotal + vatTotal + exciseTotal;

  function handleProductSelect(index: number, product: Product) {
    form.setValue(`items.${index}.productId`,   product.id);
    form.setValue(`items.${index}.productName`, product.name);
    form.setValue(`items.${index}.unitPrice`,   product.costPrice);
    form.setValue(`items.${index}.categoryId`,  "");
    form.setValue(`items.${index}.unitId`,      "");
  }

  async function onSubmit(values: CreatePurchaseValues) {
    try {
      const payload = { ...values, invoiceUrl: invoiceUrl || undefined };
      if (purchaseId) {
        await updatePurchase(purchaseId, payload);
        toast.success(`Purchase ${values.invoiceNo} updated`);
      } else {
        await createPurchase(payload);
        toast.success(`Purchase ${values.invoiceNo} logged and inventory updated`);
      }
      router.push(detailHref ?? "/purchases");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : purchaseId ? "Failed to update purchase" : "Failed to create purchase");
    }
  }

  // ── Inline supplier form ────────────────────────────────────────────────────
  const supplierForm = useForm<NewSupplierValues>({
    resolver: zodResolver(newSupplierSchema),
    defaultValues: { name: "", contactName: "", email: "", phone: "", address: "", pan: "", openingBalance: 0 },
  });

  async function handleCreateSupplier(values: NewSupplierValues) {
    try {
      const created = await createSupplierInline(values);
      setSuppliers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      form.setValue("supplierId", created.id);
      supplierForm.reset();
      setSupplierOpen(false);
      toast.success(`Vendor "${created.name}" added`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add vendor");
    }
  }

  // ── Inline product form ─────────────────────────────────────────────────────
  const skuTouched = useRef(false);
  const productForm = useForm<NewProductValues>({
    resolver: zodResolver(newProductSchema),
    defaultValues: {
      name: "", sku: "", categoryId: "", unitId: "",
      costPrice: 0, sellingPrice: 0, reorderLevel: 0, description: "",
    },
  });
  const watchedCategoryId = productForm.watch("categoryId");

  // Auto-generate SKU when category changes (only for new products, only if user hasn't typed one)
  useEffect(() => {
    if (skuTouched.current || !watchedCategoryId) return;
    const cat = categories.find((c) => c.id === watchedCategoryId);
    if (!cat) return;
    getNextSkuPreview(cat.name).then((sku) => {
      productForm.setValue("sku", sku, { shouldValidate: false });
    }).catch(() => {});
  }, [watchedCategoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreateProduct(values: NewProductValues) {
    try {
      const created = await createProductInline(values);
      setProducts((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      productForm.reset({ name: "", sku: "", categoryId: "", unitId: "", costPrice: 0, sellingPrice: 0, reorderLevel: 0, description: "" });
      skuTouched.current = false;
      setProductOpen(false);
      toast.success(`Product "${created.name}" added`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add product");
    }
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

          {/* ── Invoice Details ── */}
          <div className="rounded-lg border p-4 space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Invoice Details</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Supplier */}
              <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem className="col-span-full">
                    <FormLabel>Vendor *</FormLabel>
                    <div className="flex gap-1.5">
                      <div className="flex-1">
                        <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select vendor">
                                {suppliers.find(s => s.id === field.value)?.name}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="min-w-72 max-h-64" searchable>
                            {suppliers.map((s) => (
                              <SelectItem key={s.id} value={s.id} label={s.name}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button type="button" variant="outline" size="icon" onClick={() => setSupplierOpen(true)} title="Add vendor">
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Invoice No */}
              <FormField
                control={form.control}
                name="invoiceNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice Number *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. INV-2025-001" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Date */}
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                    {!purchaseId && !openLogDate && (
                      <p className="flex items-center gap-1.5 text-xs text-amber-600 mt-1">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        No daily log is currently open. This purchase won&apos;t appear in a production log until one is opened.
                      </p>
                    )}
                    {!purchaseId && openLogDate && watchDate && watchDate !== openLogDate && (
                      <p className="flex items-center gap-1.5 text-xs text-amber-600 mt-1">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        Date doesn&apos;t match the open daily log ({openLogDate}). The log will be auto-adjusted, but verify this is intentional.
                      </p>
                    )}
                  </FormItem>
                )}
              />
            </div>

          </div>

          {/* ── Line Items ── */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Items</h3>
              <Button
                type="button" variant="outline" size="sm"
                onClick={() => append({ productId: "", productName: "", categoryId: "", unitId: "", description: "", quantity: 1, unitPrice: 0, vatPct: 0, excisePct: 0 })}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Item
              </Button>
            </div>

            {/* Desktop header */}
            <div className="hidden lg:grid lg:grid-cols-[2fr_1.5fr_70px_110px_90px_90px_90px_90px_32px] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/40 rounded-md">
              <span>Product</span>
              <span>Description</span>
              <span>Qty</span>
              <span>Unit Price (Rs)</span>
              <span>Gross</span>
              <span>VAT 13%</span>
              <span>Excise 5%</span>
              <span className="text-right">Total</span>
              <span />
            </div>

            <div className="divide-y rounded-md border">
              {fields.map((field, index) => {
                const { gross, total } = computedItems[index] ?? { gross: 0, total: 0 };
                const item = watchItems[index];

                const isNewProduct = !item?.productId && !!item?.productName;

                return (
                  <div key={field.id} className="p-3 space-y-3 lg:space-y-0 lg:grid lg:grid-cols-[2fr_1.5fr_70px_110px_90px_90px_90px_90px_32px] lg:gap-2 lg:items-start">

                    {/* Product combobox + optional category/unit for new products */}
                    <FormField
                      control={form.control}
                      name={`items.${index}.productName`}
                      render={({ field: f }) => (
                        <FormItem className="space-y-0">
                          <FormLabel className="lg:hidden text-xs">Product *</FormLabel>
                          <div className="flex gap-1">
                            <div className="flex-1">
                              <ProductCombobox
                                value={f.value}
                                productId={item?.productId}
                                products={products}
                                onChange={(name) => {
                                  f.onChange(name);
                                  // Clear linked product if user types manually
                                  const match = products.find((p) => p.name === name);
                                  if (!match) form.setValue(`items.${index}.productId`, "");
                                }}
                                onProductSelect={(p) => handleProductSelect(index, p)}
                              />
                            </div>
                            <Button
                              type="button" variant="ghost" size="icon-sm"
                              onClick={() => setProductOpen(true)}
                              title="Add new product to inventory"
                              className="shrink-0 mt-0.5"
                            >
                              <PackagePlus className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                          {/* Category + Unit only for new (free-text) products */}
                          {isNewProduct && (
                            <div className="flex gap-1.5 mt-1.5">
                              <FormField
                                control={form.control}
                                name={`items.${index}.categoryId`}
                                render={({ field: cf }) => (
                                  <Select value={cf.value ?? ""} onValueChange={(v) => cf.onChange(v)}>
                                    <SelectTrigger className="h-7 text-xs flex-1">
                                      <SelectValue placeholder="Category">
                                        {categories.find(c => c.id === cf.value)?.name}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent className="min-w-40" searchable>
                                      {categories.map((c) => (
                                        <SelectItem key={c.id} value={c.id} label={c.name}>{c.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`items.${index}.unitId`}
                                render={({ field: uf }) => (
                                  <Select value={uf.value ?? ""} onValueChange={(v) => uf.onChange(v)}>
                                    <SelectTrigger className="h-7 text-xs w-24">
                                      <SelectValue placeholder="Unit">
                                        {units.find(u => u.id === uf.value)?.name}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent className="min-w-24" searchable>
                                      {units.map((u) => (
                                        <SelectItem key={u.id} value={u.id} label={u.name}>{u.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                            </div>
                          )}
                          {/* Inventory sync status */}
                          {item?.productId ? (
                            <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                              Inventory will update
                            </p>
                          ) : isNewProduct && item?.categoryId && item?.unitId ? (
                            <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                              Will create product &amp; update inventory
                            </p>
                          ) : isNewProduct ? (
                            <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                              Select category &amp; unit to sync inventory
                            </p>
                          ) : null}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Description */}
                    <FormField
                      control={form.control}
                      name={`items.${index}.description`}
                      render={({ field: f }) => (
                        <FormItem className="space-y-0">
                          <FormLabel className="lg:hidden text-xs">Description</FormLabel>
                          <FormControl>
                            <Input className="h-8 text-sm" placeholder="Optional" {...f} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {/* Qty */}
                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field: f }) => (
                        <FormItem className="space-y-0">
                          <FormLabel className="lg:hidden text-xs">Qty *</FormLabel>
                          <FormControl>
                            <Input
                              className="h-8 text-sm" type="number" min="0.001" step="0.001"
                              value={f.value === 0 ? "" : f.value}
                              onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Unit Price */}
                    <FormField
                      control={form.control}
                      name={`items.${index}.unitPrice`}
                      render={({ field: f }) => (
                        <FormItem className="space-y-0">
                          <FormLabel className="lg:hidden text-xs">Unit Price (Rs) *</FormLabel>
                          <FormControl>
                            <Input
                              className="h-8 text-sm" type="number" min="0" step="0.01"
                              value={f.value === 0 ? "" : f.value}
                              onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Gross (read-only) */}
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground lg:hidden">Gross</span>
                      <div className="h-8 flex items-center text-sm font-medium bg-muted/30 rounded-md px-2">
                        {gross.toFixed(2)}
                      </div>
                    </div>

                    {/* VAT 13% toggle */}
                    <FormField
                      control={form.control}
                      name={`items.${index}.vatPct`}
                      render={({ field: f }) => {
                        const { vat } = computedItems[index] ?? { vat: 0 };
                        return (
                          <FormItem className="space-y-0">
                            <FormLabel className="lg:hidden text-xs">VAT 13%</FormLabel>
                            <button
                              type="button"
                              title="Toggle VAT 13%"
                              onClick={() => f.onChange(f.value === 0 ? 13 : 0)}
                              className={`h-8 w-full rounded-md border px-2 text-xs font-medium transition-colors ${
                                f.value > 0
                                  ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300"
                                  : "bg-muted/30 text-muted-foreground border-input hover:bg-muted"
                              }`}
                            >
                              {f.value > 0 ? `+${vat.toFixed(2)}` : "—"}
                            </button>
                          </FormItem>
                        );
                      }}
                    />

                    {/* Excise 5% toggle */}
                    <FormField
                      control={form.control}
                      name={`items.${index}.excisePct`}
                      render={({ field: f }) => {
                        const { excise } = computedItems[index] ?? { excise: 0 };
                        return (
                          <FormItem className="space-y-0">
                            <FormLabel className="lg:hidden text-xs">Excise 5%</FormLabel>
                            <button
                              type="button"
                              title="Toggle Excise Duty 5%"
                              onClick={() => f.onChange(f.value === 0 ? 5 : 0)}
                              className={`h-8 w-full rounded-md border px-2 text-xs font-medium transition-colors ${
                                f.value > 0
                                  ? "bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300"
                                  : "bg-muted/30 text-muted-foreground border-input hover:bg-muted"
                              }`}
                            >
                              {f.value > 0 ? `+${excise.toFixed(2)}` : "—"}
                            </button>
                          </FormItem>
                        );
                      }}
                    />

                    {/* Line Total (read-only) */}
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground lg:hidden">Total</span>
                      <div className="h-8 flex items-center justify-end text-sm font-semibold bg-muted/30 rounded-md px-2">
                        {total.toFixed(2)}
                      </div>
                    </div>

                    {/* Remove */}
                    <Button
                      type="button" variant="ghost" size="icon-sm"
                      className="hidden lg:flex mt-0.5"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                    <Button
                      type="button" variant="outline" size="sm"
                      className="w-full lg:hidden text-destructive hover:text-destructive"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove Item
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="rounded-md bg-muted/30 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>Rs {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {vatTotal > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>VAT (13%)</span>
                  <span>Rs {vatTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {exciseTotal > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Excise Duty (5%)</span>
                  <span>Rs {exciseTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-base border-t pt-1.5 mt-1.5">
                <span>Total Cost</span>
                <span>Rs {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* ── Notes + Upload ── */}
          <div className="rounded-lg border p-4 space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Attachments & Notes</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} placeholder="Any additional notes..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Invoice Photo / Attachment</label>
                <PhotoUpload value={invoiceUrl} onChange={setInvoiceUrl} label="Upload invoice" />
              </div>
            </div>
          </div>

          {/* ── Submit ── */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.push(detailHref ?? "/purchases")}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : purchaseId ? "Save Changes" : "Log Purchase & Update Inventory"}
            </Button>
          </div>
        </form>
      </Form>

      {/* ── New Supplier Dialog ── */}
      <Dialog open={supplierOpen} onOpenChange={(v) => !v && setSupplierOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Vendor</DialogTitle></DialogHeader>
          <Form {...supplierForm}>
            <form onSubmit={supplierForm.handleSubmit(handleCreateSupplier)} className="space-y-4">
              <FormField control={supplierForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor Name *</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. SSFI Pvt. Ltd." /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={supplierForm.control} name="contactName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Person</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. Bikash Shrestha" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={supplierForm.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input {...field} type="email" placeholder="vendor@example.com" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={supplierForm.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input {...field} placeholder="98XXXXXXXX" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={supplierForm.control} name="address" render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Tole, Municipality/City, District, Province" rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={supplierForm.control} name="pan" render={({ field }) => (
                  <FormItem>
                    <FormLabel>PAN Number</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. 123456789" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={supplierForm.control} name="openingBalance" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opening Balance (Rs)</FormLabel>
                    <FormControl>
                      <Input
                        type="number" min="0" step="0.01"
                        value={field.value === 0 ? "" : field.value}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Opening balance = amount owed to this vendor before using this system.
              </p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSupplierOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={supplierForm.formState.isSubmitting}>
                  {supplierForm.formState.isSubmitting ? "Adding..." : "Add Vendor"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── New Product Dialog ── */}
      <Dialog open={productOpen} onOpenChange={(v) => {
        if (!v) { setProductOpen(false); skuTouched.current = false; productForm.reset({ name: "", sku: "", categoryId: "", unitId: "", costPrice: 0, sellingPrice: 0, reorderLevel: 0, description: "" }); }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Product</DialogTitle></DialogHeader>
          <Form {...productForm}>
            <form onSubmit={productForm.handleSubmit(handleCreateProduct)} className="space-y-4">

              {/* Product Name */}
              <FormField control={productForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. White Sandwich Bread" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Category + SKU */}
              <div className="grid grid-cols-2 gap-3">
                <FormField control={productForm.control} name="categoryId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select category">
                            {categories.find(c => c.id === field.value)?.name}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent searchable>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id} label={c.name}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={productForm.control} name="sku" render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      SKU
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">(auto-generated)</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Select a category first"
                        onChange={(e) => { skuTouched.current = true; field.onChange(e); }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Unit + Cost Price */}
              <div className="grid grid-cols-2 gap-3">
                <FormField control={productForm.control} name="unitId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select unit">
                            {units.find(u => u.id === field.value)?.name}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent searchable>
                        {units.map((u) => (
                          <SelectItem key={u.id} value={u.id} label={u.name}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={productForm.control} name="costPrice" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost Price (Rs)</FormLabel>
                    <FormControl>
                      <Input
                        type="number" step="0.01" min="0" placeholder="0.00"
                        value={field.value === 0 ? "" : field.value}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Selling Price + Reorder Level */}
              <div className="grid grid-cols-2 gap-3">
                <FormField control={productForm.control} name="sellingPrice" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selling Price (Rs)</FormLabel>
                    <FormControl>
                      <Input
                        type="number" step="0.01" min="0" placeholder="0.00"
                        value={field.value === 0 ? "" : field.value}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={productForm.control} name="reorderLevel" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reorder Level</FormLabel>
                    <FormControl>
                      <Input
                        type="number" step="0.001" min="0" placeholder="0"
                        value={field.value === 0 ? "" : field.value}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Description */}
              <FormField control={productForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Description
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Short product description..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setProductOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={productForm.formState.isSubmitting}>
                  {productForm.formState.isSubmitting ? "Creating..." : "Create Product"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
