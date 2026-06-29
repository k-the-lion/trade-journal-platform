"use client";

import type { ReactNode } from "react";

export function FilterPanel({
  title = "Filters",
  hint,
  active = false,
  onClear,
  actions,
  nested = false,
  children,
}: {
  title?: string;
  hint?: string;
  active?: boolean;
  onClear?: () => void;
  actions?: ReactNode;
  nested?: boolean;
  children: ReactNode;
}) {
  return (
    <details className={nested ? "group rounded-lg border border-border/60" : "card group"}>
      <summary className="cursor-pointer list-none px-4 py-3 flex flex-wrap items-center justify-between gap-3 select-none [&::-webkit-details-marker]:hidden">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-medium text-sm">{title}</h2>
            {active && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-primary/40 bg-primary/10 text-primary">
                Active
              </span>
            )}
          </div>
          {hint && (
            <p className="text-xs text-muted mt-0.5 group-open:hidden">{hint}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {active && onClear && (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
            >
              Clear all filters
            </button>
          )}
          {actions && (
            <div
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {actions}
            </div>
          )}
          <span
            className="text-muted text-xs transition-transform group-open:rotate-180"
            aria-hidden
          >
            ▼
          </span>
        </div>
      </summary>
      <div className="px-4 pb-4 pt-2 space-y-4 border-t border-border/60">{children}</div>
    </details>
  );
}
