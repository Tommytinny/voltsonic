// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {VoltSonic} from "../src/voltsonic.sol";

contract VoltSonicTest is Test {
    VoltSonic internal game;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    receive() external payable {}

    function setUp() public {
        vm.deal(address(this), 100 ether);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        game = new VoltSonic(address(this));
    }

    function testInitializeAllowsCustomOwner() public {
        address customOwner = makeAddr("customOwner");
        VoltSonic customOwnedGame = new VoltSonic(customOwner);
        assertEq(customOwnedGame.owner(), customOwner);
    }

    function testInitializeSetsDefaultValues() public view {
        assertEq(game.owner(), address(this));
        assertEq(game.pendingOwner(), address(0));
        assertEq(game.houseFeePercent(), 2);
        assertEq(game.jackpotSeedPercent(), 20);
        assertEq(game.minBet(), 0.0004 ether);
        assertEq(game.roundDuration(), 3 minutes);
        assertEq(game.intermissionDuration(), 1 minutes);
        assertTrue(game.bettingOpen());
        assertEq(game.currentRid(), 0);
        assertEq(game.jackpotBalance(), 0);
    }

    function testOwnerCanTransferOwnershipInTwoSteps() public {
        game.transferOwnership(alice);

        assertEq(game.owner(), address(this));
        assertEq(game.pendingOwner(), alice);

        vm.prank(alice);
        game.acceptOwnership();

        assertEq(game.owner(), alice);
        assertEq(game.pendingOwner(), address(0));
    }

    function testNonOwnerCannotStartOwnershipTransfer() public {
        vm.prank(alice);
        vm.expectRevert("Ownable: caller is not the owner");
        game.transferOwnership(bob);
    }

    function testOnlyPendingOwnerCanAcceptOwnership() public {
        game.transferOwnership(alice);

        vm.prank(bob);
        vm.expectRevert("Ownable: caller is not the pending owner");
        game.acceptOwnership();
    }

    function testCannotTransferOwnershipToZeroAddress() public {
        vm.expectRevert("Ownable: zero owner");
        game.transferOwnership(address(0));
    }

    function testTotalEthContributedTracksBetAndJackpotInflows() public {
        _placeBet(alice, 2, true, 1 ether, 0);
        _placeBet(bob, 3, false, 1 ether, 0);
        _seedJackpot(0.5 ether);

        assertEq(game.totalEthContributed(), 2.5 ether);
        assertEq(game.totalEthEscrowed(), 2.5 ether);
        assertEq(game.jackpotBalance(), 0.5 ether);
    }

    function testPlaceBetStoresExplicitPerGameAmounts() public {
        _placeBet(alice, 4, true, 1 ether, 0.5 ether);

        (
            uint256 diceChoice,
            bool parityChoice,
            uint256 diceAmount,
            uint256 parityAmount,
            bool betOnDice,
            bool betOnParity,
            bool claimed
        ) = game.userBets(alice, 0);

        assertEq(diceChoice, 4);
        assertTrue(parityChoice);
        assertEq(diceAmount, 1 ether);
        assertEq(parityAmount, 0.5 ether);
        assertTrue(betOnDice);
        assertTrue(betOnParity);
        assertFalse(claimed);
        assertEq(game.totalEthEscrowed(), 1.5 ether);
    }

    function testPlaceBetRequiresExactNativeEthValue() public {
        vm.deal(alice, 2 ether);
        vm.prank(alice);
        vm.expectRevert("Incorrect ETH value");
        game.placeBet{value: 0.9 ether}(4, true, 1 ether, 0);

        vm.deal(alice, 2 ether);
        vm.prank(alice);
        vm.expectRevert("Incorrect ETH value");
        game.placeBet{value: 1.1 ether}(4, true, 1 ether, 0);
    }

    function testGetCurrentRoundStateReturnsFrontendSummary() public {
        _placeBet(alice, 3, false, 1 ether, 0.5 ether);

        (
            uint256 roundId,
            bool isBettingOpen,
            uint256 totalDicePool,
            uint256 totalParityPool,
            uint256 currentJackpot,
            uint256 minimumBet,
            uint256 startTime,
            uint256 closeTime
        ) = game.getCurrentRoundState();

        assertEq(roundId, 0);
        assertTrue(isBettingOpen);
        assertEq(totalDicePool, 1 ether);
        assertEq(totalParityPool, 0.5 ether);
        assertEq(currentJackpot, 0);
        assertEq(minimumBet, 0.0004 ether);
        assertEq(closeTime - startTime, 3 minutes);
        assertGt(startTime, 0);
    }

    function testInitializeCreatesRoundTimingWindow() public {
        (
            uint256 roundId,
            ,
            ,
            ,
            ,
            ,
            uint256 startTime,
            uint256 closeTime
        ) = game.getCurrentRoundState();

        assertEq(roundId, 0);
        assertEq(startTime, block.timestamp);
        assertEq(closeTime, block.timestamp + 3 minutes);
    }

    function testSettlingRoundInitializesNextRoundTiming() public {
        _placeBet(alice, 2, true, 1 ether, 0);

        vm.warp(block.timestamp + 3 minutes + 1);
        game.settleRound(0, 1);

        (
            uint256 roundId,
            ,
            ,
            ,
            ,
            ,
            uint256 startTime,
            uint256 closeTime
        ) = game.getCurrentRoundState();

        assertEq(roundId, 1);
        assertEq(startTime, block.timestamp + 1 minutes);
        assertEq(closeTime, block.timestamp + 4 minutes);
    }

    function testGetCurrentPoolStatsReturnsPoolAmountsAndBettorCounts() public {
        _placeBet(alice, 3, true, 1 ether, 0.5 ether);
        _placeBet(bob, 3, false, 0.75 ether, 0.25 ether);

        (
            uint256[6] memory dicePoolAmounts,
            uint256[6] memory dicePoolBettors,
            uint256 evenPoolAmount,
            uint256 oddPoolAmount,
            uint256 evenPoolBettors,
            uint256 oddPoolBettors
        ) = game.getCurrentPoolStats();

        assertEq(dicePoolAmounts[2], 1.75 ether);
        assertEq(dicePoolBettors[2], 2);
        assertEq(evenPoolAmount, 0.5 ether);
        assertEq(oddPoolAmount, 0.25 ether);
        assertEq(evenPoolBettors, 1);
        assertEq(oddPoolBettors, 1);
    }

    function testGetUserBetReturnsPlacedBet() public {
        _placeBet(alice, 5, false, 1 ether, 0.5 ether);

        (
            uint256 diceChoice,
            bool parityChoice,
            uint256 diceAmount,
            uint256 parityAmount,
            bool betOnDice,
            bool betOnParity,
            bool claimed
        ) = game.getUserBet(alice, 0);

        assertEq(diceChoice, 5);
        assertFalse(parityChoice);
        assertEq(diceAmount, 1 ether);
        assertEq(parityAmount, 0.5 ether);
        assertTrue(betOnDice);
        assertTrue(betOnParity);
        assertFalse(claimed);
    }

    function testCannotPlaceTwoBetsInSameRound() public {
        _placeBet(alice, 2, true, 1 ether, 0);
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert("Bet already placed for round");
        game.placeBet{value: 1 ether}(5, false, 1 ether, 0);
    }

    function testCannotBetWhenBettingIsClosed() public {
        game.setBettingOpen(false);

        vm.prank(alice);
        vm.expectRevert("Betting is closed");
        game.placeBet(2, true, 1 ether, 0);
    }

    function testBettingClosesAutomaticallyAfterRoundTime() public {
        _placeBet(alice, 2, true, 1 ether, 0);

        vm.warp(block.timestamp + 3 minutes + 1);

        (
            ,
            bool isBettingOpen,
            ,
            ,
            ,
            ,
            ,
            
        ) = game.getCurrentRoundState();

        assertFalse(isBettingOpen);

        vm.prank(alice);
        vm.expectRevert("Betting is closed");
        game.placeBet(5, false, 0.5 ether, 0);
    }

    function testSettleRoundRequiresBettingWindowToCloseWhenBetsExist() public {
        _placeBet(alice, 2, true, 1 ether, 0);

        vm.expectRevert("Round not closed");
        game.settleRound(0, 1);

        vm.warp(block.timestamp + 3 minutes + 1);
        game.settleRound(0, 1);

        (
            uint256 totalDicePool,
            uint256 totalParityPool,
            uint256 totalJackpotWinners,
            uint256 diceResult,
            bool parityResult,
            bool settled,
            uint256 snapshotJackpot
        ) = game.getRoundSummary(0);

        assertEq(totalDicePool, 1 ether);
        assertEq(totalParityPool, 0);
        assertEq(totalJackpotWinners, 0);
        assertEq(diceResult, 2);
        assertTrue(parityResult);
        assertTrue(settled);
        assertEq(snapshotJackpot, 0);
        assertEq(game.currentRid(), 1);
    }

    function testOwnerSettlementAdvancesRoundAndAcceptsNewBets() public {
        _placeBet(alice, 6, true, 1 ether, 0);

        vm.warp(block.timestamp + 3 minutes + 1);

        game.settleRound(0, 8);

        (
            uint256 roundId,
            bool isBettingOpen,
            uint256 totalDicePool,
            uint256 totalParityPool,
            ,
            ,
            uint256 startTime,
            uint256 closeTime
        ) = game.getCurrentRoundState();

        assertEq(roundId, 1);
        assertFalse(isBettingOpen);
        assertEq(totalDicePool, 0);
        assertEq(totalParityPool, 0);
        assertEq(startTime, block.timestamp + 1 minutes);
        assertEq(closeTime, block.timestamp + 4 minutes);

        vm.prank(alice);
        vm.expectRevert("Betting is closed");
        game.placeBet(2, false, 0.5 ether, 0);

        vm.warp(block.timestamp + 1 minutes);

        _placeBet(alice, 2, false, 0.5 ether, 0);

        (, , uint256 newRoundDiceAmount, , bool betOnDice, , ) = game.getUserBet(alice, 1);
        assertEq(newRoundDiceAmount, 0.5 ether);
        assertTrue(betOnDice);
    }

    function testNextRoundWaitsForIntermissionBeforeBettingOpens() public {
        _placeBet(alice, 6, true, 1 ether, 0);

        vm.warp(block.timestamp + 3 minutes + 1);
        game.settleRound(0, 8);

        (
            uint256 roundId,
            bool isBettingOpen,
            ,
            ,
            ,
            ,
            uint256 startTime,
            uint256 closeTime
        ) = game.getCurrentRoundState();

        assertEq(roundId, 1);
        assertFalse(isBettingOpen);
        assertEq(startTime, block.timestamp + 1 minutes);
        assertEq(closeTime, block.timestamp + 4 minutes);

        vm.warp(startTime);

        (, isBettingOpen, , , , , , ) = game.getCurrentRoundState();
        assertTrue(isBettingOpen);
    }

    function testEmptyRoundSettlementAdvancesRoundAndStoresResults() public {
        vm.warp(block.timestamp + 3 minutes + 1);
        game.settleRound(0, 3);

        (
            ,
            ,
            uint256 jackpotWinners,
            uint256 diceResult,
            bool parityResult,
            bool settled,
            uint256 snapshotJackpot
        ) = game.getRoundSummary(0);

        assertEq(jackpotWinners, 0);
        assertEq(diceResult, 4);
        assertTrue(parityResult);
        assertTrue(settled);
        assertEq(snapshotJackpot, 0);
        assertEq(game.currentRid(), 1);
    }

    function testWinningClaimCreditsNetPayoutAndHouseFee() public {
        _seedJackpot(1 ether);

        _placeBet(alice, 4, true, 1 ether, 1 ether);

        vm.warp(block.timestamp + 3 minutes + 1);

        uint256 ownerBalanceBefore = address(this).balance;
        game.settleRound(0, 3);

        vm.prank(alice);
        game.claim(0);

        assertEq(alice.balance, 2.96 ether);
        assertEq(game.totalEthEscrowed(), 0.008 ether);
        assertEq(game.jackpotBalance(), 0.008 ether);
        assertEq(game.totalHouseFeesCollected(), 0.04 ether);
        assertEq(address(this).balance - ownerBalanceBefore, 0.032 ether);
    }

    function testGetClaimPreviewReturnsExpectedPayoutBreakdown() public {
        _seedJackpot(1 ether);

        _placeBet(alice, 4, true, 1 ether, 1 ether);

        vm.warp(block.timestamp + 3 minutes + 1);
        game.settleRound(0, 3);

        (
            uint256 poolReward,
            uint256 jackpotReward,
            uint256 totalFee,
            uint256 netWinnings,
            bool claimable
        ) = game.getClaimPreview(alice, 0);

        assertEq(poolReward, 2 ether);
        assertEq(jackpotReward, 1 ether);
        assertEq(totalFee, 0.04 ether);
        assertEq(netWinnings, 2.96 ether);
        assertTrue(claimable);
    }

    function testGetRoundSummaryReturnsSettledRoundData() public {
        _seedJackpot(1 ether);

        _placeBet(alice, 4, true, 1 ether, 1 ether);

        vm.warp(block.timestamp + 3 minutes + 1);
        game.settleRound(0, 3);

        (
            uint256 totalDicePool,
            uint256 totalParityPool,
            uint256 totalJackpotWinners,
            uint256 diceResult,
            bool parityResult,
            bool settled,
            uint256 snapshotJackpot
        ) = game.getRoundSummary(0);

        assertEq(totalDicePool, 1 ether);
        assertEq(totalParityPool, 1 ether);
        assertEq(totalJackpotWinners, 1);
        assertEq(diceResult, 4);
        assertTrue(parityResult);
        assertTrue(settled);
        assertEq(snapshotJackpot, 1 ether);
    }

    function testMultipleJackpotWinnersSplitSnapshotWithoutFeeOnJackpot() public {
        _seedJackpot(1 ether);

        _placeBet(alice, 4, true, 1 ether, 1 ether);
        _placeBet(bob, 4, true, 1 ether, 1 ether);

        vm.warp(block.timestamp + 3 minutes + 1);
        game.settleRound(0, 3);

        (, , uint256 jackpotWinners, , , , uint256 snapshotJackpot) = game.getRoundSummary(0);
        assertEq(jackpotWinners, 2);
        assertEq(snapshotJackpot, 1 ether);

        vm.prank(alice);
        game.claim(0);

        vm.prank(bob);
        game.claim(0);

        assertEq(alice.balance, 2.46 ether);
        assertEq(bob.balance, 2.46 ether);
        assertEq(game.jackpotBalance(), 0.016 ether);
    }

    function testClaimRevertsForLosingBet() public {
        _placeBet(alice, 1, false, 1 ether, 0);

        vm.warp(block.timestamp + 3 minutes + 1);
        game.settleRound(0, 5);

        vm.prank(alice);
        vm.expectRevert("No winnings to claim");
        game.claim(0);
    }

    function _placeBet(address user, uint256 diceChoice, bool parityChoice, uint256 diceAmount, uint256 parityAmount)
        internal
    {
        uint256 amount = diceAmount + parityAmount;
        vm.deal(user, amount);
        vm.prank(user);
        game.placeBet{value: amount}(diceChoice, parityChoice, diceAmount, parityAmount);
    }

    function _seedJackpot(uint256 amount) internal {
        game.seedJackpot{value: amount}();
    }
}
