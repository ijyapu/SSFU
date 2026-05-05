"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CheckCircle2, XCircle, Clock, Mail,
  Building2, Briefcase, Phone, MessageSquare,
  ChevronDown, Loader2,
} from "lucide-react";
import { approveRequest, rejectRequest } from "../actions";
import { toast } from "sonner";

type Status = "PENDING" | "APPROVED" | "REJECTED";

interface AccessRequest {
  id:         string;
  fullName:   string;
  workEmail:  string;
  department: string;
  jobTitle:   string;
  phone:      string | null;
  reason:     string | null;
  status:     Status;
  reviewNote: string | null;
  createdAt:  string;
}

interface Props {
  requests:  AccessRequest[];
  counts:    Record<Status, number>;
  activeTab: Status;
}

const ROLES = [
  { value: "employee",   label: "Employee" },
  { value: "accountant", label: "Accountant" },
  { value: "manager",    label: "Manager" },
  { value: "admin",      label: "Admin" },
] as const;

type AppRole = typeof ROLES[number]["value"];

const TAB_CONFIG: { key: Status; label: string; icon: React.ElementType; color: string }[] = [
  { key: "PENDING",  label: "Pending",  icon: Clock,         color: "text-amber-600" },
  { key: "APPROVED", label: "Approved", icon: CheckCircle2,  color: "text-green-600" },
  { key: "REJECTED", label: "Rejected", icon: XCircle,       color: "text-red-600"   },
];

export function AccessRequestsClient({ requests, counts, activeTab }: Props) {
  const router = useRouter();

  function setTab(tab: Status) {
    router.push(`/settings/access-requests?tab=${tab}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Access Requests</h2>
        <p className="text-sm text-muted-foreground">
          Review and approve or reject user access requests.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TAB_CONFIG.map(({ key, label, icon: Icon, color }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-md transition-colors border border-transparent ${
                active
                  ? "bg-background text-foreground border-border border-b-background -mb-px"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${active ? color : ""}`} />
              {label}
              <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                active
                  ? key === "PENDING"  ? "bg-amber-100 text-amber-700"
                  : key === "APPROVED" ? "bg-emerald-100 text-emerald-700"
                  :                     "bg-red-100 text-red-700"
                  : "bg-muted text-muted-foreground"
              }`}>
                {counts[key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Request list */}
      {requests.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No {activeTab.toLowerCase()} requests.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <RequestCard key={req.id} req={req} />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestCard({ req }: { req: AccessRequest }) {
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen,  setRejectOpen]  = useState(false);

  const isPending = req.status === "PENDING";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Status stripe */}
      <div className={`h-0.5 w-full ${
        req.status === "PENDING"  ? "bg-amber-400" :
        req.status === "APPROVED" ? "bg-green-500" : "bg-red-500"
      }`} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Left: person info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold text-foreground">{req.fullName}</p>
              <StatusBadge status={req.status} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-2">
              <InfoRow icon={Mail}       value={req.workEmail}  />
              {req.department && <InfoRow icon={Building2} value={req.department} />}
              {req.jobTitle   && <InfoRow icon={Briefcase} value={req.jobTitle}   />}
              {req.phone      && <InfoRow icon={Phone}     value={req.phone}      />}
            </div>

            {req.reason && (
              <div className="mt-3 flex items-start gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed italic">
                  &ldquo;{req.reason}&rdquo;
                </p>
              </div>
            )}

            {req.reviewNote && (
              <div className="mt-2 rounded-lg bg-muted/50 border border-border px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground mb-0.5">Admin note</p>
                <p className="text-xs text-foreground">{req.reviewNote}</p>
              </div>
            )}

            <p className="mt-3 text-[11px] text-muted-foreground">
              Submitted {new Date(req.createdAt).toLocaleDateString("en-NP", {
                year: "numeric", month: "short", day: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
          </div>

          {/* Right: actions */}
          {isPending && (
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={() => setApproveOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve
              </button>
              <button
                onClick={() => setRejectOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors"
              >
                <XCircle className="h-3.5 w-3.5" />
                Reject
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {approveOpen && (
        <ApproveModal
          req={req}
          onClose={() => setApproveOpen(false)}
        />
      )}
      {rejectOpen && (
        <RejectModal
          req={req}
          onClose={() => setRejectOpen(false)}
        />
      )}
    </div>
  );
}

function ApproveModal({ req, onClose }: { req: AccessRequest; onClose: () => void }) {
  const [role, setRole]   = useState<AppRole>("employee");
  const [note, setNote]   = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      try {
        await approveRequest({ id: req.id, email: req.workEmail, role, note: note || undefined });
        toast.success(`Access approved for ${req.fullName}.`);
        onClose();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  return (
    <Modal onClose={onClose}>
      <div className="h-1 bg-green-500 -mx-6 -mt-6 mb-5" />
      <h2 className="font-bold text-foreground mb-0.5">Approve Access</h2>
      <p className="text-xs text-muted-foreground mb-5">
        Assign a role to <span className="font-medium text-foreground">{req.fullName}</span>
      </p>

      {/* Role selector */}
      <div className="space-y-1.5 mb-4">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Role <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AppRole)}
            className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2.5 pr-8 text-sm text-foreground outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-[11px] text-muted-foreground">
          employee → accountant → manager → admin (increasing permissions)
        </p>
      </div>

      {/* Note */}
      <div className="space-y-1.5 mb-5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Internal note <span className="font-normal normal-case text-muted-foreground">optional</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="e.g. Confirmed by HR on phone."
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition resize-none"
        />
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={isPending}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-green-300 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {isPending ? "Approving…" : "Approve & Assign Role"}
        </button>
        <button
          onClick={onClose}
          disabled={isPending}
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}

function RejectModal({ req, onClose }: { req: AccessRequest; onClose: () => void }) {
  const [note, setNote]   = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      try {
        await rejectRequest({ id: req.id, note: note || undefined });
        toast.success(`Request from ${req.fullName} rejected.`);
        onClose();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  return (
    <Modal onClose={onClose}>
      <div className="h-1 bg-red-500 -mx-6 -mt-6 mb-5" />
      <h2 className="font-bold text-foreground mb-0.5">Reject Request</h2>
      <p className="text-xs text-muted-foreground mb-5">
        Reject access for <span className="font-medium text-foreground">{req.fullName}</span>
        {" "}({req.workEmail})
      </p>

      <div className="space-y-1.5 mb-5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Reason / note <span className="font-normal normal-case text-muted-foreground">optional</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="e.g. Could not verify employment. Please contact HR."
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition resize-none"
        />
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={isPending}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-red-300 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
          {isPending ? "Rejecting…" : "Reject Request"}
        </button>
        <button
          onClick={onClose}
          disabled={isPending}
          className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm bg-background rounded-2xl shadow-xl border border-border p-6 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, value }: { icon: React.ElementType; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground truncate">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "PENDING") return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
      <Clock className="h-2.5 w-2.5" /> Pending
    </span>
  );
  if (status === "APPROVED") return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
      <CheckCircle2 className="h-2.5 w-2.5" /> Approved
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
      <XCircle className="h-2.5 w-2.5" /> Rejected
    </span>
  );
}
