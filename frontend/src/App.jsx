import { NavLink, Route, Routes } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { VOLTSONIC_ABI, VOLT_ERC20_ABI, formatEth, formatVolt, getExplorerRoundCards } from "./lib/contract";

const CONTRACT_ADDRESS = import.meta.env.VITE_VOLTSONIC_CONTRACT_ADDRESS || "";
const CHAINLINK_ETH_USD_FEED = import.meta.env.VITE_CHAINLINK_ETH_USD_FEED_ADDRESS || "";
const BASE_SEPOLIA_RPC_URL = import.meta.env.VITE_BASE_RPC_URL || "";
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || "http://127.0.0.1:8000";
const ROUND_DURATION_SECONDS = Number(import.meta.env.VITE_VOLTSONIC_ROUND_DURATION_SECONDS || 180);
const VOLT_USD_PRICE = Number(import.meta.env.VITE_VOLT_USD_PRICE || 0);
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

function shortAddress(value) {
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

function parseTokenAmount(value) {
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
    roundId: Number(bet.round_id),
    result,
    claimed: Boolean(bet.claimed),
    settled: bet.status !== "open",
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

function useVoltSonic() {
  const [account, setAccount] = useState("");
  const [provider, setProvider] = useState(null);
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
    !CHAINLINK_ETH_USD_FEED || !ethers.isAddress(CHAINLINK_ETH_USD_FEED) || !BASE_SEPOLIA_RPC_URL ? "missing_config" : "loading"
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

  useEffect(() => {
    if (!CONTRACT_ADDRESS || !ethers.isAddress(CONTRACT_ADDRESS)) return;

    const nextProvider = BASE_SEPOLIA_RPC_URL
      ? new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL)
      : window.ethereum
        ? new ethers.BrowserProvider(window.ethereum)
        : null;

    if (!nextProvider) return;

    const nextContract = new ethers.Contract(CONTRACT_ADDRESS, VOLTSONIC_ABI, nextProvider);
    setProvider(nextProvider);
    setContract(nextContract);

    nextProvider.getNetwork().then((network) => setNetworkName(network.name)).catch(() => {});

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
      } catch {
        if (!cancelled) setBackendStatus("offline");
      }
    }

    checkBackend();
    const intervalId = window.setInterval(checkBackend, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!contract || !provider) return;

    let cancelled = false;

    async function load() {
      try {
        const [currentState, currentPoolStats, totalVaultDeposits, totalEthContributed, owner, tokenAddress] = await Promise.all([
          contract.getCurrentRoundState(),
          contract.getCurrentPoolStats(),
          contract.totalVaultDeposits(),
          contract.totalEthContributed(),
          contract.owner(),
          contract.voltToken(),
        ]);

        const tokenContract = new ethers.Contract(tokenAddress, VOLT_ERC20_ABI, provider);

        const currentRoundNumber = Number(currentState.roundId);
        const latestSettledRoundId = currentRoundNumber > 0 ? currentRoundNumber - 1 : null;
        const [connectedCredits, contractTokenBalance, tokenAllowance] = await Promise.all([
          account ? tokenContract.balanceOf(account) : Promise.resolve(0n),
          tokenContract.balanceOf(CONTRACT_ADDRESS),
          account ? tokenContract.allowance(account, CONTRACT_ADDRESS) : Promise.resolve(0n),
        ]);

        let preview = [0n, 0n, 0n, 0n, false];
        let latestRoundSummary = null;
        if (account && latestSettledRoundId !== null) {
          preview = await contract.getClaimPreview(account, latestSettledRoundId);
        }
        if (latestSettledRoundId !== null && backendStatus === "ready") {
          try {
            latestRoundSummary = await fetchBackendJson("/api/v1/rounds/latest/result");
          } catch {
            latestRoundSummary = null;
          }
        }
        if (latestSettledRoundId !== null && !latestRoundSummary) {
          latestRoundSummary = await contract.getRoundSummary(latestSettledRoundId);
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
          notify(getReadableError(error), "error", "Sync Error");
        }
      }
    }

    load();
    const timer = window.setInterval(load, 12000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [account, backendStatus, betForm.dice, betForm.parityEven, contract, provider]);

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
      if (backendStatus !== "ready") {
        if (!cancelled) {
          setBetHistory([]);
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
          fetchBackendJson(`/api/v1/bets/recent/open${account ? `?user_address=${account}&limit=50` : "?limit=50"}`),
          fetchBackendJson(`/api/v1/bets/recent/closed${account ? `?user_address=${account}&limit=50` : "?limit=50"}`),
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
          setBetHistory([]);
          setBetHistoryLoading(false);
          notify(getReadableError(error), "error", "History Error");
        }
      }
    }

    loadBetHistory();
    return () => {
      cancelled = true;
    };
  }, [account, backendStatus, snapshot.currentRound, snapshot.bettingOpen, snapshot.latestSettledRound]);

  useEffect(() => {
    if (!BASE_SEPOLIA_RPC_URL || !CHAINLINK_ETH_USD_FEED || !ethers.isAddress(CHAINLINK_ETH_USD_FEED)) {
      setEthUsdStatus("missing_config");
      return;
    }

    let cancelled = false;

    async function loadPrice() {
      try {
        if (!cancelled) setEthUsdStatus("loading");
        const rpcProvider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL);
        const priceFeed = new ethers.Contract(CHAINLINK_ETH_USD_FEED, CHAINLINK_FEED_ABI, rpcProvider);
        const [latestRoundData, decimals] = await Promise.all([
          priceFeed.latestRoundData(),
          priceFeed.decimals(),
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
    const intervalId = window.setInterval(loadPrice, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

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
      return;
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
      window.location.reload();
    } catch (error) {
      notify(getReadableError(error), "error", "Transaction Failed");
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

function BottomNavLink({ to, label, icon, fill = false }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex w-full flex-col items-center justify-center py-2 transition-all ${
          isActive
            ? "border-t-2 border-primary bg-primary/10 text-primary -mt-[2px]"
            : "text-slate-500 hover:text-blue-300"
        }`
      }
    >
      <span className="material-symbols-outlined" style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined}>
        {icon}
      </span>
      <span className="mt-1 font-mono text-[9px] uppercase tracking-wide sm:text-[10px] sm:tracking-widest">{label}</span>
    </NavLink>
  );
}

function Shell({ children, account, connectWallet, switchWallet, networkName, statusMessage, title, icon, toasts, resultModal, dismissToast, dismissResultModal }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background pb-24 text-on-surface selection:bg-primary selection:text-on-primary">
      <header className="sticky top-0 z-50 flex w-full max-w-none items-center justify-between border-b border-primary/20 bg-[#060e20] px-4 py-3 text-primary sm:px-6 sm:py-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-secondary sm:text-[24px]">{icon}</span>
          <h1 className="font-headline text-lg font-black uppercase tracking-tight text-primary sm:text-2xl sm:tracking-tighter">{title}</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {/*<div className="hidden border border-outline-variant bg-surface-container-high px-3 py-2 text-[11px] font-mono uppercase tracking-wide text-on-surface lg:block">
            {CONTRACT_ADDRESS || "Set VITE_VOLTSONIC_CONTRACT_ADDRESS"}
          </div>*/}
          <div className="hidden lg:flex items-center gap-2 sm:gap-3">
            <BottomNavLink to="/" label="GAME" icon="casino" fill />
            <BottomNavLink to="/bets" label="BETS" icon="receipt_long" />
            <BottomNavLink to="/wallet" label="WALLET" icon="ev_station" />
          </div>
          {/*<div className="hidden border border-outline-variant bg-surface-container-high px-3 py-2 text-[11px] font-mono uppercase tracking-wide text-on-surface md:block">
            {networkName || "No network"}
          </div>*/}
          {account ? (
            <div className="flex items-center gap-2">
              <div className="hidden border border-outline-variant bg-surface-container-high px-3 py-2 text-[11px] font-mono uppercase tracking-wide text-on-surface sm:block">
                {shortAddress(account)}
              </div>
              <button
                onClick={switchWallet}
                className="border border-primary/40 bg-primary/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary/20 active:scale-95 sm:px-4 sm:text-xs"
              >
                Connected
              </button>
            </div>
          ) : (
            <button
              onClick={connectWallet}
              className="glow-primary bg-primary px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-on-primary transition-colors hover:brightness-110 active:scale-95 sm:px-4 sm:text-xs"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      <ToastStack toasts={toasts} dismissToast={dismissToast} />
      <ResultModal resultModal={resultModal} dismissResultModal={dismissResultModal} />

      {children}

      <nav className="fixed bottom-0 left-0 z-50 flex h-16 w-full items-stretch justify-around border-t-2 border-primary/30 bg-[#091328]/95 shadow-[0_-10px_30px_rgba(0,82,255,0.16)] backdrop-blur-md lg:hidden">
        <BottomNavLink to="/" label="GAME" icon="casino" fill />
        <BottomNavLink to="/bets" label="BETS" icon="receipt_long" />
        <BottomNavLink to="/wallet" label="WALLET" icon="ev_station" />
        {/*<BottomNavLink to="/rounds" label="ROUND" icon="leaderboard" />*/}
      </nav>
    </div>
  );
}

function SkeletonBlock({ className = "" }) {
  return <div className={`animate-pulse rounded bg-white/10 ${className}`}></div>;
}

function SkeletonText({ width = "w-24", className = "" }) {
  return <SkeletonBlock className={`h-4 ${width} ${className}`.trim()} />;
}

function SummaryRowSkeleton({ topMargin = false }) {
  return (
    <div className={`flex items-center justify-between text-sm ${topMargin ? "mt-3" : ""}`}>
      <SkeletonText width="w-24" className="h-3" />
      <SkeletonText width="w-28" className="h-4" />
    </div>
  );
}

function StatusCell({ label, value, icon, accent, valueClass = "", iconClass = "", borderClass = "border-primary", subvalue = "" }) {
  const isComponent = typeof value === "object" && value.type;
  
  return (
    <div className={`flex items-center justify-between border-l-2 pl-3 sm:pl-4 ${borderClass}`}>
      <div>
        <span className="font-mono text-[9px] uppercase tracking-wide text-outline sm:text-[10px] sm:tracking-widest">{label}</span>
        <div className={`mt-1 text-xs font-bold sm:text-sm ${isComponent ? "" : valueClass || (accent ? "text-primary" : "text-on-surface")}`}>
          {value}
        </div>
        {subvalue ? <div className="mt-1 font-mono text-[9px] uppercase tracking-wide text-on-surface-variant">{subvalue}</div> : null}
      </div>
      <span className={`material-symbols-outlined text-[20px] sm:text-[24px] ${iconClass || "text-primary"}`}>{icon}</span>
    </div>
  );
}

function StatusStrip({ snapshot, walletConnected, roundCountdown, roundCountdownLabel, snapshotLoading }) {
  const isSettling = roundCountdownLabel === "Settling";
  const bettingStateStyles = getBettingStateStyles(snapshot.bettingOpen, isSettling);

  return (
    <div className="w-full border-b border-outline-variant bg-surface-container-low px-4 py-3 sm:px-6 sm:py-4">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <StatusCell label="Jackpot Pool" value={snapshotLoading ? <SkeletonText width="w-24" /> : <div className="text-gray-400">Coming soon</div>/*snapshot.jackpotBalance*/ } icon="trophy" accent />
        <StatusCell label="Credits" value={snapshotLoading ? <SkeletonText width="w-24" /> : snapshot.credits} icon="battery_charging_80" accent />
        <StatusCell label="Current Round" value={snapshotLoading ? <SkeletonText width="w-16" /> : snapshot.currentRound} icon="hub" accent={false} />
        <StatusCell
          label="Betting State"
          value={snapshotLoading ? <SkeletonText width="w-20" /> : isSettling ? <SettlingIndicator /> : snapshot.bettingOpen ? "OPEN" : "CLOSED"}
          subvalue={snapshotLoading ? "" : isSettling ? undefined : `${roundCountdownLabel} ${roundCountdown}`}
          icon="power_settings_new"
          accent
          valueClass={snapshotLoading ? "" : bettingStateStyles.valueClass}
          iconClass={snapshotLoading ? "" : bettingStateStyles.iconClass}
          borderClass={snapshotLoading ? "border-primary/40" : bettingStateStyles.borderClass}
        />
      </div>
    </div>
  );
}

function MiniMetric({ label, value, accent = false }) {
  return (
    <div className="border border-outline-variant bg-surface-container-high p-2.5 sm:p-3">
      <div className="font-mono text-[9px] uppercase text-outline">{label}</div>
      <div className={`mt-1.5 text-xs font-bold sm:mt-2 sm:text-sm ${accent ? "text-primary" : "text-on-surface"}`}>{value}</div>
    </div>
  );
}

function MetricCard({ label, value, accent = false }) {
  return (
    <div className="border-l-2 border-primary bg-surface-container-highest p-3 sm:p-4">
      <div className="font-mono text-[9px] uppercase text-outline sm:text-[10px]">{label}</div>
      <div className={`mt-2 text-lg font-bold sm:text-xl ${accent ? "text-primary" : "text-on-surface"}`}>{value}</div>
    </div>
  );
}

function SummaryRow({ label, value, topMargin = false, error = false }) {
  return (
    <div className={`flex items-center justify-between text-sm ${topMargin ? "mt-3" : ""}`}>
      <span className="text-outline">{label}</span>
      <span className={`font-mono font-bold ${error ? "text-error" : value.includes("ETH") ? "text-primary" : "text-on-surface"}`}>
        {value}
      </span>
    </div>
  );
}

function AmountPanel({
  label,
  value,
  onChange,
  usdValue = "",
  onUsdChange,
  borderClass,
  valuePrefix = "",
  previewLabel = "",
  previewValue = "",
  subnote = "",
}) {
  return (
    <div className={`bg-surface-container-highest border-l-4 ${borderClass} p-3 sm:p-4`}>
      <div className="mb-2 flex justify-between items-center">
        <label className="font-mono text-[10px] uppercase text-outline">{label}</label>
        <div className="flex gap-2">
          <button className="text-[10px] font-mono text-primary hover:underline">MIN</button>
          <button className="text-[10px] font-mono text-primary hover:underline">MAX</button>
        </div>
      </div>
      <div className="flex items-center">
        {valuePrefix ? <span className="mr-2 text-lg font-bold text-secondary sm:text-xl">{valuePrefix}</span> : null}
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full border-0 bg-transparent p-0 text-2xl font-mono font-bold text-on-surface focus:ring-0 sm:text-3xl"
          type="number"
          min="0"
          step="0.0001"
          placeholder="0.00"
        />
      </div>
      {typeof onUsdChange === "function" ? (
        <div className="mt-3 border border-outline-variant bg-surface-container-low px-3 py-2">
          <div className="mb-1 font-mono text-[9px] uppercase text-outline">USD Input</div>
          <div className="flex items-center">
            <span className="mr-2 text-sm font-bold text-secondary">$</span>
            <input
              value={usdValue}
              onChange={(event) => onUsdChange(event.target.value)}
              className="w-full border-0 bg-transparent p-0 text-sm font-mono font-bold text-on-surface focus:ring-0"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InlineAction({
  label,
  placeholder,
  buttonLabel,
  onAction,
  buttonClass = "hover:border-primary",
  previewLabel = "Equivalent",
  valuePrefix = "",
  previewValue,
  subnote = "",
}) {
  const [value, setValue] = useState("");

  return (
    <div className="space-y-3">
      <span className="text-[9px] font-mono uppercase text-outline sm:text-[10px]">{label}</span>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="w-full">
          <div className="flex items-center border border-outline-variant bg-surface-container-highest px-4 py-3 focus-within:border-primary">
            {valuePrefix ? <span className="mr-2 text-sm font-bold text-secondary">{valuePrefix}</span> : null}
            <input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="w-full border-0 bg-transparent p-0 text-sm text-on-surface focus:ring-0"
              type="number"
              placeholder={placeholder}
              min="0"
              step="0.0001"
            />
          </div>
          {/*<div className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-on-surface-variant">
            {previewLabel} {previewValue ? previewValue(value) : formatInputEthPreview(value)}
          </div>*/}
          {subnote ? <div className="mt-1 text-[11px] text-outline">{subnote}</div> : null}
        </div>
        <button
          onClick={() => onAction(value)}
          className={`border border-outline-variant bg-surface-container-highest px-4 py-3 text-xs font-bold uppercase transition-colors sm:min-w-[132px] ${buttonClass}`}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

function HeroPanel({ snapshot, snapshotLoading = false, title, copy, icon = "electric_bolt" }) {
  const dicePools = snapshot.roundPoolCards.slice(0, 6);
  const parityPools = snapshot.roundPoolCards.slice(6);
  const [activePoolTab, setActivePoolTab] = useState("dice");

  return (
    <section className="relative overflow-hidden border-l-2 border-primary bg-surface-container-low p-4 sm:p-6 lg:p-8">
      <div className="absolute right-0 top-0 p-2 opacity-10">
        <span className="material-symbols-outlined text-4xl sm:text-6xl">{icon}</span>
      </div>
      <div className="relative z-10">
        <div className="circuit-border border border-none p-4 sm:p-5 lg:p-6">
          {snapshotLoading ? (
            <div className="border border-outline-variant bg-surface-container-highest p-3 sm:p-4">
              <SkeletonText width="w-36" className="h-5" />
              <SkeletonText width="w-56" className="mt-2 h-3" />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="border border-outline-variant bg-surface-container-low p-3">
                  <SkeletonText width="w-20" className="h-3" />
                  <SkeletonText width="w-28" className="mt-3 h-4" />
                </div>
                <div className="border border-outline-variant bg-surface-container-low p-3">
                  <SkeletonText width="w-24" className="h-3" />
                  <div className="mt-3 flex gap-2">
                    <SkeletonBlock className="h-6 w-20" />
                    <SkeletonBlock className="h-6 w-24" />
                  </div>
                </div>
              </div>
            </div>
          ) : snapshot.latestSettledRound ? (
            <div className="border border-none bg-surface-container-highest p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-headline text-xs font-bold uppercase tracking-wide text-on-surface sm:text-sm">
                    Latest Result {snapshot.latestSettledRound}
                  </div>
                  <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-outline sm:text-[10px] sm:tracking-[0.3em]">
                    Previous round winners stay visible during the next round
                  </div>
                </div>
                <span className="border border-secondary/30 bg-secondary/10 px-2 py-1 font-mono text-[10px] uppercase text-secondary">
                  Settled
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {/*<div className="border border-outline-variant bg-surface-container-low p-3">
                  <div className="font-mono text-[9px] uppercase text-outline">Result</div>
                  <div className="mt-2 text-sm font-bold text-on-surface">
                    Dice {snapshot.latestResultDice} • {snapshot.latestResultParity}
                  </div>
                </div>*/}
                <div className="border border-outline-variant bg-surface-container-low p-3">
                  <div className="font-mono text-[9px] uppercase text-outline">Winning Pools</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {snapshot.latestWinningPools.map((pool) => (
                      <span
                        key={pool}
                        className="border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-mono text-[10px] uppercase text-emerald-400"
                      >
                        {pool}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-outline-variant bg-surface-container-highest p-3 sm:p-4">
              <div className="font-headline text-xs font-bold uppercase tracking-wide text-on-surface sm:text-sm">
                Waiting For First Result
              </div>
              <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-outline sm:text-[10px] sm:tracking-[0.3em]">
                Latest round outcome will appear here after the first settlement.
              </div>
            </div>
          )}
          {/*<div className="mt-4 grid grid-cols-3 gap-2 sm:mt-6 sm:gap-3">
            <MiniMetric label="Current Round" value={snapshot.currentRound} />
            <MiniMetric label="Betting" value={snapshot.bettingOpen ? "OPEN" : "CLOSED"} accent />
            <MiniMetric label="Min Bet" value={snapshot.minBet} />
          </div>*/}
        </div>
        {/*<div className="min-w-0 space-y-4">
          <div className="flex items-end justify-between px-1">
            <div>
              <h3 className="font-headline text-base font-bold uppercase tracking-tight sm:text-lg">Round Game Pools</h3>
              <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-outline sm:text-[10px] sm:tracking-[0.3em]">Live bettor count and stake per pool</span>
            </div>
            <span className="font-mono text-[9px] uppercase text-outline sm:text-[10px]">{snapshot.currentRound}</span>
          </div>
          <div className="flex border border-outline-variant bg-surface-container-highest p-1">
            <button
              onClick={() => setActivePoolTab("dice")}
              className={`flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition-colors sm:px-4 sm:text-[11px] sm:tracking-[0.2em] ${
                activePoolTab === "dice" ? "bg-primary text-on-primary" : "text-outline hover:text-on-surface"
              }`}
            >
              Dice
            </button>
            <button
              onClick={() => setActivePoolTab("parity")}
              className={`flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition-colors sm:px-4 sm:text-[11px] sm:tracking-[0.2em] ${
                activePoolTab === "parity" ? "bg-primary text-on-primary" : "text-outline hover:text-on-surface"
              }`}
            >
              Even / Odd
            </button>
          </div>
          {activePoolTab === "dice" ? (
            <article className="min-w-0 overflow-hidden border border-outline-variant bg-surface-container-high p-2.5 sm:p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <span className="font-headline text-xs font-bold uppercase tracking-wide text-on-surface sm:text-sm">Dice Pools</span>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-outline">Horizontal pool monitor</div>
                </div>
                <span className="font-mono text-[10px] uppercase text-outline">{dicePools.reduce((sum, pool) => sum + pool.bettors, 0)} bettors</span>
              </div>
              <div className="max-w-full overflow-x-auto pb-1">
                <div className="flex min-w-max gap-2">
                  {dicePools.map((pool) => (
                    <div
                      key={pool.title}
                      className={`w-28 flex-none border p-2.5 transition-colors sm:w-36 sm:p-4 lg:w-40 ${
                        pool.accent ? "glow-primary border-primary" : "border-outline-variant bg-surface-container-low"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className={`font-headline text-xs font-bold uppercase tracking-wide sm:text-sm ${pool.accent ? "text-primary" : "text-on-surface"}`}>
                          {pool.title}
                        </span>
                        <span className="font-mono text-[9px] uppercase text-outline">{pool.bettors}</span>
                      </div>
                      <div className="mt-3">
                        <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-outline sm:text-[10px] sm:tracking-[0.3em]">Amount</div>
                        <div className="mt-1.5 text-xs font-black text-on-surface sm:mt-2 sm:text-base">{pool.amount}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ) : (
            <article className="border border-outline-variant bg-surface-container-high p-2.5 sm:p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <span className="font-headline text-xs font-bold uppercase tracking-wide text-on-surface sm:text-sm">Parity Pools</span>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-outline">Even / odd pool monitor</div>
                </div>
                <span className="font-mono text-[10px] uppercase text-outline">{parityPools.reduce((sum, pool) => sum + pool.bettors, 0)} bettors</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                {parityPools.map((pool) => (
                  <div
                    key={pool.title}
                    className={`border p-2.5 transition-colors sm:p-4 ${
                      pool.accent ? "glow-primary border-primary" : "border-outline-variant bg-surface-container-low"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className={`font-headline text-xs font-bold uppercase tracking-wide sm:text-sm ${pool.accent ? "text-primary" : "text-on-surface"}`}>
                        {pool.title}
                      </span>
                      <span className="font-mono text-[9px] uppercase text-outline sm:text-[10px]">{pool.bettors} bettors</span>
                    </div>
                    <div className="mt-3">
                      <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-outline sm:text-[10px] sm:tracking-[0.3em]">Amount</div>
                      <div className="mt-1.5 text-sm font-black text-on-surface sm:mt-2 sm:text-lg">{pool.amount}</div>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          )}
        </div>*/}
      </div>
      <div className="pulse-line absolute bottom-0 left-0 h-[1px] w-full opacity-30"></div>
    </section>
  );
}

function GamePage({
  snapshot,
  snapshotLoading,
  betForm,
  setBetForm,
  approveVoltIfNeeded,
  writeContract,
  walletConnected,
  roundCountdown,
  roundCountdownLabel,
  ethUsdPrice,
  ethUsdStatus,
}) {
  const [activeBetTab, setActiveBetTab] = useState("dice");
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const totalStake = (Number(betForm.diceAmount || 0) + Number(betForm.parityAmount || 0)).toFixed(2);
  const diceEthPreview = formatTokenInputPreview(betForm.diceAmount);
  const parityEthPreview = formatTokenInputPreview(betForm.parityAmount);

  return (
    <>
      <StatusStrip snapshot={snapshot} walletConnected={walletConnected} roundCountdown={roundCountdown} roundCountdownLabel={roundCountdownLabel} snapshotLoading={snapshotLoading} />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-4 sm:space-y-8 sm:py-6">
        <HeroPanel
          snapshot={snapshot}
          snapshotLoading={snapshotLoading}
          title=""
          copy=""
        />

        <section className="border border-outline-variant bg-surface-container-high p-4 sm:p-6">
          <button
            onClick={() => setIsInstructionsOpen(!isInstructionsOpen)}
            className="flex w-full items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-white">help_center</span>
              <h2 className="font-headline text-lg font-bold uppercase tracking-tight text-white">How to Play</h2>
            </div>
            <span className={`material-symbols-outlined text-white transition-transform ${isInstructionsOpen ? 'rotate-180' : ''}`}>
              expand_more
            </span>
          </button>
          {isInstructionsOpen && (
            <div className="mt-4 space-y-4 text-sm text-on-surface">
              <div>
                <h3 className="font-headline text-base font-bold uppercase tracking-wide text-gray-400 mb-2">1. Connect Your Wallet</h3>
                <p className="text-outline">Connect a wallet on Base Sepolia, and make sure it holds enough $VOLT for your stake. Bets are paid in $VOLT, not native ETH.</p>
              </div>
              <div>
                <h3 className="font-headline text-base font-bold uppercase tracking-wide text-gray-400 mb-2">2. Approve Token Access</h3>
                <p className="text-outline">Before betting, set a wallet spend limit for VoltSonic. This step does not deposit or move $VOLT on its own. It only allows the contract to spend up to the amount you approve from your wallet when a bet is placed.</p>
              </div>
              <div>
                <h3 className="font-headline text-base font-bold uppercase tracking-wide text-gray-400 mb-2">3. Choose A Bet Type</h3>
                <p className="text-outline">Pick one of three modes for the active round: Dice only, Parity only, or Combo. Dice bets choose a number from 1 to 6, parity bets choose Even or Odd, and combo bets submit both together.</p>
              </div>
              <div>
                <h3 className="font-headline text-base font-bold uppercase tracking-wide text-gray-400 mb-2">4. Enter Your VOLT Amount</h3>
                <p className="text-outline">Enter the amount for the pool you want to join. Each active amount must meet the contract minimum, and you can only place one bet per round from a wallet.</p>
              </div>
              <div>
                <h3 className="font-headline text-base font-bold uppercase tracking-wide text-gray-400 mb-2">5. Approve And Submit</h3>
                <p className="text-outline">When you place a bet, VoltSonic checks whether your wallet spend limit is high enough. If it is too low, raise the limit first. After that, confirm the bet transaction before the round closes, and only then will the bet amount be spent from your wallet.</p>
              </div>
              <div>
                <h3 className="font-headline text-base font-bold uppercase tracking-wide text-gray-400 mb-2">6. Wait For Round Settlement</h3>
                <p className="text-outline">Betting stays open for the round window, then the round is settled with Chainlink VRF. A winning dice bet shares the dice pool for the rolled number, and a winning parity bet shares the matching even or odd pool.</p>
              </div>
              <div>
                <h3 className="font-headline text-base font-bold uppercase tracking-wide text-gray-400 mb-2">7. Claim Rewards</h3>
                <p className="text-outline">After settlement, go to Wallet and claim if you won. Combo winners who hit both the exact dice result and the correct parity also split the jackpot snapshot for that round, while a small fee is applied to pool rewards.</p>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex justify-between items-end px-2">
            <div>
              <h2 className="font-headline text-base font-bold uppercase tracking-tight sm:text-xl">Player Betting Terminal</h2>
              <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-secondary sm:text-[10px] sm:tracking-[0.3em]">Explicit Per-Game Entry</span>
            </div>
            <span className="font-mono text-[9px] text-outline sm:text-[10px]">{snapshot.currentRound}</span>
          </div>

          <div className="overflow-x-auto">
            <div className="flex min-w-max border border-outline-variant bg-surface-container-highest p-1">
              <button
                onClick={() => setActiveBetTab("dice")}
                className={`px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition-colors sm:px-4 sm:text-[11px] sm:tracking-[0.2em] ${
                  activeBetTab === "dice" ? "bg-secondary text-[#032731] glow-secondary" : "text-outline hover:text-secondary"
                }`}
              >
                Dice
              </button>
              <button
                onClick={() => setActiveBetTab("parity")}
                className={`px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition-colors sm:px-4 sm:text-[11px] sm:tracking-[0.2em] ${
                  activeBetTab === "parity" ? "bg-secondary text-[#032731] glow-secondary" : "text-outline hover:text-secondary"
                }`}
              >
                Even / Odd
              </button>
              <button
                onClick={() => setActiveBetTab("combo")}
                className={`px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition-colors sm:px-4 sm:text-[11px] sm:tracking-[0.2em] ${
                  activeBetTab === "combo" ? "bg-secondary text-[#032731] glow-secondary" : "text-outline hover:text-secondary"
                }`}
              >
                Combo
              </button>
            </div>
          </div>

          {activeBetTab === "dice" ? (
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_0.85fr]">
              <div className="space-y-4">
                <section className="space-y-4">
                  <div className="flex justify-between items-end px-2">
                    <h3 className="font-headline text-base font-bold uppercase tracking-tight sm:text-lg">Select Node</h3>
                    <span className="font-mono text-[9px] text-outline sm:text-[10px]">0x6-MATRIX-SELECT</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {[1, 2, 3, 4, 5, 6].map((value) => (
                      <button
                        key={value}
                        onClick={() => setBetForm((current) => ({ ...current, dice: value }))}
                        className={`group relative aspect-square overflow-hidden border bg-surface-container-high transition-all hover:border-primary flex items-center justify-center ${
                          betForm.dice === value ? "glow-primary border-primary text-primary" : "border-outline-variant"
                        }`}
                      >
                        <DiceIcon number={value} selected={betForm.dice === value} />
                        {betForm.dice === value ? <div className="absolute bottom-0 left-0 h-1 w-full bg-primary"></div> : null}
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <section className="space-y-4 border border-outline-variant bg-surface-container-high p-4 sm:p-5">
                <AmountPanel
                  label="Dice Amount ($VOLT)"
                  value={betForm.diceAmount}
                  onChange={(value) => setBetForm((current) => ({ ...current, diceAmount: value }))}
                  borderClass="border-primary"
                  valuePrefix="$"
                  previewLabel="Token Amount"
                  previewValue={diceEthPreview}
                  subnote={`Wallet balance: ${snapshot.credits}`}
                />

                <div className="border border-outline-variant bg-surface-container-low p-3 sm:p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-mono text-[9px] uppercase text-outline sm:text-[10px]">Dice Bet Summary</span>
                    <span className="font-mono text-[9px] uppercase text-secondary sm:text-[10px]">Single Pool Entry</span>
                  </div>
                  <div className="mt-4 space-y-3 text-sm">
                    {/*<SummaryRow label="Stake" value={`${Number(betForm.diceAmount || 0).toFixed(2)} $VOLT`} />*/}
                    <SummaryRow label="Stake" value={formatTokenInputPreview(betForm.diceAmount)} />
                    {/*<SummaryRow label="ETH Equivalent" value={`${(convertUsdToEthAmount(betForm.diceAmount, ethUsdPrice) || 0).toFixed(6)} ETH`} />*/}
                    <SummaryRow label="Selected Dice" value={`${betForm.dice}`} />
                  </div>
                </div>

                <button
                  onClick={() =>
                    writeContract(
                      async (contract, signer) => {
                        const diceAmount = parseTokenAmount(betForm.diceAmount);
                        if (diceAmount <= 0n) throw new Error("Enter a VOLT amount");
                        await approveVoltIfNeeded(signer, diceAmount);
                        return contract.placeBet(BigInt(betForm.dice), betForm.parityEven, diceAmount, 0n);
                      },
                      "Submitting dice bet...",
                      "Dice bet placed."
                    )
                  }
                  className="glow-primary w-full bg-primary py-4 font-headline text-base font-black uppercase tracking-tight text-on-primary transition-all active:scale-95 sm:py-5 sm:text-xl sm:tracking-tighter"
                >
                  Place Dice Bet
                </button>
              </section>
            </div>
          ) : null}

          {activeBetTab === "parity" ? (
            <div className="flex h-[200px] items-center justify-center p-4 sm:p-5">
              <div className="text-center">
                <span className="font-headline text-xs font-bold uppercase tracking-wide text-on-surface sm:text-sm">Coming Soon</span>
                <div className="mt-2 text-sm text-outline">Parity betting is coming soon. In the meantime, try out the dice pools!</div>
              </div>

            </div>
            /*<div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_0.85fr]">
              <div className="space-y-4">
                <section className="bg-surface-container-low p-3 sm:p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <span className="block font-headline text-xs font-bold uppercase tracking-wide sm:text-sm sm:tracking-wider">Parity Logic</span>
                      <span className="block font-mono text-[9px] text-outline sm:text-[10px]">AUTO-MODULATOR</span>
                    </div>
                    <div className="flex border border-outline-variant bg-surface-container-highest p-1">
                      <button
                        onClick={() => setBetForm((current) => ({ ...current, parityEven: true }))}
                        className={`px-4 py-2 text-xs font-black uppercase tracking-widest sm:px-6 ${
                          betForm.parityEven ? "bg-primary text-on-primary" : "text-outline transition-colors hover:text-on-surface"
                        }`}
                      >
                        Even
                      </button>
                      <button
                        onClick={() => setBetForm((current) => ({ ...current, parityEven: false }))}
                        className={`px-4 py-2 text-xs font-black uppercase tracking-widest sm:px-6 ${
                          !betForm.parityEven ? "bg-primary text-on-primary" : "text-outline transition-colors hover:text-on-surface"
                        }`}
                      >
                        Odd
                      </button>
                    </div>
                  </div>
                </section>
              </div>

              <section className="space-y-4 border border-outline-variant bg-surface-container-high p-4 sm:p-5">
                <AmountPanel
                  label="Parity Amount ($VOLT)"
                  value={betForm.parityAmount}
                  onChange={(value) => setBetForm((current) => ({ ...current, parityAmount: value }))}
                  borderClass="border-primary"
                  valuePrefix="$"
                  previewLabel="Token Amount"
                  previewValue={parityEthPreview}
                  subnote={`Wallet balance: ${snapshot.credits}`}
                />

                <div className="border border-outline-variant bg-surface-container-low p-3 sm:p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-mono text-[9px] uppercase text-outline sm:text-[10px]">Parity Bet Summary</span>
                    <span className="font-mono text-[9px] uppercase text-secondary sm:text-[10px]">Single Pool Entry</span>
                  </div>
                  <div className="mt-4 space-y-3 text-sm">
                    {/*<SummaryRow label="Stake" value={`${Number(betForm.parityAmount || 0).toFixed(2)} $VOLT`} />*}
                    <SummaryRow label="Stake" value={formatTokenInputPreview(betForm.parityAmount)} />
                    {/*<SummaryRow label="ETH Equivalent" value={`${(convertUsdToEthAmount(betForm.parityAmount, ethUsdPrice) || 0).toFixed(6)} ETH`} />*}
                    <SummaryRow label="Selected Parity" value={betForm.parityEven ? "EVEN" : "ODD"} />
                  </div>
                </div>

                <button
                  onClick={() =>
                    writeContract(
                      async (contract, signer) => {
                        const parityAmount = parseTokenAmount(betForm.parityAmount);
                        if (parityAmount <= 0n) throw new Error("Enter a VOLT amount");
                        await approveVoltIfNeeded(signer, parityAmount);
                        return contract.placeBet(BigInt(betForm.dice), betForm.parityEven, 0n, parityAmount);
                      },
                      "Submitting parity bet...",
                      "Parity bet placed."
                    )
                  }
                  className="glow-primary w-full bg-primary py-4 font-headline text-base font-black uppercase tracking-tight text-on-primary transition-all active:scale-95 sm:py-5 sm:text-xl sm:tracking-tighter"
                >
                  Place Parity Bet
                </button>
              </section>
            </div>*/
          ) : null}

          {activeBetTab === "combo" ? (
            <div className="flex h-[200px] items-center justify-center p-4 sm:p-5">
              <div className="text-center">
                <span className="font-headline text-xs font-bold uppercase tracking-wide text-on-surface sm:text-sm">Coming Soon</span>
                <div className="mt-2 text-sm text-outline">Combo betting is coming soon. In the meantime, try out the dice pools!</div>
              </div>

            </div>
            /*<div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_0.85fr]">
              <div className="space-y-4">
                <section className="space-y-4">
                  <div className="flex justify-between items-end px-2">
                    <h3 className="font-headline text-base font-bold uppercase tracking-tight sm:text-lg">Select Node</h3>
                    <span className="font-mono text-[9px] text-outline sm:text-[10px]">0x6-MATRIX-SELECT</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {[1, 2, 3, 4, 5, 6].map((value) => (
                      <button
                        key={value}
                        onClick={() => setBetForm((current) => ({ ...current, dice: value }))}
                        className={`group relative aspect-square overflow-hidden border bg-surface-container-high transition-all hover:border-primary flex items-center justify-center ${
                          betForm.dice === value ? "glow-primary border-primary text-primary" : "border-outline-variant"
                        }`}
                      >
                        <DiceIcon number={value} selected={betForm.dice === value} />
                        {betForm.dice === value ? <div className="absolute bottom-0 left-0 h-1 w-full bg-primary"></div> : null}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="bg-surface-container-low p-3 sm:p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <span className="block font-headline text-xs font-bold uppercase tracking-wide sm:text-sm sm:tracking-wider">Parity Logic</span>
                      <span className="block font-mono text-[9px] text-outline sm:text-[10px]">AUTO-MODULATOR</span>
                    </div>
                    <div className="flex border border-outline-variant bg-surface-container-highest p-1">
                      <button
                        onClick={() => setBetForm((current) => ({ ...current, parityEven: true }))}
                        className={`px-4 py-2 text-xs font-black uppercase tracking-widest sm:px-6 ${
                          betForm.parityEven ? "bg-primary text-on-primary" : "text-outline transition-colors hover:text-on-surface"
                        }`}
                      >
                        Even
                      </button>
                      <button
                        onClick={() => setBetForm((current) => ({ ...current, parityEven: false }))}
                        className={`px-4 py-2 text-xs font-black uppercase tracking-widest sm:px-6 ${
                          !betForm.parityEven ? "bg-primary text-on-primary" : "text-outline transition-colors hover:text-on-surface"
                        }`}
                      >
                        Odd
                      </button>
                    </div>
                  </div>
                </section>
              </div>

              <section className="space-y-4 border border-outline-variant bg-surface-container-high p-4 sm:p-5">
                <AmountPanel
                  label="Dice Amount"
                  value={betForm.diceAmount}
                  onChange={(value) => setBetForm((current) => ({ ...current, diceAmount: value }))}
                  borderClass="border-primary"
                  valuePrefix="$"
                  previewLabel="Token Amount"
                  previewValue={diceEthPreview}
                  subnote={`Wallet balance: ${snapshot.credits}`}
                />
                <AmountPanel
                  label="Parity Amount"
                  value={betForm.parityAmount}
                  onChange={(value) => setBetForm((current) => ({ ...current, parityAmount: value }))}
                  borderClass="border-outline"
                  valuePrefix="$"
                  previewLabel="Token Amount"
                  previewValue={parityEthPreview}
                  subnote={`Wallet balance: ${snapshot.credits}`}
                />

                <div className="border border-outline-variant bg-surface-container-low p-3 sm:p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-mono text-[9px] uppercase text-outline sm:text-[10px]">Combo Bet Summary</span>
                    <span className="font-mono text-[9px] uppercase text-secondary sm:text-[10px]">JACKPOT ELIGIBLE</span>
                  </div>
                  <div className="mt-4 space-y-3 text-sm">
                    {/*<SummaryRow label="Total Stake" value={`${totalStake} $VOLT`} />*}
                    <SummaryRow label="Total Stake" value={formatTokenInputPreview((Number(betForm.diceAmount || 0) + Number(betForm.parityAmount || 0)).toString())} />
                    {/*<SummaryRow label="ETH Equivalent" value={`${((convertUsdToEthAmount(betForm.diceAmount, ethUsdPrice) || 0) + (convertUsdToEthAmount(betForm.parityAmount, ethUsdPrice) || 0)).toFixed(6)} ETH`} />*}
                    <SummaryRow label="Selected Dice" value={`${betForm.dice}`} />
                    <SummaryRow label="Selected Parity" value={betForm.parityEven ? "EVEN" : "ODD"} />
                  </div>
                </div>

                <button
                  onClick={() =>
                    writeContract(
                      async (contract, signer) => {
                        const diceAmount = parseTokenAmount(betForm.diceAmount);
                        const parityAmount = parseTokenAmount(betForm.parityAmount);
                        const totalAmount = diceAmount + parityAmount;
                        if (totalAmount <= 0n) throw new Error("Enter a VOLT amount");
                        await approveVoltIfNeeded(signer, totalAmount);
                        return contract.placeBet(BigInt(betForm.dice), betForm.parityEven, diceAmount, parityAmount);
                      },
                      "Submitting combo bet...",
                      "Combo bet placed."
                    )
                  }
                  className="glow-primary w-full bg-primary py-4 font-headline text-base font-black uppercase tracking-tight text-on-primary transition-all active:scale-95 sm:py-5 sm:text-xl sm:tracking-tighter"
                >
                  Place Combo Bet
                </button>
              </section>
            </div>*/
          ) : null}

        </section>
      </main>
    </>
  );
}

function getEthUsdStatusMessage(status, ethUsdPrice) {
  if (status === "ready" && ethUsdPrice) {
    return `ETH/USD: ${formatUsdValue(ethUsdPrice)}`;
  }
  if (status === "loading") {
    return "Loading ETH/USD price...";
  }
  if (status === "missing_config") {
    return "Missing Chainlink feed or Base Sepolia RPC configuration";
  }
  if (status === "error") {
    return "Chainlink price fetch failed. Check console for details.";
  }
  return "Price status unavailable";
}

function WalletPage({ snapshot, snapshotLoading, approveVoltIfNeeded, writeContract, walletConnected, roundCountdown, roundCountdownLabel }) {
  return (
    <>
      <StatusStrip snapshot={snapshot} walletConnected={walletConnected} roundCountdown={roundCountdown} roundCountdownLabel={roundCountdownLabel} snapshotLoading={snapshotLoading} />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-4 sm:space-y-8 sm:py-6">
        

        <section className="grid gap-6 lg:grid-cols-2">
          <section className="border border-outline-variant bg-surface-container-high p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400">ev_station</span>
                <h3 className="font-headline text-sm font-bold uppercase sm:text-lg">Wallet Funding</h3>
              </div>
              <span className="bg-emerald-500/10 px-2 py-1 font-mono text-[8px] uppercase text-emerald-400">Operational</span>
            </div>
            <div className="mt-4 space-y-4 sm:mt-6 sm:space-y-5">
              <div className="border border-outline-variant bg-surface-container-low p-3 text-sm text-outline">
                Set how much $VOLT VoltSonic is allowed to use from your wallet. The tokens remain in your wallet until you actually place a bet.
              </div>
              <InlineAction
                label="Set Wallet Spend Limit"
                placeholder="0.00"
                buttonLabel="Enable Spend"
                buttonClass="border-emerald-500/40 text-emerald-300 hover:border-emerald-400 hover:text-emerald-200"
                valuePrefix="$"
                previewLabel="Spend Limit"
                previewValue={(value) => formatTokenInputPreview(value)}
                subnote={snapshotLoading ? "Loading spend limit..." : `Current spend limit: ${snapshot.tokenAllowance}`}
                onAction={(value) =>
                  writeContract(
                    async (_contract, signer) => {
                      const amount = parseTokenAmount(value);
                      if (amount <= 0n) throw new Error("Enter a VOLT amount");
                      const tokenContract = new ethers.Contract(snapshot.tokenAddress, VOLT_ERC20_ABI, signer);
                      return tokenContract.approve(CONTRACT_ADDRESS, amount);
                    },
                    "Updating wallet spend limit...",
                    "Wallet spend limit updated."
                  )
                }
              />
              <div className="border border-outline-variant bg-surface-container-highest p-3 sm:p-4">
                {snapshotLoading ? (
                  <>
                    <SummaryRowSkeleton />
                    <SummaryRowSkeleton topMargin />
                    <SummaryRowSkeleton topMargin />
                  </>
                ) : (
                  <>
                    <SummaryRow label="Available Wallet Credit" value={snapshot.credits} />
                    <SummaryRow label="VoltSonic Spend Limit" value={snapshot.tokenAllowance} topMargin />
                    <SummaryRow label="VOLT Token" value={shortAddress(snapshot.tokenAddress)} topMargin />
                  </>
                )}
              </div>
            </div>
          </section>

          <section className="border border-outline-variant bg-surface-container-high p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">toll</span>
                <h3 className="font-headline text-sm font-bold uppercase sm:text-lg">Claim Center</h3>
              </div>
              <span className="font-mono text-[9px] text-outline sm:text-[10px]">{snapshotLoading ? "Loading..." : snapshot.latestSettledRound || "--"}</span>
            </div>
            <div className="mt-4 space-y-4 sm:mt-6">
              <div className="border border-outline-variant bg-surface-container-highest p-3 sm:p-4">
                {snapshotLoading ? (
                  <>
                    <SummaryRowSkeleton />
                    <SummaryRowSkeleton topMargin />
                    <SummaryRowSkeleton topMargin />
                  </>
                ) : (
                  <>
                    <SummaryRow label="Pool Reward" value={snapshot.claimPoolReward} />
                    <SummaryRow label="Jackpot Reward" value={snapshot.claimJackpotReward} topMargin />
                    <SummaryRow label="House Fee" value={snapshot.claimFee} topMargin error />
                  </>
                )}
              </div>
              <div className="border-l-4 border-primary bg-surface-container-low p-3 sm:p-4">
                <div className="font-mono text-[9px] uppercase text-outline sm:text-[10px]">Net Claimable</div>
                {snapshotLoading ? (
                  <SkeletonText width="w-32" className="mt-2 h-8" />
                ) : (
                  <div className="mt-2 text-xl font-headline font-black text-primary sm:text-3xl">{snapshot.claimNet}</div>
                )}
              </div>
              <button
                onClick={() =>
                  writeContract(
                    (contract) => contract.claim(BigInt(snapshot.latestSettledRound.replace("#", "") || "0")),
                    "Claiming winnings...",
                    "Claim complete."
                  )
                }
                disabled={snapshotLoading || !snapshot.latestSettledRound}
                className="w-full bg-emerald-500 py-3.5 font-headline text-sm font-black uppercase tracking-tight text-white transition-all hover:bg-emerald-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:py-4 sm:text-lg sm:tracking-tighter"
              >
                Claim Winnings
              </button>
            </div>
          </section>
        </section>
      </main>
    </>
  );
}

function BetHistoryCard({ bet }) {
  const outcomeStyles = getOutcomeStyles(bet.result);
  const totalStake = BigInt(bet.diceAmount) + BigInt(bet.parityAmount);

  return (
    <article className={`border bg-surface-container-high p-4 sm:p-5 ${outcomeStyles.accent}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-headline text-base font-bold uppercase sm:text-lg">Round #{bet.roundId}</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.24em] text-outline">
            {bet.settled ? "Closed Bet" : "Open Bet"}
          </div>
        </div>
        <span className={`border px-2 py-1 font-mono text-[10px] uppercase ${outcomeStyles.badge}`}>
          {formatOutcomeLabel(bet.result)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="border border-outline-variant bg-surface-container-highest p-3">
          <div className="font-mono text-[9px] uppercase text-outline">Selections</div>
          <div className="mt-2 space-y-2 text-sm text-on-surface">
            {bet.betOnDice ? <div>Dice: {bet.diceChoice}</div> : null}
            {bet.betOnParity ? <div>Parity: {bet.parityChoice}</div> : null}
          </div>
        </div>
        <div className="border border-outline-variant bg-surface-container-highest p-3">
          <div className="font-mono text-[9px] uppercase text-outline">Stake</div>
          <div className="mt-2 space-y-2 text-sm text-on-surface">
            {bet.betOnDice ? <div>Dice Pool: {formatVolt(bet.diceAmount)}</div> : null}
            {bet.betOnParity ? <div>Parity Pool: {formatVolt(bet.parityAmount)}</div> : null}
            <div className="font-bold text-primary">Total: {formatVolt(totalStake)}</div>
          </div>
        </div>
      </div>

      {bet.settled ? (
        <div className="mt-3 border border-outline-variant bg-surface-container-highest p-3">
          <div className="font-mono text-[9px] uppercase text-outline">Round Result</div>
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-on-surface">
            <span>Dice Result: {bet.diceResult}</span>
            {/*<span>Parity Result: {bet.parityResult}</span>*/}
            {bet.result !== "lost" ? <span className="text-emerald-400">{bet.claimed ? "Winnings claimed" : "Winning bet"}</span> : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function ClosedBetListItem({ bet }) {
  const outcomeStyles = getOutcomeStyles(bet.result);
  const totalStake = BigInt(bet.diceAmount) + BigInt(bet.parityAmount);

  return (
    <li className="border-b border-outline-variant last:border-b-0">
      <article className="bg-surface-container-high px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="font-headline text-sm font-bold uppercase sm:text-base">Round #{bet.roundId}</div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.24em] text-outline">
              Closed Bet
            </div>
          </div>
          <span className={`w-fit border px-2 py-1 font-mono text-[10px] uppercase ${outcomeStyles.badge}`}>
            {formatOutcomeLabel(bet.result)}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <div className="font-mono text-[9px] uppercase text-outline">Selections</div>
            <div className="mt-2 space-y-1 text-sm text-on-surface">
              {bet.betOnDice ? <div>Dice: {bet.diceChoice}</div> : null}
              {bet.betOnParity ? <div>Parity: {bet.parityChoice}</div> : null}
            </div>
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase text-outline">Outcome</div>
            <div className="mt-2 space-y-1 text-sm text-on-surface">
              <div>Dice Result: {bet.diceResult ?? "--"}</div>
              <div>Parity Result: {bet.parityResult}</div>
            </div>
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase text-outline">Stake</div>
            <div className="mt-2 space-y-1 text-sm text-on-surface">
              {bet.betOnDice ? <div>Dice Pool: {formatVolt(bet.diceAmount)}</div> : null}
              {bet.betOnParity ? <div>Parity Pool: {formatVolt(bet.parityAmount)}</div> : null}
              <div className="font-bold text-primary">Total: {formatVolt(totalStake)}</div>
            </div>
          </div>
        </div>
      </article>
    </li>
  );
}

function BetsPage({ snapshot, snapshotLoading, betHistory, betHistoryLoading, walletConnected, roundCountdown, roundCountdownLabel }) {
  const openBets = betHistory.filter((bet) => bet.result === "open");
  const closedBets = betHistory.filter((bet) => bet.result !== "open");

  return (
    <>
      <StatusStrip snapshot={snapshot} walletConnected={walletConnected} roundCountdown={roundCountdown} roundCountdownLabel={roundCountdownLabel} snapshotLoading={snapshotLoading} />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-4 sm:space-y-8 sm:py-6">
        <HeroPanel
          snapshot={snapshot}
          snapshotLoading={snapshotLoading}
          title=""
          copy=""
          icon="receipt_long"
        />

        <section className="space-y-4">
          <div className="flex items-end justify-between px-2">
            <div>
              <h2 className="font-headline text-base font-bold uppercase tracking-tight sm:text-xl">Bet Ledger</h2>
              <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-secondary sm:text-[10px] sm:tracking-[0.3em]">
                {walletConnected ? "Open bets and closed bets for the connected wallet" : "Live open bets and recent closed bets across VoltSonic"}
              </span>
            </div>
            <span className="font-mono text-[10px] uppercase text-outline">{betHistoryLoading ? "Loading..." : `${betHistory.length} total`}</span>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-headline text-sm font-bold uppercase sm:text-lg">Open Bets</h3>
                <span className="border border-secondary/30 bg-secondary/10 px-2 py-1 font-mono text-[10px] uppercase text-secondary">
                  {openBets.length}
                </span>
              </div>
              {betHistoryLoading ? (
                Array.from({ length: 2 }, (_, index) => (
                  <div key={`open-skeleton-${index}`} className="border border-outline-variant bg-surface-container-high p-5">
                    <SkeletonText width="w-28" className="h-5" />
                    <SkeletonText width="w-20" className="mt-2 h-3" />
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <SkeletonBlock className="h-24 w-full" />
                      <SkeletonBlock className="h-24 w-full" />
                    </div>
                  </div>
                ))
              ) : openBets.length > 0 ? (
                openBets.map((bet) => <BetHistoryCard key={bet.id} bet={bet} />)
              ) : (
                <div className="border border-outline-variant bg-surface-container-high p-5 text-sm text-outline">
                  {walletConnected ? "No open bets yet." : "No live open bets yet."}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-headline text-sm font-bold uppercase sm:text-lg">Closed Bets</h3>
                <span className="border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-[10px] uppercase text-primary">
                  {closedBets.length}
                </span>
              </div>
              {betHistoryLoading ? (
                Array.from({ length: 2 }, (_, index) => (
                  <div key={`closed-skeleton-${index}`} className="border border-outline-variant bg-surface-container-high p-5">
                    <SkeletonText width="w-28" className="h-5" />
                    <SkeletonText width="w-20" className="mt-2 h-3" />
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <SkeletonBlock className="h-24 w-full" />
                      <SkeletonBlock className="h-24 w-full" />
                    </div>
                  </div>
                ))
              ) : closedBets.length > 0 ? (
                <ul className="max-h-[32rem] overflow-y-auto border border-outline-variant bg-surface-container-high">
                  {closedBets.map((bet) => <ClosedBetListItem key={bet.id} bet={bet} />)}
                </ul>
              ) : (
                <div className="border border-outline-variant bg-surface-container-high p-5 text-sm text-outline">
                  {walletConnected ? "No closed bets yet." : "No recent closed bets yet."}
                </div>
              )}
            </section>
          </div>
        </section>
      </main>
    </>
  );
}

function RoundsPage({ snapshot, snapshotLoading, roundFeed, walletConnected, roundCountdown, roundCountdownLabel }) {
  return (
    <>
      <StatusStrip snapshot={snapshot} walletConnected={walletConnected} roundCountdown={roundCountdown} roundCountdownLabel={roundCountdownLabel} snapshotLoading={snapshotLoading} />
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-6">
        <HeroPanel
          snapshot={snapshot}
          snapshotLoading={snapshotLoading}
          title="Treasury visibility and round history have their own route."
          copy="This route is dedicated to watching contract balance, jackpot state, contribution totals, and recent round activity."
          icon="leaderboard"
        />

        <section className="grid gap-6 lg:grid-cols-2">
          <section className="border border-outline-variant bg-surface-container-high p-6">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">account_balance</span>
              <h3 className="font-headline text-lg font-bold uppercase">Treasury Metrics</h3>
            </div>
            <div className="mt-6 space-y-3">
              <MetricCard label="Contract VOLT" value={snapshotLoading ? <SkeletonText width="w-28" className="h-6" /> : snapshot.contractBalance} />
              <MetricCard label="Tracked Vault VOLT" value={snapshotLoading ? <SkeletonText width="w-28" className="h-6" /> : snapshot.redeemableCredits} />
              <MetricCard label="Total VOLT Inflow" value={snapshotLoading ? <SkeletonText width="w-28" className="h-6" /> : snapshot.totalEthContributed} />
              <MetricCard label="Jackpot VOLT" value={snapshotLoading ? <SkeletonText width="w-28" className="h-6" /> : snapshot.jackpotBalance} accent />
            </div>
          </section>

          <section className="border border-outline-variant bg-surface-container-high p-6">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">casino</span>
              <h3 className="font-headline text-lg font-bold uppercase">Round Feed</h3>
            </div>
            <div className="mt-6 space-y-3">
              {snapshotLoading
                ? Array.from({ length: 3 }, (_, index) => (
                    <div key={`round-feed-skeleton-${index}`} className="border border-outline-variant bg-surface-container-highest p-4">
                      <div className="flex items-center justify-between">
                        <SkeletonText width="w-28" className="h-4" />
                        <SkeletonText width="w-16" className="h-3" />
                      </div>
                      <SkeletonText width="w-full" className="mt-3 h-3" />
                      <SkeletonText width="w-5/6" className="mt-2 h-3" />
                    </div>
                  ))
                : roundFeed.map((card) => (
                    <div key={card.title} className="border border-outline-variant bg-surface-container-highest p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-on-surface">{card.title}</span>
                        <span className={`font-mono text-[10px] uppercase ${card.stateClass}`}>{card.state}</span>
                      </div>
                      <div className="mt-2 text-sm text-outline">{card.body}</div>
                    </div>
                  ))}
            </div>
          </section>
        </section>
      </main>
    </>
  );
}

function AdminPage({ snapshot, adminForm, setAdminForm, roundFeed, approveVoltIfNeeded, writeContract, account }) {
  const bettingStateStyles = getBettingStateStyles(snapshot.bettingOpen);

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-6">
      <HeroPanel
        snapshot={snapshot}
        title="Manage rounds, treasury actions, and jackpot operations from a dedicated console."
        copy="This route stays isolated from the player routes, while still using the same uniform header and navigation shell."
        icon="admin_panel_settings"
      />

      <section className="grid gap-8 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
          <section className="border border-outline-variant bg-surface-container-high p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`material-symbols-outlined ${bettingStateStyles.iconClass}`}>power_settings_new</span>
                <h3 className="font-headline text-lg font-bold uppercase">Betting Control</h3>
              </div>
              <span className={`px-2 py-1 font-mono text-[8px] uppercase ${snapshot.bettingOpen ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                {snapshot.bettingOpen ? "Open" : "Closed"}
              </span>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <button
                onClick={() => writeContract((contract) => contract.setBettingOpen(true), "Opening betting...", "Betting opened.")}
                className="bg-emerald-500 px-4 py-4 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-emerald-400"
              >
                Open Betting
              </button>
              <button
                onClick={() => writeContract((contract) => contract.setBettingOpen(false), "Closing betting...", "Betting closed.")}
                className="border border-rose-500/40 bg-surface-container-highest px-4 py-4 text-sm font-bold uppercase tracking-widest text-rose-300 transition-colors hover:border-rose-400 hover:text-rose-200"
              >
                Close Betting
              </button>
            </div>
          </section>

          <section className="border border-outline-variant bg-surface-container-high p-6">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">account_balance_wallet</span>
              <h3 className="font-headline text-lg font-bold uppercase">Fee Recipient</h3>
            </div>
            <div className="mt-6 border border-outline-variant bg-surface-container-highest p-4">
              <label className="mb-2 block font-mono text-[10px] uppercase text-outline">House Fee Recipient Address</label>
              <p className="mb-4 text-sm text-outline">
                Set where house fees from bet settlements are sent. If not set, fees default to the owner address.
              </p>
              <div className="flex gap-3 flex-col sm:flex-row">
                <input
                  value={adminForm.houseFeeRecipient}
                  onChange={(event) => setAdminForm((current) => ({ ...current, houseFeeRecipient: event.target.value }))}
                  className="flex-1 border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface focus:border-primary focus:ring-0"
                  type="text"
                  placeholder="0x..."
                />
                <button
                  onClick={() =>
                    writeContract(
                      (contract) => {
                        if (!ethers.isAddress(adminForm.houseFeeRecipient)) throw new Error("Invalid address format");
                        if (adminForm.houseFeeRecipient === ethers.ZeroAddress) throw new Error("Address cannot be zero address");
                        return contract.setHouseFeeRecipient(adminForm.houseFeeRecipient);
                      },
                      "Setting house fee recipient...",
                      "House fee recipient updated."
                    )
                  }
                  className="border border-outline-variant bg-surface-container-high px-6 py-3 text-xs font-bold uppercase transition-colors hover:border-primary hover:text-primary sm:min-w-max"
                >
                  Set Recipient
                </button>
              </div>
            </div>
          </section>

          <section className="border border-outline-variant bg-surface-container-high p-6">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">casino</span>
              <h3 className="font-headline text-lg font-bold uppercase">Round Settlement</h3>
            </div>
            <div className="mt-6 border border-outline-variant bg-surface-container-highest p-4">
              <label className="mb-2 block font-mono text-[10px] uppercase text-outline">Request randomness for the current closed round</label>
              <p className="mb-4 text-sm text-outline">
                The contract no longer accepts an admin-supplied dice result. This action only requests settlement; the VRF callback is what finalizes the round outcome.
              </p>
              <button
                onClick={() =>
                  writeContract(
                    (contract) => contract.requestRoundSettlement(),
                    "Requesting round settlement...",
                    "Settlement request submitted."
                  )
                }
                className="border border-outline-variant bg-surface-container-high px-4 py-3 text-xs font-bold uppercase transition-colors hover:border-primary hover:text-primary"
              >
                Request Settlement
              </button>
            </div>
          </section>

          <section className="border border-outline-variant bg-surface-container-high p-6">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">paid</span>
              <h3 className="font-headline text-lg font-bold uppercase">Jackpot Funding</h3>
            </div>
            <div className="mt-6 border border-outline-variant bg-surface-container-highest p-4">
              <label className="mb-2 block font-mono text-[10px] uppercase text-outline">Seed Jackpot With VOLT</label>
              <div className="flex gap-3">
                <input
                  value={adminForm.jackpotSeed}
                  onChange={(event) => setAdminForm((current) => ({ ...current, jackpotSeed: event.target.value }))}
                  className="w-full border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface focus:border-primary focus:ring-0"
                  type="number"
                  placeholder="VOLT amount"
                />
                <button
                  onClick={() =>
                    writeContract(
                      async (contract, signer) => {
                        const amount = parseTokenAmount(adminForm.jackpotSeed);
                        if (amount <= 0n) throw new Error("Enter a VOLT amount");
                        await approveVoltIfNeeded(signer, amount);
                        return contract.seedJackpot(amount);
                      },
                      "Funding jackpot...",
                      "Jackpot funded."
                    )
                  }
                  className="border border-outline-variant bg-surface-container-high px-4 py-3 text-xs font-bold uppercase transition-colors hover:border-primary hover:text-primary"
                >
                  Fund Jackpot
                </button>
              </div>
            </div>
          </section>

          <section className="border border-outline-variant bg-surface-container-high p-6">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">tune</span>
              <h3 className="font-headline text-lg font-bold uppercase">Contract Parameters</h3>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="border border-outline-variant bg-surface-container-highest p-4">
                <label className="mb-2 block font-mono text-[10px] uppercase text-outline">Minimum Bet</label>
                <div className="flex gap-3">
                  <input
                    value={adminForm.minBet}
                    onChange={(event) => setAdminForm((current) => ({ ...current, minBet: event.target.value }))}
                    className="w-full border border-outline-variant bg-surface-container-high px-4 py-3 text-sm text-on-surface focus:border-primary focus:ring-0"
                    type="number"
                    placeholder="0.0004"
                  />
                  <button
                    onClick={() =>
                      writeContract(
                        (contract) => contract.setMinBet(ethers.parseEther(adminForm.minBet || "0")),
                        "Updating minimum bet...",
                        "Minimum bet updated."
                      )
                    }
                    className="border border-outline-variant bg-surface-container-high px-4 py-3 text-xs font-bold uppercase transition-colors hover:border-primary hover:text-primary"
                  >
                    Update
                  </button>
                </div>
              </div>
              <div className="border border-outline-variant bg-surface-container-highest p-4">
                <div className="font-mono text-[10px] uppercase text-outline">Ownership</div>
                <div className="mt-3 break-all text-sm text-on-surface-variant">{snapshot.owner}</div>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="border border-outline-variant bg-surface-container-high p-6">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">analytics</span>
              <h3 className="font-headline text-lg font-bold uppercase">Admin Metrics</h3>
            </div>
            <div className="mt-6 space-y-3">
              <MetricCard label="Total VOLT Inflow" value={snapshot.totalEthContributed} />
              <MetricCard label="Tracked Vault VOLT" value={snapshot.redeemableCredits} />
              <MetricCard label="Current Jackpot VOLT" value={snapshot.jackpotBalance} accent />
              <MetricCard label="Owner Wallet" value={account ? shortAddress(account) : "Not connected"} />
            </div>
          </section>

          <section className="border border-outline-variant bg-surface-container-high p-6">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">history</span>
              <h3 className="font-headline text-lg font-bold uppercase">Round Activity</h3>
            </div>
            <div className="mt-6 space-y-3">
              {roundFeed.map((card) => (
                <div key={card.title} className="border border-outline-variant bg-surface-container-highest p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-on-surface">{card.title}</span>
                    <span className={`font-mono text-[10px] uppercase ${card.stateClass}`}>{card.state}</span>
                  </div>
                  <div className="mt-2 text-sm text-outline">{card.body}</div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

export default function App() {
  const voltsonic = useVoltSonic();
  const commonShellProps = {
    account: voltsonic.account,
    connectWallet: voltsonic.connectWallet,
    switchWallet: voltsonic.switchWallet,
    networkName: voltsonic.networkName,
    statusMessage: voltsonic.statusMessage,
    toasts: voltsonic.toasts,
    resultModal: voltsonic.resultModal,
    dismissToast: voltsonic.dismissToast,
    dismissResultModal: voltsonic.dismissResultModal,
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Shell {...commonShellProps} title="VOLTSONIC" icon="bolt">
            <GamePage
              snapshot={voltsonic.snapshot}
              snapshotLoading={voltsonic.snapshotLoading}
              betForm={voltsonic.betForm}
              setBetForm={voltsonic.setBetForm}
              approveVoltIfNeeded={voltsonic.approveVoltIfNeeded}
              writeContract={voltsonic.writeContract}
              walletConnected={Boolean(voltsonic.account)}
              roundCountdown={voltsonic.roundCountdown}
              roundCountdownLabel={voltsonic.roundCountdownLabel}
              ethUsdPrice={voltsonic.ethUsdPrice}
              ethUsdStatus={voltsonic.ethUsdStatus}
            />
          </Shell>
        }
      />
      <Route
        path="/wallet"
        element={
          <Shell {...commonShellProps} title="VOLTSONIC" icon="bolt">
            <WalletPage
              snapshot={voltsonic.snapshot}
              snapshotLoading={voltsonic.snapshotLoading}
              approveVoltIfNeeded={voltsonic.approveVoltIfNeeded}
              writeContract={voltsonic.writeContract}
              walletConnected={Boolean(voltsonic.account)}
              roundCountdown={voltsonic.roundCountdown}
              roundCountdownLabel={voltsonic.roundCountdownLabel}
              ethUsdPrice={voltsonic.ethUsdPrice}
              ethUsdStatus={voltsonic.ethUsdStatus}
            />
          </Shell>
        }
      />
      <Route
        path="/bets"
        element={
          <Shell {...commonShellProps} title="VOLTSONIC" icon="bolt">
            <BetsPage
              snapshot={voltsonic.snapshot}
              snapshotLoading={voltsonic.snapshotLoading}
              betHistory={voltsonic.betHistory}
              betHistoryLoading={voltsonic.betHistoryLoading}
              walletConnected={Boolean(voltsonic.account)}
              roundCountdown={voltsonic.roundCountdown}
              roundCountdownLabel={voltsonic.roundCountdownLabel}
            />
          </Shell>
        }
      />
      <Route
        path="/rounds"
        element={
          <Shell {...commonShellProps} title="VOLTSONIC" icon="bolt">
            <RoundsPage
              snapshot={voltsonic.snapshot}
              snapshotLoading={voltsonic.snapshotLoading}
              roundFeed={voltsonic.roundFeed}
              walletConnected={Boolean(voltsonic.account)}
              roundCountdown={voltsonic.roundCountdown}
              roundCountdownLabel={voltsonic.roundCountdownLabel}
            />
          </Shell>
        }
      />
      <Route
        path="/admin"
        element={
          <Shell {...commonShellProps} title="VOLTSONIC" icon="bolt">
            <AdminPage
              snapshot={voltsonic.snapshot}
              adminForm={voltsonic.adminForm}
              setAdminForm={voltsonic.setAdminForm}
              roundFeed={voltsonic.roundFeed}
              approveVoltIfNeeded={voltsonic.approveVoltIfNeeded}
              writeContract={voltsonic.writeContract}
              account={voltsonic.account}
            />
          </Shell>
        }
      />
    </Routes>
  );
}
