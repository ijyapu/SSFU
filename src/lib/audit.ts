import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export type AuditAction =
  | "SALES_ORDER_CONFIRM"
  | "SALES_ORDER_EDIT"
  | "SALES_ORDER_CANCEL"
  | "SALES_ORDER_DELETE"
  | "SALES_RETURN_CREATE"
  | "DAILY_LOG_CLOSE"
  | "DAILY_LOG_REOPEN"
  | "DAILY_LOG_DISCARD"
  | "DAILY_LOG_AUTO_ADJUST"
  | "DAILY_LOG_REPAIR"
  | "STOCK_CORRECTION"
  | "PAYMENT_EDIT"
  | "PAYMENT_DELETE"
  | "SALES_RETURN_EDIT";

export type WriteAuditLogParams = {
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
};

/**
 * Write a structured audit log entry.
 * Pass a transaction client `db` to include it in an existing transaction,
 * or omit to use the global prisma client.
 */
export async function writeAuditLog(
  params: WriteAuditLogParams,
  db: TxClient = prisma,
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId:     params.userId,
        action:     params.action,
        entityType: params.entityType,
        entityId:   params.entityId,
        before:     params.before !== undefined ? (params.before as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        after:      params.after  !== undefined ? (params.after  as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        ipAddress:  params.ipAddress ?? null,
      },
    });
  } catch (err) {
    // Audit writes must never break the main operation
    console.warn("[audit] Failed to write audit log:", params.action, params.entityId, err);
  }
}
