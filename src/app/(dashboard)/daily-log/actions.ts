"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { StockMovementType, Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";

async function requireDailyLogAccess() {
  const user = await currentUser();
  if (!user) throw new Error("Unauthenticated");
  const role = user.publicMetadata?.role as string | undefined;
  if (!role || !["superadmin", "admin", "manager", "accountant"].includes(role)) {
    throw new Error("Unauthorized");
  }
  return { userId: user.id, role };
}

/** Parse a YYYY-MM-DD string into a UTC midnight Date (avoids timezone drift) */
function parseDateParam(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

/** Returns today's date as YYYY-MM-DD in Nepal time (UTC+5:45) */
export async function getTodayString(): Promise<string> {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kathmandu" });
}

// ─────────────────────────────────────────────
// FETCH
// ─────────────────────────────────────────────

export type DailyLogStatus = "OPEN" | "CLOSED" | "REOPENED" | "AUTO_ADJUSTED";

export type DailyLogRow = {
  id: string;
  logDate: string;        // YYYY-MM-DD
  status: DailyLogStatus;
  notes: string | null;
  createdAt: string;
  closedAt: string | null;
  closedBy: string | null;
  openingOutdated: boolean; // true when ≥1 product's openingQty doesn't match prev log's closingQty
  items: DailyLogItemRow[];
};

export type DailyLogItemRow = {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  categoryId: string;
  categoryName: string;
  unitName: string;
  openingQty: number;
  purchasedQty: number;    // computed from PurchaseLineItem, not stored
  producedQty: number;
  usedQty: number;
  soldQty: number;
  freshReturnQty: number;  // computed from FRESH SalesReturn records
  wasteReturnQty: number;  // computed from WASTE SalesReturn records (informational, not deducted)
  wasteQty: number;
  damagedQty: number;
  closingQty:   number;
  adjustInQty:  number;  // read-only: summed from StockMovement ADJUSTMENT_IN for this product/date
  adjustOutQty: number;  // read-only: summed from StockMovement ADJUSTMENT_OUT for this product/date
  notes: string | null;
  // opening + purchased + produced + freshReturn + adjustIn - used - sold - waste - damaged - adjustOut - closing
  // Should be 0; non-zero means the stored closing is stale vs live figures
  formulaDelta: number;
  // true when this product's openingQty doesn't match the previous log's closingQty
  openingOutdated: boolean;
};

export async function getDailyLog(dateStr: string): Promise<DailyLogRow | null> {
  await requireDailyLogAccess();
  const logDate = parseDateParam(dateStr);
  const nextDay = new Date(logDate.getTime() + 24 * 60 * 60 * 1000);

  const log = await prisma.dailyLog.findUnique({
    where: { logDate },
    include: {
      items: {
        include: {
          product: {
            include: { category: true, unit: true },
          },
        },
        orderBy: [
          { product: { category: { name: "asc" } } },
          { product: { name: "asc" } },
        ],
      },
    },
  });

  if (!log) return null;

  // For OPEN / REOPENED logs, compare each item's openingQty against the previous
  // finalized log's closingQty so we can warn the admin if they are out of sync.
  let prevClosingCheck = new Map<string, number>();
  if (log.status === "OPEN" || log.status === "REOPENED") {
    const prevFinalized = await prisma.dailyLog.findFirst({
      where: {
        logDate: { lt: logDate },
        status:  { in: ["CLOSED", "AUTO_ADJUSTED"] },
      },
      orderBy: { logDate: "desc" },
      include: { items: { select: { productId: true, closingQty: true } } },
    });
    if (prevFinalized) {
      prevClosingCheck = new Map(
        prevFinalized.items.map((i) => [i.productId, Number(i.closingQty)])
      );
    }
  }

  // Get purchases that landed on this date for each product
  const purchaseSums = await prisma.purchaseLineItem.groupBy({
    by: ["productId"],
    where: {
      productId: { not: null },
      purchase: {
        deletedAt: null,
        date: { gte: logDate, lt: nextDay },
      },
    },
    _sum: { quantity: true },
  });

  const purchaseMap = new Map(
    purchaseSums
      .filter((s) => s.productId != null)
      .map((s) => [s.productId!, Number(s._sum.quantity ?? 0)])
  );

  // Always compute soldQty and freshReturnQty live from sales orders by orderDate.
  // This ensures backdated entries and edits are reflected in both open and closed logs.
  const [soldSums, freshReturnSums] = await Promise.all([
    prisma.salesOrderItem.groupBy({
      by: ["productId"],
      where: {
        salesOrder: {
          status:    { in: ["CONFIRMED", "PARTIALLY_PAID", "PAID"] },
          deletedAt: null,
          orderDate: { gte: logDate, lt: nextDay },
        },
      },
      _sum: { quantity: true },
    }),
    prisma.salesReturnItem.groupBy({
      by: ["productId"],
      where: {
        salesReturn: {
          returnType: "FRESH",
          salesOrder: { deletedAt: null, orderDate: { gte: logDate, lt: nextDay } },
        },
      },
      _sum: { quantity: true },
    }),
  ]);
  const confirmedSoldMap = new Map(
    soldSums.map((s) => [s.productId, Number(s._sum.quantity ?? 0)])
  );
  const freshReturnMap = new Map(
    freshReturnSums.map((s) => [s.productId, Number(s._sum.quantity ?? 0)])
  );

  // Always compute wasteReturnQty from WASTE sales returns (read-only, informational)
  const productIds = log.items.map((i) => i.productId);

  const [wasteReturnSums, adjustmentMovements] = await Promise.all([
    prisma.salesReturnItem.groupBy({
      by: ["productId"],
      where: {
        salesReturn: {
          returnType: "WASTE",
          salesOrder: { deletedAt: null, orderDate: { gte: logDate, lt: nextDay } },
        },
      },
      _sum: { quantity: true },
    }),
    // Inventory adjustments for this date — exclude any legacy DailyLog-sourced ones
    prisma.stockMovement.findMany({
      where: {
        productId:     { in: productIds },
        type:          { in: [StockMovementType.ADJUSTMENT_IN, StockMovementType.ADJUSTMENT_OUT] },
        referenceType: null,
        createdAt:     { gte: logDate, lt: nextDay },
      },
      select: { productId: true, type: true, quantity: true },
    }),
  ]);

  const wasteReturnMap = new Map(
    wasteReturnSums.map((s) => [s.productId, Number(s._sum.quantity ?? 0)])
  );

  const adjustInMap  = new Map<string, number>();
  const adjustOutMap = new Map<string, number>();
  for (const mv of adjustmentMovements) {
    const pid = mv.productId;
    const qty = Number(mv.quantity);
    if (mv.type === StockMovementType.ADJUSTMENT_IN) {
      adjustInMap.set(pid, (adjustInMap.get(pid) ?? 0) + qty);
    } else {
      adjustOutMap.set(pid, (adjustOutMap.get(pid) ?? 0) + qty);
    }
  }

  const items: DailyLogItemRow[] = log.items.map((item) => {
    const opening      = Number(item.openingQty);
    const purchased    = purchaseMap.get(item.productId) ?? 0;
    const produced     = Number(item.producedQty);
    const used         = Number(item.usedQty);
    const confirmedSold  = confirmedSoldMap.get(item.productId) ?? 0;
    const storedSold     = Number(item.soldQty);
    const sold           = storedSold > confirmedSold ? storedSold : confirmedSold;
    const confirmedFresh = freshReturnMap.get(item.productId) ?? 0;
    const storedFresh    = Number(item.freshReturnQty);
    const freshReturn    = storedFresh > confirmedFresh ? storedFresh : confirmedFresh;
    const wasteReturn  = wasteReturnMap.get(item.productId) ?? 0;
    const waste        = Number(item.wasteQty);
    const damaged      = Number(item.damagedQty);
    const closing      = Number(item.closingQty);
    const adjustIn     = adjustInMap.get(item.productId) ?? 0;
    const adjustOut    = adjustOutMap.get(item.productId) ?? 0;

    // Positive delta = formula says closing should be higher than stored (data was added after close)
    // Negative delta = formula says closing should be lower (data was removed after close)
    const formulaDelta = (opening + purchased + produced + freshReturn + adjustIn - used - sold - waste - damaged - adjustOut) - closing;

    const prevClosing     = prevClosingCheck.get(item.productId);
    const openingOutdated = prevClosing !== undefined && Math.abs(prevClosing - opening) > 0.001;

    return {
      id: item.id,
      productId: item.productId,
      productName: item.product.name,
      productSku: item.product.sku,
      categoryId: item.product.categoryId,
      categoryName: item.product.category.name,
      unitName: item.product.unit.name,
      openingQty: opening,
      purchasedQty: purchased,
      producedQty: produced,
      usedQty: used,
      soldQty: sold,
      freshReturnQty: freshReturn,
      wasteReturnQty: wasteReturn,
      wasteQty: waste,
      damagedQty: damaged,
      closingQty:   closing,
      adjustInQty:  adjustIn,
      adjustOutQty: adjustOut,
      notes: item.notes,
      formulaDelta: Math.round(formulaDelta * 1000) / 1000,
      openingOutdated,
    };
  });

  const openingOutdated = items.some((i) => i.openingOutdated);

  return {
    id: log.id,
    logDate: dateStr,
    status: log.status as DailyLogStatus,
    notes: log.notes,
    createdAt: log.createdAt.toISOString(),
    closedAt: log.closedAt?.toISOString() ?? null,
    closedBy: log.closedBy,
    openingOutdated,
    items,
  };
}

// ─────────────────────────────────────────────
// START DAY
// ─────────────────────────────────────────────

export async function startDailyLog(dateStr: string): Promise<{ id: string }> {
  const { userId } = await requireDailyLogAccess();
  const logDate = parseDateParam(dateStr);

  // Prevent duplicate
  const existing = await prisma.dailyLog.findUnique({ where: { logDate } });
  if (existing) throw new Error("A log already exists for this date");

  // Find the most recent log before this date to check its status.
  const mostRecentPrior = await prisma.dailyLog.findFirst({
    where: { logDate: { lt: logDate } },
    orderBy: { logDate: "desc" },
    select: { status: true, logDate: true },
  });

  // OPEN = data is still being entered; block until it is closed.
  if (mostRecentPrior?.status === "OPEN") {
    const d = mostRecentPrior.logDate.toISOString().slice(0, 10);
    throw new Error(
      `Daily log for ${d} is still open — close it first. Opening quantities for the new day come from that day's closing figures.`
    );
  }

  // REOPENED = admin is re-editing; its closing figures may still change.
  // Skip it and use the most recent CLOSED / AUTO_ADJUSTED log's closing instead.
  // When the REOPENED log is eventually re-closed, closeDailyLog will push its
  // corrected closing into this new log's opening automatically.
  const prevLog = await prisma.dailyLog.findFirst({
    where: { logDate: { lt: logDate }, status: { in: ["CLOSED", "AUTO_ADJUSTED"] } },
    orderBy: { logDate: "desc" },
    include: { items: { select: { productId: true, closingQty: true } } },
  });

  // prevLog is CLOSED / AUTO_ADJUSTED (or null = first ever log): use its closing quantities.
  const prevClosingMap = new Map<string, number>(
    prevLog?.items.map((i) => [i.productId, Number(i.closingQty)]) ?? []
  );

  // Get all active products (for currentStock fallback on new products)
  const products = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, currentStock: true },
    orderBy: [{ categoryId: "asc" }, { name: "asc" }],
  });

  const log = await prisma.dailyLog.create({
    data: {
      logDate,
      status: "OPEN",
      createdBy: userId,
      items: {
        create: products.map((p) => ({
          productId: p.id,
          openingQty: prevClosingMap.has(p.id)
            ? prevClosingMap.get(p.id)!
            : Number(p.currentStock),
        })),
      },
    },
  });

  // Backfill soldQty and freshReturnQty from any activity recorded before the log was opened
  const nextDay = new Date(logDate.getTime() + 24 * 60 * 60 * 1000);
  const [soldItems, freshReturnItems] = await Promise.all([
    prisma.salesOrderItem.findMany({
      where: {
        salesOrder: {
          status:    { in: ["CONFIRMED", "PARTIALLY_PAID", "PAID"] },
          deletedAt: null,
          orderDate: { gte: logDate, lt: nextDay },
        },
      },
      select: { productId: true, quantity: true },
    }),
    prisma.salesReturnItem.findMany({
      where: {
        salesReturn: {
          returnType: "FRESH",
          salesOrder: { deletedAt: null, orderDate: { gte: logDate, lt: nextDay } },
        },
      },
      select: { productId: true, quantity: true },
    }),
  ]);
  const soldByProduct = new Map<string, number>();
  for (const si of soldItems) {
    soldByProduct.set(si.productId, (soldByProduct.get(si.productId) ?? 0) + Number(si.quantity));
  }
  const freshByProduct = new Map<string, number>();
  for (const ri of freshReturnItems) {
    freshByProduct.set(ri.productId, (freshByProduct.get(ri.productId) ?? 0) + Number(ri.quantity));
  }
  for (const [productId, qty] of soldByProduct) {
    await prisma.dailyLogItem.updateMany({
      where: { dailyLogId: log.id, productId },
      data:  { soldQty: qty },
    });
  }
  for (const [productId, qty] of freshByProduct) {
    await prisma.dailyLogItem.updateMany({
      where: { dailyLogId: log.id, productId },
      data:  { freshReturnQty: qty },
    });
  }

  revalidatePath("/daily-log");
  return { id: log.id };
}

// ─────────────────────────────────────────────
// DISCARD (delete an accidentally-started OPEN log)
// ─────────────────────────────────────────────

export async function discardDailyLog(logId: string): Promise<void> {
  const { userId } = await requireDailyLogAccess();

  const log = await prisma.dailyLog.findUnique({
    where: { id: logId },
    select: { status: true, logDate: true },
  });
  if (!log) throw new Error("Log not found");
  if (log.status !== "OPEN") {
    throw new Error("Only freshly-started (OPEN) logs can be discarded. Reopen then discard if needed.");
  }

  // OPEN logs have no stock movements — safe to hard-delete
  await prisma.$transaction([
    prisma.dailyLogItem.deleteMany({ where: { dailyLogId: logId } }),
    prisma.dailyLog.delete({ where: { id: logId } }),
  ]);

  await writeAuditLog({
    userId,
    action:     "DAILY_LOG_DISCARD",
    entityType: "DailyLog",
    entityId:   logId,
    after: { date: log.logDate.toISOString().slice(0, 10) },
  });

  revalidatePath("/daily-log");
  revalidatePath("/daily-log/history");
}

// ─────────────────────────────────────────────
// SYNC MISSING PRODUCTS INTO AN OPEN LOG
// ─────────────────────────────────────────────

export async function syncMissingProducts(logId: string): Promise<{ added: number }> {
  await requireDailyLogAccess();

  const log = await prisma.dailyLog.findUnique({
    where: { id: logId },
    select: { status: true, items: { select: { productId: true } } },
  });
  if (!log) throw new Error("Log not found");
  if (log.status !== "OPEN" && log.status !== "REOPENED") {
    throw new Error("Can only sync products on an open log");
  }

  const existingProductIds = new Set(log.items.map((i) => i.productId));

  const missingProducts = await prisma.product.findMany({
    where: { deletedAt: null, id: { notIn: [...existingProductIds] } },
    select: { id: true, currentStock: true },
  });

  if (missingProducts.length === 0) return { added: 0 };

  await prisma.dailyLogItem.createMany({
    data: missingProducts.map((p) => ({
      dailyLogId: logId,
      productId:  p.id,
      openingQty: Number(p.currentStock),
    })),
  });

  revalidatePath("/daily-log");
  return { added: missingProducts.length };
}

// ─────────────────────────────────────────────
// UPDATE ITEM (auto-save on blur)
// ─────────────────────────────────────────────

export type UpdateItemValues = {
  producedQty:    number;
  usedQty:        number;
  soldQty:        number;
  freshReturnQty: number;
  wasteQty:       number;
  damagedQty:     number;
  notes:          string | null;
};

export async function updateDailyLogItem(
  itemId: string,
  values: UpdateItemValues
): Promise<void> {
  await requireDailyLogAccess();

  const item = await prisma.dailyLogItem.findUnique({
    where: { id: itemId },
    select: { dailyLog: { select: { status: true } } },
  });
  if (!item) throw new Error("Item not found");

  const numericFields: (keyof UpdateItemValues)[] = ["producedQty", "usedQty", "soldQty", "freshReturnQty", "wasteQty", "damagedQty"];
  for (const f of numericFields) {
    const v = values[f] as number;
    if (typeof v === "number" && v < 0) throw new Error(`${f} cannot be negative`);
  }

  // CLOSED and AUTO_ADJUSTED logs are locked; OPEN and REOPENED allow edits
  const { status } = item.dailyLog;
  if (status === "CLOSED") throw new Error("Log is closed");
  if (status === "AUTO_ADJUSTED") throw new Error("Log was auto-adjusted. Reopen it before editing.");

  await prisma.dailyLogItem.update({
    where: { id: itemId },
    data: {
      producedQty:    values.producedQty,
      usedQty:        values.usedQty,
      soldQty:        values.soldQty,
      freshReturnQty: values.freshReturnQty,
      wasteQty:       values.wasteQty,
      damagedQty:     values.damagedQty,
      notes:          values.notes,
    },
  });
  // No revalidatePath here — client manages its own state for speed
}

// ─────────────────────────────────────────────
// CLOSE DAY
// ─────────────────────────────────────────────

export async function closeDailyLog(logId: string): Promise<void> {
  const { userId } = await requireDailyLogAccess();

  const log = await prisma.dailyLog.findUnique({
    where: { id: logId },
    include: {
      items: {
        include: { product: { select: { name: true } } },
      },
    },
  });

  if (!log) throw new Error("Log not found");
  if (log.status === "CLOSED") throw new Error("Log is already closed");
  if (log.status === "AUTO_ADJUSTED") {
    throw new Error("Log was auto-adjusted. Reopen it before closing again to avoid duplicate stock movements.");
  }

  // Determine purchased quantities on this day
  const logDate = log.logDate;
  const nextDay = new Date(logDate.getTime() + 24 * 60 * 60 * 1000);
  const dateLabel = logDate.toISOString().slice(0, 10);

  const purchaseSums = await prisma.purchaseLineItem.groupBy({
    by: ["productId"],
    where: {
      productId: { not: null },
      purchase: {
        deletedAt: null,
        date: { gte: logDate, lt: nextDay },
      },
    },
    _sum: { quantity: true },
  });
  const purchaseMap = new Map(
    purchaseSums
      .filter((s) => s.productId != null)
      .map((s) => [s.productId!, Number(s._sum.quantity ?? 0)])
  );

  const productIds = log.items.map((i) => i.productId);
  const ref = { referenceId: log.id, referenceType: "DailyLog" };

  // Read inventory adjustments for this day BEFORE the transaction (read-only, no race risk)
  // referenceType: null → only movements created from the Inventory section (no referenceType set)
  const adjMovements = await prisma.stockMovement.findMany({
    where: {
      productId:     { in: productIds },
      type:          { in: [StockMovementType.ADJUSTMENT_IN, StockMovementType.ADJUSTMENT_OUT] },
      referenceType: null,
      createdAt:     { gte: logDate, lt: nextDay },
    },
    select: { productId: true, type: true, quantity: true },
  });
  const adjInMap  = new Map<string, number>();
  const adjOutMap = new Map<string, number>();
  for (const mv of adjMovements) {
    const qty = Number(mv.quantity);
    if (mv.type === StockMovementType.ADJUSTMENT_IN) {
      adjInMap.set(mv.productId, (adjInMap.get(mv.productId) ?? 0) + qty);
    } else {
      adjOutMap.set(mv.productId, (adjOutMap.get(mv.productId) ?? 0) + qty);
    }
  }

  type PendingMovement = {
    productId: string;
    type: StockMovementType;
    quantity: number;
    quantityBefore: number;
    quantityAfter: number;
    notes: string;
  };

  // ── All reads and all writes happen inside ONE RepeatableRead transaction ──
  // Moving the stock snapshot inside the transaction prevents a race condition
  // where a concurrent SALE between snapshot and commit would corrupt stock values.
  const pendingMovements: PendingMovement[] = [];
  const itemUpdates: Array<{
    id:            string;
    productId:     string;
    closingQty:    number;
    soldQty:       number;
    freshReturnQty: number;
  }> = [];

  await prisma.$transaction(
    async (tx) => {
      // Read stock snapshot INSIDE the transaction with RepeatableRead isolation.
      // No concurrent SALE can sneak between this read and the writes below.
      const stockSnapshot = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, currentStock: true },
      });
      const stockMap = new Map(stockSnapshot.map((p) => [p.id, Number(p.currentStock)]));

      // Sync soldQty and freshReturnQty live so closing qty matches what was shown to the user
      const [confirmedSoldSums, confirmedFreshSums] = await Promise.all([
        tx.salesOrderItem.groupBy({
          by: ["productId"],
          where: {
            salesOrder: {
              status:    { in: ["CONFIRMED", "PARTIALLY_PAID", "PAID"] },
              deletedAt: null,
              orderDate: { gte: logDate, lt: nextDay },
            },
          },
          _sum: { quantity: true },
        }),
        tx.salesReturnItem.groupBy({
          by: ["productId"],
          where: {
            salesReturn: {
              returnType: "FRESH",
              salesOrder: { deletedAt: null, orderDate: { gte: logDate, lt: nextDay } },
            },
          },
          _sum: { quantity: true },
        }),
      ]);
      const confirmedSoldMap  = new Map(confirmedSoldSums.map((s) => [s.productId, Number(s._sum.quantity ?? 0)]));
      const confirmedFreshMap = new Map(confirmedFreshSums.map((s) => [s.productId, Number(s._sum.quantity ?? 0)]));

      for (const item of log.items) {
        const opening    = Number(item.openingQty);
        const purchased  = purchaseMap.get(item.productId) ?? 0;
        const produced   = Number(item.producedQty);
        const used       = Number(item.usedQty);
        // Use confirmed sales qty; fall back to stored soldQty if user manually overrode it higher
        const confirmedSold  = confirmedSoldMap.get(item.productId) ?? 0;
        const storedSold     = Number(item.soldQty);
        const sold           = storedSold > confirmedSold ? storedSold : confirmedSold;
        const storedFresh    = Number(item.freshReturnQty);
        const confirmedFresh = confirmedFreshMap.get(item.productId) ?? 0;
        const freshReturn    = storedFresh > confirmedFresh ? storedFresh : confirmedFresh;
        const waste          = Number(item.wasteQty);
        const damaged        = Number(item.damagedQty);

        const adjustIn  = adjInMap.get(item.productId)  ?? 0;
        const adjustOut = adjOutMap.get(item.productId) ?? 0;
        const closing   = opening + purchased + produced + freshReturn + adjustIn - used - sold - waste - damaged - adjustOut;

        if (closing < -0.001) {
          throw new Error(
            `Cannot close: "${item.product.name}" would have a negative closing quantity (${closing.toFixed(3)}). ` +
            `Check waste, sold, or used quantities.`
          );
        }

        const pid = item.productId;
        const addMovement = (type: StockMovementType, qty: number, label: string) => {
          if (qty <= 0) return;
          const before = stockMap.get(pid) ?? 0;
          const isOut  = type === StockMovementType.DAILY_OUT;
          const after  = isOut ? before - qty : before + qty;
          stockMap.set(pid, after);
          pendingMovements.push({ productId: pid, type, quantity: qty, quantityBefore: before, quantityAfter: after, notes: `Daily log ${dateLabel} — ${label}` });
        };

        addMovement(StockMovementType.DAILY_IN,  produced, "produced");
        addMovement(StockMovementType.DAILY_OUT, used,     "used");
        // soldQty comes from confirmed SALE movements — skipping DAILY_OUT for sold prevents double-deduction
        addMovement(StockMovementType.DAILY_OUT, waste,    "waste");
        addMovement(StockMovementType.DAILY_OUT, damaged,  "damaged");
        // Inventory adjustments are NOT replicated here — they already exist as StockMovements
        // created from the Inventory section. The closing formula uses them read-only above.

        itemUpdates.push({ id: item.id, productId: item.productId, closingQty: closing, soldQty: sold, freshReturnQty: freshReturn });
      }

      // Batch-create all stock movements
      if (pendingMovements.length > 0) {
        await tx.stockMovement.createMany({
          data: pendingMovements.map((m) => ({
            productId:       m.productId,
            type:            m.type,
            quantity:        m.quantity,
            quantityBefore:  m.quantityBefore,
            quantityAfter:   m.quantityAfter,
            notes:           m.notes,
            referenceId:     ref.referenceId,
            referenceType:   ref.referenceType,
            isAdminOverride: true,
            createdBy:       userId,
          })),
        });
      }

      // Update each product's currentStock
      for (const [productId, newStock] of stockMap.entries()) {
        await tx.product.update({
          where: { id: productId },
          data: { currentStock: newStock },
        });
      }

      // Update daily log items (store the live soldQty/freshReturnQty used for closing)
      for (const upd of itemUpdates) {
        await tx.dailyLogItem.update({
          where: { id: upd.id },
          data: {
            soldQty:        upd.soldQty,
            freshReturnQty: upd.freshReturnQty,
            closingQty:     upd.closingQty,
          },
        });
      }

      // Mark log as closed
      await tx.dailyLog.update({
        where: { id: log.id },
        data: { status: "CLOSED", closedBy: userId, closedAt: new Date() },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 30000,
    }
  );

  await writeAuditLog({
    userId,
    action:     "DAILY_LOG_CLOSE",
    entityType: "DailyLog",
    entityId:   logId,
    after: {
      date:      dateLabel,
      itemCount: log.items.length,
    },
  });

  // Propagate today's closing quantities into the immediate next OPEN/REOPENED log.
  // Only one log, one step — no cascade beyond that.
  const immediateNextLog = await prisma.dailyLog.findFirst({
    where:   { logDate: { gt: logDate } },
    orderBy: { logDate: "asc" },
    select:  { id: true, status: true },
  });
  if (immediateNextLog && (immediateNextLog.status === "OPEN" || immediateNextLog.status === "REOPENED")) {
    await prisma.$transaction(
      itemUpdates.map((upd) =>
        prisma.dailyLogItem.updateMany({
          where: { dailyLogId: immediateNextLog.id, productId: upd.productId },
          data:  { openingQty: upd.closingQty },
        })
      )
    );
  }

  revalidatePath("/daily-log");
  revalidatePath("/daily-log/history");
  revalidatePath("/inventory");
  revalidatePath("/inventory/stock-levels");
}

// ─────────────────────────────────────────────
// REOPEN DAY (admin only)
// ─────────────────────────────────────────────

export async function reopenDailyLog(logId: string): Promise<void> {
  const { userId, role } = await requireDailyLogAccess();
  if (role !== "admin" && role !== "superadmin") throw new Error("Only admins can reopen a closed log");

  const log = await prisma.dailyLog.findUnique({
    where: { id: logId },
    select: { status: true, logDate: true },
  });
  if (!log) throw new Error("Log not found");
  if (log.status !== "CLOSED" && log.status !== "AUTO_ADJUSTED") {
    throw new Error("Only CLOSED or AUTO_ADJUSTED logs can be reopened");
  }

  const dateLabel = log.logDate.toISOString().slice(0, 10);

  // Load ALL movements ever created for this log (close + any previous reopen reversals)
  // so we can compute the true net stock impact and issue a single correct reversal.
  // Using referenceType IN ["DailyLog", "DailyLogReopen"] prevents exponential corruption
  // where each reopen reverses prior reversals as well as the original movements.
  const allMovements = await prisma.stockMovement.findMany({
    where: {
      referenceId:   logId,
      referenceType: { in: ["DailyLog", "DailyLogReopen"] },
      type:          { in: [StockMovementType.DAILY_IN, StockMovementType.DAILY_OUT] },
    },
    select: { productId: true, type: true, quantity: true },
  });

  // Net stock change per product: DAILY_IN adds, DAILY_OUT subtracts
  const netMap = new Map<string, number>();
  for (const mv of allMovements) {
    const qty = Number(mv.quantity);
    const delta = mv.type === StockMovementType.DAILY_IN ? qty : -qty;
    netMap.set(mv.productId, (netMap.get(mv.productId) ?? 0) + delta);
  }
  // Only products with non-zero net need a reversal
  const productsToReverse = [...netMap.entries()].filter(([, net]) => net !== 0);
  const productIds = productsToReverse.map(([id]) => id);

  type PendingMovement = {
    productId: string;
    type: StockMovementType;
    quantity: number;
    quantityBefore: number;
    quantityAfter: number;
    notes: string;
  };

  await prisma.$transaction(
    async (tx) => {
      // Read stock snapshot INSIDE the transaction with RepeatableRead isolation
      const stockSnapshot = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, currentStock: true },
      });
      const stockMap = new Map(stockSnapshot.map((p) => [p.id, Number(p.currentStock)]));

      const pendingMovements: PendingMovement[] = [];

      for (const [productId, net] of productsToReverse) {
        // net > 0 means log added stock overall → reversal removes it (DAILY_OUT)
        // net < 0 means log removed stock overall → reversal adds it (DAILY_IN)
        const reverseType = net > 0 ? StockMovementType.DAILY_OUT : StockMovementType.DAILY_IN;
        const qty    = Math.abs(net);
        const before = stockMap.get(productId) ?? 0;
        const after  = net > 0 ? before - qty : before + qty;
        stockMap.set(productId, after);
        pendingMovements.push({
          productId,
          type:          reverseType,
          quantity:      qty,
          quantityBefore: before,
          quantityAfter:  after,
          notes: `Reopen: net reversal of daily log ${dateLabel}`,
        });
      }

      if (pendingMovements.length > 0) {
        await tx.stockMovement.createMany({
          data: pendingMovements.map((m) => ({
            productId:       m.productId,
            type:            m.type,
            quantity:        m.quantity,
            quantityBefore:  m.quantityBefore,
            quantityAfter:   m.quantityAfter,
            notes:           m.notes,
            referenceId:     logId,
            referenceType:   "DailyLogReopen",
            isAdminOverride: true,
            createdBy:       userId,
          })),
        });
      }

      for (const [productId, newStock] of stockMap.entries()) {
        await tx.product.update({
          where: { id: productId },
          data:  { currentStock: newStock },
        });
      }

      // Reset derived fields; preserve manually-entered data (producedQty, usedQty, wasteQty, adjustInQty, adjustOutQty, etc.)
      await tx.dailyLogItem.updateMany({
        where: { dailyLogId: logId },
        data: {
          soldQty:        0,
          freshReturnQty: 0,
          closingQty:     0,
        },
      });

      // Re-populate soldQty and freshReturnQty from confirmed sales orders
      const nextDay = new Date(log.logDate.getTime() + 24 * 60 * 60 * 1000);
      const [soldItems, freshReturnItems] = await Promise.all([
        tx.salesOrderItem.findMany({
          where: {
            salesOrder: {
              status:    { in: ["CONFIRMED", "PARTIALLY_PAID", "PAID"] },
              deletedAt: null,
              orderDate: { gte: log.logDate, lt: nextDay },
            },
          },
          select: { productId: true, quantity: true },
        }),
        tx.salesReturnItem.findMany({
          where: {
            salesReturn: {
              returnType: "FRESH",
              salesOrder: { deletedAt: null, orderDate: { gte: log.logDate, lt: nextDay } },
            },
          },
          select: { productId: true, quantity: true },
        }),
      ]);
      const soldByProduct  = new Map<string, number>();
      for (const si of soldItems) {
        soldByProduct.set(si.productId, (soldByProduct.get(si.productId) ?? 0) + Number(si.quantity));
      }
      const freshByProduct = new Map<string, number>();
      for (const ri of freshReturnItems) {
        freshByProduct.set(ri.productId, (freshByProduct.get(ri.productId) ?? 0) + Number(ri.quantity));
      }
      for (const [productId, qty] of soldByProduct) {
        await tx.dailyLogItem.updateMany({
          where: { dailyLogId: logId, productId },
          data:  { soldQty: qty },
        });
      }
      for (const [productId, qty] of freshByProduct) {
        await tx.dailyLogItem.updateMany({
          where: { dailyLogId: logId, productId },
          data:  { freshReturnQty: qty },
        });
      }

      // Set status to REOPENED (not OPEN) so history shows it was touched
      await tx.dailyLog.update({
        where: { id: logId },
        data: {
          status:          "REOPENED",
          autoAdjustedAt:  null,
          autoAdjustedBy:  null,
          // preserve closedBy/closedAt for audit trail
        },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 30000,
    }
  );

  await writeAuditLog({
    userId,
    action:     "DAILY_LOG_REOPEN",
    entityType: "DailyLog",
    entityId:   logId,
    after: { date: dateLabel, reopenedBy: userId },
  });

  revalidatePath("/daily-log");
  revalidatePath("/daily-log/history");
  revalidatePath("/inventory");
  revalidatePath("/inventory/stock-levels");
}

// ─────────────────────────────────────────────
// REPAIR CLOSED LOG (admin only)
// ─────────────────────────────────────────────

export type RepairResult = {
  repairedCount: number; // number of items whose closingQty changed
};

/**
 * Recomputes soldQty, freshReturnQty, and closingQty from live source records
 * for a CLOSED or AUTO_ADJUSTED log, without touching any StockMovements.
 * Manual fields (producedQty, usedQty, wasteQty, damagedQty, notes, openingQty) are preserved.
 * Marks the log AUTO_ADJUSTED and propagates the corrected closing to the next OPEN/REOPENED log.
 */
export async function repairDailyLog(logId: string): Promise<RepairResult> {
  const { userId, role } = await requireDailyLogAccess();
  if (role !== "admin" && role !== "superadmin") {
    throw new Error("Only admins can repair a closed log");
  }

  const log = await prisma.dailyLog.findUnique({
    where: { id: logId },
    include: { items: true },
  });
  if (!log) throw new Error("Log not found");
  if (log.status !== "CLOSED" && log.status !== "AUTO_ADJUSTED") {
    throw new Error("Only CLOSED or AUTO_ADJUSTED logs can be repaired");
  }

  const logDate   = log.logDate;
  const nextDay   = new Date(logDate.getTime() + 24 * 60 * 60 * 1000);
  const dateLabel = logDate.toISOString().slice(0, 10);
  const productIds = log.items.map((i) => i.productId);

  // Re-query all live source data (same sources as getDailyLog / closeDailyLog)
  const [soldSums, freshReturnSums, purchaseSums, adjMovements] = await Promise.all([
    prisma.salesOrderItem.groupBy({
      by: ["productId"],
      where: {
        salesOrder: {
          status:    { in: ["CONFIRMED", "PARTIALLY_PAID", "PAID"] },
          deletedAt: null,
          orderDate: { gte: logDate, lt: nextDay },
        },
      },
      _sum: { quantity: true },
    }),
    prisma.salesReturnItem.groupBy({
      by: ["productId"],
      where: {
        salesReturn: {
          returnType: "FRESH",
          salesOrder: { deletedAt: null, orderDate: { gte: logDate, lt: nextDay } },
        },
      },
      _sum: { quantity: true },
    }),
    prisma.purchaseLineItem.groupBy({
      by: ["productId"],
      where: {
        productId: { not: null },
        purchase:  { deletedAt: null, date: { gte: logDate, lt: nextDay } },
      },
      _sum: { quantity: true },
    }),
    prisma.stockMovement.findMany({
      where: {
        productId:     { in: productIds },
        type:          { in: [StockMovementType.ADJUSTMENT_IN, StockMovementType.ADJUSTMENT_OUT] },
        referenceType: null,
        createdAt:     { gte: logDate, lt: nextDay },
      },
      select: { productId: true, type: true, quantity: true },
    }),
  ]);

  const soldMap    = new Map(soldSums.map((s) => [s.productId, Number(s._sum.quantity ?? 0)]));
  const freshMap   = new Map(freshReturnSums.map((s) => [s.productId, Number(s._sum.quantity ?? 0)]));
  const purchaseMap = new Map(
    purchaseSums
      .filter((s) => s.productId != null)
      .map((s) => [s.productId!, Number(s._sum.quantity ?? 0)])
  );
  const adjInMap  = new Map<string, number>();
  const adjOutMap = new Map<string, number>();
  for (const mv of adjMovements) {
    const qty = Number(mv.quantity);
    if (mv.type === StockMovementType.ADJUSTMENT_IN) {
      adjInMap.set(mv.productId,  (adjInMap.get(mv.productId)  ?? 0) + qty);
    } else {
      adjOutMap.set(mv.productId, (adjOutMap.get(mv.productId) ?? 0) + qty);
    }
  }

  // Compute corrected values per item
  type ItemPatch = {
    id:           string;
    productId:    string;
    soldQty:      number;
    freshReturnQty: number;
    closingQty:   number;
    oldClosingQty: number;
    changed:      boolean;
  };

  const patches: ItemPatch[] = log.items.map((item) => {
    const opening    = Number(item.openingQty);
    const produced   = Number(item.producedQty);
    const used       = Number(item.usedQty);
    const waste      = Number(item.wasteQty);
    const damaged    = Number(item.damagedQty);
    const oldClosing = Number(item.closingQty);

    // Mirror closeDailyLog: prefer stored value if manually set higher than live
    const liveSold   = soldMap.get(item.productId) ?? 0;
    const sold       = Number(item.soldQty) > liveSold ? Number(item.soldQty) : liveSold;
    const liveFresh  = freshMap.get(item.productId) ?? 0;
    const freshReturn = Number(item.freshReturnQty) > liveFresh ? Number(item.freshReturnQty) : liveFresh;

    const purchased  = purchaseMap.get(item.productId) ?? 0;
    const adjustIn   = adjInMap.get(item.productId)  ?? 0;
    const adjustOut  = adjOutMap.get(item.productId) ?? 0;

    const newClosing = opening + purchased + produced + freshReturn + adjustIn
                     - used - sold - waste - damaged - adjustOut;

    const changed =
      Math.abs(newClosing - oldClosing)          > 0.0005 ||
      Math.abs(sold - Number(item.soldQty))      > 0.0005 ||
      Math.abs(freshReturn - Number(item.freshReturnQty)) > 0.0005;

    return {
      id:           item.id,
      productId:    item.productId,
      soldQty:      sold,
      freshReturnQty: freshReturn,
      closingQty:   newClosing,
      oldClosingQty: oldClosing,
      changed,
    };
  });

  // Persist: update all items + stamp the log as AUTO_ADJUSTED in one transaction
  await prisma.$transaction([
    ...patches.map((p) =>
      prisma.dailyLogItem.update({
        where: { id: p.id },
        data: {
          soldQty:        p.soldQty,
          freshReturnQty: p.freshReturnQty,
          closingQty:     p.closingQty,
        },
      })
    ),
    prisma.dailyLog.update({
      where: { id: logId },
      data: {
        status:         "AUTO_ADJUSTED",
        autoAdjustedAt: new Date(),
        autoAdjustedBy: userId,
      },
    }),
  ]);

  // Propagate corrected closing to the immediate next OPEN/REOPENED log (one step only)
  const immediateNextLog = await prisma.dailyLog.findFirst({
    where:   { logDate: { gt: logDate } },
    orderBy: { logDate: "asc" },
    select:  { id: true, status: true },
  });
  if (immediateNextLog && (immediateNextLog.status === "OPEN" || immediateNextLog.status === "REOPENED")) {
    await prisma.$transaction(
      patches.map((p) =>
        prisma.dailyLogItem.updateMany({
          where: { dailyLogId: immediateNextLog.id, productId: p.productId },
          data:  { openingQty: p.closingQty },
        })
      )
    );
  }

  const changedPatches = patches.filter((p) => p.changed);

  await writeAuditLog({
    userId,
    action:     "DAILY_LOG_REPAIR",
    entityType: "DailyLog",
    entityId:   logId,
    after: {
      date:            dateLabel,
      repairedBy:      userId,
      changedCount:    changedPatches.length,
      changedProducts: changedPatches.map((p) => ({
        productId:    p.productId,
        oldClosingQty: p.oldClosingQty,
        newClosingQty: p.closingQty,
      })),
    },
  });

  revalidatePath("/daily-log");
  revalidatePath("/daily-log/history");
  revalidatePath("/inventory");
  revalidatePath("/inventory/stock-levels");

  return { repairedCount: changedPatches.length };
}

// ─────────────────────────────────────────────
// HISTORY LIST
// ─────────────────────────────────────────────

export type DailyLogSummary = {
  id: string;
  logDate: string;
  status: DailyLogStatus;
  createdBy: string;
  closedBy: string | null;
  closedAt: string | null;
  autoAdjustedAt: string | null;
  productCount: number;
  activeCount: number;
  adjustCount: number;
  totalProduced: number;
  totalUsed: number;
  totalSold: number;
  totalWaste: number;
};

export async function getDailyLogHistory(limitDays = 30): Promise<DailyLogSummary[]> {
  await requireDailyLogAccess();

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - limitDays);

  const logs = await prisma.dailyLog.findMany({
    where: { logDate: { gte: since } },
    orderBy: { logDate: "desc" },
    include: {
      items: {
        select: {
          producedQty: true,
          usedQty:     true,
          soldQty:     true,
          wasteQty:    true,
          damagedQty:  true,
        },
      },
    },
  });

  return logs.map((log) => {
    const activeCount = log.items.filter(
      (i) =>
        Number(i.producedQty) + Number(i.usedQty) + Number(i.soldQty) +
        Number(i.wasteQty) + Number(i.damagedQty) > 0
    ).length;

    const adjustCount = 0; // computed live per-day view; not stored on history summary

    return {
      id: log.id,
      logDate: log.logDate.toISOString().slice(0, 10),
      status: log.status as DailyLogStatus,
      createdBy: log.createdBy,
      closedBy: log.closedBy,
      closedAt: log.closedAt?.toISOString() ?? null,
      autoAdjustedAt: log.autoAdjustedAt?.toISOString() ?? null,
      productCount: log.items.length,
      activeCount,
      adjustCount,
      totalProduced: log.items.reduce((s, i) => s + Number(i.producedQty), 0),
      totalUsed: log.items.reduce((s, i) => s + Number(i.usedQty), 0),
      totalSold: log.items.reduce((s, i) => s + Number(i.soldQty), 0),
      totalWaste: log.items.reduce((s, i) => s + Number(i.wasteQty) + Number(i.damagedQty), 0),
    };
  });
}
