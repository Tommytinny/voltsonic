import { motion } from "framer-motion";
import { ArrowUp, ArrowDown } from "lucide-react";


export function ActionButtons({ onYes, onNo, disabled }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <motion.button
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.03 }}
        onClick={onYes}
        disabled={disabled}
        className="relative py-4 rounded-xl font-black text-sm tracking-widest bg-neon-green text-primary-foreground glow-green disabled:opacity-30 disabled:cursor-not-allowed overflow-hidden"
      >
        <div className="flex items-center justify-center gap-2">
          <ArrowUp className="w-5 h-5" />
          <span>YES / UP</span>
        </div>
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.03 }}
        onClick={onNo}
        disabled={disabled}
        className="relative py-4 rounded-xl font-black text-sm tracking-widest bg-neon-red text-secondary-foreground glow-red disabled:opacity-30 disabled:cursor-not-allowed overflow-hidden"
      >
        <div className="flex items-center justify-center gap-2">
          <ArrowDown className="w-5 h-5" />
          <span>NO / DOWN</span>
        </div>
      </motion.button>
    </div>
  );
}
