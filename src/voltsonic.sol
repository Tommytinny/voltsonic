// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./utils/UpgradeableUtils.sol";

library VRFV2PlusClientLite {
    bytes4 internal constant EXTRA_ARGS_V1_TAG = bytes4(keccak256("VRF ExtraArgsV1"));

    struct ExtraArgsV1 {
        bool nativePayment;
    }

    struct RandomWordsRequest {
        bytes32 keyHash;
        uint256 subId;
        uint16 requestConfirmations;
        uint32 callbackGasLimit;
        uint32 numWords;
        bytes extraArgs;
    }

    function argsToBytes(ExtraArgsV1 memory extraArgs) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(EXTRA_ARGS_V1_TAG, extraArgs);
    }
}

interface IVRFCoordinatorV2Plus {
    function requestRandomWords(
        VRFV2PlusClientLite.RandomWordsRequest calldata req
    ) external returns (uint256 requestId);
}

interface AutomationCompatibleInterface {
    function checkUpkeep(bytes calldata checkData)
        external
        returns (bool upkeepNeeded, bytes memory performData);

    function performUpkeep(bytes calldata performData) external;
}

contract VoltSonic is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    AutomationCompatibleInterface
{
    
    // --- State Variables ---
    uint256 public currentRid;
    uint256 public jackpotBalance; 
    uint256 public houseFeePercent; 
    uint256 public jackpotSeedPercent; 
    uint256 public minBet; 
    uint256 public roundDuration;
    uint256 public intermissionDuration;
    uint256 public totalEthContributed;
    uint256 public totalHouseFeesCollected;
    uint256 public lastRandomRequestId;
    address public vrfCoordinator;
    bytes32 public vrfKeyHash;
    uint256 public vrfSubscriptionId;
    uint16 public vrfRequestConfirmations;
    uint32 public vrfCallbackGasLimit;
    bool public bettingOpen;

    // Internal $VOLT Token System
    mapping(address => uint256) public voltCredits; // This is the $VOLT balance
    uint256 public totalVaultDeposits;

    struct Bet {
        uint256 diceChoice; 
        bool parityChoice;
        uint256 diceAmount;
        uint256 parityAmount;
        bool betOnDice;
        bool betOnParity;
        bool claimed;
    }

    struct Round {
        uint256 totalDicePool;
        uint256 totalParityPool;
        mapping(uint256 => uint256) diceNumberPools; 
        mapping(bool => uint256) parityResultPools;
        mapping(uint256 => mapping(bool => uint256)) doubleWinnerCount; 
        uint256 totalJackpotWinners; 
        uint256 diceResult;
        bool parityResult;
        bool settled;
        uint256 snapshotJackpot; 
        uint256 startTime;
        uint256 closeTime;
        bool randomnessRequested;
        bool randomnessFulfilled;
        uint256 randomnessRequestId;
        mapping(uint256 => uint256) diceBettorCounts;
        mapping(bool => uint256) parityBettorCounts;
    }

    mapping(uint256 => Round) public rounds;
    mapping(address => mapping(uint256 => Bet)) public userBets;
    mapping(uint256 => uint256) public requestToRound;

    // --- Events ---
    event CreditsCharged(address indexed user, uint256 ethAmount, uint256 voltAmount);
    event CreditsDischarged(address indexed user, uint256 voltAmount, uint256 ethAmount);
    event BetPlaced(
        address indexed user,
        uint256 indexed roundId,
        uint256 diceAmount,
        uint256 parityAmount,
        uint256 diceChoice,
        bool parityChoice
    );
    event RoundSettled(uint256 indexed roundId, uint256 result, bool parityResult, uint256 totalJackpot);
    event WinningsCredited(address indexed user, uint256 indexed roundId, uint256 amount);
    event JackpotRollover(uint256 indexed roundId, uint256 amountAdded);
    event BettingStatusUpdated(bool isOpen);
    event RandomnessRequested(uint256 indexed roundId, uint256 indexed requestId);
    event RandomnessFulfilled(uint256 indexed roundId, uint256 indexed requestId, uint256 randomWord, uint256 finalDice);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() initializer public {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        houseFeePercent = 2;
        jackpotSeedPercent = 20;
        minBet = 0.0004 ether; // 0.0004 $VOLT
        roundDuration = 3 minutes;
        intermissionDuration = 1 minutes;
        vrfRequestConfirmations = 3;
        vrfCallbackGasLimit = 250000;
        bettingOpen = true;
        _initializeRound(currentRid, true);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function _initializeRound(uint256 _rid) internal {
        _initializeRound(_rid, false);
    }

    function _initializeRound(uint256 _rid, bool _startImmediately) internal {
        Round storage round = rounds[_rid];
        if (round.startTime == 0) {
            uint256 nextStartTime = _startImmediately ? block.timestamp : block.timestamp + intermissionDuration;
            round.startTime = nextStartTime;
            round.closeTime = nextStartTime + roundDuration;
        }
    }

    function _isRoundBettingOpen(uint256 _rid) internal view returns (bool) {
        Round storage round = rounds[_rid];
        return bettingOpen && !round.settled && block.timestamp >= round.startTime && block.timestamp < round.closeTime;
    }

    function _canRequestSettlement(uint256 _rid) internal view returns (bool) {
        Round storage round = rounds[_rid];
        return block.timestamp >= round.closeTime && !round.settled && !round.randomnessRequested;
    }

    function _requestRoundSettlement(uint256 _rid) internal returns (uint256 requestId) {
        Round storage round = rounds[_rid];

        require(vrfCoordinator != address(0), "VRF not configured");

        requestId = IVRFCoordinatorV2Plus(vrfCoordinator).requestRandomWords(
            VRFV2PlusClientLite.RandomWordsRequest({
                keyHash: vrfKeyHash,
                subId: vrfSubscriptionId,
                requestConfirmations: vrfRequestConfirmations,
                callbackGasLimit: vrfCallbackGasLimit,
                numWords: 1,
                extraArgs: VRFV2PlusClientLite.argsToBytes(VRFV2PlusClientLite.ExtraArgsV1({nativePayment: false}))
            })
        );

        lastRandomRequestId = requestId;
        round.randomnessRequested = true;
        round.randomnessRequestId = requestId;
        requestToRound[requestId] = _rid;

        emit RandomnessRequested(_rid, requestId);
    }

    function _advanceToNextRound(uint256 _rid) internal {
        currentRid = _rid + 1;
        _initializeRound(currentRid, false);
    }

    function _settleRoundWithDice(uint256 _rid, uint256 _finalDice) internal {
        Round storage round = rounds[_rid];

        if (round.totalDicePool == 0 && round.totalParityPool == 0) {
            round.snapshotJackpot = jackpotBalance;
            round.diceResult = _finalDice;
            round.parityResult = (_finalDice % 2 == 0);
            round.settled = true;
            emit RoundSettled(_rid, _finalDice, round.parityResult, round.snapshotJackpot);
            _advanceToNextRound(_rid);
            return;
        }

        round.diceResult = _finalDice;
        round.parityResult = (_finalDice % 2 == 0);
        
        round.totalJackpotWinners = round.doubleWinnerCount[_finalDice][round.parityResult];
        round.snapshotJackpot = jackpotBalance;

        uint256 rolloverAmount = 0;
        if (round.diceNumberPools[_finalDice] == 0) rolloverAmount += round.totalDicePool;
        if (round.parityResultPools[round.parityResult] == 0) rolloverAmount += round.totalParityPool;
        
        if (rolloverAmount > 0) {
            jackpotBalance += rolloverAmount;
            emit JackpotRollover(_rid, rolloverAmount);
        }

        round.settled = true;
        emit RoundSettled(_rid, _finalDice, round.parityResult, round.snapshotJackpot);
        _advanceToNextRound(_rid);
    }

    // --- $VOLT Token Logic (The Bank) ---

    /**
     * @dev Swap ETH for $VOLT tokens 1:1
     */
    function charge() external payable nonReentrant {
        require(msg.value > 0, "Must send ETH to get $VOLT");
        voltCredits[msg.sender] += msg.value;
        totalVaultDeposits += msg.value;
        totalEthContributed += msg.value;
        emit CreditsCharged(msg.sender, msg.value, msg.value);
    }

    /**
     * @dev Swap $VOLT tokens back for ETH
     */
    function discharge(uint256 _amount) external nonReentrant {
        require(voltCredits[msg.sender] >= _amount, "Insufficient $VOLT balance");
        require(address(this).balance >= jackpotBalance + _amount, "Insufficient liquid ETH");
        
        voltCredits[msg.sender] -= _amount;
        totalVaultDeposits -= _amount;

        (bool success, ) = payable(msg.sender).call{value: _amount}("");
        require(success, "ETH withdrawal failed");
        
        emit CreditsDischarged(msg.sender, _amount, _amount);
    }

    // --- Game Logic ---

    function placeBet(uint256 _diceNum, bool _isEven, uint256 _diceAmount, uint256 _parityAmount) external {
        _initializeRound(currentRid);
        require(_isRoundBettingOpen(currentRid), "Betting is closed");
        require(_diceAmount > 0 || _parityAmount > 0, "Select a game mode");

        uint256 totalBetAmount = _diceAmount + _parityAmount;
        require(totalBetAmount >= minBet, "Bet below minimum");
        require(voltCredits[msg.sender] >= totalBetAmount, "Insufficient $VOLT. Please charge.");
        if (_diceAmount > 0) require(_diceAmount >= minBet, "Dice bet below minimum");
        if (_parityAmount > 0) require(_parityAmount >= minBet, "Parity bet below minimum");

        Round storage round = rounds[currentRid];
        Bet storage bet = userBets[msg.sender][currentRid];
        require(!bet.betOnDice && !bet.betOnParity, "Bet already placed for round");

        // Deduct from $VOLT balance
        voltCredits[msg.sender] -= totalBetAmount;
        totalVaultDeposits -= totalBetAmount;

        if (_diceAmount > 0) {
            require(_diceNum >= 1 && _diceNum <= 6, "Invalid Dice");
            bet.diceChoice = _diceNum;
            bet.diceAmount = _diceAmount;
            bet.betOnDice = true;
            round.diceNumberPools[_diceNum] += _diceAmount;
            round.diceBettorCounts[_diceNum] += 1;
            round.totalDicePool += _diceAmount;
        }

        if (_parityAmount > 0) {
            bet.parityChoice = _isEven;
            bet.parityAmount = _parityAmount;
            bet.betOnParity = true;
            round.parityResultPools[_isEven] += _parityAmount;
            round.parityBettorCounts[_isEven] += 1;
            round.totalParityPool += _parityAmount;
        }

        if (_diceAmount > 0 && _parityAmount > 0) {
            round.doubleWinnerCount[_diceNum][_isEven]++;
        }

        emit BetPlaced(msg.sender, currentRid, _diceAmount, _parityAmount, _diceNum, _isEven);
    }

    function requestRoundSettlement() external onlyOwner returns (uint256 requestId) {
        _initializeRound(currentRid);
        require(_canRequestSettlement(currentRid), "Settlement request not ready");
        requestId = _requestRoundSettlement(currentRid);
    }

    function checkUpkeep(bytes calldata)
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        upkeepNeeded = _canRequestSettlement(currentRid);
        performData = abi.encode(currentRid);
    }

    function performUpkeep(bytes calldata performData) external override {
        uint256 roundId = currentRid;
        if (performData.length > 0) {
            roundId = abi.decode(performData, (uint256));
        }

        if (roundId != currentRid) {
            return;
        }

        if (!_canRequestSettlement(roundId)) {
            return;
        }

        _requestRoundSettlement(roundId);
    }

    function rawFulfillRandomWords(uint256 _requestId, uint256[] calldata _randomWords) external {
        require(msg.sender == vrfCoordinator, "Only VRF coordinator");
        require(_randomWords.length > 0, "Missing random words");

        uint256 roundId = requestToRound[_requestId];
        require(_requestId != 0 && roundId == currentRid, "Unknown request");

        Round storage round = rounds[roundId];
        require(round.randomnessRequestId == _requestId, "Unknown request");
        require(round.randomnessRequested, "Randomness not requested");
        require(!round.randomnessFulfilled, "Randomness already fulfilled");
        require(!round.settled, "Round already settled");

        round.randomnessFulfilled = true;
        uint256 randomWord = _randomWords[0];
        uint256 finalDice = (randomWord % 6) + 1;

        emit RandomnessFulfilled(roundId, _requestId, randomWord, finalDice);
        _settleRoundWithDice(roundId, finalDice);
    }

    function claim(uint256 _rid) external nonReentrant {
        Round storage round = rounds[_rid];
        Bet storage bet = userBets[msg.sender][_rid];

        require(round.settled, "Round not settled");
        require(!bet.claimed, "Already claimed");

        uint256 poolReward = 0;
        uint256 jackpotReward = 0;
        bool wonDice = (bet.betOnDice && bet.diceChoice == round.diceResult);
        bool wonParity = (bet.betOnParity && bet.parityChoice == round.parityResult);

        if (wonDice) poolReward += (bet.diceAmount * round.totalDicePool) / round.diceNumberPools[round.diceResult];
        if (wonParity) poolReward += (bet.parityAmount * round.totalParityPool) / round.parityResultPools[round.parityResult];

        // Jackpot Logic
        if (wonDice && wonParity && round.totalJackpotWinners > 0) {
            jackpotReward = round.snapshotJackpot / round.totalJackpotWinners;
            if (jackpotBalance >= jackpotReward) jackpotBalance -= jackpotReward;
        }

        uint256 reward = poolReward + jackpotReward;
        require(reward > 0, "No winnings to claim");
        bet.claimed = true;

        uint256 totalFee = (poolReward * houseFeePercent) / 100;
        totalHouseFeesCollected += totalFee;
        uint256 seedAmount = (totalFee * jackpotSeedPercent) / 100;
        jackpotBalance += seedAmount; 
        
        // Add winnings to $VOLT balance
        uint256 netWinnings = reward - totalFee;
        voltCredits[msg.sender] += netWinnings;
        totalVaultDeposits += netWinnings;
        
        emit WinningsCredited(msg.sender, _rid, netWinnings);

        // Send house fee to owner (actual ETH transfer)
        uint256 ownerFee = totalFee - seedAmount;
        require(address(this).balance >= totalVaultDeposits + jackpotBalance + ownerFee, "Insufficient ETH for fee payout");

        (bool success, ) = payable(owner()).call{value: ownerFee}("");
        require(success, "House fee transfer failed");
    }

    // --- View Helpers ---
    function getRoundSummary(uint256 _rid)
        external
        view
        returns (
            uint256 totalDicePool,
            uint256 totalParityPool,
            uint256 totalJackpotWinners,
            uint256 diceResult,
            bool parityResult,
            bool settled,
            uint256 snapshotJackpot
        )
    {
        Round storage round = rounds[_rid];
        return (
            round.totalDicePool,
            round.totalParityPool,
            round.totalJackpotWinners,
            round.diceResult,
            round.parityResult,
            round.settled,
            round.snapshotJackpot
        );
    }

    function getCurrentRoundState()
        external
        view
        returns (
            uint256 roundId,
            bool isBettingOpen,
            uint256 totalDicePool,
            uint256 totalParityPool,
            uint256 currentJackpot,
            uint256 minimumBet,
            uint256 startTime,
            uint256 closeTime
        )
    {
        Round storage round = rounds[currentRid];
        return (
            currentRid,
            _isRoundBettingOpen(currentRid),
            round.totalDicePool,
            round.totalParityPool,
            jackpotBalance,
            minBet,
            round.startTime,
            round.closeTime
        );
    }

    function getCurrentPoolStats()
        external
        view
        returns (
            uint256[6] memory dicePoolAmounts,
            uint256[6] memory dicePoolBettors,
            uint256 evenPoolAmount,
            uint256 oddPoolAmount,
            uint256 evenPoolBettors,
            uint256 oddPoolBettors
        )
    {
        Round storage round = rounds[currentRid];

        for (uint256 i = 0; i < 6; i++) {
            uint256 diceValue = i + 1;
            dicePoolAmounts[i] = round.diceNumberPools[diceValue];
            dicePoolBettors[i] = round.diceBettorCounts[diceValue];
        }

        evenPoolAmount = round.parityResultPools[true];
        oddPoolAmount = round.parityResultPools[false];
        evenPoolBettors = round.parityBettorCounts[true];
        oddPoolBettors = round.parityBettorCounts[false];
    }

    function getUserBet(address _user, uint256 _rid)
        external
        view
        returns (
            uint256 diceChoice,
            bool parityChoice,
            uint256 diceAmount,
            uint256 parityAmount,
            bool betOnDice,
            bool betOnParity,
            bool claimed
        )
    {
        Bet storage bet = userBets[_user][_rid];
        return (
            bet.diceChoice,
            bet.parityChoice,
            bet.diceAmount,
            bet.parityAmount,
            bet.betOnDice,
            bet.betOnParity,
            bet.claimed
        );
    }

    function getRoundRandomnessState(uint256 _rid)
        external
        view
        returns (bool randomnessRequested, bool randomnessFulfilled, uint256 randomnessRequestId)
    {
        Round storage round = rounds[_rid];
        return (round.randomnessRequested, round.randomnessFulfilled, round.randomnessRequestId);
    }

    function getClaimPreview(address _user, uint256 _rid)
        external
        view
        returns (
            uint256 poolReward,
            uint256 jackpotReward,
            uint256 totalFee,
            uint256 netWinnings,
            bool claimable
        )
    {
        Round storage round = rounds[_rid];
        Bet storage bet = userBets[_user][_rid];

        if (!round.settled || bet.claimed) {
            return (0, 0, 0, 0, false);
        }

        bool wonDice = bet.betOnDice && bet.diceChoice == round.diceResult;
        bool wonParity = bet.betOnParity && bet.parityChoice == round.parityResult;

        if (wonDice) {
            poolReward += (bet.diceAmount * round.totalDicePool) / round.diceNumberPools[round.diceResult];
        }

        if (wonParity) {
            poolReward += (bet.parityAmount * round.totalParityPool) / round.parityResultPools[round.parityResult];
        }

        if (wonDice && wonParity && round.totalJackpotWinners > 0) {
            jackpotReward = round.snapshotJackpot / round.totalJackpotWinners;
        }

        uint256 reward = poolReward + jackpotReward;
        if (reward == 0) {
            return (0, 0, 0, 0, false);
        }

        totalFee = (poolReward * houseFeePercent) / 100;
        netWinnings = reward - totalFee;
        claimable = true;
    }

    // --- Admin Functions ---
    function setMinBet(uint256 _newMin) external onlyOwner { minBet = _newMin; }
    function setRoundDuration(uint256 _newDuration) external onlyOwner {
        require(_newDuration > 0, "Round duration must be positive");
        roundDuration = _newDuration;
    }
    function setIntermissionDuration(uint256 _newDuration) external onlyOwner {
        intermissionDuration = _newDuration;
    }
    function configureRandomness(
        address _vrfCoordinator,
        bytes32 _vrfKeyHash,
        uint256 _vrfSubscriptionId,
        uint16 _vrfRequestConfirmations,
        uint32 _vrfCallbackGasLimit
    ) external onlyOwner {
        require(_vrfCoordinator != address(0), "Coordinator required");
        require(_vrfRequestConfirmations > 0, "Confirmations required");
        require(_vrfCallbackGasLimit > 0, "Callback gas required");

        vrfCoordinator = _vrfCoordinator;
        vrfKeyHash = _vrfKeyHash;
        vrfSubscriptionId = _vrfSubscriptionId;
        vrfRequestConfirmations = _vrfRequestConfirmations;
        vrfCallbackGasLimit = _vrfCallbackGasLimit;
    }
    function seedJackpot() external payable onlyOwner {
        jackpotBalance += msg.value;
        totalEthContributed += msg.value;
    }
    function setBettingOpen(bool _isOpen) external onlyOwner {
        bettingOpen = _isOpen;
        emit BettingStatusUpdated(_isOpen);
    }
}
