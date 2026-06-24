"use client";

import { useState } from "react";
import { CsvImportForm } from "@/components/CsvImportForm";
import { TopstepXSyncPanel } from "@/components/TopstepXSyncPanel";
import type { BrokerSyncConnectionPublic } from "@/lib/types/database";

type Tab = "csv" | "topstepx";

export function ImportTabs({
  orgOptions,
  accountOptions,
  strategyOptions,
  connections,
}: {
  orgOptions: { id: string; name: string }[];
  accountOptions: { id: string; name: string; is_default?: boolean }[];
  strategyOptions: { id: string; name: string }[];
  connections: BrokerSyncConnectionPublic[];
}) {
  const [tab, setTab] = useState<Tab>("topstepx");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("topstepx")}
          className={`text-sm px-4 py-2 rounded-full border transition-colors ${
            tab === "topstepx"
              ? "border-primary bg-primary/15 text-primary"
              : "border-border text-muted hover:border-primary/40"
          }`}
        >
          TopstepX API sync
        </button>
        <button
          type="button"
          onClick={() => setTab("csv")}
          className={`text-sm px-4 py-2 rounded-full border transition-colors ${
            tab === "csv"
              ? "border-primary bg-primary/15 text-primary"
              : "border-border text-muted hover:border-primary/40"
          }`}
        >
          CSV upload
        </button>
        <span className="text-xs text-muted self-center">Tradovate API — coming soon</span>
      </div>

      {tab === "topstepx" ? (
        <TopstepXSyncPanel
          connections={connections}
          accountOptions={accountOptions}
          strategyOptions={strategyOptions}
          orgOptions={orgOptions}
        />
      ) : (
        <CsvImportForm
          orgOptions={orgOptions}
          accountOptions={accountOptions}
          strategyOptions={strategyOptions}
        />
      )}
    </div>
  );
}
