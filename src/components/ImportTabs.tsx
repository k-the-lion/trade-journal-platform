"use client";

import { useState } from "react";
import { CsvImportForm } from "@/components/CsvImportForm";
import { TopstepXSyncPanel } from "@/components/TopstepXSyncPanel";
import { TradovateSyncPanel } from "@/components/TradovateSyncPanel";
import type { BrokerSyncConnectionPublic } from "@/lib/types/database";

type Tab = "topstepx" | "tradovate" | "csv";

export function ImportTabs({
  orgOptions,
  accountOptions,
  strategyOptions,
  topstepxConnections,
  tradovateConnections,
  tradovateOAuthConfigured,
  tradovateOAuthRedirectUri,
}: {
  orgOptions: { id: string; name: string }[];
  accountOptions: { id: string; name: string; is_default?: boolean }[];
  strategyOptions: { id: string; name: string }[];
  topstepxConnections: BrokerSyncConnectionPublic[];
  tradovateConnections: BrokerSyncConnectionPublic[];
  tradovateOAuthConfigured: boolean;
  tradovateOAuthRedirectUri: string;
}) {
  const [tab, setTab] = useState<Tab>("topstepx");

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "topstepx", label: "TopstepX API" },
    { id: "tradovate", label: "Tradovate API" },
    { id: "csv", label: "CSV upload" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`text-sm px-4 py-2 rounded-full border transition-colors ${
              tab === id
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted hover:border-primary/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "topstepx" ? (
        <TopstepXSyncPanel
          connections={topstepxConnections}
          accountOptions={accountOptions}
          strategyOptions={strategyOptions}
          orgOptions={orgOptions}
        />
      ) : tab === "tradovate" ? (
        <TradovateSyncPanel
          oauthConfigured={tradovateOAuthConfigured}
          oauthRedirectUri={tradovateOAuthRedirectUri}
          connections={tradovateConnections}
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
