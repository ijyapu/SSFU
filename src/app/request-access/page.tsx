"use client";
import { COMPANY } from "@/lib/company";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft, CheckCircle2, ShieldCheck, Loader2,
  User, Mail, Building2, Briefcase, Phone, MessageSquare,
} from "lucide-react";
import { submitAccessRequest, type RequestAccessValues } from "./actions";

type Field = {
  name: keyof RequestAccessValues;
  label: string;
  placeholder: string;
  type?: string;
  required?: boolean;
  icon: React.ElementType;
};

const DEPARTMENTS = [
  "Management",
  "Accounts & Finance",
  "Sales",
  "Purchasing",
  "Warehouse & Inventory",
  "Production",
  "HR & Admin",
  "IT",
  "Other",
];

const TEXT_FIELDS: Field[] = [
  { name: "fullName",  label: "Full Name",   placeholder: "Ram Prasad Sharma",    required: true,  icon: User },
  { name: "workEmail", label: "Work Email",  placeholder: "name@ssfu.work",     required: true,  type: "email", icon: Mail },
  { name: "jobTitle",  label: "Job Title",   placeholder: "e.g. Sales Manager",   required: true,  icon: Briefcase },
  { name: "phone",     label: "Phone",       placeholder: "98XXXXXXXX",           required: false, type: "tel", icon: Phone },
];

const EMPTY: RequestAccessValues = {
  fullName: "", workEmail: "", department: "",
  jobTitle: "", phone: "",    reason: "",
};

type FieldError = Partial<Record<keyof RequestAccessValues, string>>;

function validate(form: RequestAccessValues): FieldError {
  const errors: FieldError = {};
  if (!form.fullName.trim())   errors.fullName   = "Full name is required";
  if (!form.workEmail.trim())  errors.workEmail  = "Work email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.workEmail))
    errors.workEmail = "Enter a valid email address";
  if (!form.department.trim()) errors.department = "Please select a department";
  if (!form.jobTitle.trim())   errors.jobTitle   = "Job title is required";
  return errors;
}

export default function RequestAccessPage() {
  const [form, setForm]       = useState<RequestAccessValues>(EMPTY);
  const [errors, setErrors]   = useState<FieldError>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [submitted, setSubmitted]     = useState(false);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof RequestAccessValues]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");
    const fieldErrors = validate(form);
    if (Object.keys(fieldErrors).length) { setErrors(fieldErrors); return; }

    setLoading(true);
    try {
      await submitAccessRequest(form);
      setSubmitted(true);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur-sm px-6 py-3.5">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-8 w-8 shrink-0">
              <Image src="/ssfu-logo.svg" alt="SSFU" fill className="object-contain" priority />
            </div>
            <div className="leading-tight">
              <p className="font-bold text-gray-900 text-sm">{COMPANY.nameShort} ERP</p>
              <p className="text-red-600 text-[10px] tracking-widest uppercase">Enterprise Portal</p>
            </div>
          </div>
          <Link
            href="/sign-in"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-2xl">

          {submitted ? (
            <SuccessState name={form.fullName} email={form.workEmail} />
          ) : (
            <>
              {/* Page heading */}
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                  Request Access to {COMPANY.nameShort} ERP
                </h1>
                <p className="text-gray-500 text-sm mt-1.5 leading-relaxed">
                  Submit your information for administrator review. Access is granted
                  after identity and role verification.
                </p>
              </div>

              {/* Form card */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="h-1 bg-linear-to-r from-red-600 via-red-500 to-red-400" />

                <form onSubmit={handleSubmit} noValidate className="p-7 space-y-6">

                  {/* Section: Personal info */}
                  <Section title="Personal Information" subtitle="Your full name and contact details.">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {TEXT_FIELDS.slice(0, 2).map((f) => (
                        <TextField key={f.name} f={f} value={form[f.name] as string}
                          error={errors[f.name]} onChange={handleChange} />
                      ))}
                    </div>
                    <TextField
                      f={TEXT_FIELDS[3]} value={form.phone ?? ""}
                      error={errors.phone} onChange={handleChange}
                    />
                  </Section>

                  <Divider />

                  {/* Section: Role info */}
                  <Section title="Role & Department" subtitle="Help us assign the right access level.">
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        <Building2 className="h-3.5 w-3.5 text-gray-400" />
                        Department <Required />
                      </label>
                      <select
                        name="department"
                        value={form.department}
                        onChange={handleChange}
                        className={inputCls(!!errors.department)}
                      >
                        <option value="">Select your department…</option>
                        {DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      {errors.department && <ErrorMsg msg={errors.department} />}
                    </div>

                    <TextField
                      f={TEXT_FIELDS[2]} value={form.jobTitle}
                      error={errors.jobTitle} onChange={handleChange}
                    />
                  </Section>

                  <Divider />

                  {/* Section: Reason */}
                  <Section
                    title="Reason for Access"
                    subtitle="Optional — helps administrators prioritise your request."
                  >
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        <MessageSquare className="h-3.5 w-3.5 text-gray-400" />
                        What will you use the ERP system for?
                        <span className="text-gray-400 font-normal normal-case ml-1">optional</span>
                      </label>
                      <textarea
                        name="reason"
                        value={form.reason}
                        onChange={handleChange}
                        rows={3}
                        placeholder="e.g. I manage daily purchasing and need access to view supplier invoices and create purchase orders."
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none transition resize-none"
                      />
                    </div>
                  </Section>

                  <Divider />

                  {/* Notice */}
                  <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3.5">
                    <ShieldCheck className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 leading-relaxed">
                      <span className="font-semibold">Access roles are assigned by administrators only.</span>{" "}
                      You will not be able to select your own permissions. An admin will review your
                      request and assign the appropriate role before you can access the portal.
                    </p>
                  </div>

                  {/* Server error */}
                  {serverError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {serverError}
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-300 px-5 py-3 text-sm font-semibold text-white transition-colors shadow-sm"
                  >
                    {loading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Submitting request…</>
                    ) : (
                      "Submit Access Request"
                    )}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="py-5 text-center border-t border-gray-200">
        <p className="text-xs text-gray-400">
          © {new Date().getFullYear()} {COMPANY.name} · Nepal
        </p>
      </footer>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────

function SuccessState({ name, email }: { name: string; email: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="h-1 bg-linear-to-r from-green-500 to-emerald-400" />
      <div className="p-10 flex flex-col items-center text-center">
        {/* Animated icon */}
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-green-50 border-2 border-green-100">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
        </div>

        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
          Access request submitted
        </h2>
        <p className="text-gray-500 text-sm mt-2 max-w-sm leading-relaxed">
          Your request is pending administrator approval. You will receive an
          email at{" "}
          <span className="font-semibold text-gray-700">{email}</span> once
          your account has been approved.
        </p>

        {/* Summary card */}
        <div className="mt-7 w-full max-w-sm rounded-xl bg-gray-50 border border-gray-100 text-left divide-y divide-gray-100">
          <Row label="Name"   value={name} />
          <Row label="Email"  value={email} />
          <Row label="Status" value="Pending review" badge />
        </div>

        <div className="mt-7 w-full max-w-sm space-y-2.5">
          <Link
            href="/sign-in"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 hover:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Sign In
          </Link>
          <p className="text-xs text-gray-400 text-center">
            Check your inbox for a confirmation email.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, badge }: { label: string; value: string; badge?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      {badge ? (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
          {value}
        </span>
      ) : (
        <span className="text-sm font-medium text-gray-800">{value}</span>
      )}
    </div>
  );
}

function Section({
  title, subtitle, children,
}: {
  title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function TextField({
  f, value, error, onChange,
}: {
  f: Field;
  value: string;
  error?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const Icon = f.icon;
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">
        <Icon className="h-3.5 w-3.5 text-gray-400" />
        {f.label} {f.required && <Required />}
        {!f.required && <span className="text-gray-400 font-normal normal-case">optional</span>}
      </label>
      <input
        name={f.name}
        type={f.type ?? "text"}
        value={value}
        onChange={onChange}
        placeholder={f.placeholder}
        className={inputCls(!!error)}
      />
      {error && <ErrorMsg msg={error} />}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-gray-100" />;
}

function Required() {
  return <span className="text-red-500 ml-0.5">*</span>;
}

function ErrorMsg({ msg }: { msg: string }) {
  return <p className="text-xs text-red-500 mt-1">{msg}</p>;
}

function inputCls(hasError: boolean) {
  return [
    "w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition",
    hasError
      ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100"
      : "border-gray-200 bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100",
  ].join(" ");
}
