"use client";

import { useState } from "react";
import { updatePlaybook } from "@/lib/actions";
import type { CoachingPlaybook } from "@/lib/types/database";

export function PlaybookEditor({ playbook }: { playbook: CoachingPlaybook }) {
  const [tone, setTone] = useState(playbook.tone);
  const [emphasize, setEmphasize] = useState(playbook.topics_to_emphasize.join(", "));
  const [avoid, setAvoid] = useState(playbook.topics_to_avoid.join(", "));
  const [rules, setRules] = useState(playbook.custom_rules);
  const [checklist, setChecklist] = useState(playbook.review_checklist);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    try {
      await updatePlaybook(playbook.id, {
        tone,
        topics_to_emphasize: emphasize.split(",").map((s) => s.trim()).filter(Boolean),
        topics_to_avoid: avoid.split(",").map((s) => s.trim()).filter(Boolean),
        custom_rules: rules,
        review_checklist: checklist,
      });
      setSaved(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="card p-6 space-y-4 max-w-2xl">
      <div>
        <h2 className="font-medium">{playbook.name}</h2>
        <p className="text-xs text-muted">Define how the AI coaches your students.</p>
      </div>

      <div>
        <label className="label">Coaching tone</label>
        <select className="input" value={tone} onChange={(e) => setTone(e.target.value)}>
          <option value="supportive">Supportive</option>
          <option value="direct">Direct</option>
          <option value="socratic">Socratic (ask questions)</option>
          <option value="analytical">Analytical</option>
        </select>
      </div>

      <div>
        <label className="label">Topics to emphasize (comma-separated)</label>
        <input className="input" value={emphasize} onChange={(e) => setEmphasize(e.target.value)} />
      </div>

      <div>
        <label className="label">Topics to avoid (comma-separated)</label>
        <input className="input" value={avoid} onChange={(e) => setAvoid(e.target.value)} />
      </div>

      <div>
        <label className="label">Custom organization rules</label>
        <textarea className="input resize-y" rows={4} value={rules} onChange={(e) => setRules(e.target.value)} />
      </div>

      <div>
        <label className="label">Review checklist</label>
        <textarea className="input resize-y" rows={3} value={checklist} onChange={(e) => setChecklist(e.target.value)} />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Saving..." : "Save playbook"}
        </button>
        {saved && <span className="text-sm text-success">Saved!</span>}
      </div>
    </form>
  );
}
