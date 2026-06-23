"use client";

import { useState, useTransition } from "react";
import {
  createStrategy,
  deleteStrategy,
  seedStrategyTemplates,
  updateStrategy,
} from "@/lib/actions";
import { parseStrategyRules } from "@/lib/constants/strategies";
import type { TradingStrategy } from "@/lib/types/database";

export function StrategyManager({
  initialStrategies,
}: {
  initialStrategies: TradingStrategy[];
}) {
  const [strategies, setStrategies] = useState(initialStrategies);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const editing = strategies.find((s) => s.id === editingId);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const strategy = await createStrategy({
        name: String(fd.get("name")),
        description: String(fd.get("description") || "") || null,
        rules: String(fd.get("rules")),
      });
      setStrategies((prev) => [...prev, strategy as TradingStrategy]);
      e.currentTarget.reset();
    });
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingId) return;
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const updated = await updateStrategy(editingId, {
        name: String(fd.get("name")),
        description: String(fd.get("description") || "") || null,
        rules: String(fd.get("rules")),
      });
      setStrategies((prev) =>
        prev.map((s) => (s.id === editingId ? (updated as TradingStrategy) : s))
      );
      setEditingId(null);
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Permanently delete strategy "${name}"? Trades will keep their P&L but lose this strategy link.`)) {
      return;
    }
    startTransition(async () => {
      await deleteStrategy(id);
      setStrategies((prev) => prev.filter((s) => s.id !== id));
      if (editingId === id) setEditingId(null);
    });
  }

  function handleSeedTemplates() {
    startTransition(async () => {
      const { added } = await seedStrategyTemplates();
      window.location.reload();
      if (added === 0) alert("Starter templates already added.");
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {strategies.length === 0 && (
        <div className="card p-5 text-sm text-muted space-y-3">
          <p>No strategies yet. Create your own or add starter templates with example rules.</p>
          <button
            type="button"
            className="btn btn-secondary text-sm"
            onClick={handleSeedTemplates}
            disabled={pending}
          >
            Add starter templates
          </button>
        </div>
      )}

      <form onSubmit={handleCreate} className="card p-6 space-y-4">
        <h2 className="font-medium">New strategy</h2>
        <div>
          <label className="label" htmlFor="new-name">Name</label>
          <input id="new-name" name="name" className="input" placeholder="e.g. Opening drive" required />
        </div>
        <div>
          <label className="label" htmlFor="new-desc">Description (optional)</label>
          <input id="new-desc" name="description" className="input" placeholder="When and why you use this setup" />
        </div>
        <div>
          <label className="label" htmlFor="new-rules">Rules</label>
          <textarea
            id="new-rules"
            name="rules"
            rows={6}
            className="input resize-y font-mono text-xs"
            placeholder={"1. Rule one\n2. Rule two\n3. Rule three"}
            required
          />
          <p className="text-xs text-muted mt-1">
            One rule per line. When you journal a trade, you&apos;ll mark whether you followed these rules.
          </p>
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving..." : "Create strategy"}
        </button>
      </form>

      {strategies.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Your strategies ({strategies.length})</h2>
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={handleSeedTemplates}
              disabled={pending}
            >
              + Add starter templates
            </button>
          </div>

          {strategies.map((strategy) => (
            <div key={strategy.id} className="card p-5 space-y-3">
              {editingId === strategy.id ? (
                <form onSubmit={handleUpdate} className="space-y-3">
                  <input name="name" className="input" defaultValue={strategy.name} required />
                  <input
                    name="description"
                    className="input"
                    defaultValue={strategy.description ?? ""}
                  />
                  <textarea
                    name="rules"
                    rows={6}
                    className="input resize-y font-mono text-xs"
                    defaultValue={strategy.rules}
                    required
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="btn btn-primary text-sm" disabled={pending}>
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary text-sm"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-medium">{strategy.name}</h3>
                      {strategy.description && (
                        <p className="text-sm text-muted mt-0.5">{strategy.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn btn-secondary text-xs py-1.5"
                        onClick={() => setEditingId(strategy.id)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger text-xs py-1.5"
                        onClick={() => handleDelete(strategy.id, strategy.name)}
                        disabled={pending}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <ul className="text-sm text-muted space-y-1 list-disc pl-5">
                    {parseStrategyRules(strategy.rules).map((rule, i) => (
                      <li key={i}>{rule}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
