import random
from typing import Callable, Any

from web3 import Web3
from web3.contract import Contract

from app.config import get_settings


# ==============================
# ABI DEFINITIONS
# ==============================

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
        "inputs": [
            {"internalType": "address", "name": "_user", "type": "address"},
            {"internalType": "uint256", "name": "_rid", "type": "uint256"},
        ],
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


# ==============================
# MULTI RPC MANAGER
# ==============================

class MultiRPCWeb3:
    def __init__(self, rpc_urls: list[str]):
        self.rpc_urls = rpc_urls
        self.providers: list[Web3] = []

        for url in rpc_urls:
            w3 = Web3(Web3.HTTPProvider(url))
            if self._is_alive(w3):
                self.providers.append(w3)

        if not self.providers:
            raise RuntimeError("No working RPC providers available")

    def _is_alive(self, w3: Web3) -> bool:
        try:
            _ = w3.eth.block_number
            return True
        except Exception:
            return False

    def _get_w3(self) -> Web3:
        return random.choice(self.providers)

    def call(self, fn: Callable[[Web3], Any], retries: int = 3) -> Any:
        last_error = None

        for _ in range(retries):
            w3 = self._get_w3()
            try:
                return fn(w3)
            except Exception as e:
                last_error = e

        raise last_error


# ==============================
# FACTORIES
# ==============================

def get_multi_web3() -> MultiRPCWeb3:
    settings = get_settings()

    if not settings.voltsonic_rpc_urls:
        raise ValueError("Missing VOLTSONIC_RPC_URLS in .env")

    rpc_urls = [url.strip() for url in settings.voltsonic_rpc_urls.split(",")]

    return MultiRPCWeb3(rpc_urls)


def get_voltsonic_contract(w3: Web3) -> Contract:
    settings = get_settings()

    if not settings.voltsonic_contract_address:
        raise ValueError("Missing VOLTSONIC_CONTRACT_ADDRESS in .env")

    return w3.eth.contract(
        address=Web3.to_checksum_address(settings.voltsonic_contract_address),
        abi=VOLTSONIC_EVENT_ABI + VOLTSONIC_VIEW_ABI,
    )


# ==============================
# HIGH LEVEL HELPERS (USE THESE)
# ==============================

multi_w3 = get_multi_web3()


def get_current_round_state():
    def inner(w3: Web3):
        contract = get_voltsonic_contract(w3)
        return contract.functions.getCurrentRoundState().call()

    return multi_w3.call(inner)


def get_user_bet(user: str, round_id: int):
    def inner(w3: Web3):
        contract = get_voltsonic_contract(w3)
        return contract.functions.getUserBet(user, round_id).call()

    return multi_w3.call(inner)


def get_round_summary(round_id: int):
    def inner(w3: Web3):
        contract = get_voltsonic_contract(w3)
        return contract.functions.getRoundSummary(round_id).call()

    return multi_w3.call(inner)


def get_randomness_state(round_id: int):
    def inner(w3: Web3):
        contract = get_voltsonic_contract(w3)
        return contract.functions.getRoundRandomnessState(round_id).call()

    return multi_w3.call(inner)

def get_web3():
    """
    Backward compatibility wrapper.
    Returns a single Web3 instance from MultiRPC.
    """
    multi_w3 = get_multi_web3()
    return multi_w3._get_w3()