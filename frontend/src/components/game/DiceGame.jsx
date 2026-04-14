import { motion, useAnimation } from "framer-motion";
import { useEffect } from "react";

const diceFaces = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

export function DiceGame({ pools, totalPool, getMultiplier, onPick, disabled, result }) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-[10px] font-mono text-muted-foreground tracking-widest mb-1">
          PICK A NUMBER
        </div>
        <div className="text-xs text-muted-foreground">
          Pool: <span className="font-mono text-primary text-glow-cyan">{totalPool.toFixed(2)} ETH</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6].map((n) => {
          const mult = getMultiplier(n);
          const isWinner = result === n;
          return (
            <motion.button
              key={n}
              whileTap={disabled ? {} : { scale: 0.9 }}
              whileHover={disabled ? {} : { scale: 1.05 }}
              onClick={() => !disabled && onPick(n)}
              disabled={disabled}
              className={`relative rounded-xl border p-3 text-center transition-all ${
                isWinner
                  ? "border-neon-green bg-neon-green/20 glow-green"
                  : result !== null && result !== n
                  ? "border-border bg-card opacity-40"
                  : "border-border bg-card hover:border-primary/40 disabled:opacity-30 disabled:cursor-not-allowed"
              }`}
            >
              <div className="text-2xl mb-1">{diceFaces[n - 1]}</div>
              <div className="text-lg font-mono font-black text-foreground">{n}</div>
              <div className="text-[10px] font-mono text-muted-foreground mt-1">
                {mult > 0 ? `${mult}x` : "—"}
              </div>
              <div className="text-[9px] font-mono text-muted-foreground">
                {pools[n].toFixed(2)} ETH
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
