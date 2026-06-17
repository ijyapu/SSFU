
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supplierSchema, type SupplierFormValues } from "@/lib/validators/purchase";
import { createSupplier, updateSupplier } from "../../purchases/actions";

type Supplier = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  pan: string | null;
  openingBalance: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  supplier: Supplier | null;
};

export function SupplierForm({ open, onClose, supplier }: Props) {
  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "", contactName: "", email: "", phone: "", address: "", pan: "", openingBalance: 0,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        supplier
          ? {
              name:           supplier.name,
              contactName:    supplier.contactName ?? "",
              email:          supplier.email ?? "",
              phone:          supplier.phone ?? "",
              address:        supplier.address ?? "",
              pan:            supplier.pan ?? "",
              openingBalance: supplier.openingBalance,
            }
          : { name: "", contactName: "", email: "", phone: "", address: "", pan: "", openingBalance: 0 }
      );
    }
  }, [open, supplier, form]);

  async function onSubmit(values: SupplierFormValues) {
    try {
      if (supplier) {
        await updateSupplier(supplier.id, values);
        toast.success("Supplier updated");
      } else {
        await createSupplier(values);
        toast.success("Supplier added");
      }
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save supplier");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{supplier ? "Edit Vendor" : "New Vendor"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor Name *</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. SSFU Pvt. Ltd." /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Person</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. Bikash Shrestha" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input {...field} type="email" placeholder="Vendor@example.com" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input {...field} placeholder="98XXXXXXXX" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Tole, Municipality/City, District, Province" rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="pan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PAN Number</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. 123456789" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="openingBalance"
                render={({ field }) => (
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
                )}
              />
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Opening balance = amount owed to this vendor before using this system.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : supplier ? "Save Changes" : "Add Supplier"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
