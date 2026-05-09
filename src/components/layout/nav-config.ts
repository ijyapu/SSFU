import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
  CreditCard,
  Receipt,
  Calculator,
  BarChart3,
  FileText,
  Settings,
  Truck,
  ClipboardList,
  BookOpen,
  BookMarked,
  Building2,
  FlaskConical,
  Wallet,
  Banknote,
  type LucideIcon,
} from "lucide-react";
import type { PermissionKey } from "@/lib/roles";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  permission?: PermissionKey; // undefined = visible to all authenticated users
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        title: "Daily Log",
        href: "/daily-log",
        icon: ClipboardList,
        permission: "inventory",
      },
      {
        title: "Inventory",
        href: "/inventory",
        icon: Package,
        permission: "inventory",
      },
      {
        title: "Purchases",
        href: "/purchases",
        icon: ShoppingCart,
        permission: "purchases",
      },
      {
        title: "Sales",
        href: "/sales",
        icon: TrendingUp,
        permission: "sales",
      },
      {
        title: "Costing",
        href: "/costing",
        icon: Calculator,
        permission: "costing",
      },
      {
        title: "Recipes",
        href: "/costing/recipes",
        icon: FlaskConical,
        permission: "adminOverride",
      },
    ],
  },
  {
    label: "Money",
    items: [
      {
        title: "Cash Flow",
        href: "/cash-flow",
        icon: Banknote,
        permission: "cashFlow",
      },
      {
        title: "Receipts",
        href: "/receipts",
        icon: Wallet,
        permission: "receipts",
      },
      {
        title: "Expenses",
        href: "/expenses",
        icon: Receipt,
        permission: "expenses",
      },
      {
        title: "Profit & Loss",
        href: "/profit-loss",
        icon: BarChart3,
        permission: "profitLoss",
      },
    ],
  },
  {
    label: "Ledgers",
    items: [
      {
        title: "Vendors",
        href: "/vendors",
        icon: Truck,
        permission: "purchases",
      },
      {
        title: "Vendor Ledger",
        href: "/vendors/ledger",
        icon: BookOpen,
        permission: "purchases",
      },
      {
        title: "Salesmen",
        href: "/sales/salesmen",
        icon: Users,
        permission: "sales",
      },
      {
        title: "Salesman Ledger",
        href: "/salesmen/ledger",
        icon: BookMarked,
        permission: "sales",
      },
    ],
  },
  {
    label: "People",
    items: [
      {
        title: "Employees",
        href: "/employees",
        icon: Users,
        permission: "employees",
      },
      {
        title: "Payroll",
        href: "/payroll",
        icon: CreditCard,
        permission: "payroll",
      },
    ],
  },
  {
    label: "Reports",
    items: [
      {
        title: "Reports",
        href: "/reports",
        icon: FileText,
        permission: "reports",
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        title: "Company",
        href: "/company",
        icon: Building2,
      },
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        permission: "settings",
      },
    ],
  },
];
