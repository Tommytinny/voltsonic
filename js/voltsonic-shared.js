const VOLTSONIC_STORAGE_KEY = "voltsonic.contractAddress";

const VOLTSONIC_ABI = [
  "event RoundSettled(uint256 indexed roundId, uint256 result, bool parityResult, uint256 totalJackpot)",
  "function owner() view returns (address)",
  "function currentRid() view returns (uint256)",
  "function jackpotBalance() view returns (uint256)",
  "function minBet() view returns (uint256)",
  "function bettingOpen() view returns (bool)",
  "function voltToken() view returns (address)",
  "function totalVaultDeposits() view returns (uint256)",
  "function totalEthContributed() view returns (uint256)",
  "function placeBet(uint256 _diceNum, bool _isEven, uint256 _diceAmount, uint256 _parityAmount)",
  "function claim(uint256 _rid)",
  "function setBettingOpen(bool _isOpen)",
  "function requestRoundSettlement() returns (uint256)",
  "function seedJackpot(uint256 amount)",
  "function setMinBet(uint256 _newMin)",
  "function getCurrentRoundState() view returns (uint256 roundId, bool isBettingOpen, uint256 totalDicePool, uint256 totalParityPool, uint256 currentJackpot, uint256 minimumBet, uint256 startTime, uint256 closeTime)",
  "function getUserBet(address _user, uint256 _rid) view returns (uint256 diceChoice, bool parityChoice, uint256 diceAmount, uint256 parityAmount, bool betOnDice, bool betOnParity, bool claimed)",
  "function getClaimPreview(address _user, uint256 _rid) view returns (uint256 poolReward, uint256 jackpotReward, uint256 totalFee, uint256 netWinnings, bool claimable)",
  "function getRoundSummary(uint256 _rid) view returns (uint256 totalDicePool, uint256 totalParityPool, uint256 totalJackpotWinners, uint256 diceResult, bool parityResult, bool settled, uint256 snapshotJackpot)"
];

const VOLT_ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

function shortAddress(value) {
  if (!value) return "Not connected";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatEth(value, digits = 4) {
  const formatted = Number(ethers.formatEther(value ?? 0n));
  return `${formatted.toFixed(digits)} ETH`;
}

function formatVolt(value, digits = 4) {
  const formatted = Number(ethers.formatEther(value ?? 0n));
  return `${formatted.toFixed(digits)} $VOLT`;
}

function parseAmountInput(value) {
  const normalized = `${value ?? ""}`.trim();
  if (!normalized) return 0n;
  return ethers.parseEther(normalized);
}

function getStoredContractAddress() {
  return localStorage.getItem(VOLTSONIC_STORAGE_KEY) || "";
}

function setStoredContractAddress(address) {
  localStorage.setItem(VOLTSONIC_STORAGE_KEY, address);
}

function showStatus(message, isError = false) {
  const el = document.getElementById("page-status");
  if (!el) return;

  el.textContent = message;
  el.classList.remove("hidden");
  el.classList.toggle("border-error", isError);
  el.classList.toggle("text-error", isError);
  el.classList.toggle("border-primary/40", !isError);
  el.classList.toggle("text-on-surface", !isError);

  window.clearTimeout(showStatus.timeoutId);
  showStatus.timeoutId = window.setTimeout(() => {
    el.classList.add("hidden");
  }, 3200);
}

async function ensureProvider() {
  if (!window.ethereum) {
    throw new Error("No wallet provider found. Install MetaMask or a compatible wallet.");
  }

  return new ethers.BrowserProvider(window.ethereum);
}

async function getRuntime({ requireSigner = false } = {}) {
  const address = getStoredContractAddress();
  if (!address) {
    throw new Error("Set and save the contract address first.");
  }

  if (!ethers.isAddress(address)) {
    throw new Error("Saved contract address is invalid.");
  }

  const provider = await ensureProvider();
  const network = await provider.getNetwork();
  let signer = null;
  let connectedAddress = null;

  if (requireSigner) {
    signer = await provider.getSigner();
    connectedAddress = await signer.getAddress();
  } else {
    const accounts = await provider.send("eth_accounts", []);
    if (accounts.length > 0) {
      signer = await provider.getSigner();
      connectedAddress = await signer.getAddress();
    }
  }

  const runner = signer || provider;
  const contract = new ethers.Contract(address, VOLTSONIC_ABI, runner);
  const tokenAddress = await contract.voltToken();
  const tokenContract = new ethers.Contract(tokenAddress, VOLT_ERC20_ABI, runner);

  return { provider, signer, contract, tokenContract, tokenAddress, connectedAddress, contractAddress: address, network };
}

async function connectWallet() {
  const provider = await ensureProvider();
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  return { provider, signer, address };
}

function wireContractAddressControls() {
  const input = document.getElementById("contract-address-input");
  const saveBtn = document.getElementById("save-contract-btn");

  if (!input || !saveBtn) return;

  input.value = getStoredContractAddress();

  saveBtn.addEventListener("click", () => {
    const nextAddress = input.value.trim();
    if (!ethers.isAddress(nextAddress)) {
      showStatus("Enter a valid contract address.", true);
      return;
    }

    setStoredContractAddress(nextAddress);
    showStatus("Contract address saved.");
    window.dispatchEvent(new CustomEvent("voltsonic:contractChanged"));
  });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function clearClaimPreview() {
  setText("claim-pool-reward", "0.0000 $VOLT");
  setText("claim-jackpot-reward", "0.0000 $VOLT");
  setText("claim-house-fee", "0.0000 $VOLT");
  setText("claim-net-winnings", "0.0000 $VOLT");
  setText("claim-round-label", "Latest settled round: --");
}

window.VoltSonicApp = {
  VOLTSONIC_ABI,
  VOLT_ERC20_ABI,
  shortAddress,
  formatEth,
  formatVolt,
  parseAmountInput,
  getStoredContractAddress,
  setStoredContractAddress,
  showStatus,
  ensureProvider,
  getRuntime,
  connectWallet,
  wireContractAddressControls,
  setText,
  clearClaimPreview,
};
