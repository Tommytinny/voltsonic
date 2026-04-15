import { NavLink, Route, Routes } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { VOLTSONIC_ABI, VOLT_ERC20_ABI, formatEth, formatVolt, getExplorerRoundCards } from "@/lib/contract";
import { getPrimaryRpcUrl, hasRpcEndpoints, readContract, readContractsDistributed, runRpcRequest } from "@/lib/rpc";
import { RoundTimer } from "@/components/game/RoundTimer";
import { Zap, Wallet, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CONTRACT_ADDRESS = import.meta.env.VITE_VOLTSONIC_CONTRACT_ADDRESS || "";
const CHAINLINK_ETH_USD_FEED = import.meta.env.VITE_CHAINLINK_ETH_USD_FEED_ADDRESS || "";
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || "http://127.0.0.1:8000";
const ROUND_DURATION_SECONDS = Number(import.meta.env.VITE_VOLTSONIC_ROUND_DURATION_SECONDS || 180);
const VOLT_USD_PRICE = Number(import.meta.env.VITE_VOLT_USD_PRICE || 0);
const DEXSCREENER_CHAIN_ID = import.meta.env.VITE_DEXSCREENER_CHAIN_ID || "base";
const CHAINLINK_FEED_ABI = [
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "description",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint80", name: "_roundId", type: "uint80" }],
    name: "getRoundData",
    outputs: [
      { internalType: "uint80", name: "roundId", type: "uint80" },
      { internalType: "int256", name: "answer", type: "int256" },
      { internalType: "uint256", name: "startedAt", type: "uint256" },
      { internalType: "uint256", name: "updatedAt", type: "uint256" },
      { internalType: "uint80", name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "latestRoundData",
    outputs: [
      { internalType: "uint80", name: "roundId", type: "uint80" },
      { internalType: "int256", name: "answer", type: "int256" },
      { internalType: "uint256", name: "startedAt", type: "uint256" },
      { internalType: "uint256", name: "updatedAt", type: "uint256" },
      { internalType: "uint80", name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "version",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

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

function convertUsdToVoltAmount(usdValue, voltUsdPrice) {
  const usd = Number(usdValue || 0);
  const price = Number(voltUsdPrice || 0);
  if (!Number.isFinite(usd) || usd <= 0 || !Number.isFinite(price) || price <= 0) {
    return "";
  }

  return (usd / price).toFixed(4);
}

function convertVoltToUsdAmount(voltValue, voltUsdPrice) {
  const volt = Number(voltValue || 0);
  const price = Number(voltUsdPrice || 0);
  if (!Number.isFinite(volt) || volt <= 0 || !Number.isFinite(price) || price <= 0) {
    return "";
  }

  return (volt * price).toFixed(2);
}

async function fetchDexScreenerTokenPriceUsd(chainId, tokenAddress) {
  if (!chainId || !tokenAddress || !ethers.isAddress(tokenAddress)) {
    return null;
  }

  const response = await fetch(`https://api.dexscreener.com/tokens/v1/${chainId}/${tokenAddress}`);
  if (!response.ok) {
    throw new Error(`Dexscreener price request failed: ${response.status}`);
  }

  const pairs = await response.json();
  if (!Array.isArray(pairs) || pairs.length === 0) {
    return null;
  }

  const bestPair = [...pairs].sort((left, right) => {
    const leftLiquidity = Number(left?.liquidity?.usd || 0);
    const rightLiquidity = Number(right?.liquidity?.usd || 0);
    return rightLiquidity - leftLiquidity;
  })[0];

  const priceUsd = Number(bestPair?.priceUsd || 0);
  return Number.isFinite(priceUsd) && priceUsd > 0 ? priceUsd : null;
}

function formatTokenInputPreview(value) {
  const normalized = Number(value || 0);
  if (!Number.isFinite(normalized) || normalized <= 0) return "0.0000 $VOLT";
  return `${normalized.toFixed(4)} $VOLT`;
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
          ? "border-primary bg-primary/10 shadow-[0_0_12px_rgba(0,82,255,0.4)] scale-105"
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
            className={`pointer-events-auto overflow-hidden border px-4 py-3 shadow-[0_0_18px_rgba(0,82,255,0.12)] backdrop-blur-md transition-all duration-300 ${styles.shell}`}
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
      <div className="w-full max-w-md border border-primary/40 bg-[#081427] p-5 shadow-[0_0_30px_rgba(0,82,255,0.18)]">
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
      amount: "0.0000 $VOLT",
      accent: selectedDice === index + 1,
    })),
    {
      title: "Even Pool",
      bettors: 0,
      amount: "0.0000 $VOLT",
      accent: parityEven,
    },
    {
      title: "Odd Pool",
      bettors: 0,
      amount: "0.0000 $VOLT",
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
    tokenAddress: "",
    tokenAllowance: "",
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
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);
  const [networkName, setNetworkName] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [toasts, setToasts] = useState([]);
  const [resultModal, setResultModal] = useState(null);
  const [backendStatus, setBackendStatus] = useState("unknown");
  const [roundCountdown, setRoundCountdown] = useState(formatCountdown(ROUND_DURATION_SECONDS));
  const [roundCountdownLabel, setRoundCountdownLabel] = useState("Closes in");
  const [ethUsdPrice, setEthUsdPrice] = useState(null);
  const [ethUsdStatus, setEthUsdStatus] = useState(
    !CHAINLINK_ETH_USD_FEED || !ethers.isAddress(CHAINLINK_ETH_USD_FEED) || !hasRpcEndpoints() ? "missing_config" : "loading"
  );
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
  const [snapshot, setSnapshot] = useState(() => createInitialSnapshot());
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [betHistoryLoading, setBetHistoryLoading] = useState(false);
  const [backendRefreshTick, setBackendRefreshTick] = useState(0);
  const [snapshotRefreshTick, setSnapshotRefreshTick] = useState(0);
  const [priceRefreshTick, setPriceRefreshTick] = useState(0);

  const roundFeed = useMemo(() => (
    snapshot.currentRound ? getExplorerRoundCards(snapshot.currentRound) : []
  ), [snapshot.currentRound]);
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
  const tokenAddressRef = useRef("");

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

  function refreshPriceFeed() {
    setPriceRefreshTick((current) => current + 1);
  }

  useEffect(() => {
    if (!CONTRACT_ADDRESS || !ethers.isAddress(CONTRACT_ADDRESS)) return;

    const nextProvider = hasRpcEndpoints()
      ? new ethers.JsonRpcProvider(getPrimaryRpcUrl())
      : window.ethereum
        ? new ethers.BrowserProvider(window.ethereum)
        : null;

    if (!nextProvider) return;

    const nextContract = new ethers.Contract(CONTRACT_ADDRESS, VOLTSONIC_ABI, nextProvider);
    setContract(nextContract);

    runRpcRequest((provider) => provider.getNetwork(), {
      cacheKey: "rpc:network",
      cacheTtlMs: 5 * 60 * 1000,
    }).then((network) => setNetworkName(network.name)).catch(() => {});

    if (window.ethereum) {
      const walletProvider = new ethers.BrowserProvider(window.ethereum);
      walletProvider.send("eth_accounts", []).then((accounts) => {
        if (accounts[0]) setAccount(accounts[0]);
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => setAccount(accounts[0] || "");
    const handleChainChanged = () => window.location.reload();

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

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
      if (backendStatus === "ready") {
        pushToast({
          type: "success",
          title: "Backend Connected",
          message: "Read-heavy views are now using backend data.",
          dedupeKey: "backend-ready",
        });
      } else if (backendStatus === "offline") {
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
          notify(
            formatDebugError("Backend health check failed", error),
            "warning",
            "Backend Error",
            "backend-health-check-failed"
          );
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
        let totalVaultDeposits = 0n;
        let totalEthContributed = 0n;
        let owner = ethers.ZeroAddress;
        let tokenAddress = tokenAddressRef.current || ethers.ZeroAddress;

        try {
          const [
            fetchedCurrentState,
            fetchedCurrentPoolStats,
            fetchedTotalVaultDeposits,
            fetchedTotalEthContributed,
            fetchedOwner,
            fetchedTokenAddress,
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
              method: "totalVaultDeposits",
              cacheKey: "voltsonic:totalVaultDeposits",
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
            {
              address: CONTRACT_ADDRESS,
              abi: VOLTSONIC_ABI,
              method: "voltToken",
              cacheKey: "voltsonic:voltToken",
              cacheTtlMs: 5 * 60 * 1000,
            },
          ]);

          currentState = fetchedCurrentState;
          currentPoolStats = fetchedCurrentPoolStats;
          totalVaultDeposits = fetchedTotalVaultDeposits;
          totalEthContributed = fetchedTotalEthContributed;
          owner = fetchedOwner;
          tokenAddress = fetchedTokenAddress;
          tokenAddressRef.current = tokenAddress;
        } catch (error) {
          console.error("Failed to load distributed contract snapshot:", error);
          notify("Could not load contract snapshot from the RPC pool.", "error", "Contract Error", "distributed-snapshot-failed");
        }

        const hasTokenAddress = ethers.isAddress(tokenAddress) && tokenAddress !== ethers.ZeroAddress;

        const currentRoundNumber = Number(currentState.roundId);
        const latestSettledRoundId = currentRoundNumber > 0 ? currentRoundNumber - 1 : null;
        let connectedCredits = 0n;
        let contractTokenBalance = 0n;
        let tokenAllowance = 0n;

        if (account && hasTokenAddress) {
          connectedCredits = await readContract({
            address: tokenAddress,
            abi: VOLT_ERC20_ABI,
            method: "balanceOf",
            args: [account],
            cacheKey: `volt:${tokenAddress.toLowerCase()}:balanceOf:${account.toLowerCase()}`,
            cacheTtlMs: 5_000,
          }).catch(() => 0n);
        }
        if (hasTokenAddress) {
          contractTokenBalance = await readContract({
            address: tokenAddress,
            abi: VOLT_ERC20_ABI,
            method: "balanceOf",
            args: [CONTRACT_ADDRESS],
            cacheKey: `volt:${tokenAddress.toLowerCase()}:balanceOf:${CONTRACT_ADDRESS.toLowerCase()}`,
            cacheTtlMs: 5_000,
          }).catch(() => 0n);
        }
        if (account && hasTokenAddress) {
          tokenAllowance = await readContract({
            address: tokenAddress,
            abi: VOLT_ERC20_ABI,
            method: "allowance",
            args: [account, CONTRACT_ADDRESS],
            cacheKey: `volt:${tokenAddress.toLowerCase()}:allowance:${account.toLowerCase()}:${CONTRACT_ADDRESS.toLowerCase()}`,
            cacheTtlMs: 5_000,
          }).catch(() => 0n);
        }

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
        if (latestSettledRoundId !== null && backendStatus === "ready") {
          try {
            latestRoundSummary = await fetchBackendJson("/api/v1/rounds/latest/result");
          } catch (error) {
            notify(
              formatDebugError("Latest round backend fetch failed", error),
              "warning",
              "Backend Fallback",
              "latest-round-backend-fetch-failed"
            );
            latestRoundSummary = null;
          }
        }
        if (latestSettledRoundId !== null && !latestRoundSummary) {
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
          jackpotBalance: formatVolt(currentState.currentJackpot),
          minBet: ethers.formatEther(currentState.minimumBet),
          credits: formatVolt(connectedCredits),
          contractBalance: formatVolt(contractTokenBalance),
          redeemableCredits: formatVolt(totalVaultDeposits),
          totalEthContributed: formatVolt(totalEthContributed),
          claimPoolReward: formatVolt(preview[0]),
          claimJackpotReward: formatVolt(preview[1]),
          claimFee: formatVolt(preview[2]),
          claimNet: formatVolt(preview[3]),
          tokenAddress,
          tokenAllowance: formatVolt(tokenAllowance),
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
              amount: formatVolt(currentPoolStats.dicePoolAmounts[index]),
              accent: betForm.dice === index + 1,
            })),
            {
              title: "Even Pool",
              bettors: Number(currentPoolStats.evenPoolBettors),
              amount: formatVolt(currentPoolStats.evenPoolAmount),
              accent: betForm.parityEven,
            },
            {
              title: "Odd Pool",
              bettors: Number(currentPoolStats.oddPoolBettors),
              amount: formatVolt(currentPoolStats.oddPoolAmount),
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

    const nowSeconds = Math.floor(Date.now() / 1000);
    const nextMoments = [snapshot.roundStartTime, snapshot.roundCloseTime]
      .map((value) => Number(value || 0))
      .filter((value) => value > nowSeconds);
    const timeoutMs = nextMoments.length
      ? Math.max(1000, (Math.min(...nextMoments) - nowSeconds + 1) * 1000)
      : 3000;
    const timeoutId = window.setTimeout(() => {
      refreshSnapshot();
      if (backendStatus === "ready") {
        refreshBackendStatus();
      }
    }, timeoutMs);

    return () => window.clearTimeout(timeoutId);
  }, [backendStatus, snapshot.currentRound, snapshot.bettingOpen, snapshot.roundStartTime, snapshot.roundCloseTime]);

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

    if (previous.claimNet !== snapshot.claimNet && snapshot.claimNet !== "0.0000 $VOLT") {
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
        try {
          await postBackendJson("/api/v1/sync?max_blocks=200");
        } catch (syncError) {
          console.warn("Background bet sync failed", syncError);
        }

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

        rawEntries.sort((a, b) => b.roundId - a.roundId);
        setBetHistory(rawEntries);
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
  }, [account, backendStatus, snapshot.currentRound, snapshot.latestSettledRound, snapshotRefreshTick]);

  useEffect(() => {
    if (!hasRpcEndpoints() || !CHAINLINK_ETH_USD_FEED || !ethers.isAddress(CHAINLINK_ETH_USD_FEED)) {
      setEthUsdStatus("missing_config");
      return;
    }

    let cancelled = false;

    async function loadPrice() {
      try {
        if (!cancelled) setEthUsdStatus("loading");
        const [latestRoundData, decimals] = await Promise.all([
          readContract({
            address: CHAINLINK_ETH_USD_FEED,
            abi: CHAINLINK_FEED_ABI,
            method: "latestRoundData",
            cacheKey: `chainlink:${CHAINLINK_ETH_USD_FEED.toLowerCase()}:latestRoundData`,
            cacheTtlMs: 15_000,
          }),
          readContract({
            address: CHAINLINK_ETH_USD_FEED,
            abi: CHAINLINK_FEED_ABI,
            method: "decimals",
            cacheKey: `chainlink:${CHAINLINK_ETH_USD_FEED.toLowerCase()}:decimals`,
            cacheTtlMs: 60 * 60 * 1000,
          }),
        ]);

        if (cancelled) return;

        const answer = Number(latestRoundData.answer);
        const scale = 10 ** Number(decimals);
        setEthUsdPrice(answer / scale);
        setEthUsdStatus("ready");
      } catch (error) {
        if (!cancelled) {
          console.error("Chainlink ETH/USD fetch failed", error);
          setEthUsdPrice(null);
          setEthUsdStatus("error");
          pushToast({
            type: "warning",
            title: "Price Feed Unavailable",
            message: "ETH/USD conversion is temporarily unavailable.",
            dedupeKey: "price-feed-error",
          });
        }
      }
    }

    loadPrice();
    return () => {
      cancelled = true;
    };
  }, [priceRefreshTick]);

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

  async function connectWallet() {
    if (!window.ethereum) {
      notify("Install MetaMask or another injected wallet first.", "warning", "Wallet Required");
      return;
    }

    try {
      const nextProvider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await nextProvider.send("eth_requestAccounts", []);
      triggerInteractionLoading(accounts[0] || "");
      setAccount(accounts[0] || "");
      notify(
        accounts[0] ? `Connected ${shortAddress(accounts[0])}` : "Wallet connection cancelled.",
        accounts[0] ? "success" : "warning",
        accounts[0] ? "Wallet Connected" : "Wallet Cancelled"
      );
    } catch (error) {
      notify(getReadableError(error), "error", "Wallet Error");
    }
  }

  async function switchWallet() {
    if (!window.ethereum) {
      notify("Install MetaMask or another injected wallet first.", "warning", "Wallet Required");
      return;
    }

    try {
      const nextProvider = new ethers.BrowserProvider(window.ethereum);
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
      const accounts = await nextProvider.send("eth_accounts", []);
      triggerInteractionLoading(accounts[0] || "");
      setAccount(accounts[0] || "");
      notify(
        accounts[0] ? `Switched to ${shortAddress(accounts[0])}` : "No wallet selected.",
        accounts[0] ? "info" : "warning",
        accounts[0] ? "Wallet Switched" : "Wallet Selection"
      );
    } catch (error) {
      notify(getReadableError(error), "error", "Wallet Error");
    }
  }

  async function writeContract(runTx, pendingMessage, successMessage) {
    if (!window.ethereum || !contract) {
      notify("Connect your wallet and try again.", "warning", "Wallet Required");
      return { ok: false, error: "Connect your wallet and try again." };
    }

    try {
      triggerInteractionLoading();
      const walletProvider = new ethers.BrowserProvider(window.ethereum);
      const signer = await walletProvider.getSigner();
      const signedContract = contract.connect(signer);
      notify(pendingMessage, "info", "Transaction Submitted");
      const tx = await runTx(signedContract, signer);
      pushToast({
        type: "info",
        title: "Waiting For Confirmation",
        message: `Tx ${tx.hash.slice(0, 10)}... submitted.`,
        dedupeKey: `tx-hash-${tx.hash}`,
      });
      const receipt = await tx.wait();
      if (backendStatus === "ready" && receipt?.blockNumber) {
        try {
          await postBackendJson(`/api/v1/sync?from_block=${receipt.blockNumber}&max_blocks=1`);
        } catch (syncError) {
          console.warn("Backend sync after transaction failed", syncError);
        }
      }
      notify(successMessage, "success", "Transaction Confirmed");
      refreshBackendStatus();
      refreshSnapshot();
      return { ok: true, error: null };
    } catch (error) {
      const errorMessage = getReadableError(error);
      notify(errorMessage, "error", "Transaction Failed");
      return { ok: false, error: errorMessage };
    }
  }

  async function approveVoltIfNeeded(signer, amount) {
    const signedContract = contract.connect(signer);
    const tokenAddress = await signedContract.voltToken();
    const tokenContract = new ethers.Contract(tokenAddress, VOLT_ERC20_ABI, signer);
    const ownerAddress = await signer.getAddress();
    const allowance = await tokenContract.allowance(ownerAddress, CONTRACT_ADDRESS);

    if (allowance >= amount) {
      return;
    }

    notify("Approving VOLT spend...", "info", "Approval Required");
    const approveTx = await tokenContract.approve(CONTRACT_ADDRESS, amount);
    pushToast({
      type: "info",
      title: "Waiting For Approval",
      message: `Tx ${approveTx.hash.slice(0, 10)}... submitted.`,
      dedupeKey: `approve-${approveTx.hash}`,
    });
    await approveTx.wait();
    notify("VOLT approval confirmed.", "success", "Approval Confirmed");
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
    approveVoltIfNeeded,
    writeContract,
  };
}
