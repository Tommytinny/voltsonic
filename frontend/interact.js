import { ethers } from 'ethers';

// Contract details
const CONTRACT_ADDRESS = '0xC1A8d14b5DBF26cBadfa88F287a6687E2bbFD1F1';
const RPC_URL = 'https://rpc.testnet.chain.robinhood.com';

// ABI (simplified for key functions)
const VOLTSONIC_ABI = [
  "function getCurrentRoundState() view returns (uint256 roundId, bool isBettingOpen, uint256 totalDicePool, uint256 totalParityPool, uint256 currentJackpot, uint256 minimumBet, uint256 startTime, uint256 closeTime)",
  "function getCurrentPoolStats() view returns (uint256[6] dicePoolAmounts, uint256[6] dicePoolBettors, uint256 evenPoolAmount, uint256 oddPoolAmount, uint256 evenPoolBettors, uint256 oddPoolBettors)",
  "function getRoundSummary(uint256 _rid) view returns (uint256 totalDicePool, uint256 totalParityPool, uint256 totalJackpotWinners, uint256 diceResult, bool parityResult, bool settled, uint256 snapshotJackpot)",
  "function placeBet(uint256 _diceNum, bool _isEven, uint256 _diceAmount, uint256 _parityAmount)",
  "function claim(uint256 _rid)",
];

async function main() {
  // Create provider
  const provider = new ethers.JsonRpcProvider(RPC_URL, 46630);

  // Create contract instance
  const contract = new ethers.Contract(CONTRACT_ADDRESS, VOLTSONIC_ABI, provider);

  try {
    console.log('Fetching current round state...');
    const roundState = await contract.getCurrentRoundState();
    console.log('Round State:', {
      roundId: roundState.roundId.toString(),
      isBettingOpen: roundState.isBettingOpen,
      totalDicePool: ethers.formatEther(roundState.totalDicePool),
      totalParityPool: ethers.formatEther(roundState.totalParityPool),
      currentJackpot: ethers.formatEther(roundState.currentJackpot),
      minimumBet: ethers.formatEther(roundState.minimumBet),
      startTime: new Date(Number(roundState.startTime) * 1000).toISOString(),
      closeTime: new Date(Number(roundState.closeTime) * 1000).toISOString(),
    });

    // Rate limit: wait 1 second between calls
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\nFetching current pool stats...');
    const poolStats = await contract.getCurrentPoolStats();
    console.log('Pool Stats:', {
      dicePoolAmounts: poolStats.dicePoolAmounts.map(x => ethers.formatEther(x)),
      dicePoolBettors: poolStats.dicePoolBettors,
      evenPoolAmount: ethers.formatEther(poolStats.evenPoolAmount),
      oddPoolAmount: ethers.formatEther(poolStats.oddPoolAmount),
      evenPoolBettors: poolStats.evenPoolBettors,
      oddPoolBettors: poolStats.oddPoolBettors,
    });

    // Rate limit: wait 1 second between calls
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\nFetching round summary for current round...');
    try {
      const roundSummary = await contract.getRoundSummary(roundState.roundId);
      console.log('Round Summary:', {
        totalDicePool: ethers.formatEther(roundSummary.totalDicePool),
        totalParityPool: ethers.formatEther(roundSummary.totalParityPool),
        totalJackpotWinners: roundSummary.totalJackpotWinners.toString(),
        diceResult: roundSummary.diceResult.toString(),
        parityResult: roundSummary.parityResult,
        settled: roundSummary.settled,
        snapshotJackpot: ethers.formatEther(roundSummary.snapshotJackpot),
      });
    } catch (error) {
      console.error('Failed to get round summary:', error.message);
    }

  } catch (error) {
    console.error('Error interacting with contract:', error);
  }
}

main().catch(console.error);