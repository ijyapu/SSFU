"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

export type CustomerLedgerEntry = {
  id:             string;
  date:           string;
  salesOrderDate: string; // always the originating order's dispatch date — used for day grouping
  type:           "INVOICE" | "PAYMENT" | "RETURN" | "COMMISSION";
  reference:      string;
  description:    string;
  invoiceAmount:  number;
  paymentAmount:  number;
  balance:        number;
  paymentMethod:  string;
  salesOrderId:   string | null;
};

export type CommissionInvoiceRow = {
  orderId:          string;
  orderNumber:      string;
  orderDate:        string;
  invoiceAmount:    number;
  wasteDeducted:    number;
  netAmount:        number;
  commissionPct:    number;
  commissionAmount: number;
  factoryAmount:    number;
};

export type CustomerLedgerData = {
  salesman: {
    id:             string;
    name:           string;
    commissionPct:  number;
    phone:          string | null;
    address:        string | null;
    email:          string | null;
    openingBalance: number;
  };
  openingBalance: number;
  closingBalance: number;
  entries:        CustomerLedgerEntry[];
  commissionSummary: {
    totalInvoiced:      number;
    totalWaste:         number;
    totalCommission:    number;
    totalFactoryAmount: number;
    totalReceived:      number;
    invoiceCount:       number;
    invoiceBreakdown:   CommissionInvoiceRow[];
  };
  from: string;
  to:   string;
};

export async function getCustomerLedger(
  customerId: string,
  from: Date,
  to: Date
): Promise<CustomerLedgerData> {
  await requirePermission("sales");

  const salesman = await prisma.salesman.findUnique({
    where: { id: customerId, deletedAt: null },
    select: {
      id: true, name: true, commissionPct: true, phone: true,
      address: true, email: true, openingBalance: true,
    },
  });
  if (!salesman) throw new Error("Salesman not found");

  const allOrders = await prisma.salesOrder.findMany({
    where: { customerId, deletedAt: null },
    select: {
      id: true, orderNumber: true, orderDate: true, status: true,
      totalAmount: true, amountPaid: true, notes: true,
      commissionPct: true, commissionAmount: true, factoryAmount: true,
      payments: {
        select: { id: true, amount: true, method: true, paidAt: true, reference: true, notes: true },
      },
    },
    orderBy: { orderDate: "asc" },
  });

  const allReturns = await prisma.salesReturn.findMany({
    where: { salesOrder: { customerId } },
    select: {
      id: true, returnNumber: true, createdAt: true, totalAmount: true, notes: true,
      salesOrderId: true,
      salesOrder: { select: { orderNumber: true, orderDate: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Build pre-period returns per order (for accurate opening balance)
  const preFromReturnsMap = new Map<string, number>();
  for (const r of allReturns) {
    if (r.createdAt < from && r.salesOrderId) {
      preFromReturnsMap.set(r.salesOrderId, (preFromReturnsMap.get(r.salesOrderId) ?? 0) + Number(r.totalAmount));
    }
  }

  // Only CONFIRMED, PARTIALLY_PAID, and PAID orders are collectible obligations.
  // DRAFT is uncommitted; CANCELLED didn't happen; LOST means the obligation was waived.
  const COLLECTIBLE = new Set<string>(["CONFIRMED", "PARTIALLY_PAID", "PAID"]);

  // Opening balance — use factory amount (after commission & pre-period returns) not gross
  let computedOpening = Number(salesman.openingBalance);

  for (const o of allOrders) {
    if (o.orderDate < from && COLLECTIBLE.has(o.status)) {
      const preReturns    = preFromReturnsMap.get(o.id) ?? 0;
      const net           = Number(o.totalAmount) - preReturns;
      const commPct       = Number(o.commissionPct) / 100;
      const factoryAtFrom = net * (1 - commPct);
      computedOpening += factoryAtFrom - Number(o.amountPaid);
    }
  }

  // Build ledger entries within period
  const rawEntries: {
    id: string; date: Date; salesOrderDate: Date;
    type: "INVOICE" | "PAYMENT" | "RETURN" | "COMMISSION";
    reference: string; description: string;
    invoiceAmount: number; paymentAmount: number;
    paymentMethod: string; salesOrderId: string | null;
  }[] = [];

  for (const o of allOrders) {
    if (o.orderDate < from || o.orderDate > to) continue;
    if (!COLLECTIBLE.has(o.status)) continue;

    rawEntries.push({
      id:             `inv-${o.id}`,
      date:           o.orderDate,
      salesOrderDate: o.orderDate,
      type:           "INVOICE",
      reference:      o.orderNumber,
      description:    `Sales Invoice${o.notes ? ` · ${o.notes}` : ""}`,
      invoiceAmount:  Number(o.totalAmount),
      paymentAmount:  0,
      paymentMethod:  "",
      salesOrderId:   o.id,
    });

    // Commission is the salesman's share — deduct it from what they owe
    const commAmt = Number(o.commissionAmount);
    if (commAmt > 0.001) {
      rawEntries.push({
        id:             `comm-${o.id}`,
        date:           o.orderDate,
        salesOrderDate: o.orderDate,
        type:           "COMMISSION",
        reference:      o.orderNumber,
        description:    `Commission (${Number(o.commissionPct)}%) on ${o.orderNumber}`,
        invoiceAmount:  0,
        paymentAmount:  commAmt,
        paymentMethod:  "",
        salesOrderId:   o.id,
      });
    }

    for (const p of o.payments) {
      if (p.paidAt < from || p.paidAt > to) continue;
      rawEntries.push({
        id:             `pay-${p.id}`,
        date:           p.paidAt,
        salesOrderDate: o.orderDate, // group under the sale date, not the payment date
        type:           "PAYMENT",
        reference:      o.orderNumber,
        description:    `Payment for ${o.orderNumber}${p.notes ? ` · ${p.notes}` : ""}`,
        invoiceAmount:  0,
        paymentAmount:  Number(p.amount),
        paymentMethod:  p.method,
        salesOrderId:   o.id,
      });
    }
  }

  for (const r of allReturns) {
    if (r.createdAt < from || r.createdAt > to) continue;
    rawEntries.push({
      id:             `ret-${r.id}`,
      date:           r.createdAt,
      salesOrderDate: r.salesOrder.orderDate, // group under the sale date, not the return date
      type:           "RETURN",
      reference:      r.returnNumber,
      description:    `Waste Return · ${r.salesOrder.orderNumber}${r.notes ? ` · ${r.notes}` : ""}`,
      invoiceAmount:  0,
      paymentAmount:  Number(r.totalAmount),
      paymentMethod:  "",
      salesOrderId:   r.salesOrderId,
    });
  }

  const typeOrder = { INVOICE: 0, RETURN: 1, COMMISSION: 2, PAYMENT: 3 };
  rawEntries.sort((a, b) => {
    const diff = a.date.getTime() - b.date.getTime();
    if (diff !== 0) return diff;
    return (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9);
  });

  let balance = computedOpening;
  const entries: CustomerLedgerEntry[] = rawEntries.map((e) => {
    balance += e.invoiceAmount - e.paymentAmount;
    return { ...e, date: e.date.toISOString(), salesOrderDate: e.salesOrderDate.toISOString(), balance };
  });

  const closingBalance = balance;

  // Commission summary — uses stored values (updated live by processSalesReturn)
  const periodOrders = allOrders.filter(
    (o) => o.orderDate >= from && o.orderDate <= to && COLLECTIBLE.has(o.status)
  );

  // Waste per order within the period
  const wasteByOrder = new Map<string, number>();
  for (const r of allReturns) {
    if (r.createdAt < from || r.createdAt > to) continue;
    if (!r.salesOrderId) continue;
    wasteByOrder.set(r.salesOrderId, (wasteByOrder.get(r.salesOrderId) ?? 0) + Number(r.totalAmount));
  }

  const invoiceBreakdown: CommissionInvoiceRow[] = periodOrders.map((o) => {
    const invoiceAmount    = Number(o.totalAmount);
    const wasteDeducted    = wasteByOrder.get(o.id) ?? 0;
    const netAmount        = invoiceAmount - wasteDeducted;
    const commissionPct    = Number(o.commissionPct);
    const commissionAmount = Number(o.commissionAmount); // already recalculated on each return
    const factoryAmount    = Number(o.factoryAmount);
    return { orderId: o.id, orderNumber: o.orderNumber, orderDate: o.orderDate.toISOString(), invoiceAmount, wasteDeducted, netAmount, commissionPct, commissionAmount, factoryAmount };
  });

  const paymentEntries = rawEntries.filter((e) => e.type === "PAYMENT");

  return {
    salesman: {
      id:             salesman.id,
      name:           salesman.name,
      commissionPct:  Number(salesman.commissionPct),
      phone:          salesman.phone,
      address:        salesman.address,
      email:          salesman.email,
      openingBalance: Number(salesman.openingBalance),
    },
    openingBalance:  computedOpening,
    closingBalance,
    entries,
    commissionSummary: {
      totalInvoiced:      invoiceBreakdown.reduce((s, r) => s + r.invoiceAmount, 0),
      totalWaste:         invoiceBreakdown.reduce((s, r) => s + r.wasteDeducted, 0),
      totalCommission:    invoiceBreakdown.reduce((s, r) => s + r.commissionAmount, 0),
      totalFactoryAmount: invoiceBreakdown.reduce((s, r) => s + r.factoryAmount, 0),
      totalReceived:      paymentEntries.reduce((s, e) => s + e.paymentAmount, 0),
      invoiceCount:       invoiceBreakdown.length,
      invoiceBreakdown,
    },
    from: from.toISOString(),
    to:   to.toISOString(),
  };
}

export async function getAllCustomers() {
  await requirePermission("sales");
  return prisma.salesman.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
