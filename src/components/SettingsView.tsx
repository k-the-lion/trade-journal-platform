"use client";

import Link from "next/link";
import { useState } from "react";
import { AccountManager } from "@/components/AccountManager";
import { StrategyManager } from "@/components/StrategyManager";
import { TagPresetManager } from "@/components/TagPresetManager";
import {
  createUserCoachPlaybook,
  deleteUserCoachPlaybook,
  updateAccountEmail,
  updateAccountPassword,
  updateProfileName,
  updateUserCoachPlaybook,
} from "@/lib/actions";
import type {
  Profile,
  TradingAccount,
  TradingStrategy,
  TradingTagPreset,
  UserCoachPlaybook,
} from "@/lib/types/database";

export type SettingsTab = "profile" | "accounts" | "strategies" | "playbooks" | "coach";

const TONE_OPTIONS = [
  { value: "supportive", label: "Supportive" },
  { value: "direct", label: "Direct" },
  { value: "socratic", label: "Socratic" },
  { value: "analytical", label: "Analytical" },
];

function emptyPlaybookForm() {
  return {
    name: "",
    tone: "supportive",
    emphasize: "risk management, rule adherence",
    avoid: "specific trade calls, guaranteed outcomes",
    custom_rules: "Never give buy/sell signals. Focus on process and discipline.",
    review_checklist: "Ask what rule they followed before suggesting changes.",
    is_default: false,
  };
}

function tabClass(active: boolean) {
  return `shrink-0 px-4 py-2 rounded-full text-sm border transition-colors ${
    active
      ? "border-primary bg-primary/15 text-primary"
      : "border-border text-muted hover:border-primary/40 hover:text-foreground"
  }`;
}

export function SettingsView({
  activeTab,
  profile,
  accounts: initialAccounts,
  strategies,
  tagPresets,
  playbooks: initialPlaybooks,
  playbooksUnavailable = false,
  isCoach,
}: {
  activeTab: SettingsTab;
  profile: Profile;
  accounts: TradingAccount[];
  strategies: TradingStrategy[];
  tagPresets: TradingTagPreset[];
  playbooks: UserCoachPlaybook[];
  playbooksUnavailable?: boolean;
  isCoach: boolean;
}) {
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [email, setEmail] = useState(profile.email);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [playbooks, setPlaybooks] = useState(initialPlaybooks);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyPlaybookForm());
  const [playbookMsg, setPlaybookMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const tabs: Array<{ id: SettingsTab; label: string }> = [
    { id: "profile", label: "Profile" },
    { id: "accounts", label: "Accounts" },
    { id: "strategies", label: "Strategies" },
    { id: "playbooks", label: "AI Playbooks" },
  ];
  if (isCoach) {
    tabs.push({ id: "coach", label: "Coach groups" });
  }

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setProfileMsg(null);
    try {
      await updateProfileName(fullName);
      setProfileMsg("Name updated.");
    } catch (err) {
      setProfileMsg(err instanceof Error ? err.message : "Failed to update name");
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setEmailMsg(null);
    try {
      const res = await updateAccountEmail(email);
      setEmailMsg(res.message);
    } catch (err) {
      setEmailMsg(err instanceof Error ? err.message : "Failed to update email");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (password !== passwordConfirm) {
      setPasswordMsg("Passwords do not match");
      return;
    }
    setLoading(true);
    setPasswordMsg(null);
    try {
      await updateAccountPassword(password);
      setPassword("");
      setPasswordConfirm("");
      setPasswordMsg("Password updated.");
    } catch (err) {
      setPasswordMsg(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(pb: UserCoachPlaybook) {
    setEditingId(pb.id);
    setForm({
      name: pb.name,
      tone: pb.tone,
      emphasize: pb.topics_to_emphasize.join(", "),
      avoid: pb.topics_to_avoid.join(", "),
      custom_rules: pb.custom_rules,
      review_checklist: pb.review_checklist,
      is_default: pb.is_default,
    });
    setPlaybookMsg(null);
  }

  function startCreate() {
    setEditingId("new");
    setForm(emptyPlaybookForm());
    setPlaybookMsg(null);
  }

  async function handleSavePlaybook(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setPlaybookMsg(null);
    const payload = {
      name: form.name,
      tone: form.tone,
      topics_to_emphasize: form.emphasize.split(",").map((s) => s.trim()).filter(Boolean),
      topics_to_avoid: form.avoid.split(",").map((s) => s.trim()).filter(Boolean),
      custom_rules: form.custom_rules,
      review_checklist: form.review_checklist,
      is_default: form.is_default,
    };
    try {
      if (editingId === "new") {
        const created = await createUserCoachPlaybook(payload);
        setPlaybooks((prev) => [created as UserCoachPlaybook, ...prev]);
        setPlaybookMsg(`Created "${created.name}".`);
      } else if (editingId) {
        await updateUserCoachPlaybook(editingId, payload);
        setPlaybooks((prev) =>
          prev
            .map((p) =>
              p.id === editingId
                ? {
                    ...p,
                    ...payload,
                    topics_to_emphasize: payload.topics_to_emphasize ?? p.topics_to_emphasize,
                    topics_to_avoid: payload.topics_to_avoid ?? p.topics_to_avoid,
                  }
                : { ...p, is_default: payload.is_default ? false : p.is_default }
            )
            .map((p) => (payload.is_default ? { ...p, is_default: p.id === editingId } : p))
        );
        setPlaybookMsg("Playbook saved.");
      }
      setEditingId(null);
    } catch (err) {
      setPlaybookMsg(err instanceof Error ? err.message : "Failed to save playbook");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePlaybook(id: string, name: string) {
    if (!confirm(`Delete playbook "${name}"?`)) return;
    setLoading(true);
    try {
      await deleteUserCoachPlaybook(id);
      setPlaybooks((prev) => prev.filter((p) => p.id !== id));
      if (editingId === id) setEditingId(null);
      setPlaybookMsg("Playbook deleted.");
    } catch (err) {
      setPlaybookMsg(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <nav
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none" }}
        aria-label="Settings sections"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={`/settings?tab=${tab.id}`}
            className={tabClass(activeTab === tab.id)}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {activeTab === "profile" && (
        <div className="space-y-6">
          <section className="card p-6 space-y-4">
            <div>
              <h2 className="font-medium">Display name</h2>
              <p className="text-xs text-muted mt-1">Shown across the journal.</p>
            </div>
            <form onSubmit={handleSaveName} className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="label">Full name</label>
                <input
                  className="input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                Save name
              </button>
            </form>
            {profileMsg && <p className="text-sm text-muted">{profileMsg}</p>}
          </section>

          <section className="card p-6 space-y-4">
            <div>
              <h2 className="font-medium">Email</h2>
              <p className="text-xs text-muted mt-1">
                Supabase sends a confirmation link to complete the change.
              </p>
            </div>
            <form onSubmit={handleEmailChange} className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="label">Email address</label>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-secondary" disabled={loading}>
                Update email
              </button>
            </form>
            {emailMsg && <p className="text-sm text-muted">{emailMsg}</p>}
          </section>

          <section className="card p-6 space-y-4">
            <div>
              <h2 className="font-medium">Password</h2>
              <p className="text-xs text-muted mt-1">At least 8 characters.</p>
            </div>
            <form onSubmit={handlePasswordChange} className="space-y-3">
              <div>
                <label className="label">New password</label>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="label">Confirm password</label>
                <input
                  className="input"
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <button type="submit" className="btn btn-secondary" disabled={loading}>
                Update password
              </button>
            </form>
            {passwordMsg && <p className="text-sm text-muted">{passwordMsg}</p>}
          </section>
        </div>
      )}

      {activeTab === "accounts" && (
        <section className="card p-6 space-y-4">
          <div>
            <h2 className="font-medium">Trading accounts</h2>
            <p className="text-xs text-muted mt-1">
              Used for imports, trade logging, and reports. Create accounts here or during
              import.
            </p>
          </div>
          <AccountManager
            accounts={accounts}
            onAccountsChange={setAccounts}
            showCreate
            variant="settings"
          />
        </section>
      )}

      {activeTab === "strategies" && (
        <div className="space-y-6">
          <div>
            <h2 className="font-medium">Strategies & tags</h2>
            <p className="text-sm text-muted mt-1">
              Define setups and rules. When you tag a trade with a strategy, you can record
              whether you followed its rules.
            </p>
          </div>
          <StrategyManager initialStrategies={strategies} />
          <TagPresetManager initialPresets={tagPresets} />
        </div>
      )}

      {activeTab === "playbooks" && (
        <section className="card p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-medium">AI coaching playbooks</h2>
              <p className="text-xs text-muted mt-1">
                Named rule sets for AI Coach — pick one per chat session from the dropdown on
                the AI Coach page.
              </p>
            </div>
            {!playbooksUnavailable && (
              <button type="button" className="btn btn-secondary text-sm" onClick={startCreate}>
                + New playbook
              </button>
            )}
          </div>

          {playbooksUnavailable && (
            <p className="text-sm text-danger rounded-md border border-danger/30 bg-danger/10 p-3">
              Playbooks table is missing. Run migration{" "}
              <code className="text-xs">015_user_coach_playbooks.sql</code> in Supabase.
            </p>
          )}

          {!playbooksUnavailable && playbooks.length === 0 && editingId !== "new" && (
            <p className="text-sm text-muted">
              No custom playbooks yet. Create one for prop-firm rules, psychology focus, etc.
            </p>
          )}

          {!playbooksUnavailable && playbooks.length > 0 && (
            <ul className="space-y-2">
              {playbooks.map((pb) => (
                <li
                  key={pb.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {pb.name}
                      {pb.is_default && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-primary">
                          Default
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted capitalize">{pb.tone} tone</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => startEdit(pb)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-xs text-danger hover:underline"
                      onClick={() => handleDeletePlaybook(pb.id, pb.name)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {editingId && !playbooksUnavailable && (
            <form onSubmit={handleSavePlaybook} className="space-y-3 border-t border-border/50 pt-4">
              <p className="text-sm font-medium">
                {editingId === "new" ? "New playbook" : "Edit playbook"}
              </p>
              <div>
                <label className="label">Name</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Prop firm eval rules"
                  required
                />
              </div>
              <div>
                <label className="label">Tone</label>
                <select
                  className="input"
                  value={form.tone}
                  onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value }))}
                >
                  {TONE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Topics to emphasize (comma-separated)</label>
                <input
                  className="input"
                  value={form.emphasize}
                  onChange={(e) => setForm((f) => ({ ...f, emphasize: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Topics to avoid (comma-separated)</label>
                <input
                  className="input"
                  value={form.avoid}
                  onChange={(e) => setForm((f) => ({ ...f, avoid: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Custom rules</label>
                <textarea
                  className="input resize-y"
                  rows={4}
                  value={form.custom_rules}
                  onChange={(e) => setForm((f) => ({ ...f, custom_rules: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Review checklist</label>
                <textarea
                  className="input resize-y"
                  rows={2}
                  value={form.review_checklist}
                  onChange={(e) => setForm((f) => ({ ...f, review_checklist: e.target.value }))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
                />
                Use as my default for new AI Coach sessions
              </label>
              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  Save playbook
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingId(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {playbookMsg && <p className="text-sm text-muted">{playbookMsg}</p>}
        </section>
      )}

      {activeTab === "coach" && isCoach && (
        <section className="card p-6 space-y-3">
          <h2 className="font-medium">Coach groups</h2>
          <p className="text-sm text-muted">
            Create trading groups, invite students, and configure org-wide AI playbooks for your
            group.
          </p>
          <Link href="/coach" className="btn btn-secondary text-sm inline-flex">
            Open coach dashboard
          </Link>
        </section>
      )}
    </div>
  );
}
