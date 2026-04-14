import { useState, useEffect, useCallback } from "react";


function calcMultiplier(totalPool, sidePool) {
  if (sidePool === 0) return 0;
  return Number(((totalPool * 0.95) / sidePool).toFixed(2));
}

export function useMarketData() {
  const [data, setData] = useState<MarketData>(() => {
    const yesLiq = 12.5;
    const noLiq = 8.3;
    const total = yesLiq + noLiq;
    return {
      yesLiquidity: yesLiq,
      noLiquidity: noLiq,
      totalPool: total,
      yesMultiplier: calcMultiplier(total, yesLiq),
      noMultiplier: calcMultiplier(total, noLiq),
      roundEndTime: Date.now() + 120_000,
      isLocked: false,
      roundId: 42,
    };
  });

  // Simulate live on-chain events
  useEffect(() => {
    const interval = setInterval(() => {
      setData((prev) => {
        const side = Math.random() > 0.5 ? "yes" : "no";
        const amount = Math.round(Math.random() * 200) / 100;
        const yesLiq = side === "yes" ? prev.yesLiquidity + amount : prev.yesLiquidity;
        const noLiq = side === "no" ? prev.noLiquidity + amount : prev.noLiquidity;
        const total = yesLiq + noLiq;
        const timeLeft = prev.roundEndTime - Date.now();
        return {
          ...prev,
          yesLiquidity: Number(yesLiq.toFixed(2)),
          noLiquidity: Number(noLiq.toFixed(2)),
          totalPool: Number(total.toFixed(2)),
          yesMultiplier: calcMultiplier(total, yesLiq),
          noMultiplier: calcMultiplier(total, noLiq),
          isLocked: timeLeft < 10_000,
        };
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const placeBet = useCallback((side, amount) => {
    setData((prev) => {
      const yesLiq = side === "yes" ? prev.yesLiquidity + amount : prev.yesLiquidity;
      const noLiq = side === "no" ? prev.noLiquidity + amount : prev.noLiquidity;
      const total = yesLiq + noLiq;
      return {
        ...prev,
        yesLiquidity: Number(yesLiq.toFixed(2)),
        noLiquidity: Number(noLiq.toFixed(2)),
        totalPool: Number(total.toFixed(2)),
        yesMultiplier: calcMultiplier(total, yesLiq),
        noMultiplier: calcMultiplier(total, noLiq),
      };
    });
  }, []);

  return { data, placeBet };
}