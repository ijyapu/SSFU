import { Resend } from "resend";
import { COMPANY } from "@/lib/company";

// ─── Config & env validation ──────────────────────────────────────────────────

if (!process.env.RESEND_API_KEY)    console.warn("[email] RESEND_API_KEY is not set — all emails will be skipped");
if (!process.env.ADMIN_EMAIL)       console.error("[email] ADMIN_EMAIL env var is required — admin alert emails will fail at runtime");
if (!process.env.RESEND_FROM_EMAIL) console.warn("[email] RESEND_FROM_EMAIL is not set — defaulting to noreply@ssfi.work");

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM   = `${COMPANY.nameShort} ERP <${process.env.RESEND_FROM_EMAIL ?? "noreply@ssfi.work"}>`;
const ADMIN  = process.env.ADMIN_EMAIL ?? "";
const YEAR   = new Date().getFullYear();

// ─── Utilities ────────────────────────────────────────────────────────────────

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function logEmail(type: string, to: string, ok: boolean, detail?: unknown) {
  const entry = { service: "email", type, to, ok, detail: detail ?? null, ts: new Date().toISOString() };
  if (ok) console.log(JSON.stringify(entry));
  else    console.error(JSON.stringify(entry));
}

type SendParams = Parameters<InstanceType<typeof Resend>["emails"]["send"]>[0];

async function sendWithRetry(params: SendParams) {
  const first = await resend!.emails.send(params);
  if (!first.error) return first;
  await new Promise<void>((r) => setTimeout(r, 1_000));
  return resend!.emails.send(params);
}

// ─── Shared HTML primitives ───────────────────────────────────────────────────

function layout(accentColor: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06);">
  <div style="height:4px;background:${accentColor};"></div>
  <div style="background:#0f172a;padding:22px 32px;display:flex;align-items:center;gap:12px;">
    <div style="background:#dc2626;border-radius:6px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
      <span style="color:#fff;font-size:11px;font-weight:800;letter-spacing:.5px;">SS</span>
    </div>
    <div>
      <p style="margin:0;color:#f1f5f9;font-size:14px;font-weight:700;line-height:1.2;">${COMPANY.nameShort} ERP</p>
      <p style="margin:2px 0 0;color:#64748b;font-size:10px;letter-spacing:.08em;text-transform:uppercase;">Enterprise Portal</p>
    </div>
  </div>
  <div style="padding:32px;">${body}</div>
  <div style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:14px 32px;">
    <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">© ${YEAR} ${COMPANY.name} · Nepal</p>
  </div>
</div>
</body>
</html>`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 12px;font-size:12px;font-weight:600;color:#6b7280;white-space:nowrap;border-right:1px solid #e5e7eb;">${label}</td>
    <td style="padding:8px 12px;font-size:13px;color:#111827;">${value}</td>
  </tr>`;
}

function table(rows: string): string {
  return `<table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:20px 0 0;">${rows}</table>`;
}

function badge(text: string, color: string, bg: string): string {
  return `<span style="display:inline-block;background:${bg};color:${color};font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.04em;">${text}</span>`;
}

function btn(text: string, href: string, bg = "#dc2626"): string {
  return `<a href="${href}" style="display:inline-block;background:${bg};color:#fff;font-size:13px;font-weight:600;padding:10px 22px;border-radius:8px;text-decoration:none;margin-top:20px;">${text}</a>`;
}

// ─── 1. Request received (to the applicant) ───────────────────────────────────
// Called from: /api/webhooks/clerk (user.created) + /request-access/actions.ts

export async function sendRequestReceivedEmail(to: string, name: string) {
  if (!resend) { logEmail("request-received", to, false, "RESEND_API_KEY not set"); return; }

  const safeName = esc(name);

  const body = `
    <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#111827;">Request Received</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6;">
      Hi <strong style="color:#111827;">${safeName}</strong>,
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.7;">
      Thank you for submitting your access request to the <strong>${COMPANY.nameShort} Enterprise Portal</strong>.
      We have received your application and it is currently pending administrator review.
    </p>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.05em;">What happens next</p>
      <p style="margin:0;font-size:13px;color:#78350f;line-height:1.6;">
        An administrator will verify your details and assign your access role, typically within one business day.
        You will receive another email once your account has been approved or if additional information is needed.
      </p>
    </div>
    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;line-height:1.6;">
      If you did not submit this request, please contact <a href="mailto:${ADMIN}" style="color:#dc2626;text-decoration:none;">${ADMIN}</a> immediately.
    </p>
  `;

  const { data, error } = await sendWithRetry({
    from: FROM, to, subject: "Access request received",
    html: layout("linear-gradient(90deg,#f59e0b,#fcd34d)", body),
  });
  logEmail("request-received", to, !error, error ?? { id: data?.id });
}

// ─── 2. Admin alert — new access request ─────────────────────────────────────
// Called from: /api/webhooks/clerk (user.created) + /request-access/actions.ts
// department and jobTitle are optional so this works for both Google OAuth
// sign-ups (no form data) and manual access request form submissions.

export async function sendAdminNewRequestAlert(request: {
  fullName:    string;
  workEmail:   string;
  department?: string | null;
  jobTitle?:   string | null;
  phone?:      string | null;
  reason?:     string | null;
}) {
  if (!ADMIN) throw new Error("[email] ADMIN_EMAIL env var is required — cannot send admin alert");
  if (!resend) { logEmail("admin-alert", ADMIN, false, "RESEND_API_KEY not set"); return; }

  const adminUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://ssfi.work"}/settings/access-requests`;

  const rows = [
    infoRow("Name",  esc(request.fullName)),
    infoRow("Email", esc(request.workEmail)),
    ...(request.department ? [infoRow("Department", esc(request.department))] : []),
    ...(request.jobTitle   ? [infoRow("Job Title",  esc(request.jobTitle))]   : []),
    ...(request.phone      ? [infoRow("Phone",      esc(request.phone))]      : []),
    ...(request.reason     ? [infoRow("Reason",     esc(request.reason))]     : []),
  ].join("");

  const body = `
    <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#111827;">New Access Request</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6;">
      A new user has submitted an access request and is awaiting your review.
    </p>
    ${table(rows)}
    <p style="margin:20px 0 0;font-size:13px;color:#4b5563;">
      Visit the admin panel to approve or reject this request and assign an access role.
    </p>
    ${btn("Review Request", adminUrl, "#111827")}
  `;

  const { data, error } = await sendWithRetry({
    from: FROM, to: ADMIN,
    subject: `New access request from ${esc(request.fullName)}`,
    html: layout("linear-gradient(90deg,#3b82f6,#60a5fa)", body),
  });
  logEmail("admin-alert", ADMIN, !error, error ?? { id: data?.id });
}

// ─── 3. Approval email (to the user) ─────────────────────────────────────────
// Called from: /settings/access-requests/actions.ts → approveRequest()

export async function sendApprovalEmail(to: string, name: string, role: string) {
  if (!resend) { logEmail("approval", to, false, "RESEND_API_KEY not set"); return; }

  const safeName  = esc(name);
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const signInUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://ssfi.work"}/sign-in`;

  const body = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;background:#f0fdf4;border-radius:12px;border:2px solid #bbf7d0;margin-bottom:12px;">
        <span style="font-size:24px;">✓</span>
      </div>
      <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#111827;">Access Approved</h1>
      <p style="margin:0;font-size:14px;color:#6b7280;">Your account is ready to use</p>
    </div>
    <p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.7;">
      Hi <strong style="color:#111827;">${safeName}</strong>,<br><br>
      Great news! Your access request has been approved. You can now sign in to the
      <strong>${COMPANY.nameShort} Enterprise Portal</strong> and access the features available to your role.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;">
      <p style="margin:0 0 2px;font-size:12px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:.05em;">Your assigned role</p>
      <p style="margin:0;">${badge(roleLabel, "#166534", "#dcfce7")}</p>
    </div>
    <p style="margin:16px 0 0;font-size:13px;color:#4b5563;line-height:1.6;">
      Sign in using the same account you registered with. If you experience any issues,
      contact your system administrator at
      <a href="mailto:${ADMIN}" style="color:#dc2626;text-decoration:none;">${ADMIN}</a>.
    </p>
    ${btn(`Sign In to ${COMPANY.nameShort} ERP`, signInUrl, "#16a34a")}
  `;

  const { data, error } = await sendWithRetry({
    from: FROM, to,
    subject: `Your ${COMPANY.nameShort} ERP access has been approved`,
    html: layout("linear-gradient(90deg,#16a34a,#4ade80)", body),
  });
  logEmail("approval", to, !error, error ?? { id: data?.id });
}

// ─── 4. Rejection email (to the user) ────────────────────────────────────────
// Called from: /settings/access-requests/actions.ts → rejectRequest()

export async function sendRejectionEmail(to: string, name: string, note?: string | null) {
  if (!resend) { logEmail("rejection", to, false, "RESEND_API_KEY not set"); return; }

  const safeName = esc(name);
  const safeNote = note ? esc(note) : null;

  const body = `
    <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#111827;">Access Request Update</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6;">
      Hi <strong style="color:#111827;">${safeName}</strong>,
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.7;">
      After reviewing your access request, we are unable to approve portal access at this time.
    </p>
    ${safeNote ? `
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 18px;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:.05em;">Reason provided</p>
      <p style="margin:0;font-size:13px;color:#7f1d1d;line-height:1.6;">${safeNote}</p>
    </div>` : ""}
    <p style="margin:0;font-size:13px;color:#4b5563;line-height:1.6;">
      If you believe this is a mistake, please contact your manager or the system administrator at
      <a href="mailto:${ADMIN}" style="color:#dc2626;text-decoration:none;">${ADMIN}</a>.
    </p>
  `;

  const { data, error } = await sendWithRetry({
    from: FROM, to,
    subject: `Update on your ${COMPANY.nameShort} ERP access request`,
    html: layout("linear-gradient(90deg,#ef4444,#f87171)", body),
  });
  logEmail("rejection", to, !error, error ?? { id: data?.id });
}
