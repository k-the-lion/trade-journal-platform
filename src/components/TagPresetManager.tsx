"use client";

import { useState, useTransition } from "react";
import { createTagPreset, deleteTagPreset } from "@/lib/actions";
import type { TradingTagPreset } from "@/lib/types/database";

export function TagPresetManager({
  initialPresets,
}: {
  initialPresets: TradingTagPreset[];
}) {
  const [presets, setPresets] = useState(initialPresets);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const preset = await createTagPreset(name);
        setPresets((prev) => [...prev, preset]);
        setName("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create tag");
      }
    });
  }

  function handleDelete(id: string, label: string) {
    if (!confirm(`Delete saved tag "${label}"? Trades that already use it keep the tag.`)) return;
    startTransition(async () => {
      await deleteTagPreset(id);
      setPresets((prev) => prev.filter((p) => p.id !== id));
    });
  }

  return (
    <div className="card p-6 space-y-4">
      <div>
        <h2 className="font-medium">Saved trade tags</h2>
        <p className="text-sm text-muted mt-1">
          Extra tags are quick labels for what you did on a trade — like{" "}
          <span className="text-foreground">1:2 R:R</span>,{" "}
          <span className="text-foreground">revenge trade</span>, or{" "}
          <span className="text-foreground">A+ setup</span>. They&apos;re separate from
          strategies (which track rules). Save tags here, then pick them from a dropdown when
          journaling on the dashboard.
        </p>
      </div>

      <form onSubmit={handleCreate} className="flex flex-wrap gap-2">
        <input
          className="input flex-1 min-w-[200px]"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. 1:2 R:R, London open, A+ setup"
          disabled={pending}
        />
        <button type="submit" className="btn btn-primary text-sm" disabled={pending || !name.trim()}>
          Add tag
        </button>
      </form>

      {error && <p className="text-sm text-danger">{error}</p>}

      {presets.length === 0 ? (
        <p className="text-sm text-muted">No saved tags yet — add a few you use often.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-border bg-background/40"
            >
              {p.name}
              <button
                type="button"
                onClick={() => handleDelete(p.id, p.name)}
                className="text-muted hover:text-danger ml-0.5"
                disabled={pending}
                aria-label={`Delete ${p.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
