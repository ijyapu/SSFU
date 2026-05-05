import Image from "next/image";
import { requirePermission } from "@/lib/auth";
import { COMPANY } from "@/lib/company";
import { Building2, Phone, Hash, User, Calendar, MapPin, Quote, BadgeCheck } from "lucide-react";

export const metadata = { title: "Company Info — Settings" };

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <div className="flex items-start gap-4 py-3.5 border-b last:border-0">
      <div className="flex items-center gap-2 w-44 shrink-0 text-muted-foreground text-sm">
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

export default async function CompanyPage() {
  await requirePermission("settings");
  const age = new Date().getFullYear() - COMPANY.established;

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Header card */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="bg-red-700 px-6 py-5 flex items-center gap-4">
          <div className="rounded-xl bg-white overflow-hidden shadow-sm w-16 h-16 shrink-0 flex items-center justify-center">
            <Image src="/ssfi-logo.jpg" alt={COMPANY.nameShort} width={60} height={60} className="object-contain p-1" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white leading-tight">{COMPANY.name}</h2>
            <p className="text-sm text-red-100 italic mt-0.5">&ldquo;{COMPANY.slogan}&rdquo;</p>
          </div>
        </div>

        <div className="px-6 py-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium px-3 py-1">
            <BadgeCheck className="h-3.5 w-3.5" />
            PAN Registered
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium px-3 py-1">
            <Calendar className="h-3.5 w-3.5" />
            Est. {COMPANY.established} · {age} years
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="rounded-xl border bg-card">
        <div className="px-5 py-1">
          <Row icon={Building2} label="Company Name"  value={COMPANY.name} />
          <Row icon={MapPin}     label="Address"       value={COMPANY.address} />
          <Row icon={Phone}      label="Phone"         value={COMPANY.phone} />
          <Row icon={Hash}       label="PAN Number"    value={COMPANY.pan} />
          <Row icon={User}       label="Owner"         value={COMPANY.owner} />
          <Row icon={Calendar}   label="Established"   value={`${COMPANY.established} (${age} years ago)`} />
          <Row icon={Quote}      label="Slogan"        value={COMPANY.slogan} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        To update company details, edit{" "}
        <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">src/lib/company.ts</code>.
      </p>
    </div>
  );
}
