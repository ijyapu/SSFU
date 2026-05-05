"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { adjustmentSchema, type AdjustmentFormValues } from "@/lib/validators/stock";
import { createAdjustment } from "../actions";

type Product = {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  unit: { name: string };
};

type Props = {
  products: Product[];
  isAdmin: boolean;
};

export function AdjustmentForm({ products, isAdmin }: Props) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const form = useForm<AdjustmentFormValues>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      productId: "",
      type: "ADJUSTMENT_IN",
      quantity: 0,
      notes: "",
      isAdminOverride: false,
    },
  });

  const watchType = form.watch("type");

  function handleProductChange(id: string) {
    form.setValue("productId", id);
    setSelectedProduct(products.find((p) => p.id === id) ?? null);
  }

  async function onSubmit(values: AdjustmentFormValues) {
    try {
      await createAdjustment(values);
      toast.success(
        values.type === "ADJUSTMENT_IN"
          ? `Stock increased for ${selectedProduct?.name}`
          : `Stock decreased for ${selectedProduct?.name}`
      );
      form.reset({
        productId: "",
        type: "ADJUSTMENT_IN",
        quantity: 0,
        notes: "",
        isAdminOverride: false,
      });
      setSelectedProduct(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Adjustment failed");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New Adjustment</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Product */}
            <FormField control={form.control} name="productId" render={({ field }) => (
              <FormItem>
                <FormLabel>Product</FormLabel>
                <Select value={field.value} onValueChange={(v) => v && handleProductChange(v)}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a product...">
                        {products.find(p => p.id === field.value)?.name}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent searchable>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id} label={p.name}>
                        <span className="font-mono text-xs mr-2 text-muted-foreground">{p.sku}</span>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Show current stock when product is selected */}
            {selectedProduct && (
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm flex items-center justify-between">
                <span className="text-muted-foreground">Current stock</span>
                <span className="font-medium">
                  {selectedProduct.currentStock.toLocaleString()} {selectedProduct.unit.name}
                </span>
              </div>
            )}

            {/* Type */}
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Adjustment Type</FormLabel>
                <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="ADJUSTMENT_IN" label="Stock Increase">
                      <Badge variant="secondary" className="mr-2 bg-emerald-100 text-emerald-700">IN</Badge>
                      Stock Increase
                    </SelectItem>
                    <SelectItem value="ADJUSTMENT_OUT" label="Stock Decrease">
                      <Badge variant="secondary" className="mr-2 bg-red-100 text-red-700">OUT</Badge>
                      Stock Decrease
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Quantity */}
            <FormField control={form.control} name="quantity" render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Quantity
                  {selectedProduct && (
                    <span className="ml-1 text-muted-foreground font-normal">
                      ({selectedProduct.unit.name})
                    </span>
                  )}
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.001"
                    min="0.001"
                    placeholder="0"
                    value={field.value || ""}
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Notes — required */}
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Reason / Notes
                  <span className="ml-1 text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder={
                      watchType === "ADJUSTMENT_IN"
                        ? "e.g. Received unplanned ingredient delivery, supplier invoice pending..."
                        : "e.g. Damaged goods disposed, flour expired and discarded..."
                    }
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Admin override */}
            {isAdmin && watchType === "ADJUSTMENT_OUT" && (
              <FormField control={form.control} name="isAdminOverride" render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="h-4 w-4"
                    />
                  </FormControl>
                  <FormLabel className="mt-0! text-amber-600">
                    Allow negative stock (admin override)
                  </FormLabel>
                </FormItem>
              )} />
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
              variant={watchType === "ADJUSTMENT_OUT" ? "destructive" : "default"}
            >
              {form.formState.isSubmitting
                ? "Applying..."
                : watchType === "ADJUSTMENT_IN"
                ? "Add Stock"
                : "Remove Stock"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
