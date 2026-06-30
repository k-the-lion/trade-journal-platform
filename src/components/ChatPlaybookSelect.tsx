"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { updateChatSessionPlaybook } from "@/lib/actions";
import { PLAYBOOK_AUTO } from "@/lib/ai/resolve-playbook";
import type { PlaybookOption } from "@/lib/ai/playbook-options";

export type { PlaybookOption } from "@/lib/ai/playbook-options";

export function ChatPlaybookSelect({
  sessionId,
  playbookKey,
  options,
}: {
  sessionId: string;
  playbookKey: string;
  options: PlaybookOption[];
}) {
  const [value, setValue] = useState(playbookKey || PLAYBOOK_AUTO);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(playbookKey || PLAYBOOK_AUTO);
  }, [playbookKey, sessionId]);

  const selected = options.find((o) => o.key === value);

  async function handleChange(key: string) {
    setValue(key);
    setSaving(true);
    setError(null);
    try {
      await updateChatSessionPlaybook(sessionId, key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update playbook");
      setValue(playbookKey);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs text-muted">Coaching playbook</label>
        <Link href="/settings?tab=playbooks" className="text-xs text-primary hover:underline">
          Manage playbooks
        </Link>
      </div>
      <select
        className="input text-sm"
        value={value}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
      {selected?.hint && <p className="text-xs text-muted">{selected.hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
