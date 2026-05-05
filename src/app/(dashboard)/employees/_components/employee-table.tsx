"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { DateDisplay } from "@/components/ui/date-display";
import Link from "next/link";
import { Pencil, Trash2, Plus, Building2, UserX } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SortButton } from "@/components/ui/sort-icon";
import { useSortable, compareValues } from "@/hooks/use-sortable";
import { EmployeeForm } from "./employee-form";
import { DepartmentDialog } from "./department-dialog";
import { deleteEmployee } from "../actions";

type Department = { id: string; name: string; _count: { employees: number } };

type Employee = {
  id: string;
  employeeNo: string;
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
  department: { name: string };
};

type Props = {
  employees: Employee[];
  departments: Department[];
};

export function EmployeeTable({ employees, departments }: Props) {
  const [search, setSearch]             = useState("");
  const [deptFilter, setDeptFilter]     = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [formOpen, setFormOpen]         = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [deptOpen, setDeptOpen]         = useState(false);
  const { sortKey, sortDir, toggle }    = useSortable("firstName");

  const now = new Date();

  const filtered = employees.filter((e) => {
    const fullName = `${e.firstName} ${e.lastName}`.toLowerCase();
    const matchSearch =
      fullName.includes(search.toLowerCase()) ||
      e.employeeNo.toLowerCase().includes(search.toLowerCase()) ||
      e.position.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === "all" || e.departmentId === deptFilter;
    const isActive = !e.endDate || new Date(e.endDate) > now;
    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && isActive) ||
      (statusFilter === "inactive" && !isActive);
    return matchSearch && matchDept && matchStatus;
  });

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const vals: Record<string, string | number> = {
        firstName:   `${a.firstName} ${a.lastName}`,
        department:  a.department.name,
        position:    a.position,
        basicSalary: a.basicSalary,
        startDate:   a.startDate,
      };
      const bVals: Record<string, string | number> = {
        firstName:   `${b.firstName} ${b.lastName}`,
        department:  b.department.name,
        position:    b.position,
        basicSalary: b.basicSalary,
        startDate:   b.startDate,
      };
      return compareValues(vals[sortKey], bVals[sortKey], sortDir);
    });
  }, [filtered, sortKey, sortDir]);

  async function handleDelete(id: string, name: string) {
    try {
      await deleteEmployee(id);
      toast.success(`"${name}" removed`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete employee");
    }
  }

  const sp = { sortKey, sortDir, toggle };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="Search by name, ID, or position..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Select value={deptFilter} onValueChange={(v) => setDeptFilter(v ?? "all")}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All departments">
                {deptFilter === "all"
                  ? "All departments"
                  : departments.find((d) => d.id === deptFilter)?.name ?? "All departments"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" label="All departments">All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id} label={d.name}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "active")}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDeptOpen(true)}>
            <Building2 className="h-4 w-4" />
            Departments
          </Button>
          <Button onClick={() => { setEditEmployee(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" />
            New Employee
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><SortButton col="firstName"   label="Employee"   {...sp} /></TableHead>
              <TableHead><SortButton col="department"  label="Department" {...sp} /></TableHead>
              <TableHead><SortButton col="position"    label="Position"   {...sp} /></TableHead>
              <TableHead className="text-right"><SortButton col="basicSalary" label="Salary (Rs)" {...sp} className="justify-end" /></TableHead>
              <TableHead><SortButton col="startDate"   label="Start Date" {...sp} /></TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {search || deptFilter !== "all" || statusFilter !== "all"
                    ? "No employees match your filters."
                    : "No employees yet."}
                </TableCell>
              </TableRow>
            )}
            {sorted.map((emp) => {
              const isActive = !emp.endDate || new Date(emp.endDate) > now;
              return (
                <TableRow key={emp.id}>
                  <TableCell>
                    <Link href={`/employees/${emp.id}`} className="hover:underline">
                      <div className="font-medium">{emp.firstName} {emp.lastName}</div>
                    </Link>
                    <div className="text-xs text-muted-foreground font-mono">{emp.employeeNo}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{emp.department.name}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{emp.position}</TableCell>
                  <TableCell className="text-right font-medium">
                    {emp.basicSalary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    <DateDisplay date={emp.startDate} />
                  </TableCell>
                  <TableCell>
                    {isActive ? (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">Active</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                        <UserX className="h-3 w-3 mr-1" />
                        Left {format(new Date(emp.endDate!), "MMM yyyy")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => { setEditEmployee(emp); setFormOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove {emp.firstName} {emp.lastName}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will soft-delete the employee. Payroll history will be preserved.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(emp.id, `${emp.firstName} ${emp.lastName}`)}>
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        {sorted.length} of {employees.length} employees
      </p>

      <EmployeeForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditEmployee(null); }}
        employee={editEmployee}
        departments={departments}
      />
      <DepartmentDialog
        open={deptOpen}
        onClose={() => setDeptOpen(false)}
        departments={departments}
      />
    </div>
  );
}
