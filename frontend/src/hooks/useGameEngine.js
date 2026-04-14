const BETTING_DURATION = 20_000;
const LOCK_DURATION = 10_000;
const RESOLVE_DURATION = 3_000;
const PLATFORM_FEE = 0.05;
const JACKPOT_PORTION = 0.01;

const PLAYER_NAMES = [
  "Whale_81", "CryptoKing", "DiceMaster", "Player_204", "Moonshot",
  "DiamondHands", "Ape_42", "Degen_99", "LuckyStar", "BlockBuster",
  "HashHero", "ChainWolf", "NeonTrader", "VRF_Viking", "MegaBet",
  "SatoshiFan", "GweiGuru", "RektProof", "AlphaHunter", "Player_777",
];

function randomPlayer() {
  return PLAYER_NAMES[Math.floor(Math.random() * PLAYER_NAMES.length)];
}

function createFreshRound(roundId, prevJackpot) {
  return {
    roundId,
    phase: "betting",
    phaseEndTime: Date.now() + BETTING_DURATION,
    dicePools: [0, 0, 0, 0, 0, 0, 0],
    diceTotalPool: 0,
    evenPool: 0,
    oddPool: 0,
    parityTotalPool: 0,
    diceResult: null,
    parityResult: null,
    jackpotPool: prevJackpot,
    jackpotWinners: 0,
    currentStreak: 0,
  };
}

export function useGameEngine() {
  const [round, setRound] = useState(() =>
    createFreshRound(1, 2.45)
  );
  const [streak, setStreak] = useState(0);
  const [betFeed, setBetFeed] = useState([]);
  const [bigWin, setBigWin] = useState(null);
  const [roundHistory, setRoundHistory] = useState(() => {
    // Seed with some initial history
    const seed = [];
    for (let i = 10; i >= 1; i--) {
      seed.push({
        roundId: i,
        diceResult: Math.floor(Math.random() * 6) + 1,
        parityResult: Math.random() > 0.5 ? "even" : "odd",
        totalPool: Number((Math.random() * 10 + 2).toFixed(2)),
        jackpotWon: Math.random() < 0.1,
      });
    }
    return seed.reverse();
  });
  const roundRef = useRef(round);
  roundRef.current = round;

  const addBetToFeed = useCallback((gameType, pick, amount, player) => {
    const item = {
      id: `${Date.now()}-${Math.random()}`,
      player: player || randomPlayer(),
      amount,
      gameType,
      pick,
      timestamp: Date.now(),
    };
    setBetFeed((prev) => [item, ...prev].slice(0, 20));
  }, []);

  const triggerBigWin = useCallback((player, amount) => {
    setBigWin({ id: `${Date.now()}`, player, amount, timestamp: Date.now() });
    setTimeout(() => setBigWin(null), 4000);
  }, []);

  // Phase progression
  useEffect(() => {
    const tick = setInterval(() => {
      const now = Date.now();
      setRound((prev) => {
        if (now < prev.phaseEndTime) return prev;

        if (prev.phase === "betting") {
          return { ...prev, phase: "locked", phaseEndTime: now + LOCK_DURATION };
        }

        if (prev.phase === "locked") {
          const diceResult = Math.floor(Math.random() * 6) + 1;
          const parityResult = Math.random() > 0.5 ? "even" : "odd";

          // Simulate big win on resolve
          if (Math.random() < 0.3) {
            const winAmount = Number((Math.random() * 12 + 2).toFixed(1));
            triggerBigWin(randomPlayer(), winAmount);
          }

          // Add to round history
          const totalPool = prev.diceTotalPool + prev.parityTotalPool;
          setRoundHistory((h) => [
            ...h.slice(-9),
            {
              roundId: prev.roundId,
              diceResult,
              parityResult,
              totalPool: Number(totalPool.toFixed(2)),
              jackpotWon: Math.random() < 0.05,
            },
          ]);

          return {
            ...prev,
            phase: "resolving",
            phaseEndTime: now + RESOLVE_DURATION,
            diceResult,
            parityResult,
          };
        }

        if (prev.phase === "resolving") {
          const totalAllPools = prev.diceTotalPool + prev.parityTotalPool;
          const jackpotAdd = totalAllPools * JACKPOT_PORTION;
          const newJackpot = prev.jackpotPool + jackpotAdd;
          return createFreshRound(prev.roundId + 1, Number(newJackpot.toFixed(4)));
        }

        return prev;
      });
    }, 200);
    return () => clearInterval(tick);
  }, [triggerBigWin]);

  // Simulate other players betting
  useEffect(() => {
    const interval = setInterval(() => {
      setRound((prev) => {
        if (prev.phase !== "betting") return prev;
        const r = Math.random();
        if (r < 0.5) {
          const pick = Math.floor(Math.random() * 6) + 1;
          const amount = Math.round(Math.random() * 50) / 100 + 0.05;
          const newPools = [...prev.dicePools];
          newPools[pick] = Number((newPools[pick] + amount).toFixed(4));
          const newTotal = Number((prev.diceTotalPool + amount).toFixed(4));
          addBetToFeed("dice", String(pick), amount);
          return { ...prev, dicePools: newPools, diceTotalPool: newTotal };
        } else {
          const side = Math.random() > 0.5 ? "even" : "odd";
          const amount = Math.round(Math.random() * 80) / 100 + 0.05;
          addBetToFeed("parity", side.toUpperCase(), amount);
          return {
            ...prev,
            evenPool: Number(
              (prev.evenPool + (side === "even" ? amount : 0)).toFixed(4)
            ),
            oddPool: Number(
              (prev.oddPool + (side === "odd" ? amount : 0)).toFixed(4)
            ),
            parityTotalPool: Number((prev.parityTotalPool + amount).toFixed(4)),
          };
        }
      });
    }, 1500);
    return () => clearInterval(interval);
  }, [addBetToFeed]);

  const placeBet = useCallback((bet) => {
    setRound((prev) => {
      if (prev.phase !== "betting") return prev;

      if (bet.gameType === "dice") {
        const newPools = [...prev.dicePools];
        newPools[bet.pick] = Number((newPools[bet.pick] + bet.amount).toFixed(4));
        addBetToFeed("dice", String(bet.pick), bet.amount, "You");
        return {
          ...prev,
          dicePools: newPools,
          diceTotalPool: Number((prev.diceTotalPool + bet.amount).toFixed(4)),
        };
      } else {
        addBetToFeed("parity", bet.pick.toUpperCase(), bet.amount, "You");
        return {
          ...prev,
          evenPool: Number(
            (prev.evenPool + (bet.pick === "even" ? bet.amount : 0)).toFixed(4)
          ),
          oddPool: Number(
            (prev.oddPool + (bet.pick === "odd" ? bet.amount : 0)).toFixed(4)
          ),
          parityTotalPool: Number(
            (prev.parityTotalPool + bet.amount).toFixed(4)
          ),
        };
      }
    });
  }, [addBetToFeed]);

  const getDiceMultiplier = (pick) => {
    if (round.dicePools[pick] === 0) return 0;
    return Number(
      ((round.diceTotalPool * (1 - PLATFORM_FEE)) / round.dicePools[pick]).toFixed(2)
    );
  };

  const getParityMultiplier = (side) => {
    const sidePool = side === "even" ? round.evenPool : round.oddPool;
    if (sidePool === 0) return 0;
    return Number(
      ((round.parityTotalPool * (1 - PLATFORM_FEE)) / sidePool).toFixed(2)
    );
  };

  return {
    round,
    placeBet,
    getDiceMultiplier,
    getParityMultiplier,
    streak,
    betFeed,
    bigWin,
    roundHistory,
  };
}
