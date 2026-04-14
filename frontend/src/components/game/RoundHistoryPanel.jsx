import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { History, Trophy } from "lucide-react";

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || "http://127.0.0.1:8000";

const diceFaces = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

export function RoundHistoryPanel({ history }) {
  const [fetchedHistory, setFetchedHistory] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function loadRounds() {
      try {
        const response = await fetch(`${BACKEND_API_URL}/api/v1/rounds?limit=10`);
        if (!response.ok) return;

        const rounds = await response.json();
        if (cancelled) return;

        setFetchedHistory(
          rounds
            .filter((round) => round.settled && round.dice_result)
            .map((round) => ({
              roundId: Number(round.round_id),
              diceResult: Number(round.dice_result || 0),
              parityResult: round.parity_result ? "even" : "odd",
              totalPool: (
                Number(round.total_dice_pool || 0) / 1e18 +
                Number(round.total_parity_pool || 0) / 1e18
              ).toFixed(2),
              jackpotWon: Number(round.total_jackpot_winners || 0) > 0,
            }))
        );
      } catch {
        if (!cancelled) {
          setFetchedHistory([]);
        }
      }
    }

    loadRounds();
    const intervalId = window.setInterval(loadRounds, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const recent = useMemo(() => {
    const source = fetchedHistory.length > 0 ? fetchedHistory : history;
    return [...source].slice(0, 10);
  }, [fetchedHistory, history]);

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
          {recent.length > 0 ? recent.map((r, i) => (
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
              <span className="text-sm">{diceFaces[r.diceResult - 1]}</span>
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
