import { useMemo } from "react";
import { motion } from "framer-motion";
import { History } from "lucide-react";
import { ethers } from "ethers";

function parseRawTokenAmount(value) {
  try {
    return Number(ethers.formatEther(BigInt(String(value || "0"))));
  } catch {
    return 0;
  }
}

function formatBetAmount(bet) {
  const total = parseRawTokenAmount((BigInt(bet.diceAmount || 0n) + BigInt(bet.parityAmount || 0n)).toString());
  return `${total.toFixed(2)} VOLT`;
}

function formatBetPick(bet) {
  const picks = [];

  if (bet.betOnDice && bet.diceChoice) {
    picks.push(`Dice ${bet.diceChoice}`);
  }

  if (bet.betOnParity) {
    picks.push(String(bet.parityChoice).toUpperCase());
  }

  return picks.join(" + ") || "Bet";
}

function formatOutcome(bet) {
  if (bet.result === "won_claimed") return "Won • Claimed";
  if (bet.result === "won") return "Won";
  if (bet.result === "lost") return "Lost";
  return "Open";
}

function formatRelativeTime(value) {
  const timestamp = Date.parse(String(value || ""));
  if (!Number.isFinite(timestamp)) return "";

  const diffMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
  return `${Math.floor(diffMinutes / 1440)}d ago`;
}

function getOutcomeClasses(result) {
  if (result === "won" || result === "won_claimed") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }

  if (result === "lost") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-300";
  }

  return "border-secondary/30 bg-secondary/10 text-secondary";
}

function BetSection({ title, bets, emptyLabel, voltPrice }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono font-bold tracking-widest text-muted-foreground">
          {title}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">
          {bets.length}
        </span>
      </div>

      {bets.length ? (
        <div className="space-y-2">
          {bets.map((bet, index) => (
            <motion.div
              key={bet.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="rounded-lg border border-border bg-muted/20 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground">
                    Round #{bet.roundId}
                  </div>
                  <div className="mt-1 text-[11px] font-mono text-muted-foreground">
                    {formatBetPick(bet)}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-mono ${getOutcomeClasses(bet.result)}`}>
                  {formatOutcome(bet)}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between gap-3 text-[11px] font-mono">
                <div className="flex flex-col">
                  <span className="text-primary">{formatBetAmount(bet)}</span>
                  {voltPrice && (
                    <span className="text-muted-foreground text-[10px]">
                      ≈ ${(parseRawTokenAmount((BigInt(bet.diceAmount || 0n) + BigInt(bet.parityAmount || 0n)).toString()) * voltPrice).toFixed(2)}
                    </span>
                  )}
                </div>
                <span className="text-muted-foreground">
                  {formatRelativeTime(bet.updatedAt || bet.createdAt)}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-muted/10 px-3 py-4 text-[11px] font-mono text-muted-foreground">
          {emptyLabel}
        </div>
      )}
    </div>
  );
}

export function BetHistoryPanel({ bets = [], loading = false, connected = false, voltPrice }) {
  const { openBets, closedBets } = useMemo(() => {
    const sortedBets = [...bets].sort((left, right) => {
      const leftTimestamp = Date.parse(String(left.updatedAt || left.createdAt || "")) || 0;
      const rightTimestamp = Date.parse(String(right.updatedAt || right.createdAt || "")) || 0;
      return rightTimestamp - leftTimestamp;
    });

    return {
      openBets: sortedBets.filter((bet) => bet.result === "open").slice(0, 5),
      closedBets: sortedBets.filter((bet) => bet.result !== "open").slice(0, 8),
    };
  }, [bets]);

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-3">
      <div className="flex items-center gap-2">
        <History className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[10px] font-mono font-bold tracking-widest text-muted-foreground">
          BET HISTORY
        </span>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-2 w-16 rounded bg-muted/60 animate-pulse" />
              <div className="h-2 w-4 rounded bg-muted/60 animate-pulse" />
            </div>
            {Array.from({ length: 2 }, (_, index) => (
              <div key={`open-skeleton-${index}`} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="h-3 w-20 rounded bg-muted/60 animate-pulse" />
                    <div className="h-2 w-28 rounded bg-muted/60 animate-pulse" />
                  </div>
                  <div className="h-6 w-16 rounded-full bg-muted/60 animate-pulse" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-3 w-16 rounded bg-muted/60 animate-pulse" />
                  <div className="h-3 w-12 rounded bg-muted/60 animate-pulse" />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-2 w-20 rounded bg-muted/60 animate-pulse" />
              <div className="h-2 w-4 rounded bg-muted/60 animate-pulse" />
            </div>
            {Array.from({ length: 3 }, (_, index) => (
              <div key={`closed-skeleton-${index}`} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="h-3 w-20 rounded bg-muted/60 animate-pulse" />
                    <div className="h-2 w-24 rounded bg-muted/60 animate-pulse" />
                  </div>
                  <div className="h-6 w-16 rounded-full bg-muted/60 animate-pulse" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-3 w-16 rounded bg-muted/60 animate-pulse" />
                  <div className="h-3 w-12 rounded bg-muted/60 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : !connected ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/10 px-3 py-5 text-center text-[11px] font-mono text-muted-foreground">
          Connect your wallet to view open and closed bets.
        </div>
      ) : (
        <div className="space-y-4 overflow-y-auto max-h-[300px] pr-1">
          <BetSection
            title="OPEN BETS"
            bets={openBets}
            emptyLabel="No open bets right now."
            voltPrice={voltPrice}
          />
          <BetSection
            title="CLOSED BETS"
            bets={closedBets}
            emptyLabel="No closed bets yet."
            voltPrice={voltPrice}
          />
        </div>
      )}
    </div>
  );
}
