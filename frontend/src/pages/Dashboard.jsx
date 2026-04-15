import { useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useVoltSonic, shortAddress, parseTokenAmount } from "./Index.jsx";
import { RoundTimer } from "@/components/game/RoundTimer";
import { JackpotDisplay } from "@/components/game/JackpotDisplay";
import { RoundResult } from "@/components/game/RoundResult";
import { BetHistoryPanel } from "@/components/game/BetHistoryPanel";
import { BigWinBanner } from "@/components/game/BigWinBanner";
import { RoundHistoryPanel } from "@/components/game/RoundHistoryPanel";
import { QuickBetFlow } from "@/components/game/QuickBetFlow";

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || "http://127.0.0.1:8000";

function parseRoundNumber(value) {
  return Number(String(value || "").replace("#", "")) || 0;
}

function parseFormattedAmount(value) {
  const match = String(value || "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function parseRawTokenAmount(value) {
  try {
    return Number(ethers.formatEther(BigInt(String(value || "0"))));
  } catch {
    return 0;
  }
}

function fetchBackendJson(path) {
  return fetch(`${BACKEND_API_URL}${path}`).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Backend request failed: ${response.status}`);
    }
    return response.json();
  });
}

/*function buildRoundState(snapshot, roundCountdownLabel, latestResult, snapshotLoading) {
  const dicePoolValues = Array.from({ length: 6 }, (_, index) =>
    parseFormattedAmount(snapshot.roundPoolCards[index]?.amount)
  );
  const evenPool = parseFormattedAmount(snapshot.roundPoolCards[6]?.amount);
  const oddPool = parseFormattedAmount(snapshot.roundPoolCards[7]?.amount);
  const now = Date.now();
  const roundStartMs = Number(snapshot.roundStartTime || 0) * 1000;
  const roundCloseMs = Number(snapshot.roundCloseTime || 0) * 1000;
  const resolveWindowMs = 3_000;

  let phase = "loading";
  let phaseEndTime = now + 10_000;

  if (snapshotLoading) {
    phase = "loading";
    phaseEndTime = now + 10_000;
  } else if (snapshot.bettingOpen && roundCloseMs && now < roundCloseMs) {
    phase = "betting";
    phaseEndTime = roundCloseMs;
  } else if (!snapshot.bettingOpen && roundCloseMs && now < roundCloseMs) {
    phase = "locked";
    phaseEndTime = roundCloseMs;
  } else if (roundCloseMs && now < roundCloseMs + resolveWindowMs) {
    phase = "resolving";
    phaseEndTime = roundCloseMs + resolveWindowMs;
  } else if (roundStartMs && now < roundStartMs) {
    phase = "starting";
    phaseEndTime = roundStartMs;
  } else if (roundCloseMs && now >= roundCloseMs + resolveWindowMs) {
    phase = "resolved";
    phaseEndTime = now + 10_000;
  }

  return {
    roundId: parseRoundNumber(snapshot.currentRound),
    phase,
    phaseEndTime,
    dicePools: [0, ...dicePoolValues],
    diceTotalPool: dicePoolValues.reduce((sum, value) => sum + value, 0),
    evenPool,
    oddPool,
    parityTotalPool: evenPool + oddPool,
    diceResult: latestResult?.diceResult ?? null,
    parityResult: latestResult?.parityResult ?? null,
    jackpotPool: parseFormattedAmount(snapshot.jackpotBalance),
  };
}*/

function buildRoundState(snapshot, roundCountdownLabel, latestResult, snapshotLoading) {
  const dicePoolValues = Array.from({ length: 6 }, (_, index) =>
    parseFormattedAmount(snapshot.roundPoolCards[index]?.amount)
  );

  const evenPool = parseFormattedAmount(snapshot.roundPoolCards[6]?.amount);
  const oddPool = parseFormattedAmount(snapshot.roundPoolCards[7]?.amount);

  const now = Date.now();
  const roundStartMs = Number(snapshot.roundStartTime || 0) * 1000;
  const roundCloseMs = Number(snapshot.roundCloseTime || 0) * 1000;

  const resolveWindowMs = 3_000;

  const roundId = parseRoundNumber(snapshot.currentRound);
  const latestSettled = parseRoundNumber(snapshot.latestSettledRound);

  const isNewRoundStarted = roundId !== latestSettled;

  let phase = "loading";
  let phaseEndTime = now + 10_000;

  // -------------------------
  // FIXED STATE MACHINE
  // -------------------------

  if (snapshotLoading) {
    phase = "loading";
    phaseEndTime = now + 10_000;
  } 
  else if (snapshot.bettingOpen) {
    phase = "betting";
    phaseEndTime = roundCloseMs || now + 20_000;
  } 
  else if (!snapshot.bettingOpen && !isNewRoundStarted) {
    // betting closed but still same round → resolving
    phase = "resolving";
    phaseEndTime = (roundCloseMs || now) + resolveWindowMs;
  } 
  else if (isNewRoundStarted) {
    // contract already moved forward → new round starting
    phase = "starting";
    phaseEndTime = roundStartMs || now + 10_000;
  } 
  else {
    // fallback safe state (prevents UI freeze)
    phase = "betting";
    phaseEndTime = now + 20_000;
  }

  console.log({
  currentRound: snapshot.currentRound,
  latestSettledRound: snapshot.latestSettledRound,
  bettingOpen: snapshot.bettingOpen,
});

  return {
    roundId,

    phase,
    phaseEndTime,

    dicePools: [0, ...dicePoolValues],
    diceTotalPool: dicePoolValues.reduce((sum, value) => sum + value, 0),

    evenPool,
    oddPool,
    parityTotalPool: evenPool + oddPool,

    diceResult: latestResult?.diceResult ?? null,
    parityResult: latestResult?.parityResult ?? null,

    jackpotPool: parseFormattedAmount(snapshot.jackpotBalance),
  };
}

function mapHistoryRound(round) {
  return {
    roundId: Number(round.round_id),
    diceResult: Number(round.dice_result || 0),
    parityResult: round.parity_result ? "even" : "odd",
    totalPool: (parseRawTokenAmount(round.total_dice_pool) + parseRawTokenAmount(round.total_parity_pool)).toFixed(2),
    jackpotWon: Number(round.total_jackpot_winners || 0) > 0,
  };
}

function mapBetHistoryToRound(bet) {
  const totalStake = parseRawTokenAmount((BigInt(bet.diceAmount || 0n) + BigInt(bet.parityAmount || 0n)).toString());
  return {
    roundId: bet.roundId,
    diceResult: Number(bet.diceResult || 0),
    parityResult: String(bet.parityResult).toLowerCase() === "even" ? "even" : "odd",
    totalPool: totalStake.toFixed(2),
    jackpotWon: bet.wonDice && bet.wonParity,
  };
}

function DashboardHeroSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-2xl border border-border bg-card p-4 space-y-4"
      style={{
        boxShadow:
          "0 0 40px hsl(var(--neon-cyan) / 0.04), 0 0 80px hsl(var(--neon-pink) / 0.02)",
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={`pool-skeleton-${index}`} className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
            <div className="h-3 w-16 rounded bg-muted/60 animate-pulse" />
            <div className="h-8 rounded bg-muted/60 animate-pulse" />
            <div className="h-2 w-12 rounded bg-muted/60 animate-pulse" />
          </div>
        ))}
      </div>
      <div className="h-11 rounded-xl bg-muted/60 animate-pulse" />
    </motion.div>
  );
}

export default function Game() {
  const navigate = useNavigate();
  const {
    snapshot,
    snapshotLoading,
    betHistory,
    betHistoryLoading,
    backendStatus,
    account,
    connectWallet,
    switchWallet,
    writeContract,
    roundCountdownLabel,
  } = useVoltSonic();
  const [backendRounds, setBackendRounds] = useState([]);
  const previousBackendStatusRef = useRef(backendStatus);
  const hasLoadedBackendDataRef = useRef(false);

  useEffect(() => {
    if (previousBackendStatusRef.current !== backendStatus) {
      if (backendStatus === "ready") {
        toast.success("Dashboard is synced with live data.");
      } else if (backendStatus === "offline") {
        toast.warning("Server is ofline. Falling back where possible.");
      }
      previousBackendStatusRef.current = backendStatus;
    }
  }, [backendStatus]);

  useEffect(() => {
    if (backendStatus !== "ready") {
      hasLoadedBackendDataRef.current = false;
      return;
    }

    let cancelled = false;

    async function loadBackendData() {
      try {
        const rounds = await fetchBackendJson("/api/v1/rounds?limit=10");

        if (cancelled) return;

        setBackendRounds(
          rounds
            .filter((round) => round.settled && round.dice_result)
            .map(mapHistoryRound)
        );
      } catch {
        if (!cancelled) {
          setBackendRounds([]);
          toast.error("Could not refresh live dashboard activity.");
        }
      }
    }

    const shouldLoad = !hasLoadedBackendDataRef.current;

    if (shouldLoad) {
      loadBackendData().finally(() => {
        hasLoadedBackendDataRef.current = true;
      });
    }

    return () => {
      cancelled = true;
    };
  }, [account, backendStatus, snapshot.currentRound, snapshot.latestSettledRound]);

  const latestResult = useMemo(() => {
    const diceResult = Number(snapshot.latestResultDice);
    const hasDiceResult = Number.isFinite(diceResult) && diceResult > 0;
    const parityResult =
      snapshot.latestResultParity === "Even"
        ? "even"
        : snapshot.latestResultParity === "Odd"
          ? "odd"
          : null;

    return {
      diceResult: hasDiceResult ? diceResult : null,
      parityResult,
    };
  }, [snapshot.latestResultDice, snapshot.latestResultParity]);

  const round = useMemo(
    () => buildRoundState(snapshot, roundCountdownLabel, latestResult, snapshotLoading),
    [latestResult, roundCountdownLabel, snapshot, snapshotLoading]
  );

  const getDiceMultiplier = (pick) => {
    const sidePool = round.dicePools[pick] || 0;
    if (sidePool <= 0) return 0;
    return Number(((round.diceTotalPool * 0.95) / sidePool).toFixed(2));
  };

  const walletBalance = useMemo(
    () => parseFormattedAmount(snapshot.credits),
    [snapshot.credits]
  );

  const spendingLimit = useMemo(
    () => parseFormattedAmount(snapshot.tokenAllowance),
    [snapshot.tokenAllowance]
  );

  const roundHistory = useMemo(() => {
    if (backendRounds.length > 0) {
      return backendRounds.slice(0, 10);
    }

    const rounds = [];
    const seenRoundIds = new Set();

    for (const bet of betHistory) {
      if (bet.result === "open" || !bet.diceResult || seenRoundIds.has(bet.roundId)) {
        continue;
      }
      seenRoundIds.add(bet.roundId);
      rounds.push(mapBetHistoryToRound(bet));
      if (rounds.length === 10) break;
    }

    return rounds;
  }, [backendRounds, betHistory]);

  const isBettingOpen = !snapshotLoading && round.phase === "betting";
  const showLatestResult = roundCountdownLabel === "Settling" && latestResult.diceResult !== null && latestResult.parityResult !== null;

  const handleQuickBet = async (dicePick, amount) => {
    const parsedAmount = parseTokenAmount(String(amount));
    if (!account) {
      toast.warning("Connect your wallet to place a bet.");
      return false;
    }
    if (!isBettingOpen) {
      toast.warning("Betting is not open right now.");
      return false;
    }
    if (amount > walletBalance) {
      toast.warning("Bet rejected: amount is higher than your wallet balance. Fund the wallet or lower the bet.");
      return false;
    }
    if (amount > spendingLimit) {
      toast.warning("Bet rejected: amount is above your spending limit. Increase the limit in Wallet first.");
      return false;
    }
    toast.info(`Submitting dice bet on ${dicePick}...`);

    const result = await writeContract(
      async (contract) => {
        if (parsedAmount <= 0n) {
          throw new Error("Enter a VOLT amount");
        }
        return contract.placeBet(BigInt(dicePick), true, parsedAmount, 0n);
      },
      "Submitting dice bet...",
      "Dice bet placed."
    );

    if (result.ok) {
      toast.success(`Dice bet placed on ${dicePick}.`);
      return true;
    }

    toast.error(result.error || "Bet rejected.");
    return false;
  };

  return (
    <div className="min-h-screen bg-background scanline">
      <BigWinBanner bigWin={null} />

      <header className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-[hsl(185_100%_50%)]" />
          <span className="font-black text-lg tracking-tight text-foreground">
            VOLT<span className="text-[hsl(185_100%_50%)]">SONIC</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/wallet")}
            className="px-3 py-1.5 rounded-lg border border-border bg-muted text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            Wallet
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={account ? switchWallet : connectWallet}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            <Wallet className="w-3.5 h-3.5" />
            {account ? shortAddress(account) : "Connect"}
          </motion.button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            {snapshotLoading ? (
              <div className="h-3 w-24 rounded bg-muted/60 animate-pulse" />
            ) : (
              <div className="text-[10px] font-mono text-muted-foreground tracking-widest">
                ROUND #{round.roundId || "--"}
              </div>
            )}
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              {/*<Users className="w-3 h-3" />
              <span>{playerCount} players</span>*/}
            </div>
          </div>
          <RoundTimer round={round} />
        </div>

        <JackpotDisplay jackpotPool={round.jackpotPool} streak={0} loading={snapshotLoading} />

        {snapshotLoading ? (
          <DashboardHeroSkeleton />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border bg-card p-4 space-y-4"
            style={{
              boxShadow:
                "0 0 40px hsl(var(--neon-cyan) / 0.04), 0 0 80px hsl(var(--neon-pink) / 0.02)",
            }}
          >
            <AnimatePresence mode="wait">
              {showLatestResult ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <RoundResult
                    roundId={latestResult.roundId}
                    diceResult={latestResult.diceResult}
                    parityResult={latestResult.parityResult}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="quickbet"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <QuickBetFlow
                    dicePools={round.dicePools}
                    diceTotalPool={round.diceTotalPool}
                    getDiceMultiplier={getDiceMultiplier}
                    onSubmit={handleQuickBet}
                    disabled={!isBettingOpen || !account}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        <AnimatePresence>
          {snapshotLoading ? null : !account ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-xs text-muted-foreground font-mono"
            >
              Connect your wallet to place a combo bet.
            </motion.p>
          ) : round.phase === "locked" ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-xs text-muted-foreground font-mono"
            >
              Betting is temporarily locked for this round.
            </motion.p>
          ) : round.phase === "starting" ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center text-xs text-muted-foreground font-mono"
            >
              Get ready. A new round is about to open.
            </motion.p>
          ) : null}
        </AnimatePresence>

        <BetHistoryPanel bets={betHistory} loading={snapshotLoading || betHistoryLoading} connected={Boolean(account)} />
        <RoundHistoryPanel history={roundHistory} loading={snapshotLoading && roundHistory.length === 0} />

        <div className="text-center text-[10px] text-muted-foreground font-mono tracking-wider space-y-0.5">
          <div>Dice pools are live now. Parity and jackpot rewards are coming soon.</div>
          <div>Backend indexed • Contract-backed round state</div>
        </div>
      </main>
    </div>
  );
}
