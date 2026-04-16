import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Coins, Dice3, TimerReset, Trophy, Wallet } from "lucide-react";

const STEPS = [
  {
    icon: Wallet,
    title: "Connect Your Wallet",
    body: "Use the connect button in the top bar to link the wallet that will place bets and receive winnings.",
  },
  {
    icon: Coins,
    title: "Set Spending Limit In Wallet",
    body: "Open the Wallet page and approve a VOLT spending limit first. Your bets cannot go through until the game contract has allowance to use your VOLT.",
  },
  {
    icon: Dice3,
    title: "Place A Dice Bet",
    body: "Return to the dashboard, pick one dice number, enter your VOLT amount (minimum $5 USD equivalent), and confirm the bet before the round timer closes.",
  },
  {
    icon: TimerReset,
    title: "Wait For Round Result",
    body: "When betting closes, the round settles and the winning dice is shown in the round result card.",
  },
  {
    icon: Trophy,
    title: "Claim Winnings In Wallet",
    body: "If your bet wins, go back to the Wallet page and claim from the winnings section or use the latest claim action when it becomes available.",
  },
];

export function HowToPlayPanel() {
  const [open, setOpen] = useState(false);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card"
      style={{
        boxShadow:
          "0 0 40px hsl(var(--neon-cyan) / 0.03), 0 0 80px hsl(var(--neon-pink) / 0.015)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div>
          <div className="text-sm font-black uppercase tracking-widest text-foreground">
            HOW TO PLAY
          </div>
          {/*<h2 className="mt-1 text-sm font-black uppercase tracking-wide text-foreground">
            Wallet To Win Flow
          </h2>*/}
          <p className="mt-1 text-xs text-muted-foreground">
            Connect, approve, bet, wait for settlement, then claim in Wallet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-widest text-primary">
            {open ? "Hide" : "Show"}
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-4 pb-4 pt-4">
              <div className="grid gap-3">
                {STEPS.map(({ icon: Icon, title, body }, index) => (
                  <div
                    key={title}
                    className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-3"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-mono tracking-widest text-muted-foreground">
                        STEP {index + 1}
                      </div>
                      <div className="mt-1 text-sm font-bold text-foreground">{title}</div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-dashed border-secondary/30 bg-secondary/5 p-3 text-xs text-muted-foreground">
                Dice betting is live now. Set your allowance in Wallet before betting, and return to Wallet again after settlement to claim any winnings.
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}
