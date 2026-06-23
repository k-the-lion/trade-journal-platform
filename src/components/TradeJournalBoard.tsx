"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  bulkAssignStrategy,
  createTradingAccount,
  deleteTradeScreenshot,
  updateTradeJournal,
  uploadTradeScreenshot,
} from "@/lib/actions";
import { DEFAULT_STRATEGIES, moodEmoji, moodLabel } from "@/lib/constants/trade-meta";
import { computeTradeStats, formatCurrency } from "@/lib/reports/stats";
import { MoodPicker } from "@/components/MoodPicker";
import { DeleteAllTradesPanel } from "@/components/DeleteAllTradesPanel";
import { DeleteTradeButton } from "@/components/DeleteTradeButton";
import { StatCard } from "@/components/StatCard";
import type { Trade, TradingAccount } from "@/lib/types/database";

type SortKey = "date" | "pnl" | "symbol" | "direction";
type SortDir = "asc" | "desc";

export function TradeJournalBoard({
  initialTrades,
  accounts: initialAccounts,
}: {
  initialTrades: Trade[];
  accounts: TradingAccount[];
}) {
  const [trades, setTrades] = useState(initialTrades);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [selectedTradeIds, setSelectedTradeIds] = useState<string[]>([]);
  const [bulkStrategy, setBulkStrategy] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    let list = trades;
    if (selectedAccountIds.length > 0) {
      list = list.filter(
        (t) => t.account_id && selectedAccountIds.includes(t.account_id)
      );
    }

    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "pnl":
          cmp = Number(a.pnl) - Number(b.pnl);
          break;
        case "symbol":
          cmp = a.symbol.localeCompare(b.symbol);
          break;
        case "direction":
          cmp = a.direction.localeCompare(b.direction);
          break;
        default:
          cmp =
            new Date(a.traded_at).getTime() - new Date(b.traded_at).getTime();
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [trades, selectedAccountIds, sortKey, sortDir]);

  const stats = useMemo(() => computeTradeStats(filtered), [filtered]);

  function toggleAccount(id: string) {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  async function handleJournalSave(
    tradeId: string,
    notes: string,
    mood: string,
    strategy: string,
    tagsRaw: string
  ) {
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    startTransition(async () => {
      await updateTradeJournal(tradeId, {
        notes: notes || null,
        emotional_state: mood || null,
        setup_tag: strategy || null,
        tags,
      });
      setTrades((prev) =>
        prev.map((t) =>
          t.id === tradeId
            ? {
                ...t,
                notes: notes || null,
                emotional_state: mood || null,
                setup_tag: strategy || null,
                trade_tags: tags.map((tag, i) => ({
                  id: `local-${i}`,
                  trade_id: tradeId,
                  tag,
                })),
              }
            : t
        )
      );
    });
  }

  async function handleScreenshotUpload(tradeId: string, file: File) {
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      await uploadTradeScreenshot(tradeId, fd);
      window.location.reload();
    });
  }

  async function handleScreenshotDelete(screenshotId: string) {
    startTransition(async () => {
      await deleteTradeScreenshot(screenshotId);
      window.location.reload();
    });
  }

  async function handleCreateAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const account = await createTradingAccount({
      name: String(fd.get("name")),
      broker: String(fd.get("broker") || "") || null,
      account_type: (String(fd.get("account_type") || "") || null) as
        | "eval"
        | "funded"
        | "personal"
        | null,
      is_default: fd.get("is_default") === "on",
    });
    setAccounts((prev) => [...prev, account]);
    setShowAccountForm(false);
    e.currentTarget.reset();
  }

  async function handleDeleteTrade(tradeId: string) {
    setTrades((prev) => prev.filter((t) => t.id !== tradeId));
    setSelectedTradeIds((prev) => prev.filter((id) => id !== tradeId));
    if (expandedId === tradeId) setExpandedId(null);
  }

  function toggleTradeSelection(tradeId: string) {
    setSelectedTradeIds((prev) =>
      prev.includes(tradeId)
        ? prev.filter((id) => id !== tradeId)
        : [...prev, tradeId]
    );
  }

  function toggleSelectAllVisible() {
    const visibleIds = filtered.map((t) => t.id);
    const allSelected = visibleIds.every((id) => selectedTradeIds.includes(id));
    if (allSelected) {
      setSelectedTradeIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedTradeIds((prev) => [...new Set([...prev, ...visibleIds])]);
    }
  }

  async function handleBulkStrategy(applyTo: "selected" | "visible") {
    const ids =
      applyTo === "selected"
        ? selectedTradeIds
        : filtered.map((t) => t.id);
    if (!bulkStrategy || ids.length === 0) return;

    startTransition(async () => {
      await bulkAssignStrategy(ids, bulkStrategy);
      setTrades((prev) =>
        prev.map((t) =>
          ids.includes(t.id) ? { ...t, setup_tag: bulkStrategy } : t
        )
      );
      setSelectedTradeIds([]);
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total P&L"
          value={formatCurrency(stats.totalPnl)}
          positive={
            stats.totalPnl > 0 ? true : stats.totalPnl < 0 ? false : null
          }
        />
        <StatCard
          label="Win rate"
          value={`${stats.winRate}%`}
          sub={`${stats.totalTrades} trades`}
        />
        <StatCard label="Profit factor" value={String(stats.profitFactor)} />
        <StatCard label="Rule adherence" value={`${stats.ruleFollowedPct}%`} />
      </div>

      <div className="card p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div>
            <h2 className="font-medium text-sm">Accounts</h2>
            <p className="text-xs text-muted mt-0.5">
              Filter by account — select none to show all
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary text-xs py-1.5 px-3"
            onClick={() => setShowAccountForm((v) => !v)}
          >
            {showAccountForm ? "Cancel" : "+ Add account"}
          </button>
        </div>

        {showAccountForm && (
          <form
            onSubmit={handleCreateAccount}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 rounded-lg border border-border/60 bg-background/40"
          >
            <input
              name="name"
              className="input"
              placeholder="Account name"
              required
            />
            <input name="broker" className="input" placeholder="Broker (optional)" />
            <select name="account_type" className="input" defaultValue="">
              <option value="">Type —</option>
              <option value="eval">Eval</option>
              <option value="funded">Funded</option>
              <option value="personal">Personal</option>
            </select>
            <div className="flex items-center gap-3">
              <label className="text-xs text-muted flex items-center gap-1.5">
                <input type="checkbox" name="is_default" /> Default
              </label>
              <button type="submit" className="btn btn-primary text-xs py-1.5 px-3">
                Save
              </button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap gap-2">
          {accounts.length === 0 ? (
            <p className="text-sm text-muted">
              No accounts yet — add one to organize imports and trades.
            </p>
          ) : (
            accounts.map((acc) => (
              <button
                key={acc.id}
                type="button"
                onClick={() => toggleAccount(acc.id)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  selectedAccountIds.includes(acc.id)
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted hover:border-primary/40"
                }`}
              >
                {acc.name}
                {acc.is_default && " ★"}
              </button>
            ))
          )}
          {selectedAccountIds.length > 0 && (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => setSelectedAccountIds([])}
            >
              Clear filter
            </button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex flex-wrap gap-3 justify-between items-center">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={
                  filtered.length > 0 &&
                  filtered.every((t) => selectedTradeIds.includes(t.id))
                }
                onChange={toggleSelectAllVisible}
              />
              Select visible
            </label>
            <h2 className="font-medium">Trade journal</h2>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {(
              [
                ["date", "Date"],
                ["pnl", "P&L"],
                ["symbol", "Symbol"],
                ["direction", "Direction"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleSort(key)}
                className={`px-2.5 py-1 rounded border ${
                  sortKey === key
                    ? "border-primary text-primary"
                    : "border-border text-muted"
                }`}
              >
                {label}
                {sortIndicator(key)}
              </button>
            ))}
          </div>
        </div>

        {(selectedTradeIds.length > 0 || filtered.length > 0) && (
          <div className="px-4 py-2 border-b border-border/50 bg-background/30 flex flex-wrap gap-2 items-center text-sm">
            <select
              className="input max-w-[180px] text-sm py-1.5"
              value={bulkStrategy}
              onChange={(e) => setBulkStrategy(e.target.value)}
            >
              <option value="">Bulk strategy…</option>
              {DEFAULT_STRATEGIES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {selectedTradeIds.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary text-xs py-1.5"
                disabled={!bulkStrategy || pending}
                onClick={() => handleBulkStrategy("selected")}
              >
                Apply to {selectedTradeIds.length} selected
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary text-xs py-1.5"
              disabled={!bulkStrategy || pending || filtered.length === 0}
              onClick={() => handleBulkStrategy("visible")}
            >
              Apply to all visible ({filtered.length})
            </button>
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted">
            No trades match this filter.{" "}
            <Link href="/trades/new" className="text-primary hover:underline">
              Log a trade
            </Link>{" "}
            or{" "}
            <Link href="/import" className="text-primary hover:underline">
              import
            </Link>
            .
          </p>
        ) : (
          <div className="divide-y divide-border/50 max-h-[70vh] overflow-y-auto">
            {filtered.map((trade) => (
              <TradeJournalRow
                key={trade.id}
                trade={trade}
                selected={selectedTradeIds.includes(trade.id)}
                onSelectToggle={() => toggleTradeSelection(trade.id)}
                expanded={expandedId === trade.id}
                pending={pending}
                onToggle={() =>
                  setExpandedId((id) => (id === trade.id ? null : trade.id))
                }
                onSave={handleJournalSave}
                onUpload={(file) => handleScreenshotUpload(trade.id, file)}
                onDeleteScreenshot={handleScreenshotDelete}
                onDeleted={handleDeleteTrade}
              />
            ))}
          </div>
        )}
      </div>

      <DeleteAllTradesPanel tradeCount={trades.length} />
    </div>
  );
}

function TradeJournalRow({
  trade,
  selected,
  onSelectToggle,
  expanded,
  pending,
  onToggle,
  onSave,
  onUpload,
  onDeleteScreenshot,
  onDeleted,
}: {
  trade: Trade;
  selected: boolean;
  onSelectToggle: () => void;
  expanded: boolean;
  pending: boolean;
  onToggle: () => void;
  onSave: (
    id: string,
    notes: string,
    mood: string,
    strategy: string,
    tags: string
  ) => void;
  onUpload: (file: File) => void;
  onDeleteScreenshot: (id: string) => void;
  onDeleted: (tradeId: string) => void;
}) {
  const [notes, setNotes] = useState(trade.notes ?? "");
  const [mood, setMood] = useState(trade.emotional_state ?? "");
  const [strategy, setStrategy] = useState(trade.setup_tag ?? "");
  const [tags, setTags] = useState(
    trade.trade_tags?.map((t) => t.tag).join(", ") ?? ""
  );

  const accountName = trade.trading_accounts?.name;
  const screenshots = trade.trade_screenshots ?? [];
  const pnl = Number(trade.pnl);

  return (
    <div className="p-4 hover:bg-background/30 transition-colors">
      <div className="flex gap-3 items-start">
        <input
          type="checkbox"
          className="mt-2 shrink-0"
          checked={selected}
          onChange={onSelectToggle}
          onClick={(e) => e.stopPropagation()}
        />
      <button
        type="button"
        className="flex-1 min-w-0 text-left"
        onClick={onToggle}
      >
        <div className="flex flex-wrap gap-3 items-start justify-between">
          <div className="flex gap-3 min-w-0 flex-1">
            {screenshots[0]?.signed_url ? (
              <img
                src={screenshots[0].signed_url}
                alt=""
                className="w-16 h-16 rounded object-cover border border-border shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded border border-dashed border-border flex items-center justify-center text-muted text-xs shrink-0">
                No img
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{trade.symbol}</span>
                <span className="text-xs capitalize text-muted">
                  {trade.direction}
                </span>
                <span className="text-lg" title={moodLabel(trade.emotional_state)}>
                  {moodEmoji(trade.emotional_state)}
                </span>
                {trade.setup_tag && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {trade.setup_tag}
                  </span>
                )}
                {accountName && (
                  <span className="text-xs text-muted">{accountName}</span>
                )}
              </div>
              <p className="text-xs text-muted mt-0.5">
                {trade.traded_at.slice(0, 16).replace("T", " ")}
              </p>
              {trade.notes && !expanded && (
                <p className="text-sm text-muted mt-1 line-clamp-1">{trade.notes}</p>
              )}
            </div>
          </div>
          <div className={`text-sm font-medium shrink-0 ${pnl >= 0 ? "positive" : "negative"}`}>
            {formatCurrency(pnl)}
          </div>
        </div>
      </button>
      </div>

      {expanded && (
        <div className="mt-4 pl-0 sm:pl-[4.75rem] space-y-4 border-t border-border/40 pt-4">
          <div>
            <p className="label mb-2">How did you feel?</p>
            <MoodPicker value={mood} onChange={setMood} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Strategy</label>
              <select
                className="input"
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
              >
                <option value="">—</option>
                {DEFAULT_STRATEGIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Extra tags</label>
              <input
                className="input"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="comma-separated"
              />
            </div>
          </div>

          <div>
            <label className="label">Journal notes</label>
            <textarea
              className="input resize-y min-h-[100px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What happened? What would you do differently?"
            />
          </div>

          <div>
            <label className="label">Screenshots</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {screenshots.map((shot) => (
                <div key={shot.id} className="relative group">
                  {shot.signed_url && (
                    <a href={shot.signed_url} target="_blank" rel="noreferrer">
                      <img
                        src={shot.signed_url}
                        alt=""
                        className="w-24 h-24 rounded object-cover border border-border"
                      />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => onDeleteScreenshot(shot.id)}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-danger text-white text-xs opacity-0 group-hover:opacity-100"
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
              <label className="w-24 h-24 rounded border border-dashed border-border flex flex-col items-center justify-center cursor-pointer text-xs text-muted hover:border-primary/50">
                + Upload
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUpload(f);
                  }}
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary text-sm"
              disabled={pending}
              onClick={() => onSave(trade.id, notes, mood, strategy, tags)}
            >
              {pending ? "Saving..." : "Save journal"}
            </button>
            <Link
              href={`/trades/${trade.id}`}
              className="btn btn-secondary text-sm"
            >
              Full trade details
            </Link>
            <DeleteTradeButton
              tradeId={trade.id}
              tradeLabel={`${trade.symbol} (${formatCurrency(pnl)})`}
              onDeleted={onDeleted}
              className="btn btn-danger text-sm ml-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}
