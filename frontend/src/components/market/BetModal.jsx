import { useState } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Fuel } from "lucide-react";

export function BetModal({ open, onOpenChange, side, multiplier, onConfirm, label }) {
  const [amount, setAmount] = useState("");
  const numAmount = parseFloat(amount) || 0;
  const potentialReturn = numAmount * multiplier;
  const isYes = side === "yes";

  const handleConfirm = () => {
    if (numAmount > 0) {
      onConfirm(numAmount);
      setAmount("");
      onOpenChange(false);
    }
  };

  const displayLabel = label || (isYes ? "YES / UP" : "NO / DOWN");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">
            Bet on{" "}
            <span className={isYes ? "text-primary text-glow-cyan" : "text-secondary text-glow-pink"}>
              {displayLabel}
            </span>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Current multiplier: {multiplier}x
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-mono">AMOUNT (ETH)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono text-lg bg-muted border-border focus:ring-primary"
            />
          </div>

          <div className="rounded-lg bg-muted p-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Potential Return</span>
              <span className={`font-mono font-bold ${isYes ? "text-primary" : "text-secondary"}`}>
                {potentialReturn.toFixed(4)} ETH
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Net Profit</span>
              <span className="font-mono font-bold text-foreground">
                {(potentialReturn - numAmount).toFixed(4)} ETH
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Fuel className="w-3 h-3" />
            <span>Estimated gas: ~0.0008 ETH</span>
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.02 }}
            onClick={handleConfirm}
            disabled={numAmount <= 0}
            className={`w-full py-3 rounded-lg font-bold text-sm tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
              isYes
                ? "bg-primary text-primary-foreground glow-cyan"
                : "bg-secondary text-secondary-foreground glow-pink"
            }`}
          >
            CONFIRM BET
          </motion.button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
