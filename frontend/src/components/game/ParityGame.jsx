export function ParityGame({
  evenPool,
  oddPool,
  totalPool,
  getMultiplier,
  onPick,
  disabled,
  result,
}) {
  const evenMult = getMultiplier("even");
  const oddMult = getMultiplier("odd");
  const total = evenPool + oddPool;
  const evenPercent = total > 0 ? (evenPool / total) * 100 : 50;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-[10px] font-mono text-muted-foreground tracking-widest mb-1">
          BLOCK HASH LAST DIGIT
        </div>
        <div className="text-xs text-muted-foreground">
          Pool: <span className="font-mono text-primary text-glow-cyan">{totalPool.toFixed(2)} ETH</span>
        </div>
      </div>

      {/* Tug of war bar */}
      <div className="relative h-3 rounded-full bg-muted overflow-hidden border border-border">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-l-full"
          style={{
            background: "linear-gradient(90deg, hsl(var(--neon-cyan) / 0.8), hsl(var(--neon-cyan) / 0.3))",
          }}
          animate={{ width: `${evenPercent}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {(["even", "odd"]).map((side) => {
          const isEven = side === "even";
          const mult = isEven ? evenMult : oddMult;
          const pool = isEven ? evenPool : oddPool;
          const isWinner = result === side;
          const isLoser = result !== null && result !== side;

          return (
            <motion.button
              key={side}
              whileTap={disabled ? {} : { scale: 0.92 }}
              whileHover={disabled ? {} : { scale: 1.03 }}
              onClick={() => !disabled && onPick(side)}
              disabled={disabled}
              className={`relative py-5 rounded-xl border text-center transition-all ${
                isWinner
                  ? "border-neon-green bg-neon-green/15 glow-green"
                  : isLoser
                  ? "border-border bg-card opacity-40"
                  : isEven
                  ? "border-primary/30 bg-primary/5 hover:bg-primary/10 disabled:opacity-30 disabled:cursor-not-allowed"
                  : "border-secondary/30 bg-secondary/5 hover:bg-secondary/10 disabled:opacity-30 disabled:cursor-not-allowed"
              }`}
            >
              <div className={`text-2xl font-black mb-1 ${isEven ? "text-primary" : "text-secondary"}`}>
                {isEven ? "0 2 4" : "1 3 5"}
              </div>
              <div className={`text-sm font-black tracking-widest ${isEven ? "text-primary" : "text-secondary"}`}>
                {side.toUpperCase()}
              </div>
              <div className="text-xs font-mono text-muted-foreground mt-2">
                {mult > 0 ? `${mult}x` : "—"} • {pool.toFixed(2)} ETH
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
