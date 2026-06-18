import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { EmployeeTable } from "./_components/employee-table";
import { Users, UserCheck, DollarSign, Building2 } from "lucide-react";
import { formatAmount } from "@/lib/format";

export const metadata = { title: "Employees" };

export default async function EmployeesPage() {
  await requirePermission("employees");

  const [employees, departments] = await Promise.all([
    prisma.employee.findMany({
      where: { deletedAt: null },
      include: { department: true },
      orderBy: [{ department: { name: "asc" } }, { firstName: "asc" }],
      take: 500,
    }),
    prisma.department.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: { _count: { select: { employees: true } } },
    }),
  ]);

  const now = new Date();

  const activeEmployees = employees.filter(
    (e) => !e.endDate || new Date(e.endDate) > now
  );

  const totalPayroll = activeEmployees.reduce(
    (sum, e) => sum + Number(e.basicSalary), 0
  );

  const serialised = employees.map((e) => ({
    id:            e.id,
    employeeNo:    e.employeeNo,
    firstName:     e.firstName,
    lastName:      e.lastName,
    email:         e.email ?? null,
    phone:         e.phone,
    citizenshipId: e.citizenshipId ?? null,
    address:       e.address ?? null,
    departmentId:  e.departmentId,
    position:      e.position,
    basicSalary:    Number(e.basicSalary),
    openingBalance: Number(e.openingBalance),
    startDate:      e.startDate.toISOString(),
    endDate:        e.endDate?.toISOString() ?? null,
    department:    { name: e.department.name },
  }));



  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Employees</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {activeEmployees.length} active · {employees.length} total
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="rounded-lg border bg-card px-4 py-3 transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-1 hover:shadow-md active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <UserCheck className="h-3.5 w-3.5 shrink-0" />
            <span>Active Staff</span>
          </div>
          <div className="text-2xl font-bold">{activeEmployees.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Currently employed</div>
        </div>

        <div className="rounded-lg border bg-card px-4 py-3 transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-1 hover:shadow-md active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span>Departments</span>
          </div>
          <div className="text-2xl font-bold">{departments.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Active departments</div>
        </div>

        <div className="rounded-lg border bg-card px-4 py-3 transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-1 hover:shadow-md active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <DollarSign className="h-3.5 w-3.5 shrink-0" />
            <span>Monthly Payroll</span>
          </div>
          <div className="text-2xl font-bold tabular-nums">{formatAmount(totalPayroll)}</div>
          <div className="text-xs text-muted-foreground mt-1">Base salaries only</div>
        </div>

        <div className="rounded-lg border bg-card px-4 py-3 transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-1 hover:shadow-md active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span>Avg. Salary</span>
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {activeEmployees.length > 0
              ? formatAmount(totalPayroll / activeEmployees.length)
              : formatAmount(0)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Per active employee</div>
        </div>
      </div>

      <EmployeeTable employees={serialised} departments={departments} />
    </div>
  );
}
