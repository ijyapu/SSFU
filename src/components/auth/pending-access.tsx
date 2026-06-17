"use client";
import { COMPANY } from "@/lib/company";

import Image from "next/image";
import { useState } from "react";
import {
  Clock, ShieldCheck, Mail, User, CheckCircle2,
  AlertCircle, ChevronRight, X,
} from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";

interface Props {
  name?: string;
  email?: string;
}

const STEPS = [
  {
    label:  "Account created",
    sub:    "Your account has been registered in the system.",
    done:   true,
  },
  {
    label:  "Under administrator review",
    sub:    "An admin is verifying your identity and assigning a role.",
    done:   false,
    active: true,
  },
  {
    label:  "Access granted",
    sub:    "You will be notified and can sign in to the portal.",
    done:   false,
  },
];

export function PendingAccess({ name = "there", email }: Props) {
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">

      {/* Top bar */}
      <header className="border-b border-gray-200 bg-white px-6 py-3.5">
        <div className="mx-auto max-w-2xl flex items-center gap-3">
          <div className="relative h-8 w-8 shrink-0">
            <Image src="/ssfu-logo.svg" alt="SSFU" fill className="object-contain" priority />
          </div>
          <div className="leading-tight">
            <p className="font-bold text-gray-900 text-sm">{COMPANY.nameShort} ERP</p>
            <p className="text-red-600 text-[10px] tracking-widest uppercase">Enterprise Portal</p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg space-y-4">

          {/* ── Main card ── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Amber accent top — signals "waiting" not "error" */}
            <div className="h-1 w-full bg-linear-to-r from-amber-500 via-amber-400 to-yellow-300" />

            <div className="p-8">
              {/* Icon + heading */}
              <div className="flex flex-col items-center text-center mb-7">
                <div className="relative mb-5">
                  <div className="flex h-18 w-18 items-center justify-center rounded-2xl bg-amber-50 border-2 border-amber-100">
                    <Clock className="h-8 w-8 text-amber-500" />
                  </div>
                  {/* Pulse ring */}
                  <span className="absolute -inset-1 rounded-2xl border-2 border-amber-300/50 animate-ping" />
                </div>

                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                  Access Pending Approval
                </h1>
                <p className="text-gray-500 text-sm mt-2 leading-relaxed max-w-xs">
                  Hi <span className="font-semibold text-gray-700">{name}</span> — your account
                  has been created but access has not yet been granted.
                </p>
              </div>

              {/* Account info strip */}
              {email && (
                <div className="flex items-center gap-3 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 mb-6">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-200">
                    <User className="h-4 w-4 text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-500">Signed in as</p>
                    <p className="text-sm font-semibold text-gray-800 truncate">{email}</p>
                  </div>
                  <span className="ml-auto shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    <AlertCircle className="h-3 w-3" />
                    No role
                  </span>
                </div>
              )}

              {/* Progress steps */}
              <div className="space-y-0 mb-7">
                {STEPS.map((step, i) => (
                  <div key={step.label} className="flex gap-3">
                    {/* Step indicator + connector line */}
                    <div className="flex flex-col items-center">
                      <div className={[
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                        step.done
                          ? "border-green-500 bg-green-500"
                          : step.active
                          ? "border-amber-500 bg-amber-50"
                          : "border-gray-200 bg-white",
                      ].join(" ")}>
                        {step.done ? (
                          <CheckCircle2 className="h-4 w-4 text-white" />
                        ) : step.active ? (
                          <Clock className="h-3.5 w-3.5 text-amber-500" />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-gray-200" />
                        )}
                      </div>
                      {i < STEPS.length - 1 && (
                        <div className={[
                          "w-0.5 flex-1 my-1",
                          step.done ? "bg-green-300" : "bg-gray-100",
                        ].join(" ")} style={{ minHeight: 20 }} />
                      )}
                    </div>

                    {/* Step text */}
                    <div className="pb-5">
                      <p className={[
                        "text-sm font-semibold",
                        step.done
                          ? "text-green-700"
                          : step.active
                          ? "text-amber-700"
                          : "text-gray-300",
                      ].join(" ")}>
                        {step.label}
                      </p>
                      <p className={[
                        "text-xs mt-0.5 leading-relaxed",
                        step.done ? "text-gray-500" : step.active ? "text-amber-600/80" : "text-gray-300",
                      ].join(" ")}>
                        {step.sub}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* What happens next box */}
              <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3.5 mb-6">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-blue-700 mb-0.5">What happens next?</p>
                    <p className="text-xs text-blue-600 leading-relaxed">
                      An administrator will review your account and assign your access role.
                      This typically takes less than one business day. Once approved,
                      you can sign in and access the portal immediately.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-2.5">
                <button
                  onClick={() => setContactOpen(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors"
                >
                  <Mail className="h-4 w-4 text-gray-400" />
                  Contact Administrator
                  <ChevronRight className="h-3.5 w-3.5 text-gray-300 ml-auto" />
                </button>

                <SignOutButton redirectUrl="/sign-in">
                  <button className="w-full flex items-center justify-center gap-2 rounded-xl bg-gray-900 hover:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors">
                    Back to Sign In
                  </button>
                </SignOutButton>
              </div>
            </div>
          </div>

          {/* Help text */}
          <p className="text-center text-xs text-gray-400">
            If you believe this is an error, contact your manager or system administrator.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-4 text-center">
        <p className="text-xs text-gray-400">
          © {new Date().getFullYear()} {COMPANY.name} · Nepal
        </p>
      </footer>

      {/* ── Contact Admin Modal ── */}
      {contactOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="h-1 bg-linear-to-r from-red-600 to-red-400" />
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="font-bold text-gray-900">Contact Administrator</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Reach out for access support</p>
                </div>
                <button
                  onClick={() => setContactOpen(false)}
                  className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-400 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <ContactRow
                  icon={Mail}
                  label="Email"
                  value={COMPANY.contactEmail}
                  href={`mailto:${COMPANY.contactEmail}`}
                />
                <ContactRow
                  icon={User}
                  label="System Administrator"
                  value="SSFU IT / Management"
                />
              </div>

              <div className="mt-5 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
                <p className="text-xs text-gray-500 leading-relaxed">
                  Please include your <span className="font-medium text-gray-700">registered email</span> and{" "}
                  <span className="font-medium text-gray-700">department</span> when contacting the admin.
                </p>
              </div>

              <button
                onClick={() => setContactOpen(false)}
                className="mt-4 w-full rounded-xl bg-gray-900 hover:bg-gray-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white border border-gray-200">
        <Icon className="h-4 w-4 text-gray-500" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        {href ? (
          <a
            href={href}
            className="text-sm font-semibold text-red-600 hover:text-red-700 transition-colors truncate block"
          >
            {value}
          </a>
        ) : (
          <p className="text-sm font-semibold text-gray-800 truncate">{value}</p>
        )}
      </div>
    </div>
  );
}
