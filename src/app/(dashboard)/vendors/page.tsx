import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { SupplierTable } from "./_components/supplier-table";
import { ERPPageHeader } from "@/components/ui/erp-page-header";

export const metadata = { title: "Vendors" };

export default async function SuppliersPage() {
  await requirePermission("purchases");

  const suppliers = await prisma.supplier.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    take: 500,
    select: {
      id: true, name: true, contactName: true, email: true,
      phone: true, address: true, pan: true, openingBalance: true,
      _count: { select: { purchases: true } },
    },
  });

  return (
    <div className="space-y-6">
      <ERPPageHeader
        title="Vendors"
        subtitle={`${suppliers.length} active vendor${suppliers.length !== 1 ? "s" : ""}`}
        backHref="/purchases"
      />

      <SupplierTable suppliers={suppliers.map(s => ({ ...s, openingBalance: Number(s.openingBalance) }))} />
    </div>
  );
}
