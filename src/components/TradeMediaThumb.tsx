"use client";

import { useState, type ReactNode } from "react";
import { chartLinkLabel, isTradingViewChartUrl } from "@/lib/screenshots";
import type { TradeScreenshot } from "@/lib/types/database";

export function MediaHoverPreview({
  children,
  preview,
}: {
  children: ReactNode;
  preview: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          className="fixed z-[100] pointer-events-none"
          style={{
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <span className="block rounded-xl border border-border bg-surface shadow-2xl p-2 max-w-[min(90vw,520px)]">
            {preview}
          </span>
        </span>
      )}
    </span>
  );
}

export function TradeMediaThumb({
  shot,
  size = "md",
}: {
  shot: TradeScreenshot;
  size?: "sm" | "md" | "lg";
}) {
  const dims =
    size === "sm" ? "w-16 h-16" : size === "lg" ? "w-32 h-32" : "w-24 h-24";

  if (shot.signed_url) {
    return (
      <MediaHoverPreview
        preview={
          <img
            src={shot.signed_url}
            alt=""
            className="max-w-[min(85vw,480px)] max-h-[min(70vh,400px)] rounded-lg object-contain"
          />
        }
      >
        <img
          src={shot.signed_url}
          alt=""
          className={`${dims} rounded-lg object-cover border border-border cursor-zoom-in`}
        />
      </MediaHoverPreview>
    );
  }

  if (shot.link_url) {
    const label = chartLinkLabel(shot.link_url);
    return (
      <MediaHoverPreview
        preview={
          isTradingViewChartUrl(shot.link_url) ? (
            <iframe
              src={shot.link_url}
              title={label}
              className="w-[min(85vw,480px)] h-[min(60vh,320px)] rounded-lg bg-black/20"
            />
          ) : (
            <a
              href={shot.link_url}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline text-sm p-4 block"
            >
              Open chart link
            </a>
          )
        }
      >
        <a
          href={shot.link_url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`${dims} rounded-lg border border-primary/30 bg-primary/10 flex flex-col items-center justify-center text-center px-1 cursor-zoom-in hover:border-primary/50 transition-colors`}
        >
          <span className="text-lg leading-none">📈</span>
          <span className="text-[0.6rem] text-primary mt-1 font-medium leading-tight">
            TradingView
          </span>
        </a>
      </MediaHoverPreview>
    );
  }

  return null;
}

export function firstTradeMedia(
  screenshots: TradeScreenshot[] | undefined
): TradeScreenshot | null {
  if (!screenshots?.length) return null;
  return (
    screenshots.find((s) => s.signed_url || s.link_url) ?? screenshots[0] ?? null
  );
}
