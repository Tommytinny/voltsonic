(function () {
  const app = window.VoltSonicApp;

  const state = {
    account: null,
    selectedDice: 2,
    selectedParityEven: true,
    latestSettledRoundId: null,
  };

  function updateSelectionStyles() {
    document.querySelectorAll("[data-dice]").forEach((button) => {
      const isActive = Number(button.dataset.dice) === state.selectedDice;
      button.classList.toggle("border-primary", isActive);
      button.classList.toggle("text-primary", isActive);
      button.classList.toggle("glow-primary", isActive);
      if (isActive) {
        button.classList.remove("border-outline-variant");
      } else {
        button.classList.add("border-outline-variant");
      }
    });

    document.querySelectorAll("[data-parity]").forEach((button) => {
      const wantsEven = button.dataset.parity === "even";
      const isActive = wantsEven === state.selectedParityEven;
      button.classList.toggle("bg-primary", isActive);
      button.classList.toggle("text-on-primary", isActive);
      button.classList.toggle("text-outline", !isActive);
    });

    app.setText("selected-dice-display", `${state.selectedDice}`);
    app.setText("selected-parity-display", state.selectedParityEven ? "EVEN" : "ODD");
  }

  function updateStakeSummary() {
    const diceAmount = Number(document.getElementById("dice-amount-input")?.value || 0);
    const parityAmount = Number(document.getElementById("parity-amount-input")?.value || 0);
    const total = diceAmount + parityAmount;
    app.setText("total-stake-display", `${total.toFixed(4)} $VOLT`);
  }

  async function refreshWalletInfo() {
    try {
      const { connectedAddress } = await app.getRuntime();
      state.account = connectedAddress;
      app.setText("wallet-status", connectedAddress ? app.shortAddress(connectedAddress) : "Not Connected");

      if (!connectedAddress) {
        app.setText("credits-balance", "0.0000 $VOLT");
        return;
      }

      const { tokenContract } = await app.getRuntime();
      const credits = await tokenContract.balanceOf(connectedAddress);
      app.setText("credits-balance", app.formatVolt(credits));
    } catch (error) {
      app.setText("wallet-status", "Not Connected");
    }
  }

  async function refreshOverview() {
    try {
      const { contract, tokenContract, contractAddress } = await app.getRuntime();
      const [currentState, totalVaultDeposits, totalEthContributed, contractBalance] = await Promise.all([
        contract.getCurrentRoundState(),
        contract.totalVaultDeposits(),
        contract.totalEthContributed(),
        tokenContract.balanceOf(contractAddress),
      ]);

      const [roundId, isBettingOpen, , , currentJackpot, minimumBet] = currentState;
      app.setText("current-round-display", `#${roundId}`);
      app.setText("betting-state-display", isBettingOpen ? "OPEN" : "CLOSED");
      app.setText("jackpot-balance-display", app.formatVolt(currentJackpot));
      app.setText("min-bet-display", ethers.formatEther(minimumBet));
      app.setText("contract-balance-display", app.formatVolt(contractBalance));
      app.setText("redeemable-credits-display", app.formatVolt(totalVaultDeposits));
      app.setText("total-contributed-display", app.formatVolt(totalEthContributed));
      app.setText("treasury-jackpot-display", app.formatVolt(currentJackpot));
    } catch (error) {
      app.showStatus(error.message, true);
    }
  }

  async function refreshRoundFeed() {
    const feed = document.getElementById("round-feed");
    if (!feed) return;

    try {
      const { contract, provider } = await app.getRuntime();
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 5000);
      const events = await contract.queryFilter(contract.filters.RoundSettled(), fromBlock, currentBlock);
      const recent = events.slice(-3).reverse();

      if (recent.length === 0) {
        feed.innerHTML = `
          <div class="border border-outline-variant bg-surface-container-highest p-4">
            <div class="flex items-center justify-between">
              <span class="font-mono text-xs text-on-surface">No round data</span>
              <span class="font-mono text-[10px] uppercase text-outline">Idle</span>
            </div>
            <div class="mt-2 text-sm text-outline">No RoundSettled events found yet.</div>
          </div>
        `;
        state.latestSettledRoundId = null;
        app.clearClaimPreview();
        return;
      }

      feed.innerHTML = recent.map((event) => {
        const { roundId, result, parityResult, totalJackpot } = event.args;
        return `
          <div class="border border-outline-variant bg-surface-container-highest p-4">
            <div class="flex items-center justify-between">
              <span class="font-mono text-xs text-on-surface">Round #${roundId}</span>
              <span class="font-mono text-[10px] uppercase text-primary">Settled</span>
            </div>
            <div class="mt-2 text-sm text-outline">Dice ${result}, parity ${parityResult ? "even" : "odd"}, jackpot ${app.formatVolt(totalJackpot)}</div>
          </div>
        `;
      }).join("");

      state.latestSettledRoundId = Number(recent[0].args.roundId);
      app.setText("claim-round-label", `Latest settled round: #${state.latestSettledRoundId}`);
    } catch (error) {
      feed.innerHTML = `
        <div class="border border-outline-variant bg-surface-container-highest p-4">
          <div class="flex items-center justify-between">
            <span class="font-mono text-xs text-on-surface">Unable to load history</span>
            <span class="font-mono text-[10px] uppercase text-error">Error</span>
          </div>
          <div class="mt-2 text-sm text-outline">${error.message}</div>
        </div>
      `;
    }
  }

  async function refreshClaimPreview() {
    if (!state.account || state.latestSettledRoundId === null) {
      app.clearClaimPreview();
      return;
    }

    try {
      const { contract } = await app.getRuntime();
      const preview = await contract.getClaimPreview(state.account, state.latestSettledRoundId);
      const [poolReward, jackpotReward, totalFee, netWinnings, claimable] = preview;

      if (!claimable) {
        app.clearClaimPreview();
        app.setText("claim-round-label", `Latest settled round: #${state.latestSettledRoundId}`);
        return;
      }

      app.setText("claim-pool-reward", app.formatVolt(poolReward));
      app.setText("claim-jackpot-reward", app.formatVolt(jackpotReward));
      app.setText("claim-house-fee", app.formatVolt(totalFee));
      app.setText("claim-net-winnings", app.formatVolt(netWinnings));
      app.setText("claim-round-label", `Latest settled round: #${state.latestSettledRoundId}`);
    } catch (error) {
      app.showStatus(error.message, true);
    }
  }

  async function approveVolt() {
    try {
      const amount = document.getElementById("charge-amount-input").value;
      const parsed = app.parseAmountInput(amount);
      if (parsed <= 0n) throw new Error("Enter a VOLT amount.");

      const { tokenContract, contractAddress } = await app.getRuntime({ requireSigner: true });
      const tx = await tokenContract.approve(contractAddress, parsed);
      app.showStatus("Submitting VOLT approval...");
      await tx.wait();
      app.showStatus("VOLT approval updated.");
      await refreshAll();
    } catch (error) {
      app.showStatus(error.message, true);
    }
  }

  async function placeBet() {
    try {
      const diceAmount = app.parseAmountInput(document.getElementById("dice-amount-input").value);
      const parityAmount = app.parseAmountInput(document.getElementById("parity-amount-input").value);
      if (diceAmount <= 0n && parityAmount <= 0n) {
        throw new Error("Enter a dice amount, a parity amount, or both.");
      }

      const { contract, tokenContract, contractAddress, connectedAddress } = await app.getRuntime({ requireSigner: true });
      const allowance = await tokenContract.allowance(connectedAddress, contractAddress);
      const requiredAmount = diceAmount + parityAmount;
      if (allowance < requiredAmount) {
        const approveTx = await tokenContract.approve(contractAddress, requiredAmount);
        app.showStatus("Approving VOLT spend...");
        await approveTx.wait();
      }
      const tx = await contract.placeBet(state.selectedDice, state.selectedParityEven, diceAmount, parityAmount);
      app.showStatus("Submitting bet...");
      await tx.wait();
      app.showStatus("Bet placed.");
      await refreshAll();
    } catch (error) {
      app.showStatus(error.message, true);
    }
  }

  async function claimLatestRound() {
    try {
      if (state.latestSettledRoundId === null) throw new Error("No settled round available to claim.");
      const { contract } = await app.getRuntime({ requireSigner: true });
      const tx = await contract.claim(state.latestSettledRoundId);
      app.showStatus("Claiming winnings...");
      await tx.wait();
      app.showStatus("Claim complete.");
      await refreshAll();
    } catch (error) {
      app.showStatus(error.message, true);
    }
  }

  async function refreshAll() {
    await refreshWalletInfo();
    await refreshOverview();
    await refreshRoundFeed();
    await refreshClaimPreview();
  }

  function wireEvents() {
    document.getElementById("connect-wallet-btn")?.addEventListener("click", async () => {
      try {
        const { address } = await app.connectWallet();
        state.account = address;
        app.showStatus(`Connected ${app.shortAddress(address)}`);
        await refreshAll();
      } catch (error) {
        app.showStatus(error.message, true);
      }
    });

    document.getElementById("charge-btn")?.addEventListener("click", approveVolt);
    document.getElementById("discharge-btn")?.classList.add("hidden");
    document.getElementById("place-bet-btn")?.addEventListener("click", placeBet);
    document.getElementById("claim-btn")?.addEventListener("click", claimLatestRound);

    document.getElementById("dice-amount-input")?.addEventListener("input", updateStakeSummary);
    document.getElementById("parity-amount-input")?.addEventListener("input", updateStakeSummary);

    document.querySelectorAll("[data-dice]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedDice = Number(button.dataset.dice);
        updateSelectionStyles();
      });
    });

    document.querySelectorAll("[data-parity]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedParityEven = button.dataset.parity === "even";
        updateSelectionStyles();
      });
    });

    window.addEventListener("voltsonic:contractChanged", refreshAll);

    if (window.ethereum) {
      window.ethereum.on("accountsChanged", refreshAll);
      window.ethereum.on("chainChanged", () => window.location.reload());
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    app.wireContractAddressControls();
    updateSelectionStyles();
    updateStakeSummary();
    wireEvents();
    if (app.getStoredContractAddress()) {
      await refreshAll();
    }
  });
})();
