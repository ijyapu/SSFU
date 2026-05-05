"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { NAV_GROUPS } from "@/components/layout/nav-config";
import { useRole } from "@/hooks/use-role";
import { COMPANY } from "@/lib/company";

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { role, can } = useRole();

  const initials = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : "??";

  return (
    <Sidebar collapsible="offcanvas">
      {/* Brand */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg overflow-hidden bg-white border border-border">
                <Image src="/ssfi-logo.jpg" alt={COMPANY.nameShort} width={32} height={32} className="object-contain" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-semibold text-sm">{COMPANY.nameShort} ERP</span>
                <span className="text-[10px] text-muted-foreground leading-tight">{COMPANY.name}</span>
                <span className="text-xs text-muted-foreground">
                  {role ? (
                    <span className="capitalize">{role}</span>
                  ) : (
                    "No role"
                  )}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      {/* Nav groups */}
      <SidebarContent>
        {NAV_GROUPS.map((group) => {
          // Filter items by permission
          const visibleItems = group.items.filter((item) =>
            item.permission ? can(item.permission) : true
          );

          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => {
                    const isActive =
                      item.href === "/dashboard"
                        ? pathname === "/dashboard"
                        : pathname.startsWith(item.href);
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          isActive={isActive}
                          tooltip={item.title}
                          render={<Link href={item.href} />}
                        >
                          <item.icon />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarSeparator />

      {/* User footer */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Avatar size="sm">
                <AvatarImage src={user?.imageUrl} alt={user?.fullName ?? ""} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <span className="text-sm font-medium truncate">
                  {user?.fullName ?? "Loading..."}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {user?.primaryEmailAddress?.emailAddress}
                </span>
              </div>
              {role && (
                <Badge
                  variant="secondary"
                  className="text-xs shrink-0 group-data-[collapsible=icon]:hidden"
                >
                  {role}
                </Badge>
              )}
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

    </Sidebar>
  );
}
