"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/calendar", label: "Calendar" },
  { href: "/strategies", label: "Strategies" },
  { href: "/trades", label: "Trades" },
  { href: "/reports", label: "Reports" },
  { href: "/chat", label: "AI Coach" },
  { href: "/import", label: "Import" },
  { href: "/coach", label: "Coach" },
];

export function DashboardNav({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/dashboard" className="font-semibold text-primary text-lg shrink-0">
          Trade Journal
        </Link>
        <nav className="flex flex-wrap gap-1">
          {links.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
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
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-muted hidden sm:block truncate max-w-[140px]">
            {email}
          </span>
          <form action={signOut}>
            <button type="submit" className="btn btn-secondary text-xs py-1.5 px-3">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
