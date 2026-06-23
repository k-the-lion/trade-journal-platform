"use client";

import { useState, type ReactNode } from "react";
import { chartPreviewApiUrl, isTradingViewChartUrl } from "@/lib/screenshots";
import type { TradeScreenshot } from "@/lib/types/database";

const PREVIEW_IMAGE_CLASS =
  "max-w-[min(94vw,960px)] max-h-[min(88vh,800px)] rounded-lg object-contain";
const PREVIEW_SHELL_CLASS =
  "block rounded-xl border border-border bg-surface shadow-2xl p-3 max-w-[min(96vw,1000px)]";

export function MediaHoverPreview({
  children,
  preview,
  interactive = false,
}: {
  children: ReactNode;
  preview: ReactNode;
  interactive?: boolean;
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
          className={`fixed z-[100] ${interactive ? "pointer-events-auto" : "pointer-events-none"}`}
          style={{
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <span className={PREVIEW_SHELL_CLASS}>{preview}</span>
        </span>
      )}
    </span>
  );
}

function ChartLinkThumb({
  url,
  dims,
  interactive,
  previewSrc,
}: {
  url: string;
  dims: string;
  interactive?: boolean;
  previewSrc: string;
}) {
  const inner = (
    <div
      className={`${dims} rounded-lg overflow-hidden border border-border relative bg-[#0b1220] shrink-0 cursor-zoom-in`}
    >
      <img
        src={previewSrc}
        alt="TradingView chart"
        className="w-full h-full object-cover"
        onError={(e) => {
          const el = e.currentTarget;
          el.style.display = "none";
          const fallback = el.nextElementSibling as HTMLElement | null;
          if (fallback) fallback.style.display = "flex";
        }}
      />
      <div
        className="absolute inset-0 hidden flex-col items-center justify-center text-primary bg-primary/10"
        aria-hidden
      >
        <span className="text-lg">📈</span>
      </div>
      <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[0.55rem] text-center text-primary py-0.5 font-medium">
        TradingView
      </span>
    </div>
  );

  if (interactive) {
    return (
      <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
        {inner}
      </a>
    );
  }

  return inner;
}

function ChartLinkHoverPreview({ url }: { url: string }) {
  const previewSrc = chartPreviewApiUrl(url);

  return (
    <div className="space-y-2 text-center">
      <img src={previewSrc} alt="" className={PREVIEW_IMAGE_CLASS} />
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        Open chart on TradingView ↗
      </a>
    </div>
  );
}

export function TradeMediaThumb({
  shot,
  size = "md",
  interactive = true,
}: {
  shot: TradeScreenshot;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
}) {
  const dims =
    size === "sm" ? "w-16 h-16" : size === "lg" ? "w-32 h-32" : "w-24 h-24";

  if (shot.signed_url) {
    return (
      <MediaHoverPreview
        preview={<img src={shot.signed_url} alt="" className={PREVIEW_IMAGE_CLASS} />}
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
    const previewSrc = chartPreviewApiUrl(shot.link_url);
    return (
      <MediaHoverPreview
        interactive={isTradingViewChartUrl(shot.link_url)}
        preview={<ChartLinkHoverPreview url={shot.link_url} />}
      >
        <ChartLinkThumb
          url={shot.link_url}
          dims={dims}
          interactive={interactive}
          previewSrc={previewSrc}
        />
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
