"use client";

import { useMemo, useState, useTransition, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  bulkAssignStrategy,
  createTradingAccount,
  addTradeScreenshotLink,
  deleteTradeScreenshot,
  updateTradeJournal,
  uploadTradeScreenshot,
} from "@/lib/actions";
import { parseStrategyRules } from "@/lib/constants/strategies";
import { moodEmoji, moodLabel } from "@/lib/constants/trade-meta";
import { computeTradeStats, formatCurrency } from "@/lib/reports/stats";
import { isAllowedChartLink, normalizeChartLink } from "@/lib/screenshots";
import { MoodPicker } from "@/components/MoodPicker";
import { DeleteAllTradesPanel } from "@/components/DeleteAllTradesPanel";
import { DeleteTradeButton } from "@/components/DeleteTradeButton";
import { StatCard } from "@/components/StatCard";
import { TagPicker } from "@/components/TagPicker";
import { firstTradeMedia, TradeMediaThumb } from "@/components/TradeMediaThumb";
import type { Trade, TradingAccount, TradingStrategy, TradingTagPreset } from "@/lib/types/database";

type SortKey = "date" | "pnl" | "symbol" | "direction";
type SortDir = "asc" | "desc";
type OutcomeFilter = "all" | "wins" | "losses" | "breakeven";

export function TradeJournalBoard({
  initialTrades,
  accounts: initialAccounts,
  strategies,
  tagPresets,
}: {
  initialTrades: Trade[];
  accounts: TradingAccount[];
  strategies: TradingStrategy[];
  tagPresets: TradingTagPreset[];
}) {
  const [trades, setTrades] = useState(initialTrades);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [filterStrategyIds, setFilterStrategyIds] = useState<string[]>([]);
  const [filterTagNames, setFilterTagNames] = useState<string[]>([]);
  const [filterOutcome, setFilterOutcome] = useState<OutcomeFilter>("all");
  const [symbolSearch, setSymbolSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [selectedTradeIds, setSelectedTradeIds] = useState<string[]>([]);
  const [bulkStrategy, setBulkStrategy] = useState("");
  const [pending, startTransition] = useTransition();

  const allTagOptions = useMemo(() => {
    const set = new Set<string>();
    tagPresets.forEach((p) => set.add(p.name));
    trades.forEach((t) => t.trade_tags?.forEach((tt) => set.add(tt.tag)));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [trades, tagPresets]);

  const filtered = useMemo(() => {
    let list = trades;
    if (selectedAccountIds.length > 0) {
      list = list.filter(
        (t) => t.account_id && selectedAccountIds.includes(t.account_id)
      );
    }
    if (filterStrategyIds.length > 0) {
      list = list.filter(
        (t) => t.strategy_id && filterStrategyIds.includes(t.strategy_id)
      );
    }
    if (filterTagNames.length > 0) {
      list = list.filter((t) => {
        const tags = t.trade_tags?.map((x) => x.tag) ?? [];
        return filterTagNames.every((name) => tags.includes(name));
      });
    }
    if (filterOutcome === "wins") {
      list = list.filter((t) => Number(t.pnl) > 0);
    } else if (filterOutcome === "losses") {
      list = list.filter((t) => Number(t.pnl) < 0);
    } else if (filterOutcome === "breakeven") {
      list = list.filter((t) => Number(t.pnl) === 0);
    }
    if (symbolSearch.trim()) {
      const q = symbolSearch.trim().toUpperCase();
      list = list.filter((t) => t.symbol.toUpperCase().includes(q));
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
  }, [
    trades,
    selectedAccountIds,
    filterStrategyIds,
    filterTagNames,
    filterOutcome,
    symbolSearch,
    sortKey,
    sortDir,
  ]);

  const stats = useMemo(() => computeTradeStats(filtered), [filtered]);

  const handleJournalSave = useCallback(
    async (
      tradeId: string,
      notes: string,
      moodBefore: string,
      moodAfter: string,
      strategyId: string,
      ruleFollowed: string,
      tagsRaw: string
    ) => {
      const tags = tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const selected = strategies.find((s) => s.id === strategyId);

      await updateTradeJournal(tradeId, {
        notes: notes || null,
        mood_before: moodBefore || null,
        mood_after: moodAfter || null,
        emotional_state: moodAfter || moodBefore || null,
        strategy_id: strategyId || null,
        rule_followed:
          ruleFollowed === "yes" ? true : ruleFollowed === "no" ? false : null,
        tags,
      });
      setTrades((prev) =>
        prev.map((t) =>
          t.id === tradeId
            ? {
                ...t,
                notes: notes || null,
                mood_before: moodBefore || null,
                mood_after: moodAfter || null,
                emotional_state: moodAfter || moodBefore || null,
                strategy_id: strategyId || null,
                setup_tag: selected?.name ?? null,
                trading_strategies: selected ?? null,
                rule_followed:
                  ruleFollowed === "yes" ? true : ruleFollowed === "no" ? false : null,
                trade_tags: tags.map((tag, i) => ({
                  id: `local-${i}`,
                  trade_id: tradeId,
                  tag,
                })),
              }
            : t
        )
      );
    },
    [strategies]
  );

  const handleScreenshotLink = useCallback(async (tradeId: string, url: string) => {
    const inserted = await addTradeScreenshotLink(tradeId, url);
    setTrades((prev) =>
      prev.map((t) =>
        t.id === tradeId
          ? {
              ...t,
              trade_screenshots: [...(t.trade_screenshots ?? []), inserted],
            }
          : t
      )
    );
  }, []);

  function toggleStrategyFilter(id: string) {
    setFilterStrategyIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleTagFilter(name: string) {
    setFilterTagNames((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );
  }

  function clearAllFilters() {
    setSelectedAccountIds([]);
    setFilterStrategyIds([]);
    setFilterTagNames([]);
    setFilterOutcome("all");
    setSymbolSearch("");
  }

  const hasActiveFilters =
    selectedAccountIds.length > 0 ||
    filterStrategyIds.length > 0 ||
    filterTagNames.length > 0 ||
    filterOutcome !== "all" ||
    symbolSearch.trim().length > 0;

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
      const selected = strategies.find((s) => s.id === bulkStrategy);
      setTrades((prev) =>
        prev.map((t) =>
          ids.includes(t.id)
            ? {
                ...t,
                strategy_id: bulkStrategy,
                setup_tag: selected?.name ?? null,
                trading_strategies: selected ?? null,
              }
            : t
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
            <h2 className="font-medium text-sm">Filters</h2>
            <p className="text-xs text-muted mt-0.5">
              Narrow by account, outcome, strategy, tags, or symbol
            </p>
          </div>
          <div className="flex gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={clearAllFilters}
              >
                Clear all filters
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary text-xs py-1.5 px-3"
              onClick={() => setShowAccountForm((v) => !v)}
            >
              {showAccountForm ? "Cancel" : "+ Add account"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted mb-2">Outcome</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "All"],
                  ["wins", "Wins"],
                  ["losses", "Losses"],
                  ["breakeven", "Breakeven"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilterOutcome(key)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    filterOutcome === key
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted hover:border-primary/40"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted mb-2">Symbol search</p>
            <input
              className="input text-sm py-1.5"
              value={symbolSearch}
              onChange={(e) => setSymbolSearch(e.target.value)}
              placeholder="e.g. NQ, ES, MNQ"
            />
          </div>
        </div>

        <div>
          <p className="text-xs text-muted mb-2">Accounts</p>
          <div className="flex flex-wrap gap-2">
            {accounts.length === 0 ? (
              <p className="text-sm text-muted">No accounts yet.</p>
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
          </div>
        </div>

        {strategies.length > 0 && (
          <div>
            <p className="text-xs text-muted mb-2">Strategies</p>
            <div className="flex flex-wrap gap-2">
              {strategies.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleStrategyFilter(s.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    filterStrategyIds.includes(s.id)
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted hover:border-primary/40"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {allTagOptions.length > 0 && (
          <div>
            <p className="text-xs text-muted mb-2">Tags</p>
            <div className="flex flex-wrap gap-2">
              {allTagOptions.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTagFilter(tag)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    filterTagNames.includes(tag)
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted hover:border-primary/40"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

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
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {strategies.length === 0 && (
              <Link href="/strategies" className="text-xs text-primary hover:underline">
                Create strategies first
              </Link>
            )}
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
                onAddLink={(url) => handleScreenshotLink(trade.id, url)}
                onDeleteScreenshot={handleScreenshotDelete}
                onDeleted={handleDeleteTrade}
                strategies={strategies}
                tagPresets={tagPresets}
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
  onAddLink,
  onDeleteScreenshot,
  onDeleted,
  strategies,
  tagPresets,
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
    moodBefore: string,
    moodAfter: string,
    strategyId: string,
    ruleFollowed: string,
    tags: string
  ) => Promise<void>;
  onUpload: (file: File) => void;
  onAddLink: (url: string) => Promise<void>;
  onDeleteScreenshot: (id: string) => void;
  onDeleted: (tradeId: string) => void;
  strategies: TradingStrategy[];
  tagPresets: TradingTagPreset[];
}) {
  const [notes, setNotes] = useState(trade.notes ?? "");
  const [moodBefore, setMoodBefore] = useState(
    trade.mood_before ?? trade.emotional_state ?? ""
  );
  const [moodAfter, setMoodAfter] = useState(
    trade.mood_after ?? trade.emotional_state ?? ""
  );
  const [strategyId, setStrategyId] = useState(trade.strategy_id ?? "");
  const [ruleFollowed, setRuleFollowed] = useState(
    trade.rule_followed === true ? "yes" : trade.rule_followed === false ? "no" : ""
  );
  const [tags, setTags] = useState(
    trade.trade_tags?.map((t) => t.tag).join(", ") ?? ""
  );
  const [chartLink, setChartLink] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [linkStatus, setLinkStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const skipJournalSaveRef = useRef(true);
  const addingLinkRef = useRef(false);

  const screenshots = trade.trade_screenshots ?? [];

  useEffect(() => {
    setNotes(trade.notes ?? "");
    setMoodBefore(trade.mood_before ?? trade.emotional_state ?? "");
    setMoodAfter(trade.mood_after ?? trade.emotional_state ?? "");
    setStrategyId(trade.strategy_id ?? "");
    setRuleFollowed(
      trade.rule_followed === true ? "yes" : trade.rule_followed === false ? "no" : ""
    );
    setTags(trade.trade_tags?.map((t) => t.tag).join(", ") ?? "");
    setChartLink("");
    skipJournalSaveRef.current = true;
  }, [trade.id]);

  useEffect(() => {
    if (!expanded) return;
    if (skipJournalSaveRef.current) {
      skipJournalSaveRef.current = false;
      return;
    }

    const timer = window.setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await onSave(trade.id, notes, moodBefore, moodAfter, strategyId, ruleFollowed, tags);
        setSaveStatus("saved");
        window.setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("error");
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [expanded, trade.id, notes, moodBefore, moodAfter, strategyId, ruleFollowed, tags, onSave]);

  useEffect(() => {
    if (!expanded || !chartLink.trim() || addingLinkRef.current) return;

    const normalized = normalizeChartLink(chartLink);
    if (!isAllowedChartLink(normalized)) return;

    const exists = screenshots.some(
      (s) => normalizeChartLink(s.link_url ?? "") === normalized
    );
    if (exists) return;

    const timer = window.setTimeout(async () => {
      addingLinkRef.current = true;
      setLinkStatus("saving");
      try {
        await onAddLink(normalized);
        setChartLink("");
        setLinkStatus("saved");
        window.setTimeout(() => setLinkStatus("idle"), 2000);
      } catch {
        setLinkStatus("error");
      } finally {
        addingLinkRef.current = false;
      }
    }, 600);

    return () => window.clearTimeout(timer);
  }, [chartLink, expanded, screenshots, onAddLink]);

  const selectedStrategy =
    strategies.find((s) => s.id === strategyId) ?? trade.trading_strategies ?? null;
  const strategyRules = selectedStrategy
    ? parseStrategyRules(selectedStrategy.rules)
    : [];

  const accountName = trade.trading_accounts?.name;
  const pnl = Number(trade.pnl);
  const thumb = firstTradeMedia(screenshots);
  const extraTags = trade.trade_tags?.map((t) => t.tag) ?? [];

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
        {thumb ? (
          <div className="shrink-0 mt-0.5" onClick={(e) => e.stopPropagation()}>
            <TradeMediaThumb shot={thumb} size="sm" interactive={false} />
          </div>
        ) : (
          <div className="w-16 h-16 rounded border border-dashed border-border flex items-center justify-center text-muted text-xs shrink-0 mt-0.5">
            No img
          </div>
        )}
        <button
          type="button"
          className="flex-1 min-w-0 text-left"
          onClick={onToggle}
        >
          <div className="flex flex-wrap gap-3 items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{trade.symbol}</span>
                <span className="text-xs capitalize text-muted">
                  {trade.direction}
                </span>
                {(trade.mood_before || trade.mood_after || trade.emotional_state) && (
                  <span className="inline-flex items-center gap-0.5 text-lg" title="Before → after mood">
                    <span title={moodLabel(trade.mood_before ?? trade.emotional_state)}>
                      {moodEmoji(trade.mood_before ?? trade.emotional_state)}
                    </span>
                    <span className="text-muted text-xs">→</span>
                    <span title={moodLabel(trade.mood_after ?? trade.emotional_state)}>
                      {moodEmoji(trade.mood_after ?? trade.emotional_state)}
                    </span>
                  </span>
                )}
                {trade.setup_tag && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {trade.setup_tag}
                  </span>
                )}
                {extraTags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-muted border border-border/60"
                  >
                    {tag}
                  </span>
                ))}
                {trade.rule_followed === false && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-danger/15 text-danger">
                    Rules broken
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
          <div className={`text-sm font-medium shrink-0 ${pnl >= 0 ? "positive" : "negative"}`}>
            {formatCurrency(pnl)}
          </div>
        </div>
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pl-0 sm:pl-[4.75rem] space-y-4 border-t border-border/40 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">Changes save automatically</p>
            <p className="text-xs text-muted">
              {saveStatus === "saving" && "Saving…"}
              {saveStatus === "saved" && <span className="text-success">Saved</span>}
              {saveStatus === "error" && <span className="text-danger">Save failed</span>}
              {linkStatus === "saving" && " · Adding chart link…"}
              {linkStatus === "saved" && (
                <span className="text-success"> · Chart link added</span>
              )}
              {linkStatus === "error" && (
                <span className="text-danger"> · Could not add link</span>
              )}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="label mb-2">How did you feel before the trade?</p>
              <MoodPicker value={moodBefore} onChange={setMoodBefore} />
            </div>
            <div>
              <p className="label mb-2">How did you feel after the trade?</p>
              <MoodPicker value={moodAfter} onChange={setMoodAfter} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Strategy</label>
              <select
                className="input"
                value={strategyId}
                onChange={(e) => setStrategyId(e.target.value)}
              >
                <option value="">—</option>
                {strategies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {strategies.length === 0 && (
                <Link href="/strategies" className="text-xs text-primary hover:underline mt-1 inline-block">
                  Create strategies →
                </Link>
              )}
            </div>
            <div>
              <label className="label">Extra tags</label>
              <p className="text-xs text-muted mb-1.5">
                Quick labels for what you did (R:R, session, setup quality)
              </p>
              <TagPicker value={tags} onChange={setTags} presets={tagPresets} />
            </div>
          </div>

          {selectedStrategy && strategyRules.length > 0 && (
            <div className="rounded-lg border border-border/60 p-3 bg-background/40">
              <p className="text-xs font-medium text-muted mb-2">
                Rules for {selectedStrategy.name}
              </p>
              <ul className="text-sm text-muted space-y-1 list-disc pl-5">
                {strategyRules.map((rule, i) => (
                  <li key={i}>{rule}</li>
                ))}
              </ul>
            </div>
          )}

          {selectedStrategy && (
            <div>
              <label className="label">
                Did you follow {selectedStrategy.name} rules?
              </label>
              <select
                className="input max-w-xs"
                value={ruleFollowed}
                onChange={(e) => setRuleFollowed(e.target.value)}
              >
                <option value="">—</option>
                <option value="yes">Yes — followed all rules</option>
                <option value="no">No — broke rules</option>
              </select>
            </div>
          )}

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
            <label className="label">Screenshots & chart links</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {screenshots.map((shot) => (
                <div key={shot.id} className="relative group">
                  <TradeMediaThumb shot={shot} size="md" />
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
            <input
              className="input w-full text-sm mt-3"
              value={chartLink}
              onChange={(e) => setChartLink(e.target.value)}
              placeholder="Paste TradingView link — saves automatically"
            />
          </div>

          <div className="flex flex-wrap gap-2">
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
