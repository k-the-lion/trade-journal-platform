"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/journal", label: "Daily" },
  { href: "/calendar", label: "Calendar" },
  { href: "/reports", label: "Reports" },
  { href: "/planner", label: "Planner" },
  { href: "/chat", label: "AI Coach" },
  { href: "/import", label: "Import" },
  { href: "/coach", label: "Coach" },
];

export function DashboardNav({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-[90rem] mx-auto px-4 pt-3 pb-2">
        <div className="flex items-center justify-between gap-4">
          <Link href="/dashboard" className="font-semibold text-primary text-lg shrink-0">
            Trade Journal
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/settings"
              className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
                pathname.startsWith("/settings")
                  ? "bg-primary/15 text-primary"
                  : "text-muted hover:text-foreground hover:bg-white/5"
              }`}
            >
              Settings
            </Link>
            <span className="text-xs text-muted hidden md:block truncate max-w-[160px]">
              {email}
            </span>
            <form action={signOut}>
              <button type="submit" className="btn btn-secondary text-xs py-1.5 px-3">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav
          className="flex gap-1 mt-3 overflow-x-auto pb-1 -mx-1 px-1"
          style={{ scrollbarWidth: "none" }}
          aria-label="Main navigation"
        >
          {links.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted hover:text-foreground hover:bg-white/5"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
