import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { employeeSchema, type EmployeeFormValues } from "@/lib/validators/employee";
import { createEmployee, updateEmployee } from "../actions";

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  citizenshipId: string | null;
  address: string | null;
  departmentId: string;
  position: string;
  basicSalary: number;
  openingBalance: number;
  startDate: string;
  endDate: string | null;
};

type Department = { id: string; name: string };

interface Props {
  open: boolean;
  onClose: () => void;
  employee: Employee | null;
  departments: Department[];
}

export function EmployeeForm({ open, onClose, employee, departments }: Props) {
  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      firstName: "", lastName: "", email: "", phone: "",
      citizenshipId: "", address: "",
      departmentId: "", position: "", basicSalary: 0,
      openingBalance: 0,
      startDate: "", endDate: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        employee
          ? {
              firstName:      employee.firstName,
              lastName:       employee.lastName,
              email:          employee.email ?? "",
              phone:          employee.phone,
              citizenshipId:  employee.citizenshipId ?? "",
              address:        employee.address ?? "",
              departmentId:   employee.departmentId,
              position:       employee.position,
              basicSalary:    employee.basicSalary,
              openingBalance: employee.openingBalance,
              startDate:      employee.startDate.slice(0, 10),
              endDate:        employee.endDate?.slice(0, 10) ?? "",
            }
          : {
              firstName: "", lastName: "", email: "", phone: "",
              citizenshipId: "", address: "",
              departmentId: "", position: "", basicSalary: 0,
              openingBalance: 0,
              startDate: format(new Date(), "yyyy-MM-dd"), endDate: "",
            }
      );
    }
  }, [open, employee, form]);

  async function onSubmit(values: EmployeeFormValues) {
    try {
      if (employee) {
        await updateEmployee(employee.id, values);
        toast.success("Employee updated");
      } else {
        await createEmployee(values);
        toast.success("Employee added");
      }
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save employee");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{employee ? "Edit Employee" : "New Employee"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* Row 1: Name */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl><Input {...field} placeholder="Bikash" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl><Input {...field} placeholder="Shrestha" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 2: Phone + Citizenship ID */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone *</FormLabel>
                    <FormControl><Input {...field} placeholder="+977" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="citizenshipId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Citizenship ID</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. 12-34-56-78901" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 3: Email + Address */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input {...field} type="email" placeholder="employee@ssfu.work" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. Kathmandu, Ward 5" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 4: Department + Position */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="departmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department *</FormLabel>
                    <Select value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select department">
                            {departments.find(d => d.id === field.value)?.name}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent searchable>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id} label={d.name}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position *</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. Baker, Driver" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 5: Salary + Opening Balance */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="basicSalary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Basic Salary (Rs) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={field.value === 0 ? "" : field.value}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
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
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={field.value === 0 ? "" : field.value}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">
                      Unpaid salary owed before joining this system
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Row 6: Dates */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : employee ? "Save Changes" : "Add Employee"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
