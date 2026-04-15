import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Lock, Timer } from "lucide-react";



export function RoundTimer({ round }) {
  if (round.phase === "loading") {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <div className="relative w-24 h-24 rounded-full border border-border bg-muted/40 animate-pulse" />
        <div className="h-3 w-16 rounded bg-muted/50 animate-pulse" />
      </div>
    );
  }

  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const tick = () => setTimeLeft(Math.max(0, round.phaseEndTime - Date.now()));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [round.phaseEndTime]);

  const phaseDuration =
    round.phase === "betting" ? 20_000 : round.phase === "locked" ? 10_000 : round.phase === "starting" ? 10_000 : 3_000;
  const progress = Math.min(1, timeLeft / phaseDuration);
  const seconds = Math.ceil(timeLeft / 1000);
  const isUrgent = round.phase === "betting" && seconds <= 5;

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const phaseColors = {
    betting: isUrgent ? "hsl(var(--neon-red))" : "hsl(var(--neon-cyan))",
    locked: "hsl(var(--neon-pink))",
    starting: "hsl(var(--secondary))",
    resolving: "hsl(var(--neon-green))",
    resolved: "hsl(var(--muted-foreground))",
  };

  const phaseLabels = {
    betting: "BETTING",
    locked: "LOCKED",
    starting: "GET READY",
    resolving: "RESOLVING",
    resolved: "Waiting for next round",
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <motion.div
        className="relative w-24 h-24"
        animate={isUrgent ? { scale: [1, 1.06, 1] } : {}}
        transition={isUrgent ? { repeat: Infinity, duration: 0.6 } : {}}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke="hsl(var(--midnight-lighter))"
            strokeWidth="5"
          />
          <motion.circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={phaseColors[round.phase]}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.2 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {round.phase === "locked" ? (
            <Lock className="w-4 h-4 text-secondary mb-0.5" />
          ) : round.phase === "starting" ? (
            <Timer className="w-4 h-4 text-secondary mb-0.5" />
          ) : round.phase === "resolving" ? (
            <Timer className="w-4 h-4 text-neon-green mb-0.5 animate-spin" />
          ) : null}
          <span
            className={`text-xl font-mono font-black ${
              isUrgent ? "text-neon-red text-glow-red" : "text-foreground"
            }`}
          >
            {seconds}
          </span>
        </div>
      </motion.div>
      <div className="flex items-center gap-1.5">
        <div
          className="w-1.5 h-1.5 rounded-full animate-pulse-neon"
          style={{ background: phaseColors[round.phase] }}
        />
        <span className="text-[10px] font-mono tracking-widest text-muted-foreground">
          {phaseLabels[round.phase]}
        </span>
      </div>
    </div>
  );
}
