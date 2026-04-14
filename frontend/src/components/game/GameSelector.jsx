import { motion } from "framer-motion";
import { Dice5, Hash } from "lucide-react";


const games = [
  { type: "dice", label: "DICE", icon: Dice5, desc: "Pick 1–6" },
  { type: "parity", label: "BLOCK PARITY", icon: Hash, desc: "Even / Odd" },
];

export function GameSelector({ active, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {games.map((g) => {
        const isActive = active === g.type;
        return (
          <motion.button
            key={g.type}
            whileTap={{ scale: 0.96 }}
            onClick={() => onChange(g.type)}
            className={`relative rounded-xl border p-3 text-left transition-all ${
              isActive
                ? "border-primary bg-primary/10"
                : "border-border bg-card hover:border-muted-foreground/30"
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="game-tab-glow"
                className="absolute inset-0 rounded-xl"
                style={{ boxShadow: "0 0 20px hsl(var(--neon-cyan) / 0.15)" }}
              />
            )}
            <div className="relative flex items-center gap-2">
              <g.icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
              <div>
                <div className={`text-xs font-black tracking-wider ${isActive ? "text-primary" : "text-foreground"}`}>
                  {g.label}
                </div>
                <div className="text-[10px] text-muted-foreground">{g.desc}</div>
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
