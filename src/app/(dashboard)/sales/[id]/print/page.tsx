import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { format } from "date-fns";
import { toNepaliDateString } from "@/lib/nepali-date";
import { COMPANY } from "@/lib/company";
import { PrintTrigger } from "./_components/print-trigger";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const so = await prisma.salesOrder.findUnique({ where: { id }, select: { orderNumber: true } });
  return { title: so ? `Invoice ${so.orderNumber} — SSFU` : "Sales Invoice — SSFU" };
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT:          "Draft",
  CONFIRMED:      "Confirmed",
  PARTIALLY_PAID: "Partially Paid",
  PAID:           "Paid",
  CANCELLED:      "Voided",
  LOST:           "Lost / Not Returned",
};

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash", BANK_TRANSFER: "Bank Transfer", CHECK: "Cheque",
  ESEWA: "eSewa", KHALTI: "Khalti", OTHER: "Other",
};

export default async function PrintSalesInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("sales");
  const { id } = await params;

  const so = await prisma.salesOrder.findUnique({
    where: { id, deletedAt: null },
    include: {
      salesman: true,
      items: {
        include: { product: { include: { unit: true } } },
        orderBy: { product: { name: "asc" } },
      },
      payments: { orderBy: { paidAt: "asc" } },
      returns: {
        where: { salesOrder: { deletedAt: null } },
        include: { items: { include: { product: { include: { unit: true } } } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!so) notFound();

  const date          = new Date(so.orderDate);
  const subtotal      = Number(so.subtotal);
  const commissionPct = Number(so.commissionPct);
  const commAmt       = Number(so.commissionAmount);
  const factoryAmt    = Number(so.factoryAmount);
  const amountPaid    = Number(so.amountPaid);
  const outstanding   = factoryAmt - amountPaid;

  const wasteReturns = so.returns.filter((r) => r.returnType === "WASTE");
  const freshReturns = so.returns.filter((r) => r.returnType === "FRESH");
  const totalReturns = so.returns.reduce((s, r) => s + Number(r.totalAmount), 0);

  const fmt  = (n: number) => `Rs ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtN = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const statusLabel = STATUS_LABELS[so.status] ?? so.status;

  return (
    <>
      <PrintTrigger />

      <div className="min-h-screen bg-white p-0">
        <div
          id="invoice"
          className="mx-auto bg-white"
          style={{ width: "210mm", minHeight: "297mm", padding: "16mm 18mm", fontFamily: "Arial, sans-serif", fontSize: "11px", color: "#1a1a1a" }}
        >
          {/* ── Header ── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", borderBottom: "2px solid #c0392b", paddingBottom: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ssfu-logo.svg" alt={COMPANY.nameShort} style={{ width: "56px", height: "56px", objectFit: "contain" }} />
              <div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "#c0392b", letterSpacing: "0.5px" }}>{COMPANY.name.toUpperCase()}</div>
                <div style={{ fontSize: "10px", color: "#555", marginTop: "2px" }}>{COMPANY.address}</div>
                <div style={{ fontSize: "10px", color: "#555" }}>Phone: {COMPANY.phone} · PAN: {COMPANY.pan}</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "22px", fontWeight: "700", color: "#c0392b", letterSpacing: "1px" }}>SALES INVOICE</div>
              <div style={{ fontSize: "13px", fontWeight: "600", marginTop: "4px" }}>{so.orderNumber}</div>
              <div style={{ fontSize: "10px", color: "#555", marginTop: "4px" }}>
                {format(date, "dd MMMM yyyy")}<br />
                <span style={{ color: "#888" }}>{toNepaliDateString(date)}</span>
              </div>
              <div style={{ marginTop: "6px", display: "inline-block", padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: "600",
                backgroundColor: so.status === "PAID" ? "#dcfce7" : so.status === "PARTIALLY_PAID" ? "#fef9c3" : so.status === "CANCELLED" ? "#fee2e2" : "#dbeafe",
                color: so.status === "PAID" ? "#166534" : so.status === "PARTIALLY_PAID" ? "#92400e" : so.status === "CANCELLED" ? "#991b1b" : "#1e40af",
              }}>
                {statusLabel}
              </div>
            </div>
          </div>

          {/* ── Salesman info ── */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ padding: "10px 12px", backgroundColor: "#f9f9f9", borderRadius: "6px", border: "1px solid #eee", maxWidth: "50%" }}>
              <div style={{ fontSize: "10px", fontWeight: "700", color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Bill To (Salesman)</div>
              <div style={{ fontWeight: "600", fontSize: "12px" }}>{so.salesman.name}</div>
              {so.salesman.phone && <div style={{ color: "#555", marginTop: "2px" }}>{so.salesman.phone}</div>}
              {so.salesman.address && <div style={{ color: "#555" }}>{so.salesman.address}</div>}
              {commissionPct > 0 && (
                <div style={{ color: "#92400e", marginTop: "2px", fontSize: "10px" }}>Commission rate: {commissionPct}%</div>
              )}
            </div>
          </div>

          {/* ── Items table ── */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px" }}>
            <thead>
              <tr style={{ backgroundColor: "#c0392b", color: "white" }}>
                <th style={{ padding: "8px 10px", textAlign: "left",  fontWeight: "600", fontSize: "10px", textTransform: "uppercase", width: "28px" }}>#</th>
                <th style={{ padding: "8px 10px", textAlign: "left",  fontWeight: "600", fontSize: "10px", textTransform: "uppercase" }}>Product</th>
                <th style={{ padding: "8px 10px", textAlign: "center",fontWeight: "600", fontSize: "10px", textTransform: "uppercase", width: "50px" }}>Unit</th>
                <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: "600", fontSize: "10px", textTransform: "uppercase", width: "60px" }}>Qty</th>
                <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: "600", fontSize: "10px", textTransform: "uppercase", width: "90px" }}>Unit Price</th>
                <th style={{ padding: "8px 10px", textAlign: "right", fontWeight: "600", fontSize: "10px", textTransform: "uppercase", width: "90px" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {so.items.map((item, idx) => (
                <tr key={item.id} style={{ backgroundColor: idx % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "7px 10px", color: "#888" }}>{idx + 1}</td>
                  <td style={{ padding: "7px 10px", fontWeight: "500" }}>{item.product.name}</td>
                  <td style={{ padding: "7px 10px", textAlign: "center", color: "#555" }}>{item.product.unit.name}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right", tabularNums: true } as React.CSSProperties}>
                    {Number(item.quantity).toLocaleString("en-IN", { maximumFractionDigits: 3 })}
                  </td>
                  <td style={{ padding: "7px 10px", textAlign: "right" }}>{fmtN(Number(item.unitPrice))}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: "600" }}>{fmtN(Number(item.totalPrice))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── Totals ── */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "20px" }}>
            <div style={{ width: "280px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #eee", color: "#333" }}>
                <span>Subtotal</span><span style={{ fontWeight: "600" }}>{fmt(subtotal)}</span>
              </div>
              {commAmt > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #eee", color: "#92400e" }}>
                  <span>Commission ({commissionPct}%)</span><span>- {fmt(commAmt)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #eee", color: "#333" }}>
                <span style={{ fontWeight: "600" }}>Factory Amount</span><span style={{ fontWeight: "700" }}>{fmt(factoryAmt)}</span>
              </div>
              {totalReturns > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #eee", color: "#dc2626" }}>
                  <span>Returns</span><span>- {fmt(totalReturns)}</span>
                </div>
              )}
              {amountPaid > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #eee", color: "#16a34a" }}>
                  <span>Amount Paid</span><span>- {fmt(amountPaid)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", backgroundColor: outstanding > 0.005 ? "#c0392b" : "#16a34a", color: "white", borderRadius: "6px", fontWeight: "700", fontSize: "13px", marginTop: "4px" }}>
                <span>{outstanding > 0.005 ? "Outstanding" : "Fully Paid"}</span>
                <span>{fmt(Math.max(0, outstanding))}</span>
              </div>
            </div>
          </div>

          {/* ── Payments ── */}
          {so.payments.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontWeight: "700", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#555", marginBottom: "6px" }}>Payments Received</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f3f4f6", borderBottom: "1px solid #ddd" }}>
                    <th style={{ padding: "5px 8px", textAlign: "left",  fontSize: "10px", fontWeight: "600", color: "#555" }}>Date</th>
                    <th style={{ padding: "5px 8px", textAlign: "left",  fontSize: "10px", fontWeight: "600", color: "#555" }}>Method</th>
                    <th style={{ padding: "5px 8px", textAlign: "left",  fontSize: "10px", fontWeight: "600", color: "#555" }}>Reference</th>
                    <th style={{ padding: "5px 8px", textAlign: "right", fontSize: "10px", fontWeight: "600", color: "#555" }}>Amount (Rs)</th>
                  </tr>
                </thead>
                <tbody>
                  {so.payments.map((p) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "5px 8px" }}>
                        <div>{format(new Date(p.paidAt), "dd MMM yyyy")}</div>
                        <div style={{ fontSize: "9px", color: "#aaa" }}>{toNepaliDateString(new Date(p.paidAt))}</div>
                      </td>
                      <td style={{ padding: "5px 8px", color: "#555" }}>{METHOD_LABELS[p.method] ?? p.method}</td>
                      <td style={{ padding: "5px 8px", color: "#888" }}>{p.reference ?? "—"}</td>
                      <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: "600", color: "#16a34a" }}>{fmtN(Number(p.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Returns ── */}
          {(wasteReturns.length > 0 || freshReturns.length > 0) && (
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontWeight: "700", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#555", marginBottom: "6px" }}>Returns</div>
              {[...wasteReturns, ...freshReturns].map((ret) => (
                <div key={ret.id} style={{ marginBottom: "8px", padding: "8px 10px", backgroundColor: "#fef2f2", borderRadius: "6px", border: "1px solid #fecaca" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontWeight: "600", fontSize: "10px" }}>
                      {ret.returnNumber} · {ret.returnType === "FRESH" ? "Fresh Return" : "Waste Return"}
                    </span>
                    <span style={{ fontSize: "10px", color: "#888" }}>
                      {format(new Date(ret.createdAt), "dd MMM yyyy")} · <span style={{ color: "#aaa" }}>{toNepaliDateString(new Date(ret.createdAt))}</span>
                    </span>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
                    <tbody>
                      {ret.items.map((ri) => (
                        <tr key={ri.id}>
                          <td style={{ padding: "2px 0" }}>{ri.product.name}</td>
                          <td style={{ padding: "2px 0", textAlign: "right", color: "#555" }}>
                            {Number(ri.quantity).toLocaleString("en-IN", { maximumFractionDigits: 3 })} {ri.product.unit.name} × {fmtN(Number(ri.unitPrice))}
                          </td>
                          <td style={{ padding: "2px 0", textAlign: "right", fontWeight: "600", width: "80px" }}>
                            {fmt(Number(ri.quantity) * Number(ri.unitPrice))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {ret.notes && <div style={{ marginTop: "4px", fontSize: "10px", color: "#888", fontStyle: "italic" }}>{ret.notes}</div>}
                </div>
              ))}
            </div>
          )}

          {/* ── Notes ── */}
          {so.notes && (
            <div style={{ padding: "10px 12px", backgroundColor: "#fffbf0", border: "1px solid #fde68a", borderRadius: "6px", marginBottom: "20px" }}>
              <div style={{ fontWeight: "600", fontSize: "10px", color: "#92400e", marginBottom: "4px", textTransform: "uppercase" }}>Notes</div>
              <div style={{ color: "#555" }}>{so.notes}</div>
            </div>
          )}

          {/* ── Footer ── */}
          <div style={{ borderTop: "1px solid #eee", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto" }}>
            <div style={{ color: "#aaa", fontSize: "10px" }}>
              Printed on {format(new Date(), "dd MMM yyyy, HH:mm")} ({toNepaliDateString(new Date())}) · {COMPANY.nameShort} ERP
            </div>
            <div style={{ display: "flex", gap: "40px" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ borderTop: "1px solid #333", paddingTop: "4px", fontSize: "10px", color: "#555", width: "120px" }}>Salesman Signature</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ borderTop: "1px solid #333", paddingTop: "4px", fontSize: "10px", color: "#555", width: "120px" }}>Authorized Signature</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body { margin: 0; }
          #invoice { width: 100% !important; padding: 10mm 12mm !important; }
          button, .no-print { display: none !important; }
        }
        @media screen {
          body { background: #e5e7eb; }
        }
      `}</style>
    </>
  );
}
