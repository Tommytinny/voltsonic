import { useMemo } from "react";
import { motion } from "framer-motion";
import { History, Trophy } from "lucide-react";

function DiceBadge({ value, className = "" }) {
  const dotsByValue = {
    1: [{ cx: 60, cy: 60, fill: "#22c55e" }],
    2: [
      { cx: 35, cy: 35, fill: "#ef4444" },
      { cx: 85, cy: 85, fill: "#ef4444" },
    ],
    3: [
      { cx: 30, cy: 30, fill: "#3b82f6" },
      { cx: 60, cy: 60, fill: "#3b82f6" },
      { cx: 90, cy: 90, fill: "#3b82f6" },
    ],
    4: [
      { cx: 35, cy: 35, fill: "#f59e0b" },
      { cx: 85, cy: 35, fill: "#f59e0b" },
      { cx: 35, cy: 85, fill: "#f59e0b" },
      { cx: 85, cy: 85, fill: "#f59e0b" },
    ],
    5: [
      { cx: 30, cy: 30, fill: "#a855f7" },
      { cx: 90, cy: 30, fill: "#a855f7" },
      { cx: 60, cy: 60, fill: "#a855f7" },
      { cx: 30, cy: 90, fill: "#a855f7" },
      { cx: 90, cy: 90, fill: "#a855f7" },
    ],
    6: [
      { cx: 35, cy: 25, fill: "#06b6d4" },
      { cx: 35, cy: 60, fill: "#06b6d4" },
      { cx: 35, cy: 95, fill: "#06b6d4" },
      { cx: 85, cy: 25, fill: "#06b6d4" },
      { cx: 85, cy: 60, fill: "#06b6d4" },
      { cx: 85, cy: 95, fill: "#06b6d4" },
    ],
  };
  const dots = dotsByValue[value] || dotsByValue[1];

  return (
    <svg
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block h-7 w-7 ${className}`.trim()}
      aria-hidden="true"
    >
      <rect width="120" height="120" rx="20" fill="#f8fafc" />
      {dots.map((dot, index) => (
        <circle key={`${value}-${index}`} cx={dot.cx} cy={dot.cy} r="10" fill={dot.fill} />
      ))}
    </svg>
  );
}

export function RoundHistoryPanel({ history, loading = false }) {
  const recent = useMemo(() => {
    return [...(history || [])].slice(0, 10);
  }, [history]);

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <History className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[10px] font-mono font-bold tracking-widest text-muted-foreground">
          LAST 10 ROUNDS
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-1.5 min-w-max">
          {loading ? Array.from({ length: 6 }, (_, index) => (
            <div
              key={`history-skeleton-${index}`}
              className="flex min-w-[52px] flex-col items-center gap-2 rounded-lg border border-border bg-muted/20 p-2"
            >
              <div className="h-2 w-8 rounded bg-muted/60 animate-pulse" />
              <div className="h-5 w-5 rounded bg-muted/60 animate-pulse" />
              <div className="h-2 w-4 rounded bg-muted/60 animate-pulse" />
            </div>
          )) : recent.length > 0 ? recent.map((r, i) => (
            <motion.div
              key={r.roundId}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              className={`relative flex flex-col items-center gap-1 p-2 rounded-lg border text-center min-w-[52px] ${
                r.jackpotWon
                  ? "border-secondary/50 bg-secondary/10"
                  : "border-border bg-muted/30"
              }`}
            >
              {r.jackpotWon && (
                <Trophy className="absolute -top-1.5 -right-1.5 w-3 h-3 text-secondary" />
              )}
              <span className="text-[8px] font-mono text-muted-foreground">
                #{r.roundId}
              </span>
              <DiceBadge value={r.diceResult} />
              <span className="text-[8px] font-mono text-muted-foreground">{r.diceResult}</span>
              {/*<span
                className={`text-[9px] font-mono font-bold ${
                  r.parityResult === "even" ? "text-primary" : "text-secondary"
                }`}
              >
                {r.parityResult === "even" ? "EVEN" : "ODD"}
              </span>
              <span className="text-[8px] font-mono text-muted-foreground">
                {r.totalPool} VOLT
              </span>*/}
            </motion.div>
          )) : (
            <div className="text-[10px] font-mono text-muted-foreground py-2">
              No settled rounds yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
