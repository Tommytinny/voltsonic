import { ethers } from "ethers";

export const VOLTSONIC_ABI = [
  "event BetPlaced(address indexed user, uint256 indexed roundId, uint256 diceAmount, uint256 parityAmount, uint256 diceChoice, bool parityChoice)",
  "event WinningsCredited(address indexed user, uint256 indexed roundId, uint256 amount)",
  "function owner() view returns (address)",
  "function voltCredits(address) view returns (uint256)",
  "function totalVaultDeposits() view returns (uint256)",
  "function totalEthContributed() view returns (uint256)",
  "function charge() payable",
  "function discharge(uint256 _amount)",
  "function placeBet(uint256 _diceNum, bool _isEven, uint256 _diceAmount, uint256 _parityAmount)",
  "function claim(uint256 _rid)",
  "function setBettingOpen(bool _isOpen)",
  "function requestRoundSettlement() returns (uint256)",
  "function seedJackpot() payable",
  "function setMinBet(uint256 _newMin)",
  "function getCurrentRoundState() view returns (uint256 roundId, bool isBettingOpen, uint256 totalDicePool, uint256 totalParityPool, uint256 currentJackpot, uint256 minimumBet, uint256 startTime, uint256 closeTime)",
  "function getCurrentPoolStats() view returns (uint256[6] dicePoolAmounts, uint256[6] dicePoolBettors, uint256 evenPoolAmount, uint256 oddPoolAmount, uint256 evenPoolBettors, uint256 oddPoolBettors)",
  "function getUserBet(address _user, uint256 _rid) view returns (uint256 diceChoice, bool parityChoice, uint256 diceAmount, uint256 parityAmount, bool betOnDice, bool betOnParity, bool claimed)",
  "function getRoundSummary(uint256 _rid) view returns (uint256 totalDicePool, uint256 totalParityPool, uint256 totalJackpotWinners, uint256 diceResult, bool parityResult, bool settled, uint256 snapshotJackpot)",
  "function getClaimPreview(address _user, uint256 _rid) view returns (uint256 poolReward, uint256 jackpotReward, uint256 totalFee, uint256 netWinnings, bool claimable)",
  "function getRoundRandomnessState(uint256 _rid) view returns (bool randomnessRequested, bool randomnessFulfilled, uint256 randomnessRequestId)"
];

export function formatEth(value) {
  if (value === undefined || value === null) return "0.0000 ETH";
  const formatted = Number(ethers.formatEther(value));
  return `${formatted.toFixed(4)} ETH`;
}

export function formatVolt(value) {
  if (value === undefined || value === null) return "0.0000 $VOLT";
  const formatted = Number(ethers.formatEther(value));
  return `${formatted.toFixed(4)} $VOLT`;
}

export function getExplorerRoundCards(currentRound) {
  return [
    {
      title: `Current Round ${currentRound}`,
      state: "Live",
      stateClass: "is-live",
      body: "Watch the active round, confirm betting state, and monitor jackpot growth from the main dashboard.",
    },
    {
      title: "Latest Settlement",
      state: "Recent",
      stateClass: "is-recent",
      body: "Use the admin route to request settlement, then let the randomness callback finalize the next outcome.",
    },
    {
      title: "Empty Round Handling",
      state: "Supported",
      stateClass: "is-idle",
      body: "The contract can advance empty rounds, and the automation-ready flow treats that as a normal round transition.",
    },
  ];
}
