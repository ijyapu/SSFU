import { COMPANY } from "@/lib/company";
import Image from "next/image";
import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const metadata = { title: "Create Account" };

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── LEFT: Branding ── */}
      <div className="hidden lg:flex lg:w-[46%] flex-col bg-[#0f0f0f] px-12 py-10 overflow-hidden relative">
        <div className="pointer-events-none absolute left-1/2 top-48 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-red-700/10 blur-3xl" />

        <div className="relative z-10 flex items-center gap-4">
          <div className="relative h-12 w-12 shrink-0">
            <Image src="/ssfu-logo.svg" alt="SSFU" fill className="object-contain" priority />
          </div>
          <div>
            <p className="text-white font-bold text-base tracking-wide">{COMPANY.nameShort} ERP</p>
            <p className="text-red-400/80 text-xs tracking-widest uppercase">Enterprise Portal</p>
          </div>
        </div>

        <div className="relative z-10 mt-auto mb-auto space-y-8 pt-16">
          <div className="flex justify-start">
            <div className="h-24 w-24 rounded-full bg-white/5 ring-1 ring-white/10 p-2">
              <Image src="/ssfu-logo.svg" alt="SSFU" width={88} height={88} className="object-contain p-1" />
            </div>
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-white leading-snug tracking-tight">
              Joining {COMPANY.nameShort} ERP
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
              Create your account. Once registered, an administrator will review and
              grant access to the portal.
            </p>
          </div>

          {/* Steps */}
          <div className="space-y-4">
            {[
              { n: "1", title: "Register your account", sub: "Use your official work email." },
              { n: "2", title: "Await administrator review", sub: "Your role will be assigned after verification." },
              { n: "3", title: "Access the portal", sub: "Sign in once your account is approved." },
            ].map(({ n, title, sub }) => (
              <div key={n} className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold mt-0.5">
                  {n}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{title}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 mt-auto border-t border-white/5 pt-6">
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
            <p className="text-slate-500 text-xs leading-relaxed">
              Authorized personnel only. Access requires administrator approval.
            </p>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Auth card ── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[#fafafa] px-6 py-12">
        <div className="flex lg:hidden items-center gap-3 mb-10">
          <div className="relative h-10 w-10">
            <Image src="/ssfu-logo.svg" alt="SSFU" fill className="object-contain" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">{COMPANY.nameShort} ERP</p>
            <p className="text-red-500 text-xs tracking-widest uppercase">Enterprise Portal</p>
          </div>
        </div>

        <div className="w-full max-w-100">
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Create your account</h2>
            <p className="text-gray-500 text-sm mt-1.5">
              Your account will be reviewed before access is granted.
            </p>
          </div>

          <SignUp
            forceRedirectUrl="/auth-callback"
            signInForceRedirectUrl="/auth-callback"
            appearance={{
              elements: {
                rootBox:             "w-full",
                card:                "shadow-none border border-gray-200 rounded-xl bg-white p-6 w-full",
                headerTitle:         "hidden",
                headerSubtitle:      "hidden",
                socialButtonsBlockButton:
                  "border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-colors text-sm font-medium",
                formFieldLabel:      "text-gray-700 text-sm font-medium",
                formFieldInput:
                  "border-gray-200 rounded-lg text-sm focus:ring-red-500 focus:border-red-500",
                formButtonPrimary:
                  "bg-red-600 hover:bg-red-700 text-white transition-colors text-sm font-medium rounded-lg",
                footerActionLink:    "text-red-600 hover:text-red-700 font-medium",
                dividerLine:         "bg-gray-100",
                dividerText:         "text-gray-400 text-xs",
              },
            }}
          />

          <Link
            href="/sign-in"
            className="mt-5 flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>

          <p className="mt-6 text-center text-xs text-gray-400">
            <ShieldCheck className="inline h-3 w-3 mr-1 text-gray-300" />
            Secure access for authorized personnel only.
          </p>
        </div>
      </div>
    </div>
  );
}
