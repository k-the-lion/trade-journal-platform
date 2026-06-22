import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient, getProfile } from "@/lib/supabase/server";
import {
  computeTradeStats,
  formatCurrency,
  formatPct,
} from "@/lib/reports/stats";
import type { OrgMember, Trade } from "@/lib/types/database";

export default async function OrgDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const profile = await getProfile();

  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .single();

  if (!org) notFound();

  const { data: members } = await supabase
    .from("org_members")
    .select("*, profiles(*)")
    .eq("org_id", id);

  const students = (members ?? []).filter((m) => m.role === "student") as OrgMember[];

  const studentStats = await Promise.all(
    students.map(async (s) => {
      const { data: trades } = await supabase
        .from("trades")
        .select("*")
        .eq("user_id", s.user_id)
        .order("traded_at", { ascending: false });
      const stats = computeTradeStats((trades ?? []) as Trade[]);
      return { member: s, stats, tradeCount: trades?.length ?? 0 };
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/coach" className="text-sm text-muted hover:text-primary">← Coach</Link>
        <h1 className="text-2xl font-semibold mt-1">{org.name}</h1>
        <p className="text-muted text-sm">{students.length} students</p>
      </div>

      {studentStats.length === 0 ? (
        <div className="card p-6 text-muted text-sm">
          No students yet. Invite students from the coach dashboard.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-left">
                <th className="px-4 py-2 font-normal">Student</th>
                <th className="px-4 py-2 font-normal">Trades</th>
                <th className="px-4 py-2 font-normal">P&L</th>
                <th className="px-4 py-2 font-normal">Win rate</th>
                <th className="px-4 py-2 font-normal">Rule adherence</th>
              </tr>
            </thead>
            <tbody>
              {studentStats.map(({ member, stats, tradeCount }) => {
                const p = member.profiles as unknown as { full_name: string | null; email: string };
                return (
                  <tr key={member.id} className="border-t border-border/50">
                    <td className="px-4 py-2">{p?.full_name || p?.email}</td>
                    <td className="px-4 py-2">{tradeCount}</td>
                    <td className={`px-4 py-2 ${stats.totalPnl >= 0 ? "positive" : "negative"}`}>
                      {formatCurrency(stats.totalPnl)}
                    </td>
                    <td className="px-4 py-2">{formatPct(stats.winRate)}</td>
                    <td className="px-4 py-2">{formatPct(stats.ruleFollowedPct)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
