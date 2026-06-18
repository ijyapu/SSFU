"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { applyStockMovement } from "@/lib/stock";
import { StockMovementType } from "@prisma/client";
import {
  salesmanSchema, createSoSchema, updateSoSchema, salesmanPaymentSchema, salesReturnSchema,
  type SalesmanFormValues, type CreateSoValues, type UpdateSoValues,
  type SalesmanPaymentValues, type SalesReturnValues,
} from "@/lib/validators/sales";
import { getNextDocumentNumber } from "@/lib/doc-counter";
import { writeAuditLog } from "@/lib/audit";

type Db = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

/** Store date-only inputs as noon UTC to avoid midnight timezone boundary issues */
function toNoonUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
}

async function requireSalesAccess() {
  const user = await currentUser();
  if (!user) throw new Error("Unauthenticated");
  const role = user.publicMetadata?.role as string | undefined;
  if (!role || !["superadmin", "admin", "manager", "accountant"].includes(role)) {
    throw new Error("Unauthorized");
  }
  return user.id;
}

async function generateSoNumber(db: Db = prisma): Promise<string> {
  return getNextDocumentNumber(`SO-${new Date().getFullYear()}-`, db);
}

async function generateReturnNumber(db: Db = prisma): Promise<string> {
  return getNextDocumentNumber(`SR-${new Date().getFullYear()}-`, db);
}

type SyncResult = { ok: boolean; logUpdated: boolean; warning?: string };

/**
 * Increment (+1) or decrement (-1) soldQty in the daily log for the given date.
 * Returns a result object so callers can log a warning when it fails.
 */
async function syncDailyLogSoldQty(
  items: Array<{ productId: string; quantity: number }>,
  delta: 1 | -1,
  orderDate: Date,
): Promise<SyncResult> {
  try {
    // Normalise to midnight UTC for the daily log key (orderDate is stored as noon UTC)
    const logDateUTC = new Date(Date.UTC(
      orderDate.getUTCFullYear(),
      orderDate.getUTCMonth(),
      orderDate.getUTCDate(),
    ));
    const log = await prisma.dailyLog.findUnique({
      where:  { logDate: logDateUTC },
      select: { id: true, status: true },
    });
    if (!log) return { ok: true, logUpdated: false };

    // Skip closed logs — soldQty is read live from sales orders in getDailyLog for display
    if (log.status === "CLOSED" || log.status === "AUTO_ADJUSTED") {
      return { ok: true, logUpdated: false };
    }

    for (const item of items) {
      await prisma.dailyLogItem.updateMany({
        where: { dailyLogId: log.id, productId: item.productId },
        data:  delta === 1
          ? { soldQty: { increment: item.quantity } }
          : { soldQty: { decrement: item.quantity } },
      });
    }
    return { ok: true, logUpdated: true };
  } catch (err) {
    const warning = `syncDailyLogSoldQty failed for date ${orderDate.toISOString()}: ${err instanceof Error ? err.message : String(err)}`;
    console.warn("[sales]", warning);
    return { ok: false, logUpdated: false, warning };
  }
}

// ─── Salesmen ─────────────────────────────────

export async function createSalesman(values: SalesmanFormValues) {
  await requireSalesAccess();
  const data = salesmanSchema.parse(values);
  await prisma.salesman.create({
    data: {
      name:          data.name,
      email:         data.email || null,
      phone:         data.phone || null,
      address:       data.address || null,
      citizenshipNo: data.citizenshipNo || null,
      openingBalance: data.openingBalance ?? 0,
      commissionPct:  data.commissionPct ?? 0,
    },
  });
  revalidatePath("/sales/salesmen");
}

export async function updateSalesman(id: string, values: SalesmanFormValues) {
  await requireSalesAccess();
  const data = salesmanSchema.parse(values);
  await prisma.salesman.update({
    where: { id },
    data: {
      name:          data.name,
      email:         data.email || null,
      phone:         data.phone || null,
      address:       data.address || null,
      citizenshipNo: data.citizenshipNo || null,
      openingBalance: data.openingBalance ?? 0,
      commissionPct:  data.commissionPct ?? 0,
    },
  });
  revalidatePath("/sales/salesmen");
}

export async function deleteSalesman(id: string) {
  await requireSalesAccess();
  await prisma.salesman.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/sales/salesmen");
}

// ─── Sales Orders ─────────────────────────────

export async function createSalesOrder(values: CreateSoValues) {
  const userId = await requireSalesAccess();
  const data = createSoSchema.parse(values);

  // Snapshot the customer's commission rate
  const customer = await prisma.salesman.findUnique({
    where: { id: data.customerId },
    select: { commissionPct: true },
  });
  const commissionPct = Number(customer?.commissionPct ?? 0);
  const subtotal      = data.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  // Check stock availability and validate unit prices before touching anything
  for (const item of data.items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      select: { name: true, currentStock: true, sellingPrice: true },
    });
    if (!product) throw new Error("Product not found");
    if (Number(product.currentStock) < item.quantity) {
      throw new Error(
        `Insufficient stock for "${product.name}". Available: ${Number(product.currentStock).toLocaleString(undefined, { maximumFractionDigits: 3 })}, needed: ${item.quantity.toLocaleString(undefined, { maximumFractionDigits: 3 })}`
      );
    }
    if (item.unitPrice < Number(product.sellingPrice)) {
      throw new Error(
        `Unit price for ${product.name} cannot be lower than the catalog price of Rs ${Number(product.sellingPrice)}`
      );
    }
  }

  // Factor in any immediate waste returns
  const validReturnItems = (data.returnItems ?? []).filter(
    (i) => i.productId && i.quantity > 0 && i.unitPrice >= 0
  );
  const hasReturn   = validReturnItems.length > 0;
  const returnTotal = hasReturn
    ? validReturnItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
    : 0;

  // Factor in any immediate fresh returns (also reduce net, but get restocked)
  const validFreshItems = (data.freshReturnItems ?? []).filter(
    (i) => i.productId && i.quantity > 0 && i.unitPrice >= 0
  );
  const hasFreshReturn   = validFreshItems.length > 0;
  const freshReturnTotal = hasFreshReturn
    ? validFreshItems.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
    : 0;

  const netAmount        = subtotal - returnTotal - freshReturnTotal;
  const commissionAmount = Math.round(netAmount * commissionPct) / 100;
  const factoryAmount    = netAmount - commissionAmount;

  const paidNow = Math.min(data.amountPaid, factoryAmount);
  const status  = paidNow >= factoryAmount - 0.001 ? "PAID"
                : paidNow > 0                       ? "PARTIALLY_PAID"
                :                                     "CONFIRMED";

  await prisma.$transaction(async (tx) => {
    const orderNumber       = await generateSoNumber(tx as Db);
    const returnNumber      = hasReturn      ? await generateReturnNumber(tx as Db) : null;
    const freshReturnNumber = hasFreshReturn ? await generateReturnNumber(tx as Db) : null;

    const so = await tx.salesOrder.create({
      data: {
        orderNumber,
        customerId:      data.customerId,
        orderDate:       toNoonUTC(data.orderDate),
        notes:           data.notes || null,
        subtotal,
        taxAmount:       0,
        totalAmount:     subtotal,
        commissionPct,
        commissionAmount,
        factoryAmount,
        amountPaid:      paidNow,
        status,
        createdBy:       userId,
        items: {
          create: data.items.map((item) => ({
            productId:  item.productId,
            quantity:   item.quantity,
            unitPrice:  item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
          })),
        },
      },
    });

    if (paidNow > 0) {
      await tx.salesmanPayment.create({
        data: {
          salesOrderId: so.id,
          customerId:   data.customerId,
          amount:       paidNow,
          method:       "CASH",
          paidAt:       toNoonUTC(data.orderDate),
          notes:        paidNow >= factoryAmount - 0.001 ? "Payment on delivery" : "Partial payment on delivery",
          createdBy:    userId,
        },
      });
    }

    for (const item of data.items) {
      await applyStockMovement(
        {
          productId:     item.productId,
          type:          StockMovementType.SALE,
          quantity:      item.quantity,
          unitCost:      item.unitPrice,
          notes:         `Sale via ${orderNumber}`,
          referenceId:   so.id,
          referenceType: "SalesOrder",
          createdBy:     userId,
        },
        tx as Parameters<typeof applyStockMovement>[1]
      );
    }

    if (hasReturn && returnNumber) {
      await tx.salesReturn.create({
        data: {
          returnNumber,
          salesOrderId: so.id,
          returnType:   "WASTE",
          notes:        data.returnNotes || null,
          totalAmount:  returnTotal,
          createdBy:    userId,
          items: {
            create: validReturnItems.map((item) => ({
              productId: item.productId,
              quantity:  item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
        },
      });
    }

    if (hasFreshReturn && freshReturnNumber) {
      await tx.salesReturn.create({
        data: {
          returnNumber: freshReturnNumber,
          salesOrderId: so.id,
          returnType:   "FRESH",
          notes:        data.freshReturnNotes || null,
          totalAmount:  freshReturnTotal,
          createdBy:    userId,
          items: {
            create: validFreshItems.map((item) => ({
              productId: item.productId,
              quantity:  item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
        },
      });

      for (const item of validFreshItems) {
        await applyStockMovement(
          {
            productId:     item.productId,
            type:          StockMovementType.RETURN_IN,
            quantity:      item.quantity,
            unitCost:      item.unitPrice,
            notes:         `Fresh return via ${orderNumber}`,
            referenceId:   so.id,
            referenceType: "SalesReturn",
            createdBy:     userId,
          },
          tx as Parameters<typeof applyStockMovement>[1]
        );
      }
    }
  }, { timeout: 30000 });

  const syncResult = await syncDailyLogSoldQty(data.items, 1, toNoonUTC(data.orderDate));
  if (!syncResult.ok) {
    console.warn("[sales] createSalesOrder: failed to sync daily log soldQty:", syncResult.warning);
  }

  revalidatePath("/sales");
  revalidatePath("/sales/salesmen");
  revalidatePath("/inventory");
  revalidatePath("/daily-log");
}

export async function confirmSalesOrder(id: string) {
  const userId = await requireSalesAccess();

  const so = await prisma.salesOrder.findUnique({
    where: { id },
    select: {
      status:      true,
      orderNumber: true,
      orderDate:   true,
      items: {
        select: { productId: true, quantity: true, unitPrice: true },
      },
    },
  });
  if (!so) throw new Error("Sales order not found");
  if (so.status !== "DRAFT") throw new Error("Only draft orders can be confirmed");

  await prisma.$transaction(async (tx) => {
    // Re-read stock inside the transaction — prevents TOCTOU overselling
    for (const item of so.items) {
      const product = await tx.product.findUnique({
        where:  { id: item.productId },
        select: { name: true, currentStock: true },
      });
      if (!product) throw new Error("Product not found");
      const available = Number(product.currentStock);
      const needed    = Number(item.quantity);
      if (available < needed) {
        throw new Error(
          `Insufficient stock for "${product.name}". ` +
          `Available: ${available.toLocaleString(undefined, { maximumFractionDigits: 3 })}, ` +
          `needed: ${needed.toLocaleString(undefined, { maximumFractionDigits: 3 })}`
        );
      }
    }

    for (const item of so.items) {
      await applyStockMovement(
        {
          productId:     item.productId,
          type:          StockMovementType.SALE,
          quantity:      Number(item.quantity),
          unitCost:      Number(item.unitPrice),
          notes:         `Sale via ${so.orderNumber}`,
          referenceId:   id,
          referenceType: "SalesOrder",
          createdBy:     userId,
        },
        tx as Parameters<typeof applyStockMovement>[1]
      );
    }

    await tx.salesOrder.update({
      where: { id },
      data: { status: "CONFIRMED" },
    });
  }, { timeout: 30000 });

  await writeAuditLog({
    userId,
    action:     "SALES_ORDER_CONFIRM",
    entityType: "SalesOrder",
    entityId:   id,
    after: { orderNumber: so.orderNumber, status: "CONFIRMED" },
  });

  const syncResult = await syncDailyLogSoldQty(
    so.items.map((i) => ({ productId: i.productId, quantity: Number(i.quantity) })),
    1,
    so.orderDate,
  );
  if (!syncResult.ok) {
    console.warn("[sales] confirmSalesOrder: failed to sync daily log soldQty:", syncResult.warning);
  }

  revalidatePath(`/sales/${id}`);
  revalidatePath("/sales");
  revalidatePath("/sales/salesmen");
  revalidatePath("/inventory");
  revalidatePath("/daily-log");
}

export async function updateSalesOrder(id: string, values: UpdateSoValues) {
  const userId = await requireSalesAccess();
  const data = updateSoSchema.parse(values);

  const so = await prisma.salesOrder.findUnique({
    where: { id, deletedAt: null },
    include: {
      items:   true,
      returns: { select: { totalAmount: true } },
    },
  });
  if (!so) throw new Error("Sales order not found");
  if (so.status === "CANCELLED") throw new Error("Cannot edit a voided order");
  if (so.status === "LOST") throw new Error("Cannot edit an order marked as lost");

  const oldOrderDate  = so.orderDate;
  const newOrderDate  = toNoonUTC(data.orderDate);
  const dateChanged   = oldOrderDate.getTime() !== newOrderDate.getTime();

  const subtotal             = data.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const existingReturnTotal  = so.returns.reduce((sum, r) => sum + Number(r.totalAmount), 0);
  const netAmount            = subtotal - existingReturnTotal;
  const commissionPct        = Number(so.commissionPct);
  const commissionAmount     = Math.round(netAmount * commissionPct) / 100;
  const factoryAmount        = netAmount - commissionAmount;
  const amountPaid           = Number(so.amountPaid);
  const newStatus            = so.status === "DRAFT"                    ? "DRAFT"
                             : amountPaid >= factoryAmount - 0.001      ? "PAID"
                             : amountPaid > 0                           ? "PARTIALLY_PAID"
                             :                                            "CONFIRMED";

  const needsStock = so.status !== "DRAFT";

  await prisma.$transaction(async (tx) => {
    if (needsStock) {
      // Restore old stock
      for (const item of so.items) {
        await applyStockMovement(
          {
            productId:     item.productId,
            type:          StockMovementType.ADJUSTMENT_IN,
            quantity:      Number(item.quantity),
            notes:         `Edit reversal: ${so.orderNumber}`,
            referenceId:   id,
            referenceType: "SalesOrder",
            createdBy:     userId,
          },
          tx as Parameters<typeof applyStockMovement>[1]
        );
      }

      // Validate new stock and unit prices (stock is now restored from reversals above)
      for (const item of data.items) {
        const product = await tx.product.findUnique({
          where:  { id: item.productId },
          select: { name: true, currentStock: true, sellingPrice: true },
        });
        if (!product) throw new Error("Product not found");
        if (Number(product.currentStock) < item.quantity) {
          throw new Error(
            `Insufficient stock for "${product.name}". Available: ${Number(product.currentStock).toLocaleString(undefined, { maximumFractionDigits: 3 })}, needed: ${item.quantity.toLocaleString(undefined, { maximumFractionDigits: 3 })}`
          );
        }
        if (item.unitPrice < Number(product.sellingPrice)) {
          throw new Error(
            `Unit price for ${product.name} cannot be lower than the catalog price of Rs ${Number(product.sellingPrice)}`
          );
        }
      }
    }

    await tx.salesOrderItem.deleteMany({ where: { salesOrderId: id } });

    await tx.salesOrder.update({
      where: { id },
      data: {
        orderDate:        newOrderDate,
        notes:            data.notes || null,
        subtotal,
        totalAmount:      subtotal,
        commissionAmount,
        factoryAmount,
        status:           newStatus,
        items: {
          create: data.items.map((item) => ({
            productId:  item.productId,
            quantity:   item.quantity,
            unitPrice:  item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
          })),
        },
      },
    });

    if (needsStock) {
      for (const item of data.items) {
        await applyStockMovement(
          {
            productId:     item.productId,
            type:          StockMovementType.SALE,
            quantity:      item.quantity,
            unitCost:      item.unitPrice,
            notes:         `Sale via ${so.orderNumber} (edited)`,
            referenceId:   id,
            referenceType: "SalesOrder",
            createdBy:     userId,
          },
          tx as Parameters<typeof applyStockMovement>[1]
        );
      }
    }

    // Keep payment dates in sync with the order date
    if (dateChanged) {
      await tx.salesmanPayment.updateMany({
        where: { salesOrderId: id },
        data:  { paidAt: newOrderDate },
      });
    }
  }, { timeout: 30000 });

  await writeAuditLog({
    userId,
    action:     "SALES_ORDER_EDIT",
    entityType: "SalesOrder",
    entityId:   id,
    before: {
      orderNumber: so.orderNumber,
      orderDate:   oldOrderDate.toISOString(),
      items:       so.items.map((i) => ({ productId: i.productId, quantity: Number(i.quantity) })),
    },
    after: {
      orderDate: newOrderDate.toISOString(),
      items:     data.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      dateChanged,
    },
  });

  if (needsStock) {
    // Reverse old date's soldQty
    const oldSync = await syncDailyLogSoldQty(
      so.items.map((i) => ({ productId: i.productId, quantity: Number(i.quantity) })),
      -1,
      oldOrderDate,
    );
    if (!oldSync.ok) {
      console.warn("[sales] updateSalesOrder: failed to reverse old daily log soldQty:", oldSync.warning);
    }

    // Increment new date's soldQty
    const newSync = await syncDailyLogSoldQty(data.items, 1, newOrderDate);
    if (!newSync.ok) {
      console.warn("[sales] updateSalesOrder: failed to sync new daily log soldQty:", newSync.warning);
    }

  }

  revalidatePath(`/sales/${id}`);
  revalidatePath("/sales");
  revalidatePath("/sales/salesmen");
  revalidatePath("/inventory");
  revalidatePath("/daily-log");
}

/**
 * Void a sale — use when the sale was entered by mistake or did not happen.
 * For confirmed/partially-paid orders: reverses SALE stock movements so goods
 * return to inventory and removes the order from daily log soldQty via cascade.
 * For draft orders: no stock was ever deducted, so just marks it voided.
 */
export async function voidSalesOrder(id: string) {
  const userId = await requireSalesAccess();

  const so = await prisma.salesOrder.findUnique({
    where: { id },
    select: {
      status:      true,
      orderNumber: true,
      orderDate:   true,
      amountPaid:  true,
      items: { select: { productId: true, quantity: true } },
    },
  });
  if (!so) throw new Error("Sales order not found");
  if (so.status === "CANCELLED") throw new Error("Order is already voided");
  if (so.status === "LOST")      throw new Error("Order is already marked as lost");

  // Stock was deducted at confirmation and hasn't been reversed — restore it on void
  const stockWasDeducted = so.status === "CONFIRMED" || so.status === "PARTIALLY_PAID" || so.status === "PAID";

  await prisma.$transaction(async (tx) => {
    if (stockWasDeducted) {
      // Restore stock for every item
      for (const item of so.items) {
        await applyStockMovement(
          {
            productId:     item.productId,
            type:          StockMovementType.ADJUSTMENT_IN,
            quantity:      Number(item.quantity),
            notes:         `Void: ${so.orderNumber} — sale did not happen`,
            referenceId:   id,
            referenceType: "SalesOrder",
            createdBy:     userId,
          },
          tx as Parameters<typeof applyStockMovement>[1]
        );
      }
    }
    await tx.salesOrder.update({ where: { id }, data: { status: "CANCELLED" } });
  }, { timeout: 30000 });

  await writeAuditLog({
    userId,
    action:     "SALES_ORDER_CANCEL",
    entityType: "SalesOrder",
    entityId:   id,
    before: { orderNumber: so.orderNumber, status: so.status },
    after:  {
      status:        "CANCELLED",
      stockRestored: stockWasDeducted,
      refundDue:     so.status === "PAID" ? Number(so.amountPaid) : 0,
    },
  });

  if (stockWasDeducted) {
    const syncResult = await syncDailyLogSoldQty(
      so.items.map((i) => ({ productId: i.productId, quantity: Number(i.quantity) })),
      -1,
      so.orderDate,
    );
    if (!syncResult.ok) {
      console.warn("[sales] voidSalesOrder: failed to sync daily log soldQty:", syncResult.warning);
    }
  }

  revalidatePath(`/sales/${id}`);
  revalidatePath("/sales");
  revalidatePath("/sales/salesmen");
  revalidatePath("/inventory");
  revalidatePath("/daily-log");
}

/**
 * Mark a sale as Lost / Dispatched Not Returned.
 * Use ONLY when goods physically left with the salesman and will NOT come back.
 * Stock is NOT restored — the business absorbs the physical loss.
 * The financial obligation is waived (order excluded from outstanding calculations).
 */
export async function markSalesOrderLost(id: string) {
  const userId = await requireSalesAccess();

  const so = await prisma.salesOrder.findUnique({
    where: { id },
    select: { status: true, orderNumber: true, orderDate: true },
  });
  if (!so) throw new Error("Sales order not found");
  if (so.status === "DRAFT")     throw new Error("A draft order has no dispatched goods. Use Void instead.");
  if (so.status === "CANCELLED") throw new Error("Order is already voided");
  if (so.status === "LOST")      throw new Error("Order is already marked as lost");

  await prisma.salesOrder.update({ where: { id }, data: { status: "LOST" } });

  await writeAuditLog({
    userId,
    action:     "SALES_ORDER_CANCEL",
    entityType: "SalesOrder",
    entityId:   id,
    before: { orderNumber: so.orderNumber, status: so.status },
    after:  { status: "LOST", stockRestored: false },
  });

  revalidatePath(`/sales/${id}`);
  revalidatePath("/sales");
  revalidatePath("/sales/salesmen");
  revalidatePath("/daily-log");
}

export async function deleteSalesOrder(id: string) {
  const userId = await requireSalesAccess();

  const so = await prisma.salesOrder.findUnique({
    where: { id },
    select: {
      status:      true,
      orderNumber: true,
      orderDate:   true,
      items:       { select: { productId: true, quantity: true } },
    },
  });
  if (!so) throw new Error("Sales order not found");

  // CANCELLED = voided (stock already restored by voidSalesOrder)
  // LOST = goods gone (stock intentionally not restored)
  // DRAFT = stock never deducted
  const needsReversal = !["DRAFT", "CANCELLED", "LOST"].includes(so.status);

  await prisma.$transaction(async (tx) => {
    if (needsReversal) {
      for (const item of so.items) {
        await applyStockMovement(
          {
            productId:     item.productId,
            type:          StockMovementType.ADJUSTMENT_IN,
            quantity:      Number(item.quantity),
            notes:         `Sale deleted: ${so.orderNumber}`,
            referenceId:   id,
            referenceType: "SalesOrder",
            createdBy:     userId,
          },
          tx as Parameters<typeof applyStockMovement>[1]
        );
      }
    }

    await tx.salesOrder.update({
      where: { id },
      data:  { deletedAt: new Date() },
    });
  }, { timeout: 30000 });

  await writeAuditLog({
    userId,
    action:     "SALES_ORDER_DELETE",
    entityType: "SalesOrder",
    entityId:   id,
    before: { orderNumber: so.orderNumber, status: so.status },
  });

  if (needsReversal) {
    const syncResult = await syncDailyLogSoldQty(
      so.items.map((i) => ({ productId: i.productId, quantity: Number(i.quantity) })),
      -1,
      so.orderDate,
    );
    if (!syncResult.ok) {
      console.warn("[sales] deleteSalesOrder: failed to sync daily log soldQty:", syncResult.warning);
    }
  }

  revalidatePath("/sales");
  revalidatePath("/sales/salesmen");
  revalidatePath("/inventory");
  revalidatePath("/daily-log");
}

// ─── Salesman Payments ────────────────────────

export async function recordSalesmanPayment(soId: string, values: SalesmanPaymentValues) {
  const userId = await requireSalesAccess();
  const data = salesmanPaymentSchema.parse(values);

  const so = await prisma.salesOrder.findUnique({
    where: { id: soId },
    select: { customerId: true, status: true },
  });
  if (!so) throw new Error("Sales order not found");
  if (so.status === "DRAFT")     throw new Error("Confirm the order before recording a payment");
  if (so.status === "CANCELLED") throw new Error("Cannot record payment for a voided order");
  if (so.status === "LOST")      throw new Error("Cannot record payment for an order marked as lost");

  await prisma.$transaction(async (tx) => {
    const current = await tx.salesOrder.findUnique({
      where: { id: soId },
      select: { factoryAmount: true, amountPaid: true },
    });
    if (!current) throw new Error("Sales order not found");

    // Validate against the salesman's TOTAL outstanding (not just this order)
    const salesman = await tx.salesman.findUnique({
      where: { id: so.customerId },
      select: {
        openingBalance: true,
        salesOrders: {
          where: { deletedAt: null, status: { notIn: ["CANCELLED", "DRAFT", "LOST"] } },
          select: { factoryAmount: true, amountPaid: true },
        },
      },
    });
    const salesmanTotalOutstanding =
      Number(salesman?.openingBalance ?? 0) +
      (salesman?.salesOrders ?? []).reduce(
        (sum, o) => sum + Number(o.factoryAmount) - Number(o.amountPaid),
        0
      );

    if (data.amount > salesmanTotalOutstanding + 0.001) {
      throw new Error(
        `Payment of Rs ${data.amount.toFixed(2)} exceeds the total outstanding balance of Rs ${salesmanTotalOutstanding.toFixed(2)}`
      );
    }

    const factoryDue = Number(current.factoryAmount);
    const newPaid    = Number(current.amountPaid) + data.amount;
    const newStatus  = newPaid >= factoryDue - 0.001 ? "PAID" : "PARTIALLY_PAID";

    const [y, m, d] = data.paidAt.split("-").map(Number);
    const paidAtDate = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));

    await tx.salesmanPayment.create({
      data: {
        salesOrderId: soId,
        customerId:   so.customerId,
        amount:       data.amount,
        method:       data.method,
        paidAt:       paidAtDate,
        reference:    data.reference || null,
        notes:        data.notes || null,
        createdBy:    userId,
      },
    });

    await tx.salesOrder.update({
      where: { id: soId },
      data: {
        amountPaid: { increment: data.amount },
        status:     newStatus,
      },
    });
  });

  revalidatePath(`/sales/${soId}`);
  revalidatePath("/sales");
  revalidatePath("/sales/salesmen");
}

export async function updateSalesmanPayment(paymentId: string, values: SalesmanPaymentValues) {
  const userId = await requireSalesAccess();
  const data = salesmanPaymentSchema.parse(values);

  const payment = await prisma.salesmanPayment.findUnique({
    where: { id: paymentId },
    select: { salesOrderId: true, customerId: true },
  });
  if (!payment) throw new Error("Payment not found");

  const [y, m, d] = data.paidAt.split("-").map(Number);
  const paidAtDate = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));

  await prisma.$transaction(async (tx) => {
    await tx.salesmanPayment.update({
      where: { id: paymentId },
      data: {
        amount:    data.amount,
        method:    data.method,
        paidAt:    paidAtDate,
        reference: data.reference || null,
        notes:     data.notes || null,
      },
    });

    // Recompute amountPaid from all payments for this order (no floating-point drift)
    const allPayments = await tx.salesmanPayment.findMany({
      where:  { salesOrderId: payment.salesOrderId },
      select: { amount: true },
    });
    const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    const so = await tx.salesOrder.findUnique({
      where:  { id: payment.salesOrderId },
      select: { factoryAmount: true },
    });
    const factoryDue = Number(so?.factoryAmount ?? 0);
    const newStatus  = totalPaid >= factoryDue - 0.001 ? "PAID" : totalPaid > 0 ? "PARTIALLY_PAID" : "CONFIRMED";

    await tx.salesOrder.update({
      where: { id: payment.salesOrderId },
      data:  { amountPaid: totalPaid, status: newStatus },
    });
  });

  await writeAuditLog({
    userId,
    action:     "PAYMENT_EDIT",
    entityType: "SalesmanPayment",
    entityId:   paymentId,
    after: { amount: data.amount, method: data.method, paidAt: paidAtDate.toISOString() },
  });

  revalidatePath(`/sales/${payment.salesOrderId}`);
  revalidatePath("/sales");
  revalidatePath("/sales/salesmen");
  revalidatePath("/salesmen/ledger");
  revalidatePath("/cash-flow");
}

export async function deleteSalesmanPayment(paymentId: string): Promise<void> {
  const userId = await requireSalesAccess();

  const payment = await prisma.salesmanPayment.findUnique({
    where:  { id: paymentId },
    select: { salesOrderId: true, customerId: true, amount: true, paidAt: true },
  });
  if (!payment) throw new Error("Payment not found.");

  await prisma.$transaction(async (tx) => {
    await tx.salesmanPayment.delete({ where: { id: paymentId } });

    // Recompute amountPaid from remaining payments to avoid drift
    const remaining = await tx.salesmanPayment.findMany({
      where:  { salesOrderId: payment.salesOrderId },
      select: { amount: true },
    });
    const totalPaid = remaining.reduce((s, p) => s + Number(p.amount), 0);

    const so = await tx.salesOrder.findUnique({
      where:  { id: payment.salesOrderId },
      select: { factoryAmount: true },
    });
    const factoryDue = Number(so?.factoryAmount ?? 0);
    const newStatus  =
      totalPaid >= factoryDue - 0.001 ? "PAID" :
      totalPaid > 0                   ? "PARTIALLY_PAID" : "CONFIRMED";

    await tx.salesOrder.update({
      where: { id: payment.salesOrderId },
      data:  { amountPaid: totalPaid, status: newStatus },
    });
  });

  await writeAuditLog({
    userId,
    action:     "PAYMENT_DELETE",
    entityType: "SalesmanPayment",
    entityId:   paymentId,
    before:     { amount: Number(payment.amount), paidAt: payment.paidAt.toISOString() },
  });

  revalidatePath(`/sales/${payment.salesOrderId}`);
  revalidatePath("/sales");
  revalidatePath("/sales/salesmen");
  revalidatePath("/salesmen/ledger");
  revalidatePath("/cash-flow");
}

// ─── Sales Returns ────────────────────────────

export async function processSalesReturn(soId: string, values: SalesReturnValues) {
  const userId = await requireSalesAccess();
  const data = salesReturnSchema.parse(values);

  const so = await prisma.salesOrder.findUnique({
    where: { id: soId },
    select: {
      status:        true,
      orderNumber:   true,
      orderDate:     true,
      totalAmount:   true,
      commissionPct: true,
      items: {
        select: {
          productId: true,
          quantity:  true,
          product:   { select: { name: true } },
        },
      },
      returns: {
        select: {
          totalAmount: true,
          items: { select: { productId: true, quantity: true } },
        },
      },
    },
  });
  if (!so) throw new Error("Sales order not found");
  if (so.status === "DRAFT" || so.status === "CANCELLED" || so.status === "LOST") {
    throw new Error("Cannot process a return for a draft, voided, or lost order");
  }


  const returnTotal   = data.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  const prevWaste        = so.returns.reduce((sum, r) => sum + Number(r.totalAmount), 0);
  const netAmount        = Number(so.totalAmount) - prevWaste - returnTotal;
  const commissionPct    = Number(so.commissionPct);
  const commissionAmount = Math.round(netAmount * commissionPct) / 100;
  const factoryAmount    = netAmount - commissionAmount;

  let returnNumber = "";

  await prisma.$transaction(async (tx) => {
    returnNumber = await generateReturnNumber(tx as Db);
    await tx.salesReturn.create({
      data: {
        returnNumber,
        salesOrderId: soId,
        notes:        data.notes || null,
        returnType:   data.returnType,
        totalAmount:  returnTotal,
        createdBy:    userId,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity:  item.quantity,
            unitPrice: item.unitPrice,
          })),
        },
      },
    });

    await tx.salesOrder.update({
      where: { id: soId },
      data: { commissionAmount, factoryAmount },
    });

    if (data.returnType === "FRESH") {
      for (const item of data.items) {
        await applyStockMovement(
          {
            productId:     item.productId,
            type:          StockMovementType.RETURN_IN,
            quantity:      item.quantity,
            unitCost:      item.unitPrice,
            notes:         `Fresh return via ${so.orderNumber}`,
            referenceId:   soId,
            referenceType: "SalesReturn",
            createdBy:     userId,
          },
          tx as Parameters<typeof applyStockMovement>[1]
        );
      }
    }
  });

  await writeAuditLog({
    userId,
    action:     "SALES_RETURN_CREATE",
    entityType: "SalesReturn",
    entityId:   soId,
    after: {
      returnNumber,
      returnType: data.returnType,
      items:      data.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      orderDate:  so.orderDate.toISOString(),
    },
  });

  revalidatePath(`/sales/${soId}`);
  revalidatePath("/sales");
  revalidatePath("/inventory");
}

export async function updateSalesReturn(
  returnId: string,
  data: {
    items: { productId: string; quantity: number; unitPrice: number }[];
    notes?: string;
  }
) {
  const userId = await requireSalesAccess();

  const items = data.items.filter((i) => i.productId && i.quantity > 0 && i.unitPrice >= 0);
  if (!items.length) throw new Error("At least one item is required");

  const existing = await prisma.salesReturn.findUnique({
    where: { id: returnId },
    include: {
      items: true,
      salesOrder: {
        select: {
          id: true, orderNumber: true, totalAmount: true,
          commissionPct: true, status: true,
        },
      },
    },
  });
  if (!existing) throw new Error("Return not found");

  const order = existing.salesOrder;
  if (!order) throw new Error("Associated order not found");
  if (["DRAFT", "CANCELLED", "LOST"].includes(order.status)) {
    throw new Error("Cannot edit a return on a cancelled or voided order");
  }

  const newTotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  const otherReturns = await prisma.salesReturn.findMany({
    where: { salesOrderId: order.id, id: { not: returnId } },
    select: { totalAmount: true },
  });
  const otherReturnsTotal = otherReturns.reduce((s, r) => s + Number(r.totalAmount), 0);

  const netAmount        = Number(order.totalAmount) - otherReturnsTotal - newTotal;
  const commissionPct    = Number(order.commissionPct);
  const commissionAmount = Math.round(netAmount * commissionPct) / 100;
  const factoryAmount    = netAmount - commissionAmount;

  const oldTotal = Number(existing.totalAmount);

  await prisma.$transaction(async (tx) => {
    if (existing.returnType === "FRESH") {
      // Reverse old RETURN_IN movements (use RETURN_OUT to decrease stock back)
      for (const oldItem of existing.items) {
        await applyStockMovement(
          {
            productId:      oldItem.productId,
            type:           StockMovementType.RETURN_OUT,
            quantity:       Number(oldItem.quantity),
            notes:          `Edit: reversing ${existing.returnNumber}`,
            referenceId:    order.id,
            referenceType:  "SalesReturn",
            createdBy:      userId,
            isAdminOverride: true,
          },
          tx as Parameters<typeof applyStockMovement>[1]
        );
      }
      // Apply new RETURN_IN movements
      for (const item of items) {
        await applyStockMovement(
          {
            productId:     item.productId,
            type:          StockMovementType.RETURN_IN,
            quantity:      item.quantity,
            unitCost:      item.unitPrice,
            notes:         `Edited return via ${order.orderNumber}`,
            referenceId:   order.id,
            referenceType: "SalesReturn",
            createdBy:     userId,
          },
          tx as Parameters<typeof applyStockMovement>[1]
        );
      }
    }

    // Replace items and update total/notes
    await tx.salesReturnItem.deleteMany({ where: { salesReturnId: returnId } });
    await tx.salesReturn.update({
      where: { id: returnId },
      data: {
        totalAmount: newTotal,
        notes: data.notes?.trim() || null,
        items: {
          createMany: {
            data: items.map((i) => ({
              productId: i.productId,
              quantity:  i.quantity,
              unitPrice: i.unitPrice,
            })),
          },
        },
      },
    });

    await tx.salesOrder.update({
      where: { id: order.id },
      data: { commissionAmount, factoryAmount },
    });
  });

  await writeAuditLog({
    userId,
    action:     "SALES_RETURN_EDIT",
    entityType: "SalesReturn",
    entityId:   returnId,
    before: { totalAmount: oldTotal, itemCount: existing.items.length },
    after:  { totalAmount: newTotal, itemCount: items.length },
  });

  revalidatePath(`/sales/${order.id}`);
  revalidatePath("/sales");
  revalidatePath("/inventory");
  revalidatePath("/salesmen/ledger");
}
