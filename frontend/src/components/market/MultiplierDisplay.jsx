import { motion, useAnimation } from "framer-motion";
import { useEffect } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

export function MultiplierDisplay({ yesMultiplier, noMultiplier }) {
  const yesControls = useAnimation();
  const noControls = useAnimation();

  useEffect(() => {
    yesControls.start({ scale: [1, 1.15, 1], transition: { duration: 0.3 } });
  }, [yesMultiplier, yesControls]);

  useEffect(() => {
    noControls.start({ scale: [1, 1.15, 1], transition: { duration: 0.3 } });
  }, [noMultiplier, noControls]);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-lg border border-neon-green/20 bg-neon-green/5 p-4 text-center space-y-1">
        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <TrendingUp className="w-3 h-3 text-neon-green" />
          <span>YES PAYOUT</span>
        </div>
        <motion.div
          animate={yesControls}
          className="text-2xl font-mono font-black text-neon-green text-glow-green"
        >
          {yesMultiplier}x
        </motion.div>
      </div>

      <div className="rounded-lg border border-neon-red/20 bg-neon-red/5 p-4 text-center space-y-1">
        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <TrendingDown className="w-3 h-3 text-neon-red" />
          <span>NO PAYOUT</span>
        </div>
        <motion.div
          animate={noControls}
          className="text-2xl font-mono font-black text-neon-red text-glow-red"
        >
          {noMultiplier}x
        </motion.div>
      </div>
    </div>
  );
}
