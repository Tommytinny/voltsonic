import { useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Wallet, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useVoltSonic, shortAddress, parseTokenAmount } from "./Index.jsx";
import { RoundTimer } from "@/components/game/RoundTimer";
import { JackpotDisplay } from "@/components/game/JackpotDisplay";
import { RoundResult } from "@/components/game/RoundResult";
import { LiveBetFeed } from "@/components/game/LiveBetFeed";
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

  let phase = "loading";
  let phaseEndTime = now + 10_000;

  if (snapshotLoading) {
    phase = "loading";
    phaseEndTime = now + 10_000;
  } else if (snapshot.bettingOpen && roundCloseMs && now < roundCloseMs) {
    phase = "betting";
    phaseEndTime = roundCloseMs;
  } else if (roundStartMs && now < roundStartMs) {
    phase = "starting";
    phaseEndTime = roundStartMs;
  } else if (roundCloseMs && now < roundCloseMs + resolveWindowMs && roundCountdownLabel === "Settling") {
    phase = "resolving";
    phaseEndTime = roundCloseMs + resolveWindowMs;
  } else if (roundStartMs) {
    phase = "starting";
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
}

function mapBackendBetToFeedItem(bet, account) {
  const diceAmount = parseRawTokenAmount(bet.dice_amount);
  const parityAmount = parseRawTokenAmount(bet.parity_amount);
  const totalAmount = diceAmount + parityAmount;
  const pickParts = [];

  if (bet.bet_on_dice && bet.dice_choice) {
    pickParts.push(`D${bet.dice_choice}`);
  }
  if (bet.bet_on_parity) {
    pickParts.push(bet.parity_choice ? "EVEN" : "ODD");
  }

  return {
    id: `${bet.id}-${bet.tx_hash}`,
    player: account && bet.user_address?.toLowerCase() === account.toLowerCase() ? "You" : shortAddress(bet.user_address),
    amount: totalAmount,
    gameType: bet.bet_on_dice ? "dice" : "parity",
    pick: pickParts.join(" + ") || "BET",
    timestamp: Date.parse(bet.created_at || "") || 0,
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

function mapBetHistoryToFeedItem(bet) {
  const totalAmount = parseRawTokenAmount((BigInt(bet.diceAmount || 0n) + BigInt(bet.parityAmount || 0n)).toString());
  const pickParts = [];

  if (bet.betOnDice && bet.diceChoice) {
    pickParts.push(`D${bet.diceChoice}`);
  }
  if (bet.betOnParity) {
    pickParts.push(String(bet.parityChoice).toUpperCase());
  }

  return {
    id: bet.id,
    player: "You",
    amount: totalAmount,
    gameType: bet.betOnDice ? "dice" : "parity",
    pick: pickParts.join(" + ") || "BET",
    timestamp: Number(bet.timestamp || 0),
  };
}

function mergeFeedItems(...groups) {
  const merged = [];
  const seenIds = new Set();

  for (const group of groups) {
    for (const item of group) {
      if (!item || seenIds.has(item.id)) continue;
      seenIds.add(item.id);
      merged.push(item);
    }
  }

  return merged
    .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
    .slice(0, 5);
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

export default function Game() {
  const navigate = useNavigate();
  const {
    snapshot,
    snapshotLoading,
    betHistory,
    backendStatus,
    account,
    connectWallet,
    switchWallet,
    writeContract,
    roundCountdownLabel,
  } = useVoltSonic();
  const [backendFeed, setBackendFeed] = useState([]);
  const [backendRounds, setBackendRounds] = useState([]);
  const previousBackendStatusRef = useRef(backendStatus);

  useEffect(() => {
    if (previousBackendStatusRef.current !== backendStatus) {
      if (backendStatus === "ready") {
        toast.success("Dashboard is synced with live data.");
      } else if (backendStatus === "offline") {
        toast.warning("Backend is offline. Falling back where possible.");
      }
      previousBackendStatusRef.current = backendStatus;
    }
  }, [backendStatus]);

  useEffect(() => {
    if (backendStatus !== "ready") {
      setBackendFeed([]);
      setBackendRounds([]);
      return;
    }

    let cancelled = false;

    async function loadBackendData() {
      try {
        const [bets, rounds] = await Promise.all([
          fetchBackendJson("/api/v1/bets/recent/open?limit=25"),
          fetchBackendJson("/api/v1/rounds?limit=10"),
        ]);

        if (cancelled) return;

        setBackendFeed(bets.map((bet) => mapBackendBetToFeedItem(bet, account)));
        setBackendRounds(
          rounds
            .filter((round) => round.settled && round.dice_result)
            .map(mapHistoryRound)
        );
      } catch {
        if (!cancelled) {
          setBackendFeed([]);
          setBackendRounds([]);
          toast.error("Could not refresh live dashboard activity.");
        }
      }
    }

    loadBackendData();
    const intervalId = window.setInterval(loadBackendData, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [account, backendStatus]);

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

  const playerCount = useMemo(
    () => snapshot.roundPoolCards.reduce((sum, pool) => sum + Number(pool.bettors || 0), 0),
    [snapshot.roundPoolCards]
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

  const feed = useMemo(() => {
    const localOpenBets = betHistory
      .filter((bet) => bet.result === "open" || bet.status === "open")
      .map(mapBetHistoryToFeedItem);

    if (backendFeed.length > 0) {
      return mergeFeedItems(localOpenBets, backendFeed);
    }

    return mergeFeedItems(localOpenBets);
  }, [backendFeed, betHistory]);

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
            <div className="text-[10px] font-mono text-muted-foreground tracking-widest">
              ROUND #{round.roundId || "--"}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              {/*<Users className="w-3 h-3" />
              <span>{playerCount} players</span>*/}
            </div>
          </div>
          <RoundTimer round={round} />
        </div>

        <JackpotDisplay jackpotPool={round.jackpotPool} streak={0} />

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

        <AnimatePresence>
          {!account ? (
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

        <LiveBetFeed bets={feed} />
        <RoundHistoryPanel history={roundHistory} />

        <div className="text-center text-[10px] text-muted-foreground font-mono tracking-wider space-y-0.5">
          <div>Dice pools are live now. Parity and jackpot rewards are coming soon.</div>
          <div>Backend indexed • Contract-backed round state</div>
        </div>
      </main>
    </div>
  );
}
