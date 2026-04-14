import { motion } from "framer-motion";
import { Trophy, Flame, Sparkles, Lock } from "lucide-react";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";

export function JackpotDisplay({ jackpotPool, streak }) {
  const animatedValue = useAnimatedCounter(jackpotPool);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-secondary/30 bg-secondary/5 p-4 space-y-2"
      style={{ boxShadow: "0 0 30px hsl(var(--neon-pink) / 0.1)" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-secondary" />
          <span className="text-[10px] font-mono tracking-widest text-muted-foreground">
            DOUBLE PREDICTION JACKPOT
          </span>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/20 border border-secondary/30">
            <Flame className="w-3 h-3 text-secondary" />
            <span className="text-[10px] font-mono font-bold text-secondary">
              {streak}x STREAK
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-center gap-2">
        <Sparkles className="w-4 h-4 text-secondary animate-pulse-neon" />
        <motion.span
          key={Math.floor(jackpotPool * 100)}
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
          className="text-2xl font-mono font-black text-secondary text-glow-pink"
        >
          {animatedValue.toFixed(4)} VOLT
        </motion.span>
        <Sparkles className="w-4 h-4 text-secondary animate-pulse-neon" />
      </div>
      <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-secondary/30 bg-secondary/10 px-3 py-2">
        <Lock className="w-3.5 h-3.5 text-secondary" />
        <span className="text-[10px] text-center font-mono tracking-wide text-muted-foreground">
          Jackpot rewards are coming soon in a later version.
        </span>
      </div>
    </motion.div>
  );
}
