from web3 import Web3

from app.config import get_settings


VOLTSONIC_EVENT_ABI = [
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "address", "name": "user", "type": "address"},
            {"indexed": True, "internalType": "uint256", "name": "roundId", "type": "uint256"},
            {"indexed": False, "internalType": "uint256", "name": "diceAmount", "type": "uint256"},
            {"indexed": False, "internalType": "uint256", "name": "parityAmount", "type": "uint256"},
            {"indexed": False, "internalType": "uint256", "name": "diceChoice", "type": "uint256"},
            {"indexed": False, "internalType": "bool", "name": "parityChoice", "type": "bool"},
        ],
        "name": "BetPlaced",
        "type": "event",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "uint256", "name": "roundId", "type": "uint256"},
            {"indexed": False, "internalType": "uint256", "name": "result", "type": "uint256"},
            {"indexed": False, "internalType": "bool", "name": "parityResult", "type": "bool"},
            {"indexed": False, "internalType": "uint256", "name": "totalJackpot", "type": "uint256"},
        ],
        "name": "RoundSettled",
        "type": "event",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "address", "name": "user", "type": "address"},
            {"indexed": True, "internalType": "uint256", "name": "roundId", "type": "uint256"},
            {"indexed": False, "internalType": "uint256", "name": "amount", "type": "uint256"},
        ],
        "name": "WinningsCredited",
        "type": "event",
    },
]

VOLTSONIC_VIEW_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "_user", "type": "address"}, {"internalType": "uint256", "name": "_rid", "type": "uint256"}],
        "name": "getUserBet",
        "outputs": [
            {"internalType": "uint256", "name": "diceChoice", "type": "uint256"},
            {"internalType": "bool", "name": "parityChoice", "type": "bool"},
            {"internalType": "uint256", "name": "diceAmount", "type": "uint256"},
            {"internalType": "uint256", "name": "parityAmount", "type": "uint256"},
            {"internalType": "bool", "name": "betOnDice", "type": "bool"},
            {"internalType": "bool", "name": "betOnParity", "type": "bool"},
            {"internalType": "bool", "name": "claimed", "type": "bool"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "uint256", "name": "_rid", "type": "uint256"}],
        "name": "getRoundSummary",
        "outputs": [
            {"internalType": "uint256", "name": "totalDicePool", "type": "uint256"},
            {"internalType": "uint256", "name": "totalParityPool", "type": "uint256"},
            {"internalType": "uint256", "name": "totalJackpotWinners", "type": "uint256"},
            {"internalType": "uint256", "name": "diceResult", "type": "uint256"},
            {"internalType": "bool", "name": "parityResult", "type": "bool"},
            {"internalType": "bool", "name": "settled", "type": "bool"},
            {"internalType": "uint256", "name": "snapshotJackpot", "type": "uint256"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "uint256", "name": "_rid", "type": "uint256"}],
        "name": "getRoundRandomnessState",
        "outputs": [
            {"internalType": "bool", "name": "randomnessRequested", "type": "bool"},
            {"internalType": "bool", "name": "randomnessFulfilled", "type": "bool"},
            {"internalType": "uint256", "name": "randomnessRequestId", "type": "uint256"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getCurrentRoundState",
        "outputs": [
            {"internalType": "uint256", "name": "roundId", "type": "uint256"},
            {"internalType": "bool", "name": "isBettingOpen", "type": "bool"},
            {"internalType": "uint256", "name": "totalDicePool", "type": "uint256"},
            {"internalType": "uint256", "name": "totalParityPool", "type": "uint256"},
            {"internalType": "uint256", "name": "currentJackpot", "type": "uint256"},
            {"internalType": "uint256", "name": "minimumBet", "type": "uint256"},
            {"internalType": "uint256", "name": "startTime", "type": "uint256"},
            {"internalType": "uint256", "name": "closeTime", "type": "uint256"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
]


def get_web3() -> Web3:
    settings = get_settings()
    if not settings.voltsonic_rpc_url:
        raise ValueError("Missing VOLTSONIC_RPC_URL in backend .env")
    return Web3(Web3.HTTPProvider(settings.voltsonic_rpc_url))


def get_voltsonic_contract(w3: Web3):
    settings = get_settings()
    if not settings.voltsonic_contract_address:
        raise ValueError("Missing VOLTSONIC_CONTRACT_ADDRESS in backend .env")
    abi = VOLTSONIC_EVENT_ABI + VOLTSONIC_VIEW_ABI
    return w3.eth.contract(address=Web3.to_checksum_address(settings.voltsonic_contract_address), abi=abi)
