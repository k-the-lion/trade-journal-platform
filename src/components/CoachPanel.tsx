"use client";

import { useState } from "react";
import { createOrganization, inviteStudent } from "@/lib/actions";
import type { Organization } from "@/lib/types/database";

function inviteLink(token: string): string {
  if (typeof window === "undefined") return `/invite?token=${token}`;
  return `${window.location.origin}/invite?token=${token}`;
}

function InviteLinkCard({ email, link }: { email: string; link: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers / denied permission
      const input = document.createElement("input");
      input.value = link;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="card p-4 max-w-2xl space-y-3 border border-primary/30 bg-primary/5">
      <div>
        <p className="text-sm text-foreground font-medium">Invite link ready for {email}</p>
        <p className="text-xs text-muted mt-1">
          No email is sent automatically. Copy this link and send it to your student — they must
          sign up or log in with <span className="text-foreground">{email}</span>, then accept.
          Link expires in 7 days.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <input className="input flex-1 min-w-[200px] text-xs font-mono" readOnly value={link} />
        <button type="button" className="btn btn-primary text-sm shrink-0" onClick={handleCopy}>
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
    </div>
  );
}

export function CoachPanel({ organizations }: { organizations: Organization[] }) {
  const [orgs, setOrgs] = useState(organizations);
  const [newOrgName, setNewOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pendingInvite, setPendingInvite] = useState<{ email: string; link: string } | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setLoading(true);
    setMessage(null);
    setPendingInvite(null);
    try {
      const org = await createOrganization(newOrgName.trim());
      setOrgs((prev) => [...prev, org]);
      setNewOrgName("");
      setMessage(`Created organization "${org.name}"`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to create org");
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(orgId: string) {
    const email = inviteEmail[orgId]?.trim();
    if (!email) return;
    setLoading(true);
    setMessage(null);
    setPendingInvite(null);
    try {
      const invite = await inviteStudent(orgId, email);
      const link = inviteLink(invite.token);
      setPendingInvite({ email, link });
      setInviteEmail((prev) => ({ ...prev, [orgId]: "" }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to create invite");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreateOrg} className="card p-6 flex flex-wrap gap-3 items-end max-w-2xl">
        <div className="flex-1 min-w-[200px]">
          <label className="label">New organization</label>
          <input
            className="input"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            placeholder="My Trading Group"
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          Create group
        </button>
      </form>

      {message && (
        <div className="text-sm text-muted card p-3 max-w-2xl">{message}</div>
      )}

      {pendingInvite && (
        <InviteLinkCard email={pendingInvite.email} link={pendingInvite.link} />
      )}

      {orgs.length === 0 ? (
        <p className="text-muted text-sm">No organizations yet. Create one to invite students.</p>
      ) : (
        orgs.map((org) => (
          <div key={org.id} className="card p-6 max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">{org.name}</h2>
              <a href={`/coach/org/${org.id}`} className="text-sm text-primary hover:underline">
                View students →
              </a>
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="student@email.com"
                  value={inviteEmail[org.id] ?? ""}
                  onChange={(e) =>
                    setInviteEmail((prev) => ({ ...prev, [org.id]: e.target.value }))
                  }
                />
                <button
                  type="button"
                  className="btn btn-secondary shrink-0"
                  onClick={() => handleInvite(org.id)}
                  disabled={loading}
                >
                  Create invite link
                </button>
              </div>
              <p className="text-xs text-muted">
                Generates a shareable link — nothing is emailed. Your student must use the invited
                email address when they join.
              </p>
            </div>
            <a href={`/coach/playbook?org=${org.id}`} className="text-sm text-muted hover:text-primary">
              Edit AI coaching playbook →
            </a>
          </div>
        ))
      )}
    </div>
  );
}
