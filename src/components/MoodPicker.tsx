"use client";

import { TRADE_MOODS } from "@/lib/constants/trade-meta";

export function MoodPicker({
  value,
  onChange,
  name = "emotional_state",
}: {
  value?: string | null;
  onChange?: (value: string) => void;
  name?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {TRADE_MOODS.map((mood) => (
        <label
          key={mood.value}
          title={mood.label}
          className={`cursor-pointer rounded-lg border px-3 py-2 text-xl transition-colors ${
            value === mood.value
              ? "border-primary bg-primary/15 ring-2 ring-primary/30"
              : "border-border hover:border-primary/50"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={mood.value}
            className="sr-only"
            defaultChecked={value === mood.value}
            onChange={() => onChange?.(mood.value)}
          />
          {mood.emoji}
        </label>
      ))}
    </div>
  );
}
