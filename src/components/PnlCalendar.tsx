"use client";

import { useMemo, useState } from "react";
import {
  buildMonthGrid,
  formatMonthLabel,
  isSameDay,
  toDateKey,
} from "@/lib/economic-calendar/utils";
import { formatCurrency } from "@/lib/reports/stats";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function PnlCalendar({
  dailyPnl,
}: {
  dailyPnl: Record<string, number>;
}) {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(toDateKey(today));

  const grid = useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const monthPnl = useMemo(() => {
    let total = 0;
    for (const cell of grid) {
      if (!cell.inMonth) continue;
      total += dailyPnl[cell.dateKey] ?? 0;
    }
    return total;
  }, [grid, dailyPnl]);

  const selectedPnl = selectedDay ? dailyPnl[selectedDay] : undefined;

  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDay(toDateKey(today));
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-sm">Trading calendar</h2>
          <p className="text-xs text-muted mt-0.5">
            Green = profitable day · Red = losing day · Gray = no trades
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Month P&L</p>
          <p
            className={`text-lg font-semibold ${
              monthPnl >= 0 ? "text-success" : "text-danger"
            }`}
          >
            {formatCurrency(monthPnl)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary text-sm px-3"
            onClick={() => {
              const d = new Date(viewYear, viewMonth - 1, 1);
              setViewYear(d.getFullYear());
              setViewMonth(d.getMonth());
            }}
            aria-label="Previous month"
          >
            ←
          </button>
          <h3 className="text-base font-semibold min-w-[160px] text-center">
            {formatMonthLabel(viewYear, viewMonth)}
          </h3>
          <button
            type="button"
            className="btn btn-secondary text-sm px-3"
            onClick={() => {
              const d = new Date(viewYear, viewMonth + 1, 1);
              setViewYear(d.getFullYear());
              setViewMonth(d.getMonth());
            }}
            aria-label="Next month"
          >
            →
          </button>
        </div>
        <button type="button" className="btn btn-secondary text-sm" onClick={goToday}>
          Today
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 font-medium">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((cell) => {
          const pnl = dailyPnl[cell.dateKey];
          const hasTrades = pnl !== undefined;
          const isWin = hasTrades && pnl > 0;
          const isLoss = hasTrades && pnl < 0;
          const isBreakeven = hasTrades && pnl === 0;
          const isToday = isSameDay(cell.date, today);
          const isSelected = selectedDay === cell.dateKey;

          let bg = "bg-background/20 border-border/40";
          if (hasTrades) {
            if (isWin) bg = "bg-success/20 border-success/40";
            else if (isLoss) bg = "bg-danger/20 border-danger/40";
            else bg = "bg-white/5 border-border/60";
          }

          return (
            <button
              key={cell.dateKey}
              type="button"
              onClick={() => setSelectedDay(cell.dateKey)}
              className={`min-h-[64px] rounded-lg border p-1.5 text-left transition-colors ${bg} ${
                isSelected ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""
              } ${isToday ? "border-primary/70" : ""} ${
                cell.inMonth ? "" : "opacity-40"
              } hover:brightness-110`}
            >
              <span
                className={`text-xs font-medium ${
                  isToday ? "text-primary" : cell.inMonth ? "text-foreground" : "text-muted"
                }`}
              >
                {cell.date.getDate()}
              </span>
              {hasTrades && (
                <p
                  className={`text-[10px] font-semibold mt-1 leading-tight ${
                    isWin ? "text-success" : isLoss ? "text-danger" : "text-muted"
                  }`}
                >
                  {isBreakeven ? "BE" : formatCurrency(pnl)}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <p className="text-sm text-muted border-t border-border/50 pt-3">
          {selectedDay}:{" "}
          {selectedPnl !== undefined ? (
            <span
              className={
                selectedPnl > 0
                  ? "text-success font-medium"
                  : selectedPnl < 0
                    ? "text-danger font-medium"
                    : "text-foreground font-medium"
              }
            >
              {formatCurrency(selectedPnl)}
            </span>
          ) : (
            "No trades logged"
          )}
        </p>
      )}
    </div>
  );
}
