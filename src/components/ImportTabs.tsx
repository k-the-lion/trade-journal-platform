"use client";

import { useState } from "react";
import { CsvImportForm } from "@/components/CsvImportForm";
import { TopstepXSyncPanel } from "@/components/TopstepXSyncPanel";
import { TradovateSyncPanel } from "@/components/TradovateSyncPanel";
import type { ImportAdapterInfo } from "@/lib/imports";
import type { BrokerSyncConnectionPublic } from "@/lib/types/database";

type Tab = "csv" | "topstepx" | "tradovate";

function ImportHelpCard({
  title,
  steps,
  footnote,
}: {
  title: string;
  steps: string[];
  footnote?: string;
}) {
  return (
    <div className="card p-5 space-y-2 max-w-2xl">
      <h2 className="font-medium text-sm">{title}</h2>
      <ol className="text-xs text-muted list-decimal pl-4 space-y-1">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {footnote && <p className="text-xs text-muted pt-1">{footnote}</p>}
    </div>
  );
}

function SupportedCsvFormats({ adapters }: { adapters: ImportAdapterInfo[] }) {
  return (
    <div className="card p-5 space-y-3 max-w-2xl">
      <h2 className="font-medium text-sm">Supported CSV formats</h2>
      <ul className="text-sm text-muted space-y-2">
        {adapters.map((a) => (
          <li key={a.name}>
            <span className="text-foreground">{a.name}</span>
            {a.supportedFields && (
              <span className="block text-xs mt-0.5">
                Columns: {a.supportedFields.slice(0, 8).join(", ")}
                {a.supportedFields.length > 8 ? "…" : ""}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ImportTabs({
  orgOptions,
  accountOptions,
  strategyOptions,
  topstepxConnections,
  tradovateConnections,
  tradovateOAuthConfigured,
  tradovateOAuthRedirectUri,
  adapters,
}: {
  orgOptions: { id: string; name: string }[];
  accountOptions: { id: string; name: string; is_default?: boolean }[];
  strategyOptions: { id: string; name: string }[];
  topstepxConnections: BrokerSyncConnectionPublic[];
  tradovateConnections: BrokerSyncConnectionPublic[];
  tradovateOAuthConfigured: boolean;
  tradovateOAuthRedirectUri: string;
  adapters: ImportAdapterInfo[];
}) {
  const [tab, setTab] = useState<Tab>("csv");

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "csv", label: "CSV upload" },
    { id: "topstepx", label: "TopstepX API" },
    { id: "tradovate", label: "Tradovate API" },
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

      {tab === "csv" && (
        <div className="space-y-4">
          <CsvImportForm
            orgOptions={orgOptions}
            accountOptions={accountOptions}
            strategyOptions={strategyOptions}
          />
          <SupportedCsvFormats adapters={adapters} />
        </div>
      )}

      {tab === "topstepx" && (
        <div className="space-y-4">
          <TopstepXSyncPanel
            connections={topstepxConnections}
            accountOptions={accountOptions}
            strategyOptions={strategyOptions}
            orgOptions={orgOptions}
          />
          <ImportHelpCard
            title="How TopstepX API sync works"
            steps={[
              "Subscribe to the ProjectX API in TopstepX Settings (~$15–29/mo).",
              "Copy your dashboard username and API key.",
              "Verify credentials above, then pick your combine or funded account.",
              "First sync pulls up to 12 months of history; use Sync now for new trades.",
            ]}
          />
        </div>
      )}

      {tab === "tradovate" && (
        <div className="space-y-4">
          <TradovateSyncPanel
            oauthConfigured={tradovateOAuthConfigured}
            oauthRedirectUri={tradovateOAuthRedirectUri}
            connections={tradovateConnections}
            accountOptions={accountOptions}
            strategyOptions={strategyOptions}
            orgOptions={orgOptions}
          />
          <ImportHelpCard
            title="How Tradovate sync works"
            steps={[
              "Choose Live or Demo, then click Connect with Tradovate.",
              "Log in on Tradovate's site and approve read-only access.",
              "No API subscription is required on your Tradovate account.",
              "Pick the account to sync, then use Sync now to import trades.",
            ]}
            footnote={
              tradovateOAuthConfigured
                ? undefined
                : "OAuth is not enabled on this deployment yet — use the CSV upload tab with a Tradovate Orders export until it is."
            }
          />
        </div>
      )}
    </div>
  );
}
