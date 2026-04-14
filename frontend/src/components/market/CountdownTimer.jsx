import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";



export function CountdownTimer({ endTime, isLocked }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const tick = () => setTimeLeft(Math.max(0, endTime - Date.now()));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [endTime]);

  const totalDuration = 120_000;
  const progress = Math.min(1, timeLeft / totalDuration);
  const seconds = Math.ceil(timeLeft / 1000);
  const isUrgent = seconds <= 30 && seconds > 0;

  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const strokeColor = isLocked
    ? "hsl(var(--muted-foreground))"
    : isUrgent
    ? "hsl(var(--neon-red))"
    : "hsl(var(--neon-cyan))";

  return (
    <div className="flex flex-col items-center gap-2">
      <motion.div
        className="relative w-28 h-28"
        animate={isUrgent && !isLocked ? { scale: [1, 1.05, 1] } : {}}
        transition={isUrgent ? { repeat: Infinity, duration: 0.8 } : {}}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke="hsl(var(--midnight-lighter))"
            strokeWidth="6"
          />
          <motion.circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.3 }}
            style={{
              filter: isUrgent && !isLocked
                ? "drop-shadow(0 0 8px hsl(350 90% 55% / 0.6))"
                : "drop-shadow(0 0 6px hsl(185 100% 50% / 0.4))",
            }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isLocked ? (
            <div className="flex flex-col items-center gap-1">
              <Lock className="w-5 h-5 text-muted-foreground" />
              <span className="text-xs font-bold tracking-widest text-muted-foreground">
                LOCKED
              </span>
            </div>
          ) : (
            <>
              <span
                className={`text-2xl font-mono font-black ${
                  isUrgent ? "text-neon-red text-glow-red" : "text-foreground"
                }`}
              >
                {seconds}
              </span>
              <span className="text-[10px] text-muted-foreground tracking-wider uppercase">
                seconds
              </span>
            </>
          )}
        </div>
      </motion.div>

      <span className="text-[10px] text-muted-foreground font-mono tracking-wider">
        ROUND TIMER
      </span>
    </div>
  );
}
