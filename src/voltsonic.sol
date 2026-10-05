// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract VoltSonic {
    
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
    address public houseFeeRecipient;
    bool public bettingOpen;
    uint256 public totalEthEscrowed;
    address private _owner;
    address private _pendingOwner;
    uint256 private _reentrancyStatus;

    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    modifier onlyOwner() {
        require(msg.sender == _owner, "Ownable: caller is not the owner");
        _;
    }

    modifier nonReentrant() {
        require(_reentrancyStatus != _ENTERED, "ReentrancyGuard: reentrant call");
        _reentrancyStatus = _ENTERED;
        _;
        _reentrancyStatus = _NOT_ENTERED;
    }

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
        mapping(uint256 => uint256) diceBettorCounts;
        mapping(bool => uint256) parityBettorCounts;
    }

    mapping(uint256 => Round) public rounds;
    mapping(address => mapping(uint256 => Bet)) public userBets;

    // --- Events ---
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
    event HouseFeeRecipientUpdated(address indexed previousRecipient, address indexed newRecipient);
    constructor(address initialOwner) {
        require(initialOwner != address(0), "Ownable: zero owner");

        _owner = initialOwner;
        _reentrancyStatus = _NOT_ENTERED;
        houseFeePercent = 2;
        jackpotSeedPercent = 20;
        minBet = 0.0004 ether;
        houseFeeRecipient = initialOwner;
        roundDuration = 3 minutes;
        intermissionDuration = 1 minutes;
        bettingOpen = true;
        _initializeRound(currentRid, true);
    }

    function owner() public view returns (address) {
        return _owner;
    }

    function pendingOwner() public view returns (address) {
        return _pendingOwner;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "Ownable: zero owner");
        _pendingOwner = newOwner;
        emit OwnershipTransferStarted(_owner, newOwner);
    }

    function acceptOwnership() public {
        require(msg.sender == _pendingOwner, "Ownable: caller is not the pending owner");
        address previousOwner = _owner;
        _owner = _pendingOwner;
        _pendingOwner = address(0);
        emit OwnershipTransferred(previousOwner, _owner);
    }

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);

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

    function _pushEth(address to, uint256 amount) internal {
        if (amount == 0) return;
        totalEthEscrowed -= amount;
        (bool success, ) = to.call{value: amount}("");
        require(success, "ETH transfer failed");
    }

    // --- Game Logic ---

    function placeBet(uint256 _diceNum, bool _isEven, uint256 _diceAmount, uint256 _parityAmount) external payable {
        _initializeRound(currentRid);
        require(_isRoundBettingOpen(currentRid), "Betting is closed");
        require(_diceAmount > 0 || _parityAmount > 0, "Select a game mode");

        uint256 totalBetAmount = _diceAmount + _parityAmount;
        require(msg.value == totalBetAmount, "Incorrect ETH value");
        require(totalBetAmount >= minBet, "Bet below minimum");
        if (_diceAmount > 0) require(_diceAmount >= minBet, "Dice bet below minimum");
        if (_parityAmount > 0) require(_parityAmount >= minBet, "Parity bet below minimum");

        Round storage round = rounds[currentRid];
        Bet storage bet = userBets[msg.sender][currentRid];
        require(!bet.betOnDice && !bet.betOnParity, "Bet already placed for round");

        totalEthContributed += msg.value;
        totalEthEscrowed += msg.value;

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

    function settleRound(uint256 _rid, uint256 _randomWord) external onlyOwner {
        Round storage round = rounds[_rid];

        require(block.timestamp >= round.closeTime, "Round not closed");
        require(!round.settled, "Round already settled");

        uint256 finalDice = (_randomWord % 6) + 1;
        _settleRoundWithDice(_rid, finalDice);
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
        
        uint256 netWinnings = reward - totalFee;
        uint256 ownerFee = totalFee - seedAmount;
        address feeRecipient = houseFeeRecipient != address(0) ? houseFeeRecipient : owner();

        emit WinningsCredited(msg.sender, _rid, netWinnings);

        _pushEth(msg.sender, netWinnings);
        _pushEth(feeRecipient, ownerFee);
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
    function seedJackpot() external payable onlyOwner {
        require(msg.value > 0, "Amount required");
        totalEthContributed += msg.value;
        totalEthEscrowed += msg.value;
        jackpotBalance += msg.value;
    }
    function setBettingOpen(bool _isOpen) external onlyOwner {
        bettingOpen = _isOpen;
        emit BettingStatusUpdated(_isOpen);
    }
    function setHouseFeeRecipient(address _recipient) external onlyOwner {
        require(_recipient != address(0), "Recipient cannot be zero address");
        address previousRecipient = houseFeeRecipient;
        houseFeeRecipient = _recipient;
        emit HouseFeeRecipientUpdated(previousRecipient, _recipient);
    }
    function forceSettleEmptyRound(uint256 _rid) external onlyOwner {
        Round storage round = rounds[_rid];
        require(!round.settled && round.totalDicePool == 0 && round.totalParityPool == 0);
        round.diceResult = 1; // Default
        round.parityResult = false;
        round.snapshotJackpot = jackpotBalance;
        round.settled = true;
        emit RoundSettled(_rid, 1, false, jackpotBalance);
        _advanceToNextRound(_rid);
    }
    function forceSettleRound(uint256 _rid, uint256 _dice) external onlyOwner {
        require(_dice >= 1 && _dice <= 6, "Invalid dice");
        Round storage round = rounds[_rid];
        require(!round.settled, "Already settled");
        round.diceResult = _dice;
        round.parityResult = (_dice % 2 == 0);
        round.snapshotJackpot = jackpotBalance;
        round.settled = true;
        emit RoundSettled(_rid, _dice, round.parityResult, jackpotBalance);
        _advanceToNextRound(_rid);
    }

    receive() external payable {
        totalEthContributed += msg.value;
        totalEthEscrowed += msg.value;
    }
}
