"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2, ChevronsUpDown, Check, Info } from "lucide-react";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { updateSoSchema, type UpdateSoValues } from "@/lib/validators/sales";
import { updateSalesOrder } from "../../../actions";

type SoData = {
  id: string;
  orderNumber: string;
  status: string;
  salesmanName: string;
  commissionPct: number;
  orderDate: string;
  notes: string;
  amountPaid: number;
  existingReturnTotal: number;
  items: { productId: string; quantity: number; unitPrice: number }[];
};

type Product = {
  id: string;
  name: string;
  sku: string;
  sellingPrice: number;
  currentStock: number;
  unit: { name: string };
};

export function SoEditForm({ so, products }: { so: SoData; products: Product[] }) {
  const router = useRouter();
  const [openCombobox, setOpenCombobox] = useState<Record<number, boolean>>({});
  const savedScrollY = useRef(0);

  const form = useForm<UpdateSoValues>({
    resolver: zodResolver(updateSoSchema),
    defaultValues: {
      orderDate: so.orderDate,
      notes:     so.notes,
      items:   so.items,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchItems = form.watch("items");

  const subtotal = watchItems.reduce((sum, i) => sum + (i.quantity || 0) * (i.unitPrice || 0), 0);
  const netAmount = subtotal - so.existingReturnTotal;
  const commissionAmount = Math.round(netAmount * so.commissionPct) / 100;
  const factoryAmount = netAmount - commissionAmount;
  const outstanding = factoryAmount - so.amountPaid;
  const newStatus = so.status === "DRAFT"                  ? "Draft"
                  : so.amountPaid >= factoryAmount - 0.001 ? "Paid"
                  : so.amountPaid > 0                      ? "Partially Paid"
                  :                                          "Confirmed";

  // Augment each product with its current order quantity so stock hints are correct
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  function handleProductChange(index: number, productId: string) {
    const product = productMap.get(productId);
    if (product) {
      const oldQty  = so.items.find((i) => i.productId === productId)?.quantity ?? 0;
      const available = product.currentStock + oldQty;
      if (available <= 0) {
        toast.error(`"${product.name}" is out of stock`, {
          description: "This product has no available stock. Restock before adding to this order.",
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

  async function onSubmit(values: UpdateSoValues) {
    try {
      await updateSalesOrder(so.id, values);
      toast.success("Sales order updated");
      router.push(`/sales/${so.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update order");
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
          const product = productMap.get(item.productId);
          if (product) {
            const oldQty    = so.items.find((i) => i.productId === item.productId)?.quantity ?? 0;
            const available = product.currentStock + oldQty;
            if (item.quantity > available) {
              toast.error(`Not enough stock for "${product.name}"`, {
                description: `Available: ${available.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${product.unit.name} — ordered: ${item.quantity.toLocaleString(undefined, { maximumFractionDigits: 3 })}`,
              });
              return;
            }
          }
        }
        form.setValue("items", filled, { shouldValidate: false });
        form.handleSubmit(onSubmit)();
      }} className="space-y-6">

        {/* Salesman (read-only) + due date + notes */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Salesman</p>
            <div className="flex h-10 items-center rounded-lg border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
              {so.salesmanName}
            </div>
          </div>
          <FormField
            control={form.control}
            name="orderDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sale Date *</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
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

        {/* Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">Order Items</h3>
            <Button
              type="button" variant="outline" size="sm"
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
              const qty        = watchItems[index]?.quantity || 0;
              const price      = watchItems[index]?.unitPrice || 0;
              const lineTotal  = qty * price;
              const product    = productMap.get(watchItems[index]?.productId ?? "");
              // Add back the old quantity for this product since it will be restored on save
              const oldQty     = so.items.find((i) => i.productId === watchItems[index]?.productId)?.quantity ?? 0;
              const available  = (product?.currentStock ?? 0) + oldQty;

              return (
                <div key={field.id} className="grid grid-cols-[2fr_90px_100px_70px_32px] gap-2 px-3 py-2 items-start">
                  <FormField
                    control={form.control}
                    name={`items.${index}.productId`}
                    render={({ field: f }) => (
                      <FormItem className="space-y-0">
                        <Popover
                          open={!!openCombobox[index]}
                          onOpenChange={(o) => {
                            if (o) savedScrollY.current = window.scrollY;
                            setOpenCombobox((prev) => ({ ...prev, [index]: o }));
                            if (o) requestAnimationFrame(() =>
                              requestAnimationFrame(() =>
                                window.scrollTo({ top: savedScrollY.current, behavior: "instant" as ScrollBehavior })
                              )
                            );
                          }}
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
                                  {productMap.get(f.value)?.name ?? "Select product"}
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
                        {product && (
                          <p className="text-xs pt-0.5">
                            {available <= 0 ? (
                              <span className="text-destructive font-medium">Out of stock</span>
                            ) : qty > 0 && qty > available ? (
                              <span className="text-destructive">
                                Only {available.toLocaleString(undefined, { maximumFractionDigits: 3 })} {product.unit.name} available
                              </span>
                            ) : (
                              <span className="text-muted-foreground">
                                {available.toLocaleString(undefined, { maximumFractionDigits: 3 })} {product.unit.name} available
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
                            className="h-8 text-sm" type="number" min="0.001" step="0.001"
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
                            className="h-8 text-sm" type="number" min="0" step="0.01"
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
                    type="button" variant="ghost" size="icon-sm" className="mt-0.5"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              );
            })}

            {/* Add row */}
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
              {so.existingReturnTotal > 0.001 && (
                <div className="flex justify-between gap-4 text-orange-600">
                  <span>Returns Deducted</span>
                  <span className="tabular-nums">− Rs {so.existingReturnTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {subtotal > 0 && (
                <>
                  {so.existingReturnTotal > 0.001 && (
                    <div className="flex justify-between gap-4 text-muted-foreground">
                      <span>Net Amount</span>
                      <span className="tabular-nums">Rs {netAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-4 text-amber-600">
                    <span>Commission ({so.commissionPct}%)</span>
                    <span className="tabular-nums">Rs {commissionAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between gap-4 text-green-700 font-semibold border-t pt-1.5">
                    <span>Factory Amount</span>
                    <span className="tabular-nums">Rs {factoryAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between gap-4 text-green-600">
                    <span>Already Collected</span>
                    <span className="tabular-nums">Rs {so.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {outstanding > 0.001 && (
                    <div className="flex justify-between gap-4 text-destructive font-medium">
                      <span>Outstanding after save</span>
                      <span className="tabular-nums">Rs {outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-4 text-muted-foreground text-xs pt-0.5">
                    <span className="flex items-center gap-1"><Info className="h-3 w-3" />Status after save</span>
                    <span>{newStatus}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push(`/sales/${so.id}`)}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
