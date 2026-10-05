import { NavLink, Route, Routes } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { decodeEventLog } from "viem";
import { useAccount, useConnect, useDisconnect, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { VOLTSONIC_ABI, VOLTSONIC_VIEM_ABI, formatEth, mapRoundRecordToCard } from "@/lib/contract";
import { getPrimaryRpcUrl, hasRpcEndpoints, readContract, readContractsDistributed, runRpcRequest } from "@/lib/rpc";
import { SHOW_BACKEND_TOASTS } from "@/lib/featureFlags";
import { RoundTimer } from "@/components/game/RoundTimer";
import { Zap, Wallet, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CONTRACT_ADDRESS = import.meta.env.VITE_VOLTSONIC_CONTRACT_ADDRESS || "";
const ROBINHOOD_CHAIN_ID = Number(import.meta.env.VITE_ROBINHOOD_CHAIN_ID || 46630);
const ROBINHOOD_RPC_URL = import.meta.env.VITE_ROBINHOOD_RPC_URL || "https://rpc.testnet.chain.robinhood.com";
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || "http://127.0.0.1:8000";
const ROUND_DURATION_SECONDS = Number(import.meta.env.VITE_VOLTSONIC_ROUND_DURATION_SECONDS || 180);

export function shortAddress(value) {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "Not connected";
}

function getBettingStateStyles(isOpen, isSettling = false) {
  if (isSettling) {
    return {
      valueClass: "text-amber-400",
      iconClass: "text-amber-400",
      borderClass: "border-amber-400",
    };
  }
  return isOpen
    ? {
        valueClass: "text-emerald-400",
        iconClass: "text-emerald-400",
        borderClass: "border-emerald-400",
      }
    : {
        valueClass: "text-rose-400",
        iconClass: "text-rose-400",
        borderClass: "border-rose-400",
      };
}

function formatCountdown(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatInputEthPreview(value) {
  const normalized = Number(value || 0);
  if (!Number.isFinite(normalized) || normalized <= 0) return "0.0000 ETH";
  return `${normalized.toFixed(4)} ETH`;
}

function formatUsdValue(value) {
  const normalized = Number(value || 0);
  if (!Number.isFinite(normalized) || normalized <= 0) return "$0.00";
  return `$${normalized.toFixed(2)}`;
}

function convertUsdToEthAmount(usdValue, ethUsdPrice) {
  const usd = Number(usdValue || 0);
  const price = Number(ethUsdPrice || 0);
  if (!Number.isFinite(usd) || usd <= 0 || !Number.isFinite(price) || price <= 0) {
    return null;
  }

  return usd / price;
}

function formatUsdToEthPreview(usdValue, ethUsdPrice) {
  const converted = convertUsdToEthAmount(usdValue, ethUsdPrice);
  if (converted === null) return "0.000000 ETH";
  return `${converted.toFixed(6)} ETH`;
}

function formatTokenInputPreview(value) {
  const normalized = Number(value || 0);
    if (!Number.isFinite(normalized) || normalized <= 0) return "0.0000 ETH";
  return `${normalized.toFixed(4)} ETH`;
}

function DiceIcon({ number, selected = false }) {
  const getDotPositions = (num) => {
    const positions = {
      1: [{ top: '50%', left: '50%' }],
      2: [
        { top: '25%', left: '25%' },
        { top: '75%', left: '75%' }
      ],
      3: [
        { top: '25%', left: '25%' },
        { top: '50%', left: '50%' },
        { top: '75%', left: '75%' }
      ],
      4: [
        { top: '25%', left: '25%' },
        { top: '25%', left: '75%' },
        { top: '75%', left: '25%' },
        { top: '75%', left: '75%' }
      ],
      5: [
        { top: '25%', left: '25%' },
        { top: '25%', left: '75%' },
        { top: '50%', left: '50%' },
        { top: '75%', left: '25%' },
        { top: '75%', left: '75%' }
      ],
      6: [
        { top: '25%', left: '25%' },
        { top: '25%', left: '75%' },
        { top: '50%', left: '25%' },
        { top: '50%', left: '75%' },
        { top: '75%', left: '25%' },
        { top: '75%', left: '75%' }
      ]
    };
    return positions[num] || positions[1];
  };

  const dotPositions = getDotPositions(number);

  return (
    <div
      className={`relative h-10 w-10 sm:h-12 sm:w-12 rounded-lg border-2 transition-all ${
        selected
          ? "border-primary bg-primary/10 shadow-[0_0_12px_color-mix(in_oklch,var(--primary)_40%,transparent)] scale-105"
          : "border-outline-variant bg-white shadow-sm"
      }`}
    >
      {/* Dice dots */}
      {dotPositions.map((pos, index) => (
        <div
          key={index}
          className={`absolute h-2 w-2 rounded-full transform -translate-x-1/2 -translate-y-1/2 ${
            selected ? "bg-primary" : "bg-slate-700"
          }`}
          style={{
            top: pos.top,
            left: pos.left,
          }}
        />
      ))}

      {/* Subtle 3D effect */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10 rounded-b-lg" />
    </div>
  );
}

function SettlingIndicator() {
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((prev) => (prev === 3 ? 1 : prev + 1));
    }, 600);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <span className="material-symbols-outlined text-[20px] sm:text-[24px] text-amber-400 animate-spin" style={{ animationDuration: '2s' }}>
        autorenew
      </span>
      <span className="text-amber-400 font-bold">
        Settling{'.'.repeat(dotCount)}
      </span>
    </div>
  );
}

export function parseTokenAmount(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return 0n;
  return ethers.parseUnits(normalized, 18);
}

function getReadableError(error) {
  if (!error) return "Something went wrong.";

  const nestedMessages = [
    error?.shortMessage,
    error?.reason,
    error?.info?.error?.message,
    error?.error?.message,
    error?.data?.message,
    error?.message,
  ].filter((value) => typeof value === "string" && value.trim());

  const combinedMessage = nestedMessages.join(" | ").toLowerCase();

  if (error.code === 4001) {
    return "Transaction rejected in wallet.";
  }

  if (combinedMessage.includes("missing revert data")) {
    return "Transaction could not be completed. Please check the action details and try again.";
  }

  if (combinedMessage.includes("execution reverted")) {
    // Try to extract the actual contract error message
    if (error.reason && typeof error.reason === "string" && error.reason.trim()) {
      return `Contract Error: ${error.reason}`;
    }
    // Generic revert with require(false) usually means onlyOwner check failed
    if (combinedMessage.includes("require(false)")) {
      return "You must be the contract owner to perform this action. Please connect with the owner wallet.";
    }
    return "Transaction reverted by the contract. Please check: (1) You are the contract owner, (2) Address is valid, (3) Address is not zero address.";
  }

  if (combinedMessage.includes("insufficient funds")) {
    return "Insufficient wallet funds for gas or value.";
  }

  if (combinedMessage.includes("user rejected")) {
    return "Transaction rejected in wallet.";
  }

  if (combinedMessage.includes("0x")) {
    if (combinedMessage.includes("call exception")) {
      return "Contract call failed. Please retry after checking the current round state and your inputs.";
    }

    if (combinedMessage.includes("bad address checksum") || combinedMessage.includes("invalid address")) {
      return "Configuration error detected. Please refresh the app or verify setup.";
    }
  }

  if (typeof error.shortMessage === "string" && !error.shortMessage.includes("could not coalesce error")) {
    return error.shortMessage.replace(/0x[a-fA-F0-9]{6,}/g, "[hidden]");
  }

  if (typeof error.reason === "string" && error.reason.trim()) {
    return error.reason.replace(/0x[a-fA-F0-9]{6,}/g, "[hidden]");
  }

  if (typeof error?.info?.error?.message === "string" && error.info.error.message.trim()) {
    return error.info.error.message.replace(/0x[a-fA-F0-9]{6,}/g, "[hidden]");
  }

  if (typeof error?.error?.message === "string" && error.error.message.trim()) {
    return error.error.message.replace(/0x[a-fA-F0-9]{6,}/g, "[hidden]");
  }

  if (typeof error?.data?.message === "string" && error.data.message.trim()) {
    return error.data.message.replace(/0x[a-fA-F0-9]{6,}/g, "[hidden]");
  }

  if (typeof error.message === "string" && error.message.includes("could not coalesce error")) {
    return "Wallet or RPC returned an invalid response. Retry the action, then refresh if it persists.";
  }

  if (typeof error.message === "string" && error.message.trim()) {
    return error.message.replace(/0x[a-fA-F0-9]{6,}/g, "[hidden]");
  }

  return "Something went wrong.";
}

function formatDebugError(prefix, error) {
  const detail = getReadableError(error);
  return detail && detail !== "Something went wrong." ? `${prefix}: ${detail}` : prefix;
}

function formatOutcomeLabel(result) {
  if (result === "won_claimed") return "Won • Claimed";
  if (result === "won") return "Won";
  if (result === "lost") return "Lost";
  return "Open";
}

function getOutcomeStyles(result) {
  if (result === "won" || result === "won_claimed") {
    return {
      badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      accent: "border-emerald-500/50",
    };
  }

  if (result === "lost") {
    return {
      badge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
      accent: "border-rose-500/40",
    };
  }

  return {
    badge: "bg-secondary/10 text-secondary border-secondary/30",
    accent: "border-primary/40",
  };
}

function getToastStyles(type) {
  if (type === "success") {
    return {
      shell: "border-emerald-500/40 bg-emerald-500/10",
      icon: "check_circle",
      iconClass: "text-emerald-400",
      titleClass: "text-emerald-300",
    };
  }

  if (type === "error") {
    return {
      shell: "border-rose-500/40 bg-rose-500/10",
      icon: "error",
      iconClass: "text-rose-400",
      titleClass: "text-rose-300",
    };
  }

  if (type === "warning") {
    return {
      shell: "border-amber-500/40 bg-amber-500/10",
      icon: "warning",
      iconClass: "text-amber-400",
      titleClass: "text-amber-300",
    };
  }

  return {
    shell: "border-primary/40 bg-surface-container-high/95",
    icon: "notifications",
    iconClass: "text-secondary",
    titleClass: "text-primary",
  };
}

function ToastStack({ toasts, dismissToast }) {
  return (
    <div className="pointer-events-none fixed left-4 right-4 top-20 z-[60] flex flex-col gap-3 sm:left-auto sm:right-4 sm:top-24 sm:w-[360px]">
      {toasts.map((toast) => {
        const styles = getToastStyles(toast.type);
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto overflow-hidden border px-4 py-3 shadow-[0_0_18px_color-mix(in_oklch,var(--primary)_12%,transparent)] backdrop-blur-md transition-all duration-300 ${styles.shell}`}
          >
            <div className="flex items-start gap-3">
              <span className={`material-symbols-outlined mt-0.5 text-[20px] ${styles.iconClass}`}>{styles.icon}</span>
              <div className="min-w-0 flex-1">
                <div className={`font-headline text-xs font-bold uppercase tracking-wide ${styles.titleClass}`}>
                  {toast.title}
                </div>
                <div className="mt-1 text-sm text-on-surface">{toast.message}</div>
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                className="material-symbols-outlined text-outline transition-colors hover:text-on-surface"
                aria-label="Dismiss notification"
              >
                close
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ResultModal({ resultModal, dismissResultModal }) {
  if (!resultModal) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md border border-primary/40 bg-card p-5 shadow-[0_0_30px_color-mix(in_oklch,var(--primary)_18%,transparent)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-headline text-lg font-bold uppercase tracking-tight text-white">
              {resultModal.title}
            </div>
            <div className="mt-2 text-sm text-on-surface">{resultModal.message}</div>
          </div>
          <button
            onClick={dismissResultModal}
            className="material-symbols-outlined text-outline transition-colors hover:text-on-surface"
            aria-label="Dismiss result notification"
          >
            close
          </button>
        </div>
        {resultModal.winningPools?.length ? (
          <div className="mt-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-outline">Winning Pools</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {resultModal.winningPools.map((pool) => (
                <span
                  key={pool}
                  className="border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-mono text-[10px] uppercase text-emerald-400"
                >
                  {pool}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function buildDefaultRoundPoolCards(selectedDice = 2, parityEven = true) {
  return [
    ...Array.from({ length: 6 }, (_, index) => ({
      title: `Dice ${index + 1}`,
      bettors: 0,
      amount: "0.0000 ETH",
      accent: selectedDice === index + 1,
    })),
    {
      title: "Even Pool",
      bettors: 0,
      amount: "0.0000 ETH",
      accent: parityEven,
    },
    {
      title: "Odd Pool",
      bettors: 0,
      amount: "0.0000 ETH",
      accent: !parityEven,
    },
  ];
}

async function fetchBackendJson(path) {
  const response = await fetch(`${BACKEND_API_URL}${path}`);

  if (!response.ok) {
    let detail = `Backend request failed: ${response.status}`;
    try {
      const payload = await response.json();
      if (payload?.detail) detail = payload.detail;
    } catch {
      // Ignore JSON parse failures and use the status-based message.
    }
    throw new Error(detail);
  }

  return response.json();
}

async function postBackendJson(path) {
  const response = await fetch(`${BACKEND_API_URL}${path}`, {
    method: "POST",
  });

  if (!response.ok) {
    let detail = `Backend request failed: ${response.status}`;
    try {
      const payload = await response.json();
      if (payload?.detail) detail = payload.detail;
    } catch {
      // Ignore JSON parse failures and use the status-based message.
    }
    throw new Error(detail);
  }

  return response.json();
}

function mapBackendBetToUiBet(bet, round = null) {
  const result = bet.status === "claimed" ? "won_claimed" : bet.status;
  const parityResult = round?.parity_result;
  return {
    id: `${bet.tx_hash}-${bet.round_id}`,
    status: bet.status,
    txHash: bet.tx_hash || "",
    roundId: Number(bet.round_id),
    result,
    claimed: Boolean(bet.claimed),
    settled: bet.status !== "open",
    createdAt: bet.created_at || "",
    updatedAt: bet.updated_at || "",
    diceChoice: bet.dice_choice ? Number(bet.dice_choice) : 0,
    parityChoice: bet.parity_choice === null ? "Odd" : bet.parity_choice ? "Even" : "Odd",
    diceAmount: BigInt(bet.dice_amount || "0"),
    parityAmount: BigInt(bet.parity_amount || "0"),
    betOnDice: Boolean(bet.bet_on_dice),
    betOnParity: Boolean(bet.bet_on_parity),
    diceResult: round?.dice_result ?? null,
    parityResult: parityResult === null || parityResult === undefined ? "--" : parityResult ? "Even" : "Odd",
    wonDice: Boolean(bet.won && bet.bet_on_dice),
    wonParity: Boolean(bet.won && bet.bet_on_parity),
  };
}

function createInitialSnapshot(selectedDice = 2, parityEven = true) {
  return {
    currentRound: "",
    bettingOpen: false,
    jackpotBalance: "",
    minBet: "",
    credits: "",
    contractBalance: "",
    redeemableCredits: "",
    totalEthContributed: "",
    claimPoolReward: "",
    claimJackpotReward: "",
    claimFee: "",
    claimNet: "",
    latestSettledRound: "",
    latestResultDice: "",
    latestResultParity: "",
    latestWinningPools: [],
    owner: "",
    roundStartTime: 0,
    roundCloseTime: 0,
    roundPoolCards: buildDefaultRoundPoolCards(selectedDice, parityEven),
  };
}

export function useVoltSonic() {
  const { address: account = "", chainId, isConnected, connector: activeConnector } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: ROBINHOOD_CHAIN_ID });
  const [contract, setContract] = useState(null);
  const [networkName, setNetworkName] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [toasts, setToasts] = useState([]);
  const [resultModal, setResultModal] = useState(null);
  const [backendStatus, setBackendStatus] = useState("unknown");
  const [roundCountdown, setRoundCountdown] = useState(formatCountdown(ROUND_DURATION_SECONDS));
  const [roundCountdownLabel, setRoundCountdownLabel] = useState("Closes in");
  const ethUsdPrice = null;
  const ethUsdStatus = "unavailable";
  const [betForm, setBetForm] = useState({
    dice: 2,
    parityEven: true,
    diceAmount: "",
    parityAmount: "",
  });
  const [adminForm, setAdminForm] = useState({
    jackpotSeed: "",
    minBet: "",
    houseFeeRecipient: "",
  });
  const [betHistory, setBetHistory] = useState([]);
  const [backendRoundRecords, setBackendRoundRecords] = useState([]);
  const [snapshot, setSnapshot] = useState(() => createInitialSnapshot());
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [betHistoryLoading, setBetHistoryLoading] = useState(false);
  const [backendRefreshTick, setBackendRefreshTick] = useState(0);
  const [snapshotRefreshTick, setSnapshotRefreshTick] = useState(0);
  const [betHistoryRefreshTick, setBetHistoryRefreshTick] = useState(0);

  const roundFeed = useMemo(() => backendRoundRecords.map(mapRoundRecordToCard), [backendRoundRecords]);
  const toastIdRef = useRef(0);
  const prevSnapshotRef = useRef(null);
  const prevAccountRef = useRef("");
  const prevBackendStatusRef = useRef("unknown");
  const countdownSignalsRef = useRef({ roundKey: "", start60: false, start10: false, close60: false, close10: false });
  const recentToastKeysRef = useRef(new Map());
  const hasInitialDataLoadRef = useRef(false);
  const hasSeenInitialBackendStatusRef = useRef(false);
  const hasSeenInitialAccountRef = useRef(false);
  const resultModalTimeoutRef = useRef(null);

  useEffect(() => {
    if (backendStatus !== "ready") return undefined;

    let cancelled = false;
    const loadRecentRounds = async () => {
      try {
        const rounds = await fetchBackendJson("/api/v1/rounds?limit=10");
        if (!cancelled) setBackendRoundRecords(rounds);
      } catch (error) {
        console.warn("Could not load recent rounds from backend:", error);
      }
    };

    loadRecentRounds();
    const intervalId = window.setInterval(loadRecentRounds, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [backendStatus, snapshot.currentRound]);

  function dismissToast(id) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  function dismissResultModal() {
    setResultModal(null);
    if (resultModalTimeoutRef.current) {
      window.clearTimeout(resultModalTimeoutRef.current);
      resultModalTimeoutRef.current = null;
    }
  }

  function pushToast({ type = "info", title = "Notice", message, dedupeKey, duration = 5000 }) {
    if (!message) return;

    const now = Date.now();
    const key = dedupeKey || `${type}:${title}:${message}`;
    const previousAt = recentToastKeysRef.current.get(key);
    if (previousAt && now - previousAt < 4000) return;
    recentToastKeysRef.current.set(key, now);

    const id = ++toastIdRef.current;
    setToasts((current) => [{ id, type, title, message }, ...current].slice(0, 6));

    window.setTimeout(() => {
      dismissToast(id);
    }, duration);
  }

  function notify(message, type = "info", title = "Notice", dedupeKey) {
    setStatusMessage(message);
    pushToast({ type, title, message, dedupeKey });
  }

  function showResultModal(title, message, winningPools = [], duration = 7000) {
    setResultModal({ title, message, winningPools });
    if (resultModalTimeoutRef.current) {
      window.clearTimeout(resultModalTimeoutRef.current);
    }
    resultModalTimeoutRef.current = window.setTimeout(() => {
      setResultModal(null);
      resultModalTimeoutRef.current = null;
    }, duration);
  }

  function triggerInteractionLoading(nextAccount = account) {
    setSnapshotLoading(true);
    if (nextAccount) {
      setBetHistoryLoading(true);
    }
  }

  function refreshBackendStatus() {
    setBackendRefreshTick((current) => current + 1);
  }

  function refreshSnapshot() {
    setSnapshotRefreshTick((current) => current + 1);
  }

  useEffect(() => {
    if (!CONTRACT_ADDRESS || !ethers.isAddress(CONTRACT_ADDRESS)) return;

    const nextProvider = hasRpcEndpoints()
      ? new ethers.JsonRpcProvider(getPrimaryRpcUrl())
      : null;

    if (!nextProvider) return;

    const nextContract = new ethers.Contract(CONTRACT_ADDRESS, VOLTSONIC_ABI, nextProvider);
    setContract(nextContract);

  }, []);

  useEffect(() => {
    setNetworkName(!chainId ? "" : chainId === ROBINHOOD_CHAIN_ID ? "Robinhood Chain Testnet" : "Wrong network");
  }, [chainId]);

  useEffect(() => {
    if (!statusMessage) return;

    const timeoutId = window.setTimeout(() => {
      setStatusMessage("");
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [statusMessage]);

  useEffect(() => {
    const previousStatus = prevBackendStatusRef.current;
    if (previousStatus !== backendStatus) {
      if (!hasSeenInitialBackendStatusRef.current) {
        hasSeenInitialBackendStatusRef.current = true;
        prevBackendStatusRef.current = backendStatus;
        return;
      }
      if (SHOW_BACKEND_TOASTS && backendStatus === "ready") {
        pushToast({
          type: "success",
          title: "Backend Connected",
          message: "Read-heavy views are now using backend data.",
          dedupeKey: "backend-ready",
        });
      } else if (SHOW_BACKEND_TOASTS && backendStatus === "offline") {
        pushToast({
          type: "warning",
          title: "Backend Offline",
          message: "Falling back to direct contract reads where possible.",
          dedupeKey: "backend-offline",
          duration: 6500,
        });
      }
      prevBackendStatusRef.current = backendStatus;
    }
  }, [backendStatus]);

  useEffect(() => {
    let cancelled = false;

    async function checkBackend() {
      try {
        await fetchBackendJson("/health");
        if (!cancelled) setBackendStatus("ready");
      } catch (error) {
        if (!cancelled) {
          setBackendStatus("offline");
          if (SHOW_BACKEND_TOASTS) {
            notify(
              formatDebugError("Backend health check failed", error),
              "warning",
              "Backend Error",
              "backend-health-check-failed"
            );
          }
        }
      }
    }

    checkBackend();
    return () => {
      cancelled = true;
    };
  }, [backendRefreshTick]);

  useEffect(() => {
    if (!account) {
      setBetHistory([]);
      setBetHistoryLoading(false);
    }
  }, [account]);

  useEffect(() => {
    if (!CONTRACT_ADDRESS || !ethers.isAddress(CONTRACT_ADDRESS) || !hasRpcEndpoints()) return;

    let cancelled = false;

    async function load() {
      try {
        let currentState = { roundId: 0, isBettingOpen: false, totalDicePool: 0n, totalParityPool: 0n, currentJackpot: 0n, minimumBet: 0n, startTime: 0, closeTime: 0 };
        let currentPoolStats = { dicePoolAmounts: [0n, 0n, 0n, 0n, 0n, 0n], dicePoolBettors: [0, 0, 0, 0, 0, 0], evenPoolAmount: 0n, oddPoolAmount: 0n, evenPoolBettors: 0, oddPoolBettors: 0 };
        let totalEthEscrowed = 0n;
        let totalEthContributed = 0n;
        let owner = ethers.ZeroAddress;

        try {
          const [
            fetchedCurrentState,
            fetchedCurrentPoolStats,
            fetchedTotalEthEscrowed,
            fetchedTotalEthContributed,
            fetchedOwner,
          ] = await readContractsDistributed([
            {
              address: CONTRACT_ADDRESS,
              abi: VOLTSONIC_ABI,
              method: "getCurrentRoundState",
              cacheKey: "voltsonic:getCurrentRoundState",
              cacheTtlMs: 3_000,
            },
            {
              address: CONTRACT_ADDRESS,
              abi: VOLTSONIC_ABI,
              method: "getCurrentPoolStats",
              cacheKey: "voltsonic:getCurrentPoolStats",
              cacheTtlMs: 3_000,
            },
            {
              address: CONTRACT_ADDRESS,
              abi: VOLTSONIC_ABI,
              method: "totalEthEscrowed",
              cacheKey: "voltsonic:totalEthEscrowed",
              cacheTtlMs: 8_000,
            },
            {
              address: CONTRACT_ADDRESS,
              abi: VOLTSONIC_ABI,
              method: "totalEthContributed",
              cacheKey: "voltsonic:totalEthContributed",
              cacheTtlMs: 8_000,
            },
            {
              address: CONTRACT_ADDRESS,
              abi: VOLTSONIC_ABI,
              method: "owner",
              cacheKey: "voltsonic:owner",
              cacheTtlMs: 5 * 60 * 1000,
            },
          ]);

          currentState = fetchedCurrentState;
          currentPoolStats = fetchedCurrentPoolStats;
          totalEthEscrowed = fetchedTotalEthEscrowed;
          totalEthContributed = fetchedTotalEthContributed;
          owner = fetchedOwner;
        } catch (error) {
          console.error("Failed to load distributed contract snapshot:", error);
          notify("Could not load contract snapshot from the RPC pool.", "error", "Contract Error", "distributed-snapshot-failed");
        }

        const currentRoundNumber = Number(currentState.roundId);
        const latestSettledRoundId = currentRoundNumber > 0 ? currentRoundNumber - 1 : null;
        const [connectedCredits, contractEthBalance] = await Promise.all([
          account
            ? runRpcRequest((rpcProvider) => rpcProvider.getBalance(account), {
                cacheKey: `eth:balance:${account.toLowerCase()}`,
                cacheTtlMs: 3_000,
              }).catch(() => 0n)
            : Promise.resolve(0n),
          runRpcRequest((rpcProvider) => rpcProvider.getBalance(CONTRACT_ADDRESS), {
            cacheKey: `eth:balance:${CONTRACT_ADDRESS.toLowerCase()}`,
            cacheTtlMs: 3_000,
          }).catch(() => 0n),
        ]);

        let preview = [0n, 0n, 0n, 0n, false];
        let latestRoundSummary = null;
        if (account && latestSettledRoundId !== null) {
          preview = await readContract({
            address: CONTRACT_ADDRESS,
            abi: VOLTSONIC_ABI,
            method: "getClaimPreview",
            args: [account, latestSettledRoundId],
            cacheKey: `voltsonic:getClaimPreview:${account.toLowerCase()}:${latestSettledRoundId}`,
            cacheTtlMs: 5_000,
          }).catch(() => [0n, 0n, 0n, 0n, false]);
        }
        if (latestSettledRoundId !== null) {
          try {
            latestRoundSummary = await readContract({
              address: CONTRACT_ADDRESS,
              abi: VOLTSONIC_ABI,
              method: "getRoundSummary",
              args: [latestSettledRoundId],
              cacheKey: `voltsonic:getRoundSummary:${latestSettledRoundId}`,
              cacheTtlMs: 8_000,
            });
          } catch (error) {
            console.error("Failed to get round summary:", error);
            notify(
              "Could not load latest round result from contract.",
              "warning",
              "Contract Read Error",
              "round-summary-contract-failed"
            );
            latestRoundSummary = null;
          }
        }

        if (cancelled) return;

        setSnapshot({
          currentRound: `#${currentRoundNumber}`,
          bettingOpen: currentState.isBettingOpen,
          jackpotBalance: formatEth(currentState.currentJackpot),
          minBet: ethers.formatEther(currentState.minimumBet),
          credits: formatEth(connectedCredits),
          contractBalance: formatEth(contractEthBalance),
          redeemableCredits: formatEth(totalEthEscrowed),
          totalEthContributed: formatEth(totalEthContributed),
          claimPoolReward: formatEth(preview[0]),
          claimJackpotReward: formatEth(preview[1]),
          claimFee: formatEth(preview[2]),
          claimNet: formatEth(preview[3]),
          latestSettledRound: latestRoundSummary
            ? `#${Number(latestRoundSummary.round_id ?? latestSettledRoundId)}`
            : latestSettledRoundId === null
              ? "--"
              : `#${latestSettledRoundId}`,
          latestResultDice: latestRoundSummary
            ? `${Number(latestRoundSummary.dice_result ?? latestRoundSummary.diceResult)}`
            : "--",
          latestResultParity: latestRoundSummary
            ? ((latestRoundSummary.parity_result ?? latestRoundSummary.parityResult) ? "Even" : "Odd")
            : "--",
          latestWinningPools: latestRoundSummary
            ? [
                `Dice ${Number(latestRoundSummary.dice_result ?? latestRoundSummary.diceResult)}`,
                /*(latestRoundSummary.parity_result ?? latestRoundSummary.parityResult) ? "Even Pool" : "Odd Pool",*/
              ]
            : [],
          owner,
          roundStartTime: Number(currentState.startTime),
          roundCloseTime: Number(currentState.closeTime),
          roundPoolCards: [
            ...Array.from({ length: 6 }, (_, index) => ({
              title: `Dice ${index + 1}`,
              bettors: Number(currentPoolStats.dicePoolBettors[index]),
              amount: formatEth(currentPoolStats.dicePoolAmounts[index]),
              accent: betForm.dice === index + 1,
            })),
            {
              title: "Even Pool",
              bettors: Number(currentPoolStats.evenPoolBettors),
              amount: formatEth(currentPoolStats.evenPoolAmount),
              accent: betForm.parityEven,
            },
            {
              title: "Odd Pool",
              bettors: Number(currentPoolStats.oddPoolBettors),
              amount: formatEth(currentPoolStats.oddPoolAmount),
              accent: !betForm.parityEven,
            },
          ],
        });
        setSnapshotLoading(false);
      } catch (error) {
        if (!cancelled) {
          setSnapshotLoading(false);
          notify(
            formatDebugError("Contract snapshot load failed", error),
            "error",
            "Sync Error",
            "contract-snapshot-load-failed"
          );
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [account, backendStatus, snapshotRefreshTick]);

  useEffect(() => {
    if (!snapshot.roundStartTime && !snapshot.roundCloseTime) return;

    const intervalId = window.setInterval(() => {
      refreshSnapshot();
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [snapshot.currentRound, snapshot.roundStartTime, snapshot.roundCloseTime]);

  useEffect(() => {
    const previous = prevSnapshotRef.current;
    
    // On first render, just store the snapshot without showing toasts
    if (!previous) {
      prevSnapshotRef.current = snapshot;
      return;
    }

    // Wait until we have real data loaded (currentRound is no longer default)
    // This prevents toasts from showing on initial page load
    if (!hasInitialDataLoadRef.current) {
      if (snapshot.currentRound) {
        // Mark that initial data has loaded, update previous snapshot, and skip toasts this round
        hasInitialDataLoadRef.current = true;
        prevSnapshotRef.current = snapshot;
        return;
      } else {
        // Still waiting for initial data, just update previous snapshot
        prevSnapshotRef.current = snapshot;
        return;
      }
    }

    /*if (previous.latestSettledRound !== snapshot.latestSettledRound && snapshot.latestSettledRound) {
      showResultModal(
        "Round Result",
        `${snapshot.latestSettledRound}: Dice ${snapshot.latestResultDice}`, /*${snapshot.latestResultParity}.*
        snapshot.latestWinningPools,
        7000
      );
    }*/

    // Now that initial data is loaded, show toasts only for real changes
    if (previous.currentRound !== snapshot.currentRound && snapshot.currentRound) {
      showResultModal(
        "Round Result",
        `${snapshot.latestSettledRound}: Dice ${snapshot.latestResultDice}`, /*${snapshot.latestResultParity}.*/
        snapshot.latestWinningPools,
        7000
      );
      pushToast({
        type: "info",
        title: "New Round Started",
        message: `${snapshot.currentRound} is now active.`,
        dedupeKey: `round-start-${snapshot.currentRound}`,
      });
    }

    if (previous.bettingOpen !== snapshot.bettingOpen) {
      pushToast({
        type: snapshot.bettingOpen ? "success" : "warning",
        title: snapshot.bettingOpen ? "Betting Opened" : "Betting Closed",
        message: snapshot.bettingOpen
          ? `${snapshot.currentRound} is open for new bets.`
          : `${snapshot.currentRound} is no longer accepting bets.`,
        dedupeKey: `betting-${snapshot.currentRound}-${snapshot.bettingOpen ? "open" : "closed"}`,
      });
    }

    /*if (previous.latestSettledRound !== snapshot.latestSettledRound && snapshot.latestSettledRound) {
      showResultModal(
        "Round Result",
        `${snapshot.latestSettledRound}: Dice ${snapshot.latestResultDice}`, /*${snapshot.latestResultParity}.*
        snapshot.latestWinningPools,
        7000
      );
    }*/

    if (previous.claimNet !== snapshot.claimNet && snapshot.claimNet !== "0.0000 ETH") {
      pushToast({
        type: "success",
        title: "Claim Available",
        message: `Winnings are ready to claim for ${snapshot.latestSettledRound}.`,
        dedupeKey: `claimable-${snapshot.latestSettledRound}-${snapshot.claimNet}`,
      });
    }

    prevSnapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    let cancelled = false;

    async function loadBetHistory() {
      if (!account || backendStatus !== "ready") {
        if (!cancelled) {
          setBetHistoryLoading(false);
        }
        return;
      }

      if (!cancelled) setBetHistoryLoading(true);
      try {
        const [openBets, closedBets] = await Promise.all([
          fetchBackendJson(`/api/v1/bets/recent/open?user_address=${account}&limit=50`),
          fetchBackendJson(`/api/v1/bets/recent/closed?user_address=${account}&limit=50`),
        ]);

        const mergedBets = [...openBets, ...closedBets];
        const closedRoundIds = [...new Set(
          mergedBets
            .filter((bet) => bet.status !== "open")
            .map((bet) => Number(bet.round_id))
            .filter((roundId) => Number.isFinite(roundId))
        )];
        const roundEntries = await Promise.all(
          closedRoundIds.map(async (roundId) => {
            try {
              const round = await fetchBackendJson(`/api/v1/rounds/${roundId}`);
              return [roundId, round];
            } catch {
              return [roundId, null];
            }
          })
        );
        const roundsById = new Map(roundEntries);
        const rawEntries = mergedBets.map((bet) => mapBackendBetToUiBet(bet, roundsById.get(Number(bet.round_id)) || null));

        if (cancelled) return;

        setBetHistory((current) => {
          const remoteTxHashes = new Set(rawEntries.map((bet) => bet.txHash.toLowerCase()));
          const localOpenBets = current.filter((bet) =>
            bet.result === "open" && !remoteTxHashes.has(bet.txHash.toLowerCase())
          );
          return [...rawEntries, ...localOpenBets].sort((a, b) => b.roundId - a.roundId);
        });
        setBetHistoryLoading(false);
      } catch (error) {
        if (!cancelled) {
          setBetHistoryLoading(false);
          notify(getReadableError(error), "error", "History Error");
        }
      }
    }

    loadBetHistory();
    return () => {
      cancelled = true;
    };
  }, [account, backendStatus, snapshot.currentRound, snapshot.latestSettledRound, betHistoryRefreshTick]);

  useEffect(() => {
    setSnapshot((current) => ({
      ...current,
      roundPoolCards:
        current.roundPoolCards.length === 8
          ? current.roundPoolCards.map((pool, index) => ({
              ...pool,
              accent: index < 6 ? betForm.dice === index + 1 : index === 6 ? betForm.parityEven : !betForm.parityEven,
            }))
          : buildDefaultRoundPoolCards(betForm.dice, betForm.parityEven),
    }));
  }, [betForm.dice, betForm.parityEven]);

  useEffect(() => {
    if (!snapshot.roundStartTime || !snapshot.roundCloseTime) {
      setRoundCountdownLabel("Closes in");
      setRoundCountdown(formatCountdown(ROUND_DURATION_SECONDS));
      return;
    }

    const updateCountdown = () => {
      const nowSeconds = Math.floor(Date.now() / 1000);

      if (nowSeconds < snapshot.roundStartTime) {
        setRoundCountdownLabel("Starts in");
        setRoundCountdown(formatCountdown(snapshot.roundStartTime - nowSeconds));
        return;
      }

      if (nowSeconds < snapshot.roundCloseTime && snapshot.bettingOpen) {
        setRoundCountdownLabel("Closes in");
        setRoundCountdown(formatCountdown(snapshot.roundCloseTime - nowSeconds));
        return;
      }

      if (nowSeconds >= snapshot.roundCloseTime) {
        setRoundCountdownLabel("Settling");
        setRoundCountdown("00:00");
        return;
      }
    };

    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 1000);

    return () => window.clearInterval(intervalId);
  }, [snapshot.bettingOpen, snapshot.roundStartTime, snapshot.roundCloseTime]);

  useEffect(() => {
    const roundKey = `${snapshot.currentRound}:${snapshot.roundStartTime}:${snapshot.roundCloseTime}`;
    const nowSeconds = Math.floor(Date.now() / 1000);
    const startsIn = snapshot.roundStartTime ? snapshot.roundStartTime - nowSeconds : null;
    const closesIn = snapshot.roundCloseTime ? snapshot.roundCloseTime - nowSeconds : null;

    if (countdownSignalsRef.current.roundKey !== roundKey) {
      countdownSignalsRef.current = { roundKey, start60: false, start10: false, close60: false, close10: false };
    }

    const timer = window.setInterval(() => {
      const currentNow = Math.floor(Date.now() / 1000);
      const currentStartsIn = snapshot.roundStartTime ? snapshot.roundStartTime - currentNow : null;
      const currentClosesIn = snapshot.roundCloseTime ? snapshot.roundCloseTime - currentNow : null;

      if (currentStartsIn !== null && currentStartsIn <= 60 && currentStartsIn > 10 && !countdownSignalsRef.current.start60) {
        countdownSignalsRef.current.start60 = true;
        pushToast({
          type: "info",
          title: "Next Round Soon",
          message: `${snapshot.currentRound} starts in under 1 minute.`,
          dedupeKey: `start60-${roundKey}`,
        });
      }

      if (currentStartsIn !== null && currentStartsIn <= 10 && currentStartsIn >= 0 && !countdownSignalsRef.current.start10) {
        countdownSignalsRef.current.start10 = true;
        pushToast({
          type: "info",
          title: "Round Starting",
          message: `${snapshot.currentRound} opens in ${currentStartsIn}s.`,
          dedupeKey: `start10-${roundKey}`,
        });
      }

      if (snapshot.bettingOpen && currentClosesIn !== null && currentClosesIn <= 60 && currentClosesIn > 10 && !countdownSignalsRef.current.close60) {
        countdownSignalsRef.current.close60 = true;
        pushToast({
          type: "warning",
          title: "Betting Closing Soon",
          message: `${snapshot.currentRound} closes in under 1 minute.`,
          dedupeKey: `close60-${roundKey}`,
        });
      }

      if (snapshot.bettingOpen && currentClosesIn !== null && currentClosesIn <= 10 && currentClosesIn >= 0 && !countdownSignalsRef.current.close10) {
        countdownSignalsRef.current.close10 = true;
        pushToast({
          type: "warning",
          title: "Last Call",
          message: `Betting closes in ${currentClosesIn}s.`,
          dedupeKey: `close10-${roundKey}`,
        });
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [snapshot.currentRound, snapshot.roundStartTime, snapshot.roundCloseTime, snapshot.bettingOpen]);

  useEffect(() => {
    const previousAccount = prevAccountRef.current;
    if (previousAccount !== account) {
      if (!hasSeenInitialAccountRef.current) {
        hasSeenInitialAccountRef.current = true;
        prevAccountRef.current = account;
        return;
      }
      if (account && !previousAccount) {
        pushToast({
          type: "success",
          title: "Wallet Connected",
          message: `Connected ${shortAddress(account)}.`,
          dedupeKey: `wallet-connected-${account}`,
        });
      } else if (account && previousAccount && account !== previousAccount) {
        pushToast({
          type: "info",
          title: "Wallet Switched",
          message: `Now using ${shortAddress(account)}.`,
          dedupeKey: `wallet-switched-${account}`,
        });
      } else if (!account && previousAccount) {
        pushToast({
          type: "warning",
          title: "Wallet Disconnected",
          message: "No active wallet connected.",
          dedupeKey: `wallet-disconnected-${previousAccount}`,
        });
      }
      prevAccountRef.current = account;
    }
  }, [account]);

  useEffect(() => () => {
    if (resultModalTimeoutRef.current) {
      window.clearTimeout(resultModalTimeoutRef.current);
      resultModalTimeoutRef.current = null;
    }
  }, []);

  async function connectWallet(connector) {
    if (!connector) {
      notify("No compatible wallet connector is available.", "warning", "Wallet Required");
      return false;
    }

    try {
      if (isConnected && activeConnector?.uid === connector.uid) return true;
      if (isConnected) await disconnectAsync();
      const connection = await connectAsync({ connector });
      if (connection.chainId !== ROBINHOOD_CHAIN_ID) {
        await switchChainAsync({ chainId: ROBINHOOD_CHAIN_ID });
      }
      triggerInteractionLoading(connection.accounts[0] || "");
      notify(
        connection.accounts[0] ? `Connected ${shortAddress(connection.accounts[0])}` : "Wallet connection cancelled.",
        connection.accounts[0] ? "success" : "warning",
        connection.accounts[0] ? "Wallet Connected" : "Wallet Cancelled"
      );
      return Boolean(connection.accounts[0]);
    } catch (error) {
      notify(getReadableError(error), "error", "Wallet Error");
      return false;
    }
  }

  async function switchWallet() {
    return connectWallet();
  }

  async function disconnectWallet() {
    try {
      await disconnectAsync();
      return true;
    } catch (error) {
      notify(getReadableError(error), "error", "Wallet Error");
      return false;
    }
  }

  async function writeContract(request, pendingMessage, successMessage, onConfirmed) {
    if (!isConnected || !account || !publicClient) {
      notify("Connect your wallet and try again.", "warning", "Wallet Required");
      return { ok: false, error: "Connect your wallet and try again." };
    }

    try {
      triggerInteractionLoading();
      if (chainId !== ROBINHOOD_CHAIN_ID) {
        await switchChainAsync({ chainId: ROBINHOOD_CHAIN_ID });
      }
      notify(pendingMessage, "info", "Transaction Submitted");
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: VOLTSONIC_VIEM_ABI,
        chainId: ROBINHOOD_CHAIN_ID,
        account,
        ...request,
      });
      pushToast({
        type: "info",
        title: "Waiting For Confirmation",
        message: `Tx ${hash.slice(0, 10)}... submitted.`,
        dedupeKey: `tx-hash-${hash}`,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt && request.functionName === "placeBet") {
        const betEvent = receipt.logs
          .filter((log) => log.address?.toLowerCase() === CONTRACT_ADDRESS.toLowerCase())
          .map((log) => {
            try {
              return decodeEventLog({
                abi: VOLTSONIC_VIEM_ABI,
                eventName: "BetPlaced",
                data: log.data,
                topics: log.topics,
              });
            } catch {
              return null;
            }
          })
          .find(Boolean);

        if (betEvent) {
          const [diceChoice, parityChoice, diceAmount, parityAmount] = request.args;
          const timestamp = new Date().toISOString();
          const confirmedBet = {
            id: `${hash}-${Number(betEvent.args.roundId)}`,
            status: "open",
            txHash: hash,
            roundId: Number(betEvent.args.roundId),
            result: "open",
            claimed: false,
            settled: false,
            createdAt: timestamp,
            updatedAt: timestamp,
            diceChoice: Number(diceChoice),
            parityChoice: parityChoice ? "Even" : "Odd",
            diceAmount: BigInt(diceAmount),
            parityAmount: BigInt(parityAmount),
            betOnDice: BigInt(diceAmount) > 0n,
            betOnParity: BigInt(parityAmount) > 0n,
            diceResult: null,
            parityResult: "--",
            wonDice: false,
            wonParity: false,
          };
          setBetHistory((current) => [
            confirmedBet,
            ...current.filter((bet) => bet.txHash.toLowerCase() !== hash.toLowerCase()),
          ]);
        }
      }
      if (receipt && onConfirmed) {
        try {
          await onConfirmed({ receipt, account, backendAvailable: backendStatus === "ready" });
        } catch (confirmationError) {
          console.warn("Could not process confirmed transaction:", confirmationError);
        }
      }
      notify(successMessage, "success", "Transaction Confirmed");
      refreshBackendStatus();
      refreshSnapshot();
      setBetHistoryRefreshTick((current) => current + 1);
      return { ok: true, error: null };
    } catch (error) {
      const errorMessage = getReadableError(error);
      notify(errorMessage, "error", "Transaction Failed");
      return { ok: false, error: errorMessage };
    }
  }

  return {
    account,
    networkName,
    statusMessage,
    snapshot,
    snapshotLoading,
    betForm,
    setBetForm,
    adminForm,
    setAdminForm,
    betHistory,
    betHistoryLoading,
    roundFeed,
    roundCountdown,
    roundCountdownLabel,
    ethUsdPrice,
    ethUsdStatus,
    backendStatus,
    toasts,
    resultModal,
    dismissToast,
    dismissResultModal,
    connectWallet,
    switchWallet,
    disconnectWallet,
    connectors,
    refreshSnapshot,
    writeContract,
  };
}