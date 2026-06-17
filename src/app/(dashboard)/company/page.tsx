import Image from "next/image";
import { currentUser } from "@clerk/nextjs/server";
import { Building2, Phone, Hash, User, Calendar, MapPin, Quote, BadgeCheck } from "lucide-react";
import { getCompanyInfo } from "./actions";
import { CompanyForm } from "./_components/company-form";

export const metadata = { title: "Company" };

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
  const [info, user] = await Promise.all([getCompanyInfo(), currentUser()]);
  const role = user?.publicMetadata?.role as string | undefined;
  const isAdmin = role === "admin" || role === "superadmin";
  const age = new Date().getFullYear() - info.established;

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Page heading */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Company Profile</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Business information used across reports, invoices, and tax documents.
          </p>
        </div>
        <CompanyForm info={info} isAdmin={isAdmin} />
      </div>

      {/* Header card */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="bg-primary px-6 py-5 flex items-center gap-4">
          <div className="rounded-xl bg-white overflow-hidden shadow-sm w-16 h-16 shrink-0 flex items-center justify-center">
            <Image src="/ssfu-logo.svg" alt={info.nameShort} width={60} height={60} className="object-contain p-1" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white leading-tight">{info.name}</h2>
            <p className="text-sm text-primary-foreground/70 italic mt-0.5">&ldquo;{info.slogan}&rdquo;</p>
          </div>
        </div>
        <div className="px-6 py-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium px-3 py-1">
            <BadgeCheck className="h-3.5 w-3.5" />
            PAN Registered
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium px-3 py-1">
            <Calendar className="h-3.5 w-3.5" />
            Est. {info.established} · {age} years
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="rounded-xl border bg-card">
        <div className="px-5 py-1">
          <Row icon={Building2} label="Company Name" value={info.name} />
          <Row icon={MapPin}    label="Address"      value={info.address} />
          <Row icon={Phone}     label="Phone"        value={info.phone} />
          <Row icon={Hash}      label="PAN Number"   value={info.pan} />
          <Row icon={User}      label="Owner"        value={info.owner} />
          <Row icon={Calendar}  label="Established"  value={`${info.established} (${age} years ago)`} />
          <Row icon={Quote}     label="Slogan"       value={info.slogan} />
        </div>
      </div>

    </div>
  );
}
