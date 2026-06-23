"use client";

import { useState } from "react";
import { createTrade, updateTrade } from "@/lib/actions";
import { DEFAULT_STRATEGIES } from "@/lib/constants/trade-meta";
import { MoodPicker } from "@/components/MoodPicker";
import type { AccountType, Trade, TradeDirection } from "@/lib/types/database";

interface TradeFormProps {
  trade?: Trade;
  orgOptions?: { id: string; name: string }[];
  accountOptions?: { id: string; name: string }[];
}

export function TradeForm({
  trade,
  orgOptions = [],
  accountOptions = [],
}: TradeFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mood, setMood] = useState(trade?.emotional_state ?? "");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const tagsRaw = String(fd.get("tags") || "");
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const input = {
      traded_at: new Date(String(fd.get("traded_at"))).toISOString(),
      symbol: String(fd.get("symbol")).toUpperCase(),
      direction: String(fd.get("direction")) as TradeDirection,
      entry_price: fd.get("entry_price") ? Number(fd.get("entry_price")) : null,
      exit_price: fd.get("exit_price") ? Number(fd.get("exit_price")) : null,
      quantity: Number(fd.get("quantity")) || 1,
      pnl: Number(fd.get("pnl")),
      r_multiple: fd.get("r_multiple") ? Number(fd.get("r_multiple")) : null,
      setup_tag: String(fd.get("setup_tag") || "") || null,
      notes: String(fd.get("notes") || "") || null,
      emotional_state: mood || String(fd.get("emotional_state") || "") || null,
      rule_followed:
        fd.get("rule_followed") === "yes"
          ? true
          : fd.get("rule_followed") === "no"
            ? false
            : null,
      account_type: (String(fd.get("account_type") || "") || null) as AccountType | null,
      account_id: String(fd.get("account_id") || "") || null,
      org_id: String(fd.get("org_id") || "") || null,
      tags,
    };

    try {
      if (trade) {
        await updateTrade(trade.id, input);
        window.location.href = `/trades/${trade.id}`;
      } else {
        await createTrade(input);
        window.location.href = "/dashboard";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save trade");
      setLoading(false);
    }
  }

  const tradedAtDefault = trade
    ? trade.traded_at.slice(0, 16)
    : new Date().toISOString().slice(0, 16);

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-5 max-w-2xl">
      {error && (
        <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-md p-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="traded_at">Date & time</label>
          <input id="traded_at" name="traded_at" type="datetime-local" className="input" defaultValue={tradedAtDefault} required />
        </div>
        <div>
          <label className="label" htmlFor="symbol">Symbol</label>
          <input id="symbol" name="symbol" className="input" defaultValue={trade?.symbol ?? ""} placeholder="ES, NQ, AAPL" required />
        </div>
        <div>
          <label className="label" htmlFor="direction">Direction</label>
          <select id="direction" name="direction" className="input" defaultValue={trade?.direction ?? "long"}>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </div>
        {accountOptions.length > 0 ? (
          <div>
            <label className="label" htmlFor="account_id">Trading account</label>
            <select id="account_id" name="account_id" className="input" defaultValue={trade?.account_id ?? ""}>
              <option value="">—</option>
              {accountOptions.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="label" htmlFor="account_type">Account type</label>
            <select id="account_type" name="account_type" className="input" defaultValue={trade?.account_type ?? ""}>
              <option value="">—</option>
              <option value="eval">Eval</option>
              <option value="funded">Funded</option>
              <option value="personal">Personal</option>
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="entry_price">Entry price</label>
          <input id="entry_price" name="entry_price" type="number" step="any" className="input" defaultValue={trade?.entry_price ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="exit_price">Exit price</label>
          <input id="exit_price" name="exit_price" type="number" step="any" className="input" defaultValue={trade?.exit_price ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="quantity">Quantity / contracts</label>
          <input id="quantity" name="quantity" type="number" step="any" className="input" defaultValue={trade?.quantity ?? 1} required />
        </div>
        <div>
          <label className="label" htmlFor="pnl">P&L ($)</label>
          <input id="pnl" name="pnl" type="number" step="any" className="input" defaultValue={trade?.pnl ?? ""} required />
        </div>
        <div>
          <label className="label" htmlFor="r_multiple">R-multiple</label>
          <input id="r_multiple" name="r_multiple" type="number" step="any" className="input" defaultValue={trade?.r_multiple ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="setup_tag">Strategy</label>
          <select id="setup_tag" name="setup_tag" className="input" defaultValue={trade?.setup_tag ?? ""}>
            <option value="">—</option>
            {DEFAULT_STRATEGIES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="rule_followed">Rule followed?</label>
          <select id="rule_followed" name="rule_followed" className="input" defaultValue={
            trade?.rule_followed === true ? "yes" : trade?.rule_followed === false ? "no" : ""
          }>
            <option value="">—</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        {orgOptions.length > 0 && (
          <div>
            <label className="label" htmlFor="org_id">Organization</label>
            <select id="org_id" name="org_id" className="input" defaultValue={trade?.org_id ?? ""}>
              <option value="">Solo (none)</option>
              {orgOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div>
        <p className="label mb-2">How did you feel about this trade?</p>
        <MoodPicker value={mood} onChange={setMood} />
      </div>

      <div>
        <label className="label" htmlFor="tags">Extra tags (comma-separated)</label>
        <input id="tags" name="tags" className="input" defaultValue={trade?.trade_tags?.map((t) => t.tag).join(", ") ?? ""} />
      </div>

      <div>
        <label className="label" htmlFor="notes">Journal notes</label>
        <textarea id="notes" name="notes" rows={4} className="input resize-y" defaultValue={trade?.notes ?? ""} placeholder="What was your read? What would you repeat or change?" />
      </div>

      <div className="flex gap-3">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Saving..." : trade ? "Update trade" : "Log trade"}
        </button>
        <a href={trade ? `/trades/${trade.id}` : "/dashboard"} className="btn btn-secondary">
          Cancel
        </a>
      </div>
    </form>
  );
}
