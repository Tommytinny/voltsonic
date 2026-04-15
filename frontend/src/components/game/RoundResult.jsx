import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

function DiceBadge({ value, className = "" }) {
  const dotsByValue = {
    1: [{ cx: 60, cy: 60, fill: "#22c55e" }],
    2: [
      { cx: 35, cy: 35, fill: "#ef4444" },
      { cx: 85, cy: 85, fill: "#ef4444" },
    ],
    3: [
      { cx: 30, cy: 30, fill: "#3b82f6" },
      { cx: 60, cy: 60, fill: "#3b82f6" },
      { cx: 90, cy: 90, fill: "#3b82f6" },
    ],
    4: [
      { cx: 35, cy: 35, fill: "#f59e0b" },
      { cx: 85, cy: 35, fill: "#f59e0b" },
      { cx: 35, cy: 85, fill: "#f59e0b" },
      { cx: 85, cy: 85, fill: "#f59e0b" },
    ],
    5: [
      { cx: 30, cy: 30, fill: "#a855f7" },
      { cx: 90, cy: 30, fill: "#a855f7" },
      { cx: 60, cy: 60, fill: "#a855f7" },
      { cx: 30, cy: 90, fill: "#a855f7" },
      { cx: 90, cy: 90, fill: "#a855f7" },
    ],
    6: [
      { cx: 35, cy: 25, fill: "#06b6d4" },
      { cx: 35, cy: 60, fill: "#06b6d4" },
      { cx: 35, cy: 95, fill: "#06b6d4" },
      { cx: 85, cy: 25, fill: "#06b6d4" },
      { cx: 85, cy: 60, fill: "#06b6d4" },
      { cx: 85, cy: 95, fill: "#06b6d4" },
    ],
  };
  const dots = dotsByValue[value] || dotsByValue[1];

  return (
    <svg
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block h-16 w-16 ${className}`.trim()}
      aria-hidden="true"
    >
      <rect width="120" height="120" rx="20" fill="#f8fafc" />
      {dots.map((dot, index) => (
        <circle key={`${value}-${index}`} cx={dot.cx} cy={dot.cy} r="10" fill={dot.fill} />
      ))}
    </svg>
  );
}

export function RoundResult({ roundId, diceResult, parityResult }) {
  const [rolling, setRolling] = useState(true);
  const [currentFace, setCurrentFace] = useState(0);

  useEffect(() => {
    if (diceResult === null) return;
    setRolling(true);
    setCurrentFace(0);

    let frame = 0;
    const totalFrames = 14;
    const interval = setInterval(() => {
      frame++;
      setCurrentFace(Math.floor(Math.random() * 6));
      if (frame >= totalFrames) {
        clearInterval(interval);
        setCurrentFace(diceResult - 1);
        setRolling(false);
      }
    }, 80);

    return () => clearInterval(interval);
  }, [diceResult]);

  if (diceResult === null || parityResult === null) return null;

  console.log("Rendering RoundResult with:", { roundId, diceResult, parityResult });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl border border-neon-green/30 bg-neon-green/5 p-4 text-center space-y-2"
    >
      <div className="text-[10px] font-mono tracking-widest text-muted-foreground">
        {roundId !== null && roundId !== undefined ? `ROUND ${roundId} RESULT` : "ROUND RESULT"}
      </div>
      <div className="flex items-center justify-center gap-6">
        <div className="text-center">
          <motion.div
            className="mb-1 flex justify-center"
            animate={rolling ? {
              rotateX: [0, 360],
              rotateZ: [0, -15, 15, -10, 10, 0],
              scale: [1, 1.2, 0.9, 1.1, 1],
            } : {
              rotateX: 0,
              rotateZ: 0,
              scale: [1.3, 1],
            }}
            transition={rolling ? {
              rotateX: { duration: 0.3, repeat: Infinity },
              rotateZ: { duration: 1.1, repeat: Infinity },
              scale: { duration: 0.8, repeat: Infinity },
            } : {
              duration: 0.3,
              type: "spring",
              stiffness: 300,
            }}
          >
            <DiceBadge value={currentFace + 1} />
          </motion.div>
          <AnimatePresence>
            {!rolling && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm font-mono font-bold text-neon-green text-glow-green"
              >
                Dice: {diceResult}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="w-px h-10 bg-border" />
        <div className="text-center">
          {/*<motion.div
            className="text-3xl mb-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: rolling ? 0.3 : 1 }}
            transition={{ delay: rolling ? 0 : 0.2 }}
          >
            {parityResult === "even" ? "⟐" : "◇"}
          </motion.div>
          <AnimatePresence>
            {!rolling && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-sm font-mono font-bold text-primary text-glow-cyan"
              >
                {parityResult.toUpperCase()}
              </motion.div>
            )}
          </AnimatePresence>*/}
        </div>
      </div>
    </motion.div>
  );
}
