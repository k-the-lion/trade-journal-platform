"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import type { BreakdownItem, EquityPoint } from "@/lib/reports/stats";

export function EquityCurveChart({ data }: { data: EquityPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="card p-6 text-center text-muted text-sm">
        Log trades to see your equity curve.
      </div>
    );
  }

  return (
    <div className="card p-4 h-72">
      <h3 className="text-sm font-medium mb-3">Equity Curve</h3>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 11 }} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: "#1e293b", border: "1px solid #334155" }}
            labelStyle={{ color: "#f8fafc" }}
          />
          <Line type="monotone" dataKey="cumulativePnl" stroke="#00d2ff" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BreakdownChart({
  data,
  title,
  labelWidth = 88,
}: {
  data: BreakdownItem[];
  title: string;
  labelWidth?: number;
}) {
  if (data.length === 0) {
    return (
      <div className="card p-6 text-center text-muted text-sm">
        No data for {title.toLowerCase()}.
      </div>
    );
  }

  return (
    <div className="card p-4 h-72">
      <h3 className="text-sm font-medium mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={data.slice(0, 8)} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} />
          <YAxis type="category" dataKey="label" width={labelWidth} tick={{ fill: "#94a3b8", fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: "#1e293b", border: "1px solid #334155" }}
          />
          <Bar dataKey="pnl" fill="#3a7bd5" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BreakdownTable({ data, title }: { data: BreakdownItem[]; title: string }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted text-left">
            <th className="px-4 py-2 font-normal">Label</th>
            <th className="px-4 py-2 font-normal">Trades</th>
            <th className="px-4 py-2 font-normal">P&L</th>
            <th className="px-4 py-2 font-normal">Win %</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.label} className="border-t border-border/50">
              <td className="px-4 py-2">{row.label}</td>
              <td className="px-4 py-2">{row.count}</td>
              <td className={`px-4 py-2 ${row.pnl >= 0 ? "positive" : "negative"}`}>
                ${row.pnl.toLocaleString()}
              </td>
              <td className="px-4 py-2">{row.winRate}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
