import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Fuel, Check, Lock } from "lucide-react";

const STEPS = ["dice", "amount", "confirm"];
const STEP_LABELS = ["Pick Dice", "Set Amount", "Confirm"];
const QUICK_AMOUNTS = [0.05, 0.1, 0.25, 0.5, 1.0];

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
      className={`inline-block h-10 w-10 ${className}`.trim()}
      aria-hidden="true"
    >
      <rect width="120" height="120" rx="20" fill="#f8fafc" />
      {dots.map((dot, index) => (
        <circle key={`${value}-${index}`} cx={dot.cx} cy={dot.cy} r="10" fill={dot.fill} />
      ))}
    </svg>
  );
}

export function QuickBetFlow({
  dicePools,
  diceTotalPool,
  getDiceMultiplier,
  onSubmit,
  disabled,
}) {
  const [step, setStep] = useState("dice");
  const [dicePick, setDicePick] = useState(null);
  const [amount, setAmount] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const stepIndex = STEPS.indexOf(step);
  const numAmount = parseFloat(amount) || 0;

  const diceMult = dicePick !== null ? getDiceMultiplier(dicePick) : 0;
  const potentialDiceReturn = numAmount * (diceMult || 0);

  const canProceed = useMemo(() => {
    if (step === "dice") return dicePick !== null;
    if (step === "amount") return numAmount > 0;
    return true;
  }, [step, dicePick, numAmount]);

  const goNext = () => {
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
  };

  const goBack = () => {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]);
  };

  const handleConfirm = async () => {
    if (dicePick === null || numAmount <= 0) return;
    setSubmitting(true);
    const success = await onSubmit(dicePick, numAmount);
    setSubmitting(false);

    if (!success) return;

    setSubmitted(true);
    setTimeout(() => {
      setDicePick(null);
      setAmount("");
      setStep("dice");
      setSubmitted(false);
    }, 1500);
  };

  const selectDice = (n) => {
    setDicePick(n);
    setTimeout(goNext, 200);
  };

  const selectQuickAmount = (a) => {
    setAmount(String(a));
  };

  // Success state
  if (submitted) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex flex-col items-center justify-center py-10 space-y-3"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, delay: 0.1 }}
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: "hsl(var(--neon-green) / 0.2)", boxShadow: "var(--glow-green)" }}
        >
          <Check className="w-7 h-7" style={{ color: "hsl(var(--neon-green))" }} />
        </motion.div>
        <div className="text-sm font-bold text-foreground">Bet Placed!</div>
        <div className="text-[10px] font-mono text-muted-foreground">
          Dice #{dicePick} • {numAmount} VOLT
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1">
            <motion.div
              className={`h-1 rounded-full flex-1 transition-colors duration-300 ${
                i <= stepIndex ? "bg-[hsl(185_100%_50%)]" : "bg-muted"
              }`}
              animate={i === stepIndex ? { opacity: [0.6, 1, 0.6] } : { opacity: 1 }}
              transition={i === stepIndex ? { repeat: Infinity, duration: 1.5 } : {}}
            />
          </div>
        ))}
      </div>

      {/* Step label */}
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-mono text-muted-foreground tracking-widest">
          STEP {stepIndex + 1}/3 — {STEP_LABELS[stepIndex]}
        </div>
        {/* Selections summary chips */}
        <div className="flex items-center gap-1">
          {dicePick !== null && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="inline-flex items-center gap-1 rounded border border-[hsl(185_100%_50%)] bg-[hsl(var(185_100%_50%)] px-1.5 py-0.5 text-[9px] font-mono font-bold text-[hsl(185_100%_50%)]"
            >
              <DiceBadge value={dicePick} className="h-5 w-5" />
              {dicePick}
            </motion.span>
          )}
        </div>
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        {step === "dice" && (
          <motion.div
            key="dice"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.15 }}
          >
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6].map((n) => {
                const mult = getDiceMultiplier(n);
                const selected = dicePick === n;
                return (
                  <motion.button
                    key={n}
                    whileTap={{ scale: 0.88 }}
                    whileHover={{ scale: 1.05 }}
                    onClick={() => !disabled && selectDice(n)}
                    disabled={disabled}
                    className={`relative rounded-xl border p-3 text-center transition-all ${
                      selected
                        ? "border-primary bg-primary/15 ring-1 ring-primary/40"
                        : "border-border bg-card hover:border-primary/40 disabled:opacity-30 disabled:cursor-not-allowed"
                    }`}
                  >
                    <DiceBadge value={n} className="mx-auto mb-1" />
                    <div className="text-lg font-mono font-black text-foreground">{n}</div>
                   {/*} <div className="text-[10px] font-mono text-muted-foreground mt-1">
                      {mult > 0 ? `${mult}x` : "—"}
                    </div>*/}
                    <div className="text-[9px] font-mono text-muted-foreground mt-1">
                      {Number(dicePools?.[n] || 0).toFixed(2)} VOLT
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}

        {step === "amount" && (
          <motion.div
            key="amount"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.15 }}
            className="space-y-3"
          >
            {/* Quick amount buttons */}
            {/*<div className="flex gap-1.5 flex-wrap">
              {QUICK_AMOUNTS.map((a) => (
                <motion.button
                  key={a}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => selectQuickAmount(a)}
                  className={`px-3 py-2 rounded-lg border text-xs font-mono font-bold transition-all ${
                    parseFloat(amount) === a
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-muted text-muted-foreground hover:text-foreground hover:border-primary/30"
                  }`}
                >
                  {a} VOLT
                </motion.button>
              ))}
            </div>*/}

            {/* Custom input */}
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Custom amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full h-12 rounded-xl border border-[hsl(230_20%_18%)] bg-[hsl(230_20%_16%)] px-4 pr-14 font-mono text-lg text-[hsl(210_40%_96%)] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
                VOLT
              </span>
            </div>

            {/* Return preview */}
            {numAmount > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="rounded-lg bg-muted/50 border border-border p-3 space-y-1.5"
              >
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Dice #{dicePick} return</span>
                  <span className="font-mono font-bold text-primary">
                    {potentialDiceReturn > 0 ? `${potentialDiceReturn.toFixed(4)} VOLT` : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-1 border-t border-border">
                  <Fuel className="w-3 h-3" />
                  <span>Requires a single contract transaction plus any needed approval.</span>
                </div>
              </motion.div>
            )}

            <div className="rounded-xl border border-dashed border-secondary/30 bg-secondary/5 p-4">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-secondary" />
                <span className="text-[10px] font-mono font-bold tracking-widest text-secondary">
                  PARITY MODE COMING SOON
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                This version supports dice pools only. Parity betting will be enabled in the next release.
              </p>
            </div>
          </motion.div>
        )}

        {step === "confirm" && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            {/* Summary card */}
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <div className="text-[10px] font-mono text-muted-foreground tracking-widest mb-2">
                BET SUMMARY
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {dicePick !== null ? <DiceBadge value={dicePick} className="h-8 w-8" /> : null}
                  <div>
                    <div className="text-xs font-bold text-foreground">Dice #{dicePick}</div>
                    <div className="text-[10px] font-mono text-primary">{diceMult}x multiplier</div>
                  </div>
                </div>
                <div className="text-sm font-mono font-bold text-foreground">{numAmount} VOLT</div>
              </div>
              <div className="border-t border-border pt-2 flex justify-between text-xs">
                <span className="text-muted-foreground">Total stake</span>
                <span className="font-mono font-bold text-foreground">{numAmount.toFixed(4)} VOLT</span>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-secondary/20 bg-secondary/5 px-3 py-2">
              <Lock className="w-4 h-4 text-secondary" />
              <span className="text-[11px] text-secondary font-bold">
                Parity mode and jackpot rewards are coming in a future update.
              </span>
            </div>

            {/* Confirm button */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              onClick={handleConfirm}
              disabled={submitting}
              className="w-full py-4 rounded-xl font-black text-sm tracking-widest bg-primary text-primary-foreground transition-all"
              style={{ boxShadow: "var(--glow-cyan)" }}
            >
              {submitting ? "WAITING FOR APPROVAL..." : `PLACE DICE BET - ${numAmount.toFixed(5)} VOLT`}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      {step !== "confirm" && (
        <div className="flex items-center justify-between pt-1">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={goBack}
            disabled={stepIndex === 0}
            className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground disabled:opacity-0 transition-all"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </motion.button>

          {step !== "dice" && (
            <motion.button
              whileTap={{ scale: 0.92 }}
              whileHover={{ scale: 1.02 }}
              onClick={goNext}
              disabled={!canProceed}
              className="flex items-center gap-1 px-4 py-2 rounded-[0.75rem] text-xs font-bold bg-[hsl(185_100%_50%)] text-[hsl(230_25%_7%)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              {step === "amount" ? "Review" : "Next"} <ChevronRight className="w-3.5 h-3.5" />
            </motion.button>
          )}
        </div>
      )}
    </div>
  );
}
