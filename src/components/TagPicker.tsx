"use client";

import type { TradingTagPreset } from "@/lib/types/database";

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function joinTags(tags: string[]): string {
  return tags.join(", ");
}

export function TagPicker({
  value,
  onChange,
  presets,
  presetsPosition = "above",
}: {
  value: string;
  onChange: (value: string) => void;
  presets: TradingTagPreset[];
  /** Put quick-pick chips below the text field so paired controls can align in a grid. */
  presetsPosition?: "above" | "below";
}) {
  const selected = parseTags(value);

  function toggleTag(name: string) {
    const next = selected.includes(name)
      ? selected.filter((t) => t !== name)
      : [...selected, name];
    onChange(joinTags(next));
  }

  const presetButtons =
    presets.length > 0 ? (
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => {
          const active = selected.includes(p.name);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggleTag(p.name)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                active
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted hover:border-primary/40"
              }`}
            >
              {p.name}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <div className="space-y-2">
      {presetsPosition === "above" && presetButtons}
      <input
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          presets.length
            ? "More tags, comma-separated"
            : "e.g. 1:2 R:R, London open — or save tags on Strategies"
        }
      />
      {presetsPosition === "below" && presetButtons}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((tag) => (
            <span
              key={tag}
              className="text-[0.65rem] px-2 py-0.5 rounded-full bg-white/5 text-muted border border-border/60"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
