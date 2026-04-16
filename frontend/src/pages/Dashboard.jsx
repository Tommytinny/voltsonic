import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { HowToPlayPanel } from "@/components/game/HowToPlayPanel";
import { VOLTSONIC_ABI } from "@/lib/contract.js";

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || "http://127.0.0.1:8000";
const CONTRACT_ADDRESS = import.meta.env.VITE_VOLTSONIC_CONTRACT_ADDRESS || "";
const BASE_RPC_URL = import.meta.env.VITE_BASE_RPC_URL || "";
const staticProvider = new ethers.JsonRpcProvider(BASE_RPC_URL);

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

function postBackendJson(path, body) {
  return fetch(`${BACKEND_API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Backend POST failed: ${response.status}`);
    }
    return response.json();
  });
}

// Add this near your other utility functions (top of the file)
async function fetchChainTruth(roundId, contractAddress, abi) {
  if (!roundId || !contractAddress) return null;
  try {
    const contract = new ethers.Contract(contractAddress, abi, staticProvider);
    // [0] pools, [3] diceResult, [5] settled
    const summary = await contract.getRoundSummary(BigInt(roundId));
    return {
      roundId: roundId,
      diceResult: Number(summary[3]),
      parityResult: summary[4] ? "even" : "odd",
      isSettled: summary[5],
    };
  } catch (err) {
    console.error("Direct chain fetch failed:", err);
    return null;
  }
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

  const roundId = parseRoundNumber(snapshot.currentRound);
  const latestSettled = parseRoundNumber(snapshot.latestSettledRound);

  const isNewRoundStarted = roundId !== latestSettled;
  const hasStarted = roundStartMs > 0 && now >= roundStartMs;
  const beforeClose = roundCloseMs > 0 && now < roundCloseMs;
  const insideBettingWindow = hasStarted && beforeClose;

  let phase = "loading";
  let phaseEndTime = now + 10_000;

  if (snapshotLoading) {
    phase = "loading";
    phaseEndTime = now + 10_000;
  } 
  else if (insideBettingWindow) {
    phase = "betting";
    phaseEndTime = roundCloseMs || now + 20_000;
  } 
  else if (!insideBettingWindow && !isNewRoundStarted && roundCloseMs > 0 && now >= roundCloseMs) {
    // betting closed but still same round → resolving
    phase = "resolving";
    phaseEndTime = (roundCloseMs || now) + resolveWindowMs;
  } 
  else if (roundStartMs > 0 && now < roundStartMs) {
    phase = "starting";
    phaseEndTime = roundStartMs || now + 10_000;
  } 
  else {
    phase = "betting";
    phaseEndTime = now + 20_000;
  }

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
}*/

/*function buildRoundState(snapshot, roundCountdownLabel, latestResult, snapshotLoading) {
  // 1. Parse Pools
  const dicePoolValues = Array.from({ length: 6 }, (_, index) =>
    parseFormattedAmount(snapshot.roundPoolCards[index]?.amount)
  );
  const evenPool = parseFormattedAmount(snapshot.roundPoolCards[6]?.amount);
  const oddPool = parseFormattedAmount(snapshot.roundPoolCards[7]?.amount);

  // 2. Timestamps & Round IDs
  const now = Date.now();
  const roundId = parseRoundNumber(snapshot.currentRound);
  const latestSettled = parseRoundNumber(snapshot.latestSettledRound);
  const roundStartMs = Number(snapshot.roundStartTime || 0) * 1000;
  const roundCloseMs = Number(snapshot.roundCloseTime || 0) * 1000;

  // 3. Logic Flags
  const isSettled = roundId <= latestSettled && roundId !== 0;
  const resolveWindowMs = 5000; // Increased to 5s for blockchain propagation

  let phase = "loading";
  let phaseEndTime = now + 10000;

  if (snapshotLoading || !roundId) {
    phase = "loading";
  } 
  // CASE 1: Round is already settled on-chain
  else if (isSettled) {
    phase = "starting"; // Round is done, waiting for the bridge/backend to start #NEXT
    phaseEndTime = roundStartMs > now ? roundStartMs : now + 5000;
  } 
  // CASE 2: Betting is active (Current Time is before Close Time)
  else if (now < roundCloseMs) {
    // Check if contract has bettingOpen flag (extra safety)
    phase = snapshot.bettingOpen ? "betting" : "locked";
    phaseEndTime = roundCloseMs;
  } 
  // CASE 3: Betting time expired, but not settled yet
  else if (now >= roundCloseMs && now < roundCloseMs + resolveWindowMs) {
    phase = "resolving";
    phaseEndTime = roundCloseMs + resolveWindowMs;
  } 
  // CASE 4: The "Limbo" state (Resolution taking longer than expected)
  else {
    phase = "resolving"; // Keep showing resolving until snapshot.latestSettledRound updates
    phaseEndTime = now + 2000; 
  }

  return {
    roundId,
    phase,
    phaseEndTime,
    dicePools: [0, ...dicePoolValues],
    diceTotalPool: dicePoolValues.reduce((sum, value) => sum + value, 0),
    evenPool, oddPool,
    parityTotalPool: evenPool + oddPool,
    diceResult: latestResult?.diceResult ?? null,
    parityResult: latestResult?.parityResult ?? null,
    jackpotPool: parseFormattedAmount(snapshot.jackpotBalance),
  };
}*/

/*function buildRoundState(snapshot, roundCountdownLabel, latestResult, snapshotLoading) {
  // 1. Parse Pools
  const dicePoolValues = Array.from({ length: 6 }, (_, index) =>
    parseFormattedAmount(snapshot.roundPoolCards?.[index]?.amount)
  );
  const evenPool = parseFormattedAmount(snapshot.roundPoolCards?.[6]?.amount);
  const oddPool = parseFormattedAmount(snapshot.roundPoolCards?.[7]?.amount);

  // 2. Timestamps & Round IDs
  const now = Date.now();
  const roundId = parseRoundNumber(snapshot.currentRound);
  const latestSettled = parseRoundNumber(snapshot.latestSettledRound);
  const roundStartMs = Number(snapshot.roundStartTime || 0) * 1000;
  const roundCloseMs = Number(snapshot.roundCloseTime || 0) * 1000;

  // 3. Logic Flags
  // A round is officially "Done" only if the contract says it is settled.
  const isSettled = roundId <= latestSettled && roundId !== 0;
  
  // A round is in "Limbo" if the time is up but the contract hasn't settled it yet.
  const isWaitingForBlockchain = roundId > latestSettled && now >= roundCloseMs;

  let phase = "loading";
  let phaseEndTime = now + 10000;

  if (snapshotLoading || !roundId) {
    phase = "loading";
  } 
  // CASE 1: The "Gating" Logic - Stay in Resolving until the ID match happens
  else if (isWaitingForBlockchain) {
    phase = "resolving";
    // Set an artificial end time for the progress bar to look active, 
    // but the logic will re-trigger this block every tick until isSettled is true.
    phaseEndTime = now + 5000; 
  }
  // CASE 2: Round is settled, moving to the next one
  else if (isSettled) {
    phase = "starting"; 
    // If the next round start time is in the future, use it. Otherwise, 5s buffer.
    phaseEndTime = roundStartMs > now ? roundStartMs : now + 5000;
  } 
  // CASE 3: Betting is active
  else if (now < roundCloseMs) {
    phase = snapshot.bettingOpen ? "betting" : "locked";
    phaseEndTime = roundCloseMs;
  } 
  // DEFAULT: Fallback safety
  else {
    phase = "resolving";
    phaseEndTime = now + 2000;
  }

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
    latestSettled, // Exported for debugging
  };
}*/


/*function buildRoundState(snapshot, roundCountdownLabel, latestResult, snapshotLoading, onChainData) {
  const dicePoolValues = Array.from({ length: 6 }, (_, index) =>
    parseFormattedAmount(snapshot.roundPoolCards?.[index]?.amount)
  );
  const evenPool = parseFormattedAmount(snapshot.roundPoolCards?.[6]?.amount);
  const oddPool = parseFormattedAmount(snapshot.roundPoolCards?.[7]?.amount);

  const now = Date.now();
  const roundId = parseRoundNumber(snapshot.currentRound);
  const latestSettled = parseRoundNumber(snapshot.latestSettledRound);
  const roundStartMs = Number(snapshot.roundStartTime || 0) * 1000;
  const roundCloseMs = Number(snapshot.roundCloseTime || 0) * 1000;

  // OVERRIDE: Trust the chain if the backend is slow
  const isSettledOnChain = onChainData?.isSettled || false;
  const isSettled = (roundId <= latestSettled && roundId !== 0) || isSettledOnChain;
  
  const isWaitingForBlockchain = roundId > latestSettled && !isSettledOnChain && now >= roundCloseMs;

  let phase = "loading";
  let phaseEndTime = now + 10000;

  if (snapshotLoading || !roundId) {
    phase = "loading";
  } 
  else if (isWaitingForBlockchain) {
    phase = "resolving";
    phaseEndTime = now + 5000; 
  }
  else if (isSettled) {
    phase = "starting"; 
    phaseEndTime = roundStartMs > now ? roundStartMs : now + 5000;
  } 
  else if (now < roundCloseMs) {
    phase = snapshot.bettingOpen ? "betting" : "locked";
    phaseEndTime = roundCloseMs;
  } 
  else {
    phase = "resolving";
    phaseEndTime = now + 2000;
  }

  return {
    roundId,
    phase,
    phaseEndTime,
    dicePools: [0, ...dicePoolValues],
    diceTotalPool: dicePoolValues.reduce((sum, value) => sum + value, 0),
    evenPool, 
    oddPool,
    parityTotalPool: evenPool + oddPool,
    // Use onChainData result if backend hasn't updated yet
    diceResult: isSettledOnChain ? onChainData.diceResult : (latestResult?.diceResult ?? null),
    parityResult: isSettledOnChain ? (onChainData.diceResult % 2 === 0 ? "even" : "odd") : (latestResult?.parityResult ?? null),
    jackpotPool: parseFormattedAmount(snapshot.jackpotBalance),
  };
}*/

function buildRoundState(snapshot, roundCountdownLabel, latestResult, snapshotLoading, onChainData) {
  const dicePoolValues = Array.from({ length: 6 }, (_, index) =>
    parseFormattedAmount(snapshot.roundPoolCards?.[index]?.amount)
  );
  
  const now = Date.now();
  const roundId = parseRoundNumber(snapshot.currentRound);
  const latestSettled = parseRoundNumber(snapshot.latestSettledRound);
  const roundStartMs = Number(snapshot.roundStartTime || 0) * 1000;
  const roundCloseMs = Number(snapshot.roundCloseTime || 0) * 1000;

  // LOGIC FLAGS
  const isSettledOnChain = onChainData?.isSettled || false;
  const isSettled = (roundId <= latestSettled && roundId !== 0) || isSettledOnChain;
  const isWaitingForBlockchain = roundId > latestSettled && !isSettledOnChain && now >= roundCloseMs;

  // --- TRACE LOGGING ---
  /*console.group(`🎲 State Trace: Round #${roundId}`);
  console.log("Current Time:", new Date(now).toLocaleTimeString());
  console.log("Round Close:", new Date(roundCloseMs).toLocaleTimeString());
  console.table({
    "Backend Settled ID": latestSettled,
    "Blockchain Settled?": isSettledOnChain,
    "Is Settled (Total)?": isSettled,
    "Is In Limbo?": isWaitingForBlockchain,
    "Raw Dice Result": isSettledOnChain ? onChainData.diceResult : latestResult?.diceResult
  });
  console.groupEnd();*/

  let phase = "loading";
  let phaseEndTime = now + 10000;

  if (snapshotLoading || !roundId) {
    phase = "loading";
  } 
  else if (isWaitingForBlockchain) {
    phase = "resolving";
    phaseEndTime = now + 5000; 
  }
  else if (isSettled) {
    phase = "starting"; 
    phaseEndTime = roundStartMs > now ? roundStartMs : now + 5000;
  } 
  else if (now < roundCloseMs) {
    phase = snapshot.bettingOpen ? "betting" : "locked";
    phaseEndTime = roundCloseMs;
  } 
  else {
    phase = "resolving";
    phaseEndTime = now + 2000;
  }

  return {
    roundId,
    phase,
    phaseEndTime,
    dicePools: [0, ...dicePoolValues],
    diceTotalPool: dicePoolValues.reduce((sum, v) => sum + v, 0),
    evenPool: parseFormattedAmount(snapshot.roundPoolCards?.[6]?.amount), 
    oddPool: parseFormattedAmount(snapshot.roundPoolCards?.[7]?.amount),
    diceResult: isSettledOnChain ? onChainData.diceResult : (latestResult?.diceResult ?? null),
    parityResult: isSettledOnChain ? (onChainData.diceResult % 2 === 0 ? "even" : "odd") : (latestResult?.parityResult ?? null),
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
    roundCountdown,
    roundCountdownLabel,
    voltPrice,
  } = useVoltSonic();
  const [backendRounds, setBackendRounds] = useState([]);
  const previousBackendStatusRef = useRef(backendStatus);
  const hasLoadedBackendDataRef = useRef(false);
  const postedRoundIdRef = useRef(null);
  const [onChainData, setOnChainData] = useState(null);

  const staticProvider = useMemo(() => {

  // Use a reliable Public RPC for the background truth check

  return new ethers.JsonRpcProvider(BASE_RPC_URL);

}, []);

  
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

  const loadBackendData = useCallback(async () => {
    if (backendStatus !== "ready") {
      return;
    }

    try {
      const rounds = await fetchBackendJson("/api/v1/rounds?limit=10");
      setBackendRounds(
        rounds
          .filter((round) => round.settled && round.dice_result)
          .map(mapHistoryRound)
      );
    } catch (error) {
      console.warn("Failed to refresh live dashboard activity:", error);
      setBackendRounds([]);
      toast.error("Could not refresh live dashboard activity.");
    }
  }, [backendStatus]);

  useEffect(() => {
    if (backendStatus !== "ready") {
      hasLoadedBackendDataRef.current = false;
      return;
    }

    let cancelled = false;
    let interval;

    loadBackendData().finally(() => {
      if (!cancelled) {
        hasLoadedBackendDataRef.current = true;
      }
    });

    interval = setInterval(() => {
      if (!cancelled) loadBackendData();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [backendStatus, snapshot.currentRound, snapshot.latestSettledRound, loadBackendData]);

  /*const latestResult = useMemo(() => {
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
  }, [snapshot.latestResultDice, snapshot.latestResultParity]);*/

  // Inside Game component
const latestResult = useMemo(() => {
  const diceResult = Number(snapshot.latestResultDice);
  const resultRoundId = parseRoundNumber(snapshot.latestSettledRound); // Get the ID of the settled result
  const currentRoundId = parseRoundNumber(snapshot.currentRound);

  const hasDiceResult = Number.isFinite(diceResult) && diceResult > 0;
  const parityResult =
    snapshot.latestResultParity === "Even" ? "even" :
    snapshot.latestResultParity === "Odd" ? "odd" : null;
  
    // --- DEBUG LOG ---
  /*console.log("🔍 [Dashboard Data State]:", {
    displayingRound: currentRoundId,
    contractReportsSettled: resultRoundId,
    match: currentRoundId === resultRoundId ? "✅ MATCH" : "❌ MISMATCH (Waiting...)",
    rawDiceValue: diceResult,
    snapshotLoading
  });*/

  return {
    diceResult: hasDiceResult ? diceResult : null,
    parityResult,
    resultRoundId, // Track which round this result actually belongs to
  };
}, [snapshot.latestResultDice, snapshot.latestResultParity, snapshot.latestSettledRound]);



  /*const round = useMemo(
    () => buildRoundState(snapshot, roundCountdownLabel, latestResult, snapshotLoading),
    [latestResult, roundCountdownLabel, snapshot, snapshotLoading]
  );*/

  const provider = useMemo(() => {
    if (window.ethereum) return new ethers.BrowserProvider(window.ethereum);
    return null;
  }, []);

  // UPDATE the round useMemo to include onChainData
  const round = useMemo(
    () => buildRoundState(snapshot, roundCountdownLabel, latestResult, snapshotLoading, onChainData),
    [latestResult, roundCountdownLabel, snapshot, snapshotLoading, onChainData]
  );

  // ADD THE BLOCKCHAIN WATCHER EFFECT
  useEffect(() => {
    let interval;
    // Poll the chain for the current round's settlement status during resolving
    if (round.phase === "resolving" && round.roundId && !onChainData) {
      interval = setInterval(async () => {
        const data = await fetchChainTruth(
            round.roundId, 
            CONTRACT_ADDRESS, 
            VOLTSONIC_ABI
        );
        if (data && data.isSettled) {
          setOnChainData(data);
          clearInterval(interval);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [round.phase, round.roundId, provider, onChainData]);


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
  // Only show result data when it matches the current round, otherwise advance to the next round state
  const resultToShow = onChainData && round.roundId === onChainData.roundId ? onChainData : null;
  const showLatestResult = !!resultToShow;

  useEffect(() => {
    if (onChainData && round.roundId && round.roundId !== onChainData.roundId) {
      setOnChainData(null);
    }
  }, [round.roundId, onChainData]);

  useEffect(() => {
    if (!resultToShow || backendStatus !== "ready") {
      return;
    }
    if (postedRoundIdRef.current === resultToShow.roundId) {
      return;
    }

    let cancelled = false;

    async function pushRoundResult() {
      try {
        await postBackendJson("/api/v1/rounds", {
          round_id: resultToShow.roundId,
          settled: true,
          randomness_requested: true,
          randomness_fulfilled: true,
          dice_result: resultToShow.diceResult,
          parity_result: resultToShow.parityResult === "even",
        });

        if (!cancelled) {
          postedRoundIdRef.current = resultToShow.roundId;
          loadBackendData();
        }
      } catch (error) {
        console.warn("Failed to push round result to backend:", error);
      }
    }

    pushRoundResult();
    return () => {
      cancelled = true;
    };
  }, [backendStatus, loadBackendData, resultToShow]);

  useEffect(() => {
    if (round.phase === "starting" && roundCountdownLabel === "Starts in" && roundCountdown === "00:01") {
      window.location.reload();
    }
  }, [round.phase, roundCountdown, roundCountdownLabel]);

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

    const minBetUsd = 5;
    if (voltPrice > 0) {
      const minBetVolt = minBetUsd / voltPrice;
      if (amount < minBetVolt) {
        toast.warning(`Minimum bet is $${minBetUsd} USD (≈ ${minBetVolt.toFixed(4)} VOLT).`);
        return false;
      }
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

        <JackpotDisplay jackpotPool={round.jackpotPool} streak={0} loading={snapshotLoading} voltPrice={voltPrice} />

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
                    roundId={resultToShow.roundId || resultToShow.resultRoundId}
                    diceResult={resultToShow.diceResult}
                    parityResult={resultToShow.parityResult}
                    resultRoundId={resultToShow.roundId || resultToShow.resultRoundId}
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
                    voltPrice={voltPrice}
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

        <HowToPlayPanel />

        <BetHistoryPanel bets={betHistory} loading={snapshotLoading || betHistoryLoading} connected={Boolean(account)} voltPrice={voltPrice} />
        <RoundHistoryPanel history={roundHistory} loading={snapshotLoading && roundHistory.length === 0} />

        <div className="text-center text-[10px] text-muted-foreground font-mono tracking-wider space-y-0.5">
          <div>Dice pools are live now. Parity and jackpot rewards are coming soon.</div>
          <div>Backend indexed • Contract-backed round state</div>
        </div>
      </main>
    </div>
  );
}