"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";


export type LedgerEntry = {
  id:            string;
  date:          string;
  type:          "INVOICE" | "PAYMENT";
  reference:     string;
  description:   string;
  invoiceAmount: number;
  paymentAmount: number;
  balance:       number;
  vatAmount:     number;
  exciseAmount:  number;
  subtotal:      number;
  paymentMethod: string;
  invoiceUrl:    string | null;
  receiptUrl:    string | null;
  purchaseId:    string | null;
};

export type OutstandingInvoice = {
  purchaseId:      string;
  invoiceNo:       string;
  date:            string;
  totalCost:       number;
  amountPaid:      number;  // paid at invoice creation
  allocatedAmount: number;  // allocated via VendorPayments
  outstanding:     number;  // totalCost - amountPaid - allocatedAmount
};

export type VendorLedgerData = {
  supplier: {
    id:             string;
    name:           string;
    pan:            string | null;
    phone:          string | null;
    address:        string | null;
    contactName:    string | null;
    openingBalance: number;
  };
  openingBalance:     number;
  closingBalance:     number;
  entries:            LedgerEntry[];
  outstandingInvoices: OutstandingInvoice[];
  taxSummary: {
    totalPurchases:  number;
    totalVat:        number;
    totalExcise:     number;
    totalInvoiced:   number;
    totalPaid:       number;
    netPayable:      number;
    invoiceCount:    number;
    vatInvoiceCount: number;
  };
  from: string;
  to:   string;
};

export async function getVendorLedger(
  supplierId: string,
  from: Date,
  to: Date
): Promise<VendorLedgerData> {
  await requirePermission("purchases");

  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId, deletedAt: null },
    select: {
      id: true, name: true, pan: true, phone: true,
      address: true, contactName: true, openingBalance: true,
    },
  });
  if (!supplier) throw new Error("Supplier not found");

  // All purchases + their allocation sums
  const allPurchases = await prisma.purchase.findMany({
    where: { supplierId, deletedAt: null },
    select: {
      id: true, invoiceNo: true, date: true,
      subtotal: true, vatTotal: true, totalCost: true,
      amountPaid: true, paymentMethod: true, notes: true, invoiceUrl: true,
      items: {
        select: { vatAmount: true, exciseAmount: true, grossAmount: true },
      },
    },
    orderBy: { date: "asc" },
  });

  // Allocation sums per purchaseId (from VendorPaymentAllocations)
  const allocRows = await prisma.vendorPaymentAllocation.groupBy({
    by: ["purchaseId"],
    where: { purchase: { supplierId } },
    _sum: { amount: true },
  });

  const allocMap = new Map<string, number>(
    allocRows.map((r) => [r.purchaseId, Number(r._sum.amount ?? 0)])
  );

  // SupplierPayments (tied to POs)
  const allSpPayments = await prisma.supplierPayment.findMany({
    where: { supplierId },
    select: {
      id: true, amount: true, method: true, reference: true,
      notes: true, paidAt: true,
      purchaseOrder: { select: { orderNumber: true } },
    },
    orderBy: { paidAt: "asc" },
  });

  // Standalone VendorPayments
  const allVendorPayments = await prisma.vendorPayment.findMany({
    where: { supplierId },
    select: {
      id: true, amount: true, method: true, reference: true,
      notes: true, receiptUrl: true, paidAt: true,
    },
    orderBy: { paidAt: "asc" },
  });

  // ── Opening balance ──────────────────────────────────────────────────────
  const baseOpening = Number(supplier.openingBalance);
  let computedOpening = baseOpening;

  for (const p of allPurchases) {
    if (p.date < from) {
      computedOpening += Number(p.totalCost);
      computedOpening -= Number(p.amountPaid);
      // VendorPaymentAllocation is NOT subtracted here — it is bookkeeping only.
      // The actual cash outflow is captured by VendorPayment.amount below.
    }
  }
  for (const sp of allSpPayments) {
    if (sp.paidAt < from) computedOpening -= Number(sp.amount);
  }
  for (const vp of allVendorPayments) {
    if (vp.paidAt < from) computedOpening -= Number(vp.amount);
  }

  // ── Ledger entries ───────────────────────────────────────────────────────
  type RawEntry = {
    id: string; date: Date; type: "INVOICE" | "PAYMENT";
    reference: string; description: string;
    invoiceAmount: number; paymentAmount: number;
    vatAmount: number; exciseAmount: number; subtotal: number;
    paymentMethod: string; invoiceUrl: string | null;
    receiptUrl: string | null; purchaseId: string | null;
  };

  const rawEntries: RawEntry[] = [];

  for (const p of allPurchases) {
    if (p.date < from || p.date > to) continue;

    const vatAmt    = p.items.reduce((s, i) => s + Number(i.vatAmount ?? 0), 0);
    const exciseAmt = p.items.reduce((s, i) => s + Number(i.exciseAmount ?? 0), 0);
    const sub       = p.items.reduce((s, i) => s + Number(i.grossAmount ?? 0), 0);

    rawEntries.push({
      id: `inv-${p.id}`, date: p.date, type: "INVOICE",
      reference: p.invoiceNo,
      description: `Purchase Invoice${p.notes ? ` · ${p.notes}` : ""}`,
      invoiceAmount: Number(p.totalCost), paymentAmount: 0,
      vatAmount: vatAmt, exciseAmount: exciseAmt, subtotal: sub,
      paymentMethod: "", invoiceUrl: p.invoiceUrl, receiptUrl: null, purchaseId: p.id,
    });

    // Immediate payment at invoice creation
    if (Number(p.amountPaid) > 0) {
      rawEntries.push({
        id: `pay-${p.id}`, date: p.date, type: "PAYMENT",
        reference: p.invoiceNo,
        description: `Payment at purchase · ${p.invoiceNo}`,
        invoiceAmount: 0, paymentAmount: Number(p.amountPaid),
        vatAmount: 0, exciseAmount: 0, subtotal: 0,
        paymentMethod: p.paymentMethod, invoiceUrl: null, receiptUrl: null, purchaseId: p.id,
      });
    }
  }

  for (const sp of allSpPayments) {
    if (sp.paidAt < from || sp.paidAt > to) continue;
    rawEntries.push({
      id: `sp-${sp.id}`, date: sp.paidAt, type: "PAYMENT",
      reference: sp.reference ?? sp.purchaseOrder.orderNumber,
      description: `PO Payment · ${sp.purchaseOrder.orderNumber}${sp.notes ? ` · ${sp.notes}` : ""}`,
      invoiceAmount: 0, paymentAmount: Number(sp.amount),
      vatAmount: 0, exciseAmount: 0, subtotal: 0,
      paymentMethod: sp.method, invoiceUrl: null, receiptUrl: null, purchaseId: null,
    });
  }

  for (const vp of allVendorPayments) {
    if (vp.paidAt < from || vp.paidAt > to) continue;
    rawEntries.push({
      id: `vp-${vp.id}`, date: vp.paidAt, type: "PAYMENT",
      reference: vp.reference ?? "—",
      description: `Credit Settlement${vp.notes ? ` · ${vp.notes}` : ""}`,
      invoiceAmount: 0, paymentAmount: Number(vp.amount),
      vatAmount: 0, exciseAmount: 0, subtotal: 0,
      paymentMethod: vp.method, invoiceUrl: null, receiptUrl: vp.receiptUrl ?? null, purchaseId: null,
    });
  }

  // Sort: invoices before same-day payments
  rawEntries.sort((a, b) => {
    const diff = a.date.getTime() - b.date.getTime();
    if (diff !== 0) return diff;
    return a.type === "INVOICE" ? -1 : 1;
  });

  let balance = computedOpening;
  const entries: LedgerEntry[] = rawEntries.map((e) => {
    balance += e.invoiceAmount - e.paymentAmount;
    return { ...e, date: e.date.toISOString(), balance };
  });

  const closingBalance = balance;

  // ── Tax summary ───────────────────────────────────────────────────────────
  const invoiceEntries = rawEntries.filter((e) => e.type === "INVOICE");
  const totalPurchases  = invoiceEntries.reduce((s, e) => s + e.subtotal, 0);
  const totalVat        = invoiceEntries.reduce((s, e) => s + e.vatAmount, 0);
  const totalExcise     = invoiceEntries.reduce((s, e) => s + e.exciseAmount, 0);
  const totalInvoiced   = invoiceEntries.reduce((s, e) => s + e.invoiceAmount, 0);
  const totalPaid       = rawEntries.filter((e) => e.type === "PAYMENT").reduce((s, e) => s + e.paymentAmount, 0);

  // ── Outstanding invoices (all time, for payment allocation dialog) ────────
  const outstandingInvoices: OutstandingInvoice[] = allPurchases
    .map((p) => {
      const allocated  = allocMap.get(p.id) ?? 0;
      const outstanding = Math.max(0, Number(p.totalCost) - Number(p.amountPaid) - allocated);
      return {
        purchaseId:      p.id,
        invoiceNo:       p.invoiceNo,
        date:            p.date.toISOString(),
        totalCost:       Number(p.totalCost),
        amountPaid:      Number(p.amountPaid),
        allocatedAmount: allocated,
        outstanding,
      };
    })
    .filter((p) => p.outstanding > 0.005)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // oldest first

  return {
    supplier: { ...supplier, openingBalance: Number(supplier.openingBalance) },
    openingBalance:  computedOpening,
    closingBalance,
    entries,
    outstandingInvoices,
    taxSummary: {
      totalPurchases, totalVat, totalExcise, totalInvoiced, totalPaid,
      netPayable:      closingBalance,
      invoiceCount:    invoiceEntries.length,
      vatInvoiceCount: invoiceEntries.filter((e) => e.vatAmount > 0).length,
    },
    from: from.toISOString(),
    to:   to.toISOString(),
  };
}

// ── Record payment ───────────────────────────────────────────────────────────

const recordPaymentSchema = z.object({
  supplierId:  z.string().min(1),
  amount:      z.number().min(0.01, "Amount must be > 0"),
  method:      z.enum(["CASH", "BANK_TRANSFER", "CHECK", "ESEWA", "KHALTI", "IME_PAY", "FONEPAY", "OTHER"]),
  reference:   z.string().optional(),
  notes:       z.string().optional(),
  receiptUrl:  z.string().optional(),
  paidAt:      z.string(),
  allocations: z.array(z.object({
    purchaseId: z.string(),
    amount:     z.number().min(0.01),
  })).optional(),
});

export async function recordVendorPayment(values: {
  supplierId:  string;
  amount:      number;
  method:      string;
  reference?:  string;
  notes?:      string;
  receiptUrl?: string;
  paidAt:      string;
  allocations?: Array<{ purchaseId: string; amount: number }>;
}) {
  await requirePermission("purchases");
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthenticated");

  const data = recordPaymentSchema.parse(values);

  // Validate allocations don't exceed total
  const allocTotal = (data.allocations ?? []).reduce((s, a) => s + a.amount, 0);
  if (allocTotal > data.amount + 0.005) {
    throw new Error("Allocated amount exceeds payment total");
  }

  // Create VendorPayment + Allocations in a transaction
  await prisma.vendorPayment.create({
    data: {
      supplierId: data.supplierId,
      amount:     data.amount,
      method:     data.method,
      reference:  data.reference || null,
      notes:      data.notes || null,
      receiptUrl: data.receiptUrl || null,
      paidAt:     new Date(data.paidAt),
      createdBy:  userId,
      allocations: {
        create: (data.allocations ?? []).map((a) => ({
          purchaseId: a.purchaseId,
          amount:     a.amount,
        })),
      },
    },
  });

  revalidatePath("/vendors/ledger");
  revalidatePath("/purchases");
}

export async function deleteVendorPayment(id: string) {
  await requirePermission("purchases");
  await prisma.vendorPayment.delete({ where: { id } });
  revalidatePath("/vendors/ledger");
  revalidatePath("/purchases");
}

export async function getAllSuppliers() {
  await requirePermission("purchases");
  return prisma.supplier.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, pan: true },
    orderBy: { name: "asc" },
  });
}
