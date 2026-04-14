import { useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Shield, Gift, ArrowUpRight, ArrowDownLeft, Settings, Check, Copy, ExternalLink, Wallet as WalletIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";
import { useVoltSonic, parseTokenAmount, shortAddress } from "./Index.jsx";
import { VOLT_ERC20_ABI } from "@/lib/contract";

const CONTRACT_ADDRESS = import.meta.env.VITE_VOLTSONIC_CONTRACT_ADDRESS || "";
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || "http://127.0.0.1:8000";
const BASESCAN_TOKEN_URL = "https://sepolia.basescan.org/token";
const PRESET_LIMITS = [0.001, 0.00, 250, 500, 1000];

function getSpendLimitStorageKey(account) {
  return account ? `voltsonic:spend-limit:${account.toLowerCase()}` : "";
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

function timeAgo(timestamp) {
  const millis = new Date(timestamp).getTime();
  if (!Number.isFinite(millis)) return "";
  const mins = Math.max(0, Math.floor((Date.now() - millis) / 60000));
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

export default function Wallet() {
  const navigate = useNavigate();
  const {
    snapshot,
    snapshotLoading,
    account,
    backendStatus,
    connectWallet,
    switchWallet,
    writeContract,
  } = useVoltSonic();

  const [customLimit, setCustomLimit] = useState("");
  const [showLimitEditor, setShowLimitEditor] = useState(true);
  const [wins, setWins] = useState([]);
  const [claimingId, setClaimingId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [configuredLimit, setConfiguredLimit] = useState(0);
  const [updatingLimit, setUpdatingLimit] = useState(false);
  const previousBackendStatusRef = useRef(backendStatus);

  useEffect(() => {
    if (previousBackendStatusRef.current !== backendStatus) {
      if (backendStatus === "ready") {
        toast.success("Wallet data is live.");
      } else if (backendStatus === "offline") {
        toast.warning("Backend is offline. Some wallet history may be unavailable.");
      }
      previousBackendStatusRef.current = backendStatus;
    }
  }, [backendStatus]);

  useEffect(() => {
    if (!account) {
      setConfiguredLimit(0);
      return;
    }

    const storedValue = window.localStorage.getItem(getSpendLimitStorageKey(account));
    const parsedValue = Number(storedValue || 0);
    setConfiguredLimit(Number.isFinite(parsedValue) ? parsedValue : 0);
  }, [account]);

  useEffect(() => {
    if (!account || backendStatus !== "ready") {
      setWins([]);
      return;
    }

    let cancelled = false;

    async function loadWins() {
      try {
        const closedBets = await fetchBackendJson(`/api/v1/bets/recent/closed?user_address=${account}&limit=50`);
        if (cancelled) return;

        const nextWins = closedBets
          .filter((bet) => bet.status === "won" || bet.status === "claimed")
          .map((bet) => ({
            id: `${bet.id}-${bet.round_id}`,
            roundId: Number(bet.round_id),
            gameType: bet.bet_on_dice ? "dice" : "bet",
            amount: parseRawTokenAmount(bet.payout_amount),
            timestamp: bet.updated_at || bet.created_at,
            claimed: Boolean(bet.claimed || bet.status === "claimed"),
          }))
          .filter((bet) => bet.amount > 0)
          .sort((a, b) => b.roundId - a.roundId);

        setWins(nextWins);
      } catch {
        if (!cancelled) {
          setWins([]);
          toast.error("Could not load wallet winnings.");
        }
      }
    }

    loadWins();
    const intervalId = window.setInterval(loadWins, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [account, backendStatus]);

  const balance = parseFormattedAmount(snapshot.credits);
  const spendingLimit = parseFormattedAmount(snapshot.tokenAllowance);
  const effectiveConfiguredLimit = Math.max(configuredLimit, spendingLimit);
  const spentThisRound = useMemo(
    () => Math.max(effectiveConfiguredLimit - spendingLimit, 0),
    [effectiveConfiguredLimit, spendingLimit]
  );
  const totalClaimable = useMemo(
    () => wins.filter((win) => !win.claimed).reduce((sum, win) => sum + win.amount, 0),
    [wins]
  );
  const latestClaimRoundId = useMemo(() => {
    const latestRoundLabel = String(snapshot.latestSettledRound || "");
    const numeric = Number(latestRoundLabel.replace("#", ""));
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }, [snapshot.latestSettledRound]);

  const animatedBalance = useAnimatedCounter(balance);
  const animatedClaimable = useAnimatedCounter(totalClaimable);
  const limitUsedPercent = effectiveConfiguredLimit > 0 ? Math.min((spentThisRound / effectiveConfiguredLimit) * 100, 100) : 0;
  const tokenExplorerUrl = snapshot.tokenAddress ? `${BASESCAN_TOKEN_URL}/${snapshot.tokenAddress}` : null;

  const handleClaim = (roundId, id) => {
    setClaimingId(id);
    toast.info(`Submitting claim for round #${roundId}...`);
    writeContract(
      (contract) => contract.claim(BigInt(roundId)),
      `Claiming winnings for round #${roundId}...`,
      `Claim complete for round #${roundId}.`
    );
  };

  const handleClaimLatest = () => {
    if (!latestClaimRoundId) {
      toast.warning("No settled round is ready to claim yet.");
      return;
    }
    setClaimingId("latest");
    toast.info("Submitting latest claim...");
    writeContract(
      (contract) => contract.claim(BigInt(latestClaimRoundId)),
      "Claiming latest winnings...",
      "Latest claim complete."
    );
  };

  const handleSetLimit = async (value) => {
    const stringValue = String(value);
    if (!snapshot.tokenAddress) {
      toast.error("Token contract is not available yet.");
      return;
    }
    if (!account) {
      toast.warning("Connect your wallet before updating the spend limit.");
      return;
    }
    setUpdatingLimit(true);
    toast.info("Updating wallet spend limit...");
    const result = await writeContract(
      async (_contract, signer) => {
        const amount = parseTokenAmount(stringValue);
        if (amount <= 0n) throw new Error("Enter a VOLT amount");
        const tokenContract = new ethers.Contract(snapshot.tokenAddress, VOLT_ERC20_ABI, signer);
        return tokenContract.approve(CONTRACT_ADDRESS, amount);
      },
      "Updating wallet spend limit...",
      "Wallet spend limit updated."
    );
    setUpdatingLimit(false);

    if (result?.ok) {
      const numericValue = Number(stringValue);
      if (Number.isFinite(numericValue) && numericValue >= 0) {
        setConfiguredLimit(numericValue);
        window.localStorage.setItem(getSpendLimitStorageKey(account), String(numericValue));
      }
      setShowLimitEditor(false);
      setCustomLimit("");
    }
  };

  const handleCopyAddress = async () => {
    if (!account) return;
    await navigator.clipboard.writeText(account);
    setCopied(true);
    toast.success("Wallet address copied.");
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background scanline">
      <header className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 ext-[hsl(185_100%_50%)]" />
          <span className="font-black text-lg tracking-tight text-foreground">
            VOLT<span className="text-[hsl(185_100%_50%)]">SONIC</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/game")}
            className="px-3 py-1.5 rounded-lg border border-border bg-muted text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            Dashboard
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={account ? switchWallet : connectWallet}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            <WalletIcon className="w-3.5 h-3.5" />
            {account ? shortAddress(account) : "Connect"}
          </motion.button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-5 space-y-4"
          style={{ boxShadow: "0 0 40px hsl(var(--neon-cyan) / 0.06)" }}
        >
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-mono text-muted-foreground tracking-widest">BALANCE</div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={account ? handleCopyAddress : connectWallet}
              className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md bg-muted"
            >
              <span>{account ? shortAddress(account) : "Connect wallet"}</span>
              {account ? copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" /> : null}
            </motion.button>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black font-mono text-foreground tabular-nums">
              {snapshotLoading ? "0.00000" : animatedBalance.toFixed(5)}
            </span>
            <span className="text-sm font-bold text-[hsl(185_100%_50%)]">$VOLT</span>
          </div>
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={account ? switchWallet : connectWallet}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[15px] bg-primary text-[hsl(185_100%_50%)] text-xs font-bold tracking-wider"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" /> {account ? "SWITCH WALLET" : "CONNECT WALLET"}
            </motion.button>
            {/*<motion.button
              whileTap={{ scale: 0.95 }}
              disabled
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border bg-muted text-foreground text-xs font-bold tracking-wider opacity-60"
            >
              <ArrowUpRight className="w-3.5 h-3.5" /> WITHDRAW
            </motion.button>*/}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-border bg-card p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[hsl(185_100%_50%)]" />
              <span className="text-xs font-bold text-foreground tracking-wide">SPENDING LIMIT</span>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowLimitEditor((current) => !current)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <Settings className="w-4 h-4 text-muted-foreground" />
            </motion.button>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-muted-foreground">
                {spendingLimit.toFixed(4)} remaining
              </span>
              
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${limitUsedPercent}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={`h-full rounded-full ${
                  limitUsedPercent > 80
                    ? "bg-destructive"
                    : limitUsedPercent > 50
                      ? "bg-[hsl(var(--neon-green))]"
                      : "bg-primary"
                }`}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Live ERC-20 allowance remaining after your current open bets
            </p>
          </div>

          <AnimatePresence>
            {showLimitEditor && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-2"
              >
            
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Custom..."
                    value={customLimit}
                    onChange={(event) => setCustomLimit(event.target.value)}
                    className="flex-1 bg-muted border border-[hsl(230_20%_18%)] rounded-lg px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleSetLimit(customLimit)}
                    disabled={!parseFloat(customLimit) || !snapshot.tokenAddress || updatingLimit}
                    className="px-3 py-1.5 rounded-[var(0.75rem)] bg-[hsl(185_100%_50%)] text-[hsl(230_25%_7%)] text-xs font-bold disabled:opacity-30"
                  >
                    {updatingLimit ? "WAIT..." : "SET"}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-border bg-card p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-[hsl(var(--neon-green))]" />
              <span className="text-xs font-bold text-foreground tracking-wide">CLAIM WINNING</span>
            </div>
            {totalClaimable > 0 ? (
              <span className="text-xs font-mono font-bold text-[hsl(var(--neon-green))]">
                +{animatedClaimable.toFixed(5)} $VOLT
              </span>
            ) : null}
          </div>

          {parseFormattedAmount(snapshot.claimNet) > 0 && latestClaimRoundId ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.01 }}
              onClick={handleClaimLatest}
              disabled={claimingId !== null}
              className="w-full py-2.5 rounded-xl text-xs font-bold tracking-wider transition-all disabled:opacity-50 bg-[hsl(var(--neon-green))] text-background"
              style={{ boxShadow: "var(--glow-green)" }}
            >
              {claimingId === "latest" ? "CLAIMING..." : `CLAIM LATEST - ${snapshot.claimNet}`}
            </motion.button>
          ) : null}

          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {wins.length > 0 ? (
              wins.map((win) => (
                <motion.div
                  key={win.id}
                  layout
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors ${
                    win.claimed ? "bg-muted/50 opacity-50" : "bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm">🎲</span>
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        Round #{win.roundId}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        {win.gameType.toUpperCase()} • {timeAgo(win.timestamp)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[hsl(var(--neon-green))]">
                      +{win.amount.toFixed(2)}
                    </span>
                    {win.claimed ? (
                      <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-0.5">
                        <Check className="w-3 h-3" /> Claimed
                      </span>
                    ) : (
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleClaim(win.roundId, win.id)}
                        disabled={claimingId !== null}
                        className="px-2.5 py-1 rounded-lg bg-[hsl(var(--neon-green))] text-background text-[10px] font-bold disabled:opacity-50"
                      >
                        {claimingId === win.id ? "..." : "CLAIM"}
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              ))
            ) : (
              <p className="text-center text-[10px] text-muted-foreground font-mono py-2">
                {account ? "No winning yet." : "Connect your wallet to load wallet activity."}
              </p>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
