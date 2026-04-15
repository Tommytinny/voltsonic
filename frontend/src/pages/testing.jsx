import { useEffect, useState } from "react";
import { VOLTSONIC_ABI } from "@/lib/contract";
import { readContract } from "@/lib/rpc";

const CONTRACT_ADDRESS =
  "0xDbE80d8C7384165Ba4651A6ff6cCa19988BE0145";

export default function Test() {
  const [state, setState] = useState(null);
  const [result, setResult] = useState(null);
  const [pools, setPools] = useState(null);
  const [error, setError] = useState("");

  async function loadData() {
    try {
      const [round, poolStats] = await Promise.all([
        readContract({
          address: CONTRACT_ADDRESS,
          abi: VOLTSONIC_ABI,
          method: "getCurrentRoundState",
          cacheKey: "test:getCurrentRoundState",
          cacheTtlMs: 2_500,
        }),
        readContract({
          address: CONTRACT_ADDRESS,
          abi: VOLTSONIC_ABI,
          method: "getCurrentPoolStats",
          cacheKey: "test:getCurrentPoolStats",
          cacheTtlMs: 2_500,
        }),
      ]);

      let result = null;
      try {
        result = await readContract({
          address: CONTRACT_ADDRESS,
          abi: VOLTSONIC_ABI,
          method: "getRoundSummary",
          args: [round.roundId],
          cacheKey: `test:getRoundSummary:${round.roundId.toString()}`,
          cacheTtlMs: 5_000,
        });
      } catch (err) {
        console.error("Failed to get round summary:", err);
      }

      setState({
        roundId: round.roundId.toString(),
        bettingOpen: round.isBettingOpen,
        jackpot: round.currentJackpot.toString(),
        totalDicePool: result ? result.totalDicePool : 0,
        totalParityPool: result ? result.totalParityPool : 0,
        jackpotWinners: result ? result.totalJackpotWinners : 0,
        diceResult: result ? Number(result.diceResult) : "",
        parityResult: result ? (result.parityResult ? "Even" : "Odd") : "",
        settled: result ? result.settled : false,
        snapshotJackpot: result ? result.snapshotJackpot : 0,
      });

      setPools({
        dice: poolStats.dicePoolAmounts.map((x) => x.toString()),
        even: poolStats.evenPoolAmount.toString(),
        odd: poolStats.oddPoolAmount.toString(),
      });
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load contract");
    }
  }

  useEffect(() => {
    loadData();

    // auto refresh every 5s (important for VRF games)
    const interval = setInterval(loadData, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <h2>VoltSonic Contract Test</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {!state ? (
        <p>Loading...</p>
      ) : (
        <>
          <h3>Round State</h3>
          <p>Round ID: {state.roundId}</p>
          <p>Betting Open: {String(state.bettingOpen)}</p>
          <p>Jackpot: {state.jackpot}</p>

          <h3>Pool Stats</h3>
          <p>Dice Pools: {pools?.dice.join(", ")}</p>
          <p>Even Pool: {pools?.even}</p>
          <p>Odd Pool: {pools?.odd}</p>

          <h3>Result</h3>
          <p>Dice Result: {result?.diceResult}</p>
          <p>Parity Result: {result?.parityResult}</p>
        </>
      )}
    </div>
  );
}
