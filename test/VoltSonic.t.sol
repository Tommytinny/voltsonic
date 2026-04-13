// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {VoltSonic, VRFV2PlusClientLite} from "../src/voltsonic.sol";

contract MockERC20 {
    string public constant name = "Volt";
    string public constant symbol = "VOLT";
    uint8 public constant decimals = 18;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "ERC20: insufficient allowance");
        allowance[from][msg.sender] = allowed - amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "ERC20: transfer exceeds balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }
}

contract SimpleERC1967Proxy {
    bytes32 private constant IMPLEMENTATION_SLOT =
        bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);

    constructor(address implementation, bytes memory initData) payable {
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly {
            sstore(slot, implementation)
        }

        if (initData.length > 0) {
            (bool success, bytes memory returndata) = implementation.delegatecall(initData);
            if (!success) {
                assembly {
                    revert(add(returndata, 32), mload(returndata))
                }
            }
        }
    }

    fallback() external payable {
        _delegate();
    }

    receive() external payable {
        _delegate();
    }

    function _delegate() internal {
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly {
            let implementation := sload(slot)
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())

            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}

contract MockVRFCoordinatorV2 {
    uint256 internal nextRequestId = 1;

    function requestRandomWords(
        VRFV2PlusClientLite.RandomWordsRequest calldata
    ) external returns (uint256 requestId) {
        requestId = nextRequestId++;
    }

    function fulfillRandomWords(address consumer, uint256 requestId, uint256 randomWord) external {
        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = randomWord;
        VoltSonic(payable(consumer)).rawFulfillRandomWords(requestId, randomWords);
    }
}

contract VoltSonicV2 is VoltSonic {
    function version() external pure returns (uint256) {
        return 2;
    }
}

contract VoltSonicTokenRecovery is VoltSonic {
    function version() external pure returns (uint256) {
        return 3;
    }
}

contract VoltSonicTest is Test {
    VoltSonic internal game;
    MockVRFCoordinatorV2 internal vrfCoordinator;
    MockERC20 internal voltToken;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    receive() external payable {}

    function setUp() public {
        voltToken = new MockERC20();
        VoltSonic implementation = new VoltSonic();
        SimpleERC1967Proxy proxy =
            new SimpleERC1967Proxy(
                address(implementation), abi.encodeCall(VoltSonic.initialize, (address(this), address(voltToken)))
            );

        game = VoltSonic(payable(address(proxy)));
        vrfCoordinator = new MockVRFCoordinatorV2();
        game.configureRandomness(address(vrfCoordinator), bytes32(uint256(1)), 1, 3, 250000);
    }

    function testInitializeAllowsCustomOwner() public {
        address customOwner = makeAddr("customOwner");
        VoltSonic implementation = new VoltSonic();
        SimpleERC1967Proxy proxy =
            new SimpleERC1967Proxy(
                address(implementation), abi.encodeCall(VoltSonic.initialize, (customOwner, address(voltToken)))
            );

        VoltSonic customOwnedGame = VoltSonic(payable(address(proxy)));
        assertEq(customOwnedGame.owner(), customOwner);
    }

    function testInitializeSetsDefaultValues() public view {
        assertEq(game.owner(), address(this));
        assertEq(game.houseFeePercent(), 2);
        assertEq(game.jackpotSeedPercent(), 20);
        assertEq(game.minBet(), 0.0004 ether);
        assertEq(game.roundDuration(), 3 minutes);
        assertEq(game.intermissionDuration(), 1 minutes);
        assertTrue(game.bettingOpen());
        assertEq(game.currentRid(), 0);
        assertEq(game.jackpotBalance(), 0);
        assertEq(address(game.voltToken()), address(voltToken));
    }

    function testOwnerCanRestoreTokenAddressAfterUpgrade() public {
        VoltSonicTokenRecovery implementation = new VoltSonicTokenRecovery();
        MockERC20 replacementToken = new MockERC20();
        game.upgradeTo(address(implementation));

        game.setVoltToken(address(replacementToken));
        assertEq(address(game.voltToken()), address(replacementToken));

        game.setVoltToken(address(voltToken));
        assertEq(address(game.voltToken()), address(voltToken));
    }

    function testNonOwnerCannotRestoreTokenAddress() public {
        vm.prank(alice);
        vm.expectRevert("Ownable: caller is not the owner");
        game.setVoltToken(address(voltToken));
    }

    function testMintAndApprovalHelperFundsPlayerWallet() public {
        _charge(alice, 2 ether);

        assertEq(voltToken.balanceOf(alice), 2 ether);
        assertEq(voltToken.allowance(alice, address(game)), 2 ether);
        assertEq(game.totalVaultDeposits(), 0);
        assertEq(game.totalEthContributed(), 0);
        assertEq(voltToken.balanceOf(address(game)), 0);
    }

    function testTotalEthContributedTracksTokenInflows() public {
        _charge(alice, 2 ether);
        _charge(bob, 1 ether);
        _seedJackpot(0.5 ether);

        assertEq(game.totalEthContributed(), 0.5 ether);
        assertEq(game.totalVaultDeposits(), 0.5 ether);
        assertEq(game.jackpotBalance(), 0.5 ether);
        assertEq(voltToken.balanceOf(address(game)), 0.5 ether);
    }

    function testPlaceBetStoresExplicitPerGameAmounts() public {
        _charge(alice, 2 ether);

        vm.prank(alice);
        game.placeBet(4, true, 1 ether, 0.5 ether);

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
        assertEq(voltToken.balanceOf(alice), 0.5 ether);
        assertEq(game.totalVaultDeposits(), 1.5 ether);
        assertEq(voltToken.balanceOf(address(game)), 1.5 ether);
    }

    function testGetCurrentRoundStateReturnsFrontendSummary() public {
        _charge(alice, 2 ether);

        vm.prank(alice);
        game.placeBet(3, false, 1 ether, 0.5 ether);

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
        _charge(alice, 1 ether);

        vm.prank(alice);
        game.placeBet(2, true, 1 ether, 0);

        vm.warp(block.timestamp + 3 minutes + 1);
        uint256 requestId = game.requestRoundSettlement();
        vrfCoordinator.fulfillRandomWords(address(game), requestId, 1);

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
        _charge(alice, 3 ether);
        _charge(bob, 3 ether);

        vm.prank(alice);
        game.placeBet(3, true, 1 ether, 0.5 ether);

        vm.prank(bob);
        game.placeBet(3, false, 0.75 ether, 0.25 ether);

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
        _charge(alice, 2 ether);

        vm.prank(alice);
        game.placeBet(5, false, 1 ether, 0.5 ether);

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
        _charge(alice, 3 ether);

        vm.startPrank(alice);
        game.placeBet(2, true, 1 ether, 0);
        vm.expectRevert("Bet already placed for round");
        game.placeBet(5, false, 1 ether, 0);
        vm.stopPrank();
    }

    function testCannotBetWhenBettingIsClosed() public {
        _charge(alice, 1 ether);
        game.setBettingOpen(false);

        vm.prank(alice);
        vm.expectRevert("Betting is closed");
        game.placeBet(2, true, 1 ether, 0);
    }

    function testBettingClosesAutomaticallyAfterRoundTime() public {
        _charge(alice, 1 ether);

        vm.prank(alice);
        game.placeBet(2, true, 1 ether, 0);

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
        _charge(alice, 1 ether);

        vm.prank(alice);
        game.placeBet(2, true, 1 ether, 0);

        vm.expectRevert("Settlement request not ready");
        game.requestRoundSettlement();

        vm.warp(block.timestamp + 3 minutes + 1);
        uint256 requestId = game.requestRoundSettlement();
        vrfCoordinator.fulfillRandomWords(address(game), requestId, 1);

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

    function testRandomnessMustBeRequestedBeforeFulfillment() public {
        vm.expectRevert("Unknown request");
        vrfCoordinator.fulfillRandomWords(address(game), 1, 7);
    }

    function testRandomnessRequestMarksRoundAndMapsRequestId() public {
        _charge(alice, 1 ether);

        vm.prank(alice);
        game.placeBet(6, true, 1 ether, 0);

        vm.warp(block.timestamp + 3 minutes + 1);
        uint256 requestId = game.requestRoundSettlement();

        assertEq(requestId, 1);
        assertEq(game.lastRandomRequestId(), 1);
        assertEq(game.requestToRound(requestId), 0);

        (bool randomnessRequested, bool randomnessFulfilled, uint256 randomnessRequestId) =
            game.getRoundRandomnessState(0);

        assertTrue(randomnessRequested);
        assertFalse(randomnessFulfilled);
        assertEq(randomnessRequestId, requestId);
    }

    function testCheckUpkeepSignalsOnlyAfterSettlementWindowCloses() public {
        _charge(alice, 1 ether);

        vm.prank(alice);
        game.placeBet(6, true, 1 ether, 0);

        (bool upkeepNeededBefore, bytes memory performDataBefore) = game.checkUpkeep("");
        assertFalse(upkeepNeededBefore);
        assertEq(abi.decode(performDataBefore, (uint256)), 0);

        vm.warp(block.timestamp + 3 minutes + 1);

        (bool upkeepNeededAfter, bytes memory performDataAfter) = game.checkUpkeep("");
        assertTrue(upkeepNeededAfter);
        assertEq(abi.decode(performDataAfter, (uint256)), 0);
    }

    function testPerformUpkeepRequestsRandomnessForCurrentRound() public {
        _charge(alice, 1 ether);

        vm.prank(alice);
        game.placeBet(6, true, 1 ether, 0);

        vm.warp(block.timestamp + 3 minutes + 1);

        game.performUpkeep(abi.encode(uint256(0)));

        uint256 requestId = game.lastRandomRequestId();
        assertEq(requestId, 1);
        assertEq(game.requestToRound(requestId), 0);

        (bool randomnessRequested, bool randomnessFulfilled, uint256 randomnessRequestId) =
            game.getRoundRandomnessState(0);

        assertTrue(randomnessRequested);
        assertFalse(randomnessFulfilled);
        assertEq(randomnessRequestId, requestId);
    }

    function testFulfillmentAutoStartsNextRoundAndAcceptsNewBets() public {
        _charge(alice, 2 ether);

        vm.prank(alice);
        game.placeBet(6, true, 1 ether, 0);

        vm.warp(block.timestamp + 3 minutes + 1);

        game.performUpkeep(abi.encode(uint256(0)));
        uint256 requestId = game.lastRandomRequestId();
        vrfCoordinator.fulfillRandomWords(address(game), requestId, 8);

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

        vm.prank(alice);
        game.placeBet(2, false, 0.5 ether, 0);

        (, , uint256 newRoundDiceAmount, , bool betOnDice, , ) = game.getUserBet(alice, 1);
        assertEq(newRoundDiceAmount, 0.5 ether);
        assertTrue(betOnDice);
    }

    function testNextRoundWaitsForIntermissionBeforeBettingOpens() public {
        _charge(alice, 2 ether);

        vm.prank(alice);
        game.placeBet(6, true, 1 ether, 0);

        vm.warp(block.timestamp + 3 minutes + 1);
        uint256 requestId = game.requestRoundSettlement();
        vrfCoordinator.fulfillRandomWords(address(game), requestId, 8);

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

    function testPerformUpkeepDoesNothingWhenNotNeeded() public {
        game.performUpkeep("");
        assertEq(game.lastRandomRequestId(), 0);
    }

    function testEmptyRoundSettlementAdvancesRoundAndStoresResults() public {
        vm.warp(block.timestamp + 3 minutes + 1);
        uint256 requestId = game.requestRoundSettlement();
        vrfCoordinator.fulfillRandomWords(address(game), requestId, 3);

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
        _charge(alice, 2 ether);
        _seedJackpot(1 ether);

        vm.prank(alice);
        game.placeBet(4, true, 1 ether, 1 ether);

        vm.warp(block.timestamp + 3 minutes + 1);

        uint256 ownerBalanceBefore = voltToken.balanceOf(address(this));
        uint256 requestId = game.requestRoundSettlement();
        vrfCoordinator.fulfillRandomWords(address(game), requestId, 3);

        vm.prank(alice);
        game.claim(0);

        assertEq(voltToken.balanceOf(alice), 2.96 ether);
        assertEq(game.totalVaultDeposits(), 0.008 ether);
        assertEq(game.jackpotBalance(), 0.008 ether);
        assertEq(game.totalHouseFeesCollected(), 0.04 ether);
        assertEq(voltToken.balanceOf(address(this)) - ownerBalanceBefore, 0.032 ether);
    }

    function testOwnerCanUpgradeProxyAndPreserveState() public {
        _charge(alice, 1 ether);

        VoltSonicV2 implementationV2 = new VoltSonicV2();
        game.upgradeTo(address(implementationV2));

        VoltSonicV2 upgraded = VoltSonicV2(payable(address(game)));
        assertEq(upgraded.version(), 2);
        assertEq(upgraded.owner(), address(this));
        assertEq(address(upgraded.voltToken()), address(voltToken));
        assertEq(upgraded.currentRid(), 0);
        assertEq(upgraded.intermissionDuration(), 1 minutes);
    }

    function testGetClaimPreviewReturnsExpectedPayoutBreakdown() public {
        _charge(alice, 2 ether);
        _seedJackpot(1 ether);

        vm.prank(alice);
        game.placeBet(4, true, 1 ether, 1 ether);

        vm.warp(block.timestamp + 3 minutes + 1);
        uint256 requestId = game.requestRoundSettlement();
        vrfCoordinator.fulfillRandomWords(address(game), requestId, 3);

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
        _charge(alice, 2 ether);
        _seedJackpot(1 ether);

        vm.prank(alice);
        game.placeBet(4, true, 1 ether, 1 ether);

        vm.warp(block.timestamp + 3 minutes + 1);
        uint256 requestId = game.requestRoundSettlement();
        vrfCoordinator.fulfillRandomWords(address(game), requestId, 3);

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
        _charge(alice, 2 ether);
        _charge(bob, 2 ether);
        _seedJackpot(1 ether);

        vm.prank(alice);
        game.placeBet(4, true, 1 ether, 1 ether);

        vm.prank(bob);
        game.placeBet(4, true, 1 ether, 1 ether);

        vm.warp(block.timestamp + 3 minutes + 1);
        uint256 requestId = game.requestRoundSettlement();
        vrfCoordinator.fulfillRandomWords(address(game), requestId, 3);

        (, , uint256 jackpotWinners, , , , uint256 snapshotJackpot) = game.getRoundSummary(0);
        assertEq(jackpotWinners, 2);
        assertEq(snapshotJackpot, 1 ether);

        vm.prank(alice);
        game.claim(0);

        vm.prank(bob);
        game.claim(0);

        assertEq(voltToken.balanceOf(alice), 2.46 ether);
        assertEq(voltToken.balanceOf(bob), 2.46 ether);
        assertEq(game.jackpotBalance(), 0.016 ether);
    }

    function testClaimRevertsForLosingBet() public {
        _charge(alice, 1 ether);

        vm.prank(alice);
        game.placeBet(1, false, 1 ether, 0);

        vm.warp(block.timestamp + 3 minutes + 1);
        uint256 requestId = game.requestRoundSettlement();
        vrfCoordinator.fulfillRandomWords(address(game), requestId, 5);

        vm.prank(alice);
        vm.expectRevert("No winnings to claim");
        game.claim(0);
    }

    function _charge(address user, uint256 amount) internal {
        voltToken.mint(user, amount);
        vm.prank(user);
        voltToken.approve(address(game), amount);
    }

    function _seedJackpot(uint256 amount) internal {
        voltToken.mint(address(this), amount);
        voltToken.approve(address(game), amount);
        game.seedJackpot(amount);
    }
}
