"use client";

import { CalendarDays, CalendarRange, LayoutDashboard, Link2, Settings, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const main = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/booking-links", label: "Booking links", icon: Link2 },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarRange },
  { href: "/dashboard/calendars", label: "Calendars", icon: CalendarDays },
];

const account = [{ href: "/dashboard/settings", label: "Settings", icon: Settings }];
const adminOnly = [{ href: "/dashboard/admin", label: "Admin", icon: ShieldCheck }];

type Item = (typeof main)[number];

export function DashboardNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));

  const group = (label: string, items: Item[]) => (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((l) => (
            <SidebarMenuItem key={l.href}>
              <SidebarMenuButton asChild isActive={isActive(l.href)} tooltip={l.label}>
                <Link href={l.href}>
                  <l.icon />
                  <span>{l.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <>
      {group("Scheduling", main)}
      {group("Account", isAdmin ? [...account, ...adminOnly] : account)}
    </>
  );
}
