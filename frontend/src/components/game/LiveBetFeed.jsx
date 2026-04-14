import { motion, AnimatePresence } from "framer-motion";
import { Flame, Dice5, Hash } from "lucide-react";

export function LiveBetFeed({ bets }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <Flame className="w-3.5 h-3.5 text-secondary animate-pulse" />
        <span className="text-[10px] font-mono font-bold tracking-widest text-secondary">
          LIVE BETS
        </span>
        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
      </div>

      <div className="space-y-1 max-h-[140px] overflow-hidden">
        <AnimatePresence initial={false}>
          {bets.slice(0, 5).map((bet) => (
            <motion.div
              key={bet.id}
              initial={{ opacity: 0, x: -20, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-2 text-[11px] font-mono py-1 border-b border-border/50 last:border-0"
            >
              {bet.gameType === "dice" ? (
                <Dice5 className="w-3 h-3 text-primary shrink-0" />
              ) : (
                <Hash className="w-3 h-3 text-secondary shrink-0" />
              )}
              <span className={`font-bold ${bet.player === "You" ? "text-neon-green" : "text-foreground"}`}>
                {bet.player}
              </span>
              <span className="text-muted-foreground">bet</span>
              <span className="text-primary font-bold">{bet.amount.toFixed(2)}</span>
              <span className="text-muted-foreground">→</span>
              <span className="text-foreground font-bold">{bet.pick}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}