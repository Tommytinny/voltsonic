import { ethers } from "ethers";
import { parseAbi } from "viem";

export const VOLTSONIC_ABI = [
  "event BetPlaced(address indexed user, uint256 indexed roundId, uint256 diceAmount, uint256 parityAmount, uint256 diceChoice, bool parityChoice)",
  "event WinningsCredited(address indexed user, uint256 indexed roundId, uint256 amount)",
  "function owner() view returns (address)",
  "function totalEthEscrowed() view returns (uint256)",
  "function totalEthContributed() view returns (uint256)",
  "function placeBet(uint256 _diceNum, bool _isEven, uint256 _diceAmount, uint256 _parityAmount) payable",
  "function claim(uint256 _rid)",
  "function setBettingOpen(bool _isOpen)",
  "function setHouseFeeRecipient(address _recipient)",
  "function seedJackpot() payable",
  "function setMinBet(uint256 _newMin)",
  "function getCurrentRoundState() view returns (uint256 roundId, bool isBettingOpen, uint256 totalDicePool, uint256 totalParityPool, uint256 currentJackpot, uint256 minimumBet, uint256 startTime, uint256 closeTime)",
  "function getCurrentPoolStats() view returns (uint256[6] dicePoolAmounts, uint256[6] dicePoolBettors, uint256 evenPoolAmount, uint256 oddPoolAmount, uint256 evenPoolBettors, uint256 oddPoolBettors)",
  "function getUserBet(address _user, uint256 _rid) view returns (uint256 diceChoice, bool parityChoice, uint256 diceAmount, uint256 parityAmount, bool betOnDice, bool betOnParity, bool claimed)",
  "function getRoundSummary(uint256 _rid) view returns (uint256 totalDicePool, uint256 totalParityPool, uint256 totalJackpotWinners, uint256 diceResult, bool parityResult, bool settled, uint256 snapshotJackpot)",
  "function getClaimPreview(address _user, uint256 _rid) view returns (uint256 poolReward, uint256 jackpotReward, uint256 totalFee, uint256 netWinnings, bool claimable)",
];

export const VOLTSONIC_VIEM_ABI = parseAbi([
  "event BetPlaced(address indexed user, uint256 indexed roundId, uint256 diceAmount, uint256 parityAmount, uint256 diceChoice, bool parityChoice)",
  "event WinningsCredited(address indexed user, uint256 indexed roundId, uint256 amount)",
  "function owner() view returns (address)",
  "function totalEthEscrowed() view returns (uint256)",
  "function totalEthContributed() view returns (uint256)",
  "function placeBet(uint256 _diceNum, bool _isEven, uint256 _diceAmount, uint256 _parityAmount) payable",
  "function claim(uint256 _rid)",
  "function setBettingOpen(bool _isOpen)",
  "function setHouseFeeRecipient(address _recipient)",
  "function seedJackpot() payable",
  "function setMinBet(uint256 _newMin)",
]);

export const VOLT_ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

export function formatEth(value) {
  if (value === undefined || value === null) return "0.0000 ETH";
  const formatted = Number(ethers.formatEther(value));
  return `${formatted.toFixed(4)} ETH`;
}

export function mapRoundRecordToCard(round) {
  const roundId = Number(round.round_id);
  const settled = Boolean(round.settled);
  const diceResult = Number(round.dice_result || 0);
  const parity = round.parity_result === null ? "" : round.parity_result ? "Even" : "Odd";
  const dicePool = formatEth(BigInt(round.total_dice_pool || "0"));
  const parityPool = formatEth(BigInt(round.total_parity_pool || "0"));

  return {
    title: `Round #${roundId}`,
    state: settled ? "Settled" : "Open",
    stateClass: settled ? "is-recent" : "is-live",
    body: settled
      ? `Dice ${diceResult}${parity ? ` · ${parity}` : ""} · Pools ${dicePool} dice / ${parityPool} parity`
      : `Round pools: ${dicePool} dice / ${parityPool} parity.`,
  };
}
