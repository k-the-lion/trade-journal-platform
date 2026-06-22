"use client";

import { useState } from "react";
import { createOrganization, inviteStudent } from "@/lib/actions";
import type { Organization } from "@/lib/types/database";

export function CoachPanel({ organizations }: { organizations: Organization[] }) {
  const [orgs, setOrgs] = useState(organizations);
  const [newOrgName, setNewOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setLoading(true);
    setMessage(null);
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
    try {
      const invite = await inviteStudent(orgId, email);
      setMessage(`Invite sent to ${email}. Share token: ${invite.token}`);
      setInviteEmail((prev) => ({ ...prev, [orgId]: "" }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to invite");
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
                Invite
              </button>
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
