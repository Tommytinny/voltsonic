import { useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Shield, Gift, ArrowUpRight, ArrowDownLeft, Settings, Check, Copy, ExternalLink, Wallet as WalletIcon, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";
import { useVoltSonic, shortAddress } from "./Index.jsx";
import { WalletConnectModal } from "@/components/game/WalletConnectModal";
import { SHOW_BACKEND_TOASTS } from "@/lib/featureFlags";

const CONTRACT_ADDRESS = import.meta.env.VITE_VOLTSONIC_CONTRACT_ADDRESS || "";
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || "http://127.0.0.1:8000";
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

function WinListSkeleton() {
  return (
    <div className="space-y-1.5 max-h-64 overflow-y-auto">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={`win-skeleton-${index}`}
          className="flex items-center justify-between rounded-xl bg-muted p-3"
        >
          <div className="flex items-center gap-2.5">
            <div className="h-5 w-5 rounded bg-muted-foreground/20 animate-pulse" />
            <div className="space-y-2">
              <div className="h-3 w-20 rounded bg-muted-foreground/20 animate-pulse" />
              <div className="h-2 w-24 rounded bg-muted-foreground/20 animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-14 rounded bg-muted-foreground/20 animate-pulse" />
            <div className="h-7 w-16 rounded-lg bg-muted-foreground/20 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Wallet() {
  const navigate = useNavigate();
  const {
    snapshot,
    snapshotLoading,
    account,
    backendStatus,
    connectWallet,
    disconnectWallet,
    connectors,
    writeContract,
    refreshSnapshot
  } = useVoltSonic();

  const [wins, setWins] = useState([]);
  const [claimingId, setClaimingId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [winsLoading, setWinsLoading] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const previousBackendStatusRef = useRef(backendStatus);
  const hasLoadedWinsRef = useRef(false);

  useEffect(() => {
    if (previousBackendStatusRef.current !== backendStatus) {
      if (SHOW_BACKEND_TOASTS && backendStatus === "ready") {
        toast.success("Wallet data is live.");
      } else if (SHOW_BACKEND_TOASTS && backendStatus === "offline") {
        toast.warning("Server is ofline. Some wallet history may be unavailable.");
      }
      previousBackendStatusRef.current = backendStatus;
    }
  }, [backendStatus]);

  useEffect(() => {
    if (!account || backendStatus !== "ready") {
      hasLoadedWinsRef.current = false;
      setWinsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadWins() {
      try {
        if (!cancelled) setWinsLoading(true);
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
        setWinsLoading(false);
      } catch {
        if (!cancelled) {
          setWinsLoading(false);
          toast.error("Could not load wallet winnings.");
        }
      }
    }

    const shouldLoad = !hasLoadedWinsRef.current;

    if (shouldLoad) {
      loadWins().finally(() => {
        hasLoadedWinsRef.current = true;
      });
    }

    return () => {
      cancelled = true;
    };
  }, [account, backendStatus, snapshot.latestSettledRound, snapshot.claimNet]);

  const balance = parseFormattedAmount(snapshot.credits);
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
  const showWinsSkeleton = snapshotLoading || winsLoading;

  const handleClaim = async (roundId, id) => {
    setClaimingId(id);
    toast.info(`Submitting claim for round #${roundId}...`);
    const result = await writeContract(
      { functionName: "claim", args: [BigInt(roundId)] },
      `Claiming winnings for round #${roundId}...`,
      `Claim complete for round #${roundId}.`
    );

    if (result?.ok) {
      toast.success(`Successfully claimed winnings for round #${roundId}.`);
      setClaimingId(null);
      refreshSnapshot();
    }
  };

  const handleClaimLatest = async () => {
    if (!latestClaimRoundId) {
      toast.warning("No settled round is ready to claim yet.");
      return;
    }
    setClaimingId("latest");
    toast.info("Submitting latest claim...");
    const result = await writeContract(
      { functionName: "claim", args: [BigInt(latestClaimRoundId)] },
      "Claiming latest winnings...",
      "Latest claim complete."
    );

    if (result?.ok) {
      toast.success(`Successfully claimed winnings for round #${latestClaimRoundId}.`);
      setClaimingId(null);
      refreshSnapshot();
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
          <Zap className="w-5 h-5 text-primary" />
          <span className="font-black text-lg tracking-tight text-foreground">
            VOLT<span className="text-primary">SONIC</span>
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
            onClick={() => setWalletModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            <WalletIcon className="w-3.5 h-3.5" />
            {account ? shortAddress(account) : "Connect"}
          </motion.button>
          {account ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={async () => {
                if (await disconnectWallet()) toast.success("Wallet disconnected.");
              }}
              aria-label="Disconnect wallet"
              title="Disconnect wallet"
              className="flex h-9 w-9 items-center justify-center border border-border bg-muted text-muted-foreground transition-colors hover:border-rose-500/50 hover:text-rose-400"
            >
              <LogOut className="h-4 w-4" />
            </motion.button>
          ) : null}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-5 space-y-4"
          style={{ boxShadow: "0 0 40px color-mix(in oklch, var(--primary) 6%, transparent)" }}
        >
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-mono text-muted-foreground tracking-widest">BALANCE</div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={account ? handleCopyAddress : () => setWalletModalOpen(true)}
              className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md bg-muted"
            >
              <span>{account ? shortAddress(account) : "Connect wallet"}</span>
              {account ? copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" /> : null}
            </motion.button>
          </div>
          <div className="flex items-baseline gap-2">
            {snapshotLoading ? (
              <div className="h-10 w-40 rounded bg-muted/60 animate-pulse" />
            ) : (
              <>
                <span className="text-4xl font-black font-mono text-foreground tabular-nums">
                  {animatedBalance.toFixed(5)}
                </span>
                <span className="text-sm font-bold text-primary">ETH</span>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setWalletModalOpen(true)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[15px] bg-primary text-primary-foreground text-xs font-bold tracking-wider"
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
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-foreground tracking-wide">NATIVE ETH BETTING</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Bets are sent directly with each transaction. Keep enough ETH in your wallet for the stake and network gas.
          </p>
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
            {!showWinsSkeleton && totalClaimable > 0 ? (
              <span className="text-xs font-mono font-bold text-[hsl(var(--neon-green))]">
                +{animatedClaimable.toFixed(5)} ETH
              </span>
            ) : null}
          </div>

          {!snapshotLoading && parseFormattedAmount(snapshot.claimNet) > 0 && latestClaimRoundId ? (
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
          ) : snapshotLoading ? (
            <div className="h-10 rounded-xl bg-muted/60 animate-pulse" />
          ) : null}

          {showWinsSkeleton ? (
            <WinListSkeleton />
          ) : (
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
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-[hsl(var(--neon-green))]">
                        +{win.amount.toFixed(5)} ETH
                      </span>
                    </div>
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
          )}
        </motion.div>
      </main>
      <WalletConnectModal
        open={walletModalOpen}
        connectors={connectors}
        onConnect={connectWallet}
        onClose={() => setWalletModalOpen(false)}
      />
    </div>
  );
}
