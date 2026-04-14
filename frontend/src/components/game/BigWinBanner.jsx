import { motion, AnimatePresence } from "framer-motion";
import { PartyPopper } from "lucide-react";

export function BigWinBanner({ bigWin }) {
  return (
    <AnimatePresence>
      {bigWin && (
        <motion.div
          key={bigWin.id}
          initial={{ opacity: 0, y: -40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="fixed top-0 left-0 right-0 z-50 px-4 pt-3 pb-2"
        >
          <div
            className="max-w-lg mx-auto rounded-xl border border-secondary/50 bg-card px-4 py-3 flex items-center gap-3"
            style={{ boxShadow: "0 0 40px hsl(var(--neon-pink) / 0.3), 0 4px 20px hsl(0 0% 0% / 0.5)" }}
          >
            <PartyPopper className="w-5 h-5 text-secondary animate-bounce shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-mono tracking-widest text-secondary font-bold">
                🎉 BIG WINNER
              </div>
              <div className="text-sm font-mono font-bold text-foreground truncate">
                {bigWin.player} just won{" "}
                <span className="text-secondary text-glow-pink">
                  {bigWin.amount.toFixed(1)} ETH
                </span>
                !
              </div>
            </div>
            <PartyPopper className="w-5 h-5 text-secondary animate-bounce shrink-0" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}