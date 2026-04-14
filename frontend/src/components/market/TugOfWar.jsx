import { motion, AnimatePresence } from "framer-motion";


export function TugOfWar({ yesLiquidity, noLiquidity }) {
  const total = yesLiquidity + noLiquidity;
  const yesPercent = total > 0 ? (yesLiquidity / total) * 100 : 50;
  const isBalanced = Math.abs(yesPercent - 50) < 3;

  return (
    <div className="w-full space-y-3">
      <div className="flex justify-between text-sm font-mono">
        <span className="text-neon-green text-glow-green font-semibold">
          YES {yesPercent.toFixed(1)}%
        </span>
        <span className="text-neon-red text-glow-red font-semibold">
          NO {(100 - yesPercent).toFixed(1)}%
        </span>
      </div>

      <div className="relative h-10 rounded-full bg-midnight-lighter overflow-hidden border border-border">
        {/* YES side */}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-l-full"
          style={{
            background: "linear-gradient(90deg, hsl(155 100% 45% / 0.8), hsl(155 100% 45% / 0.4))",
            boxShadow: "inset 0 0 20px hsl(155 100% 45% / 0.3)",
          }}
          animate={{ width: `${yesPercent}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />

        {/* NO side */}
        <motion.div
          className="absolute inset-y-0 right-0 rounded-r-full"
          style={{
            background: "linear-gradient(270deg, hsl(350 90% 55% / 0.8), hsl(350 90% 55% / 0.4))",
            boxShadow: "inset 0 0 20px hsl(350 90% 55% / 0.3)",
          }}
          animate={{ width: `${100 - yesPercent}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />

        {/* VS Badge */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center z-10"
          animate={isBalanced ? { rotate: [0, -3, 3, -3, 0] } : { rotate: 0 }}
          transition={isBalanced ? { repeat: Infinity, duration: 0.5, repeatDelay: 1 } : {}}
        >
          <div
            className="px-3 py-1 rounded-full text-xs font-black tracking-widest border border-border"
            style={{
              background: "hsl(var(--midnight))",
              color: "hsl(var(--foreground))",
            }}
          >
            VS
          </div>
        </motion.div>
      </div>

      <div className="flex justify-between text-xs text-muted-foreground font-mono">
        <span>{yesLiquidity.toFixed(2)} ETH</span>
        <span>{noLiquidity.toFixed(2)} ETH</span>
      </div>
    </div>
  );
}