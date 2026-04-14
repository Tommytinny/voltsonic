import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";



const diceFaces = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

export function RoundResult({ diceResult, parityResult }) {
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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl border border-neon-green/30 bg-neon-green/5 p-4 text-center space-y-2"
    >
      <div className="text-[10px] font-mono tracking-widest text-muted-foreground">
        ROUND RESULT
      </div>
      <div className="flex items-center justify-center gap-6">
        <div className="text-center">
          <motion.div
            className="text-5xl mb-1"
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
            {diceFaces[currentFace]}
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
          <motion.div
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
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}