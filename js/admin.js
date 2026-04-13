(function () {
  const app = window.VoltSonicApp;

  async function refreshAdminOverview() {
    try {
      const { contract, tokenContract, contractAddress, connectedAddress } = await app.getRuntime();
      const [currentState, totalVaultDeposits, totalEthContributed, ownerAddress, contractBalance] = await Promise.all([
        contract.getCurrentRoundState(),
        contract.totalVaultDeposits(),
        contract.totalEthContributed(),
        contract.owner(),
        tokenContract.balanceOf(contractAddress),
      ]);

      const [roundId, isBettingOpen, , , currentJackpot] = currentState;
      app.setText("admin-round-status", isBettingOpen ? "OPEN" : "CLOSED");
      app.setText("admin-current-round", `#${roundId}`);
      app.setText("admin-jackpot-balance", app.formatVolt(currentJackpot));
      app.setText("admin-contract-balance", app.formatVolt(contractBalance));
      app.setText("admin-total-contributed", app.formatVolt(totalEthContributed));
      app.setText("admin-redeemable-credits", app.formatVolt(totalVaultDeposits));
      app.setText("admin-jackpot-metric", app.formatVolt(currentJackpot));
      app.setText("owner-address-display", ownerAddress);
      app.setText("admin-owner-wallet", connectedAddress ? app.shortAddress(connectedAddress) : "Not connected");
    } catch (error) {
      app.showStatus(error.message, true);
    }
  }

  async function refreshRoundActivity() {
    const feed = document.getElementById("admin-round-activity");
    if (!feed) return;

    try {
      const { contract, provider } = await app.getRuntime();
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 5000);
      const events = await contract.queryFilter(contract.filters.RoundSettled(), fromBlock, currentBlock);
      const recent = events.slice(-4).reverse();

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
    } catch (error) {
      feed.innerHTML = `
        <div class="border border-outline-variant bg-surface-container-highest p-4">
          <div class="flex items-center justify-between">
            <span class="font-mono text-xs text-on-surface">Unable to load activity</span>
            <span class="font-mono text-[10px] uppercase text-error">Error</span>
          </div>
          <div class="mt-2 text-sm text-outline">${error.message}</div>
        </div>
      `;
    }
  }

  async function runAdminAction(action, successMessage) {
    try {
      const { contract } = await app.getRuntime({ requireSigner: true });
      const tx = await action(contract);
      app.showStatus("Submitting transaction...");
      await tx.wait();
      app.showStatus(successMessage);
      await refreshAll();
    } catch (error) {
      app.showStatus(error.message, true);
    }
  }

  async function refreshAll() {
    await refreshAdminOverview();
    await refreshRoundActivity();
  }

  function wireEvents() {
    document.getElementById("connect-owner-btn")?.addEventListener("click", async () => {
      try {
        const { address } = await app.connectWallet();
        app.showStatus(`Connected ${app.shortAddress(address)}`);
        await refreshAll();
      } catch (error) {
        app.showStatus(error.message, true);
      }
    });

    document.getElementById("open-betting-btn")?.addEventListener("click", () =>
      runAdminAction((contract) => contract.setBettingOpen(true), "Betting opened.")
    );

    document.getElementById("close-betting-btn")?.addEventListener("click", () =>
      runAdminAction((contract) => contract.setBettingOpen(false), "Betting closed.")
    );

    document.getElementById("settle-round-btn")?.addEventListener("click", () => {
      runAdminAction((contract) => contract.requestRoundSettlement(), "Settlement request submitted.");
    });

    document.getElementById("seed-jackpot-btn")?.addEventListener("click", () => {
      const value = document.getElementById("seed-jackpot-input").value;
      let parsed;
      try {
        parsed = app.parseAmountInput(value);
      } catch (error) {
        app.showStatus("Enter a valid VOLT amount.", true);
        return;
      }

      if (parsed <= 0n) {
        app.showStatus("Enter a VOLT amount to seed the jackpot.", true);
        return;
      }

      runAdminAction(async (contract) => {
        const { tokenContract, contractAddress } = await app.getRuntime({ requireSigner: true });
        const approveTx = await tokenContract.approve(contractAddress, parsed);
        app.showStatus("Approving VOLT for jackpot funding...");
        await approveTx.wait();
        return contract.seedJackpot(parsed);
      }, "Jackpot funded.");
    });

    document.getElementById("update-min-bet-btn")?.addEventListener("click", () => {
      const value = document.getElementById("min-bet-input").value;
      let parsed;
      try {
        parsed = app.parseAmountInput(value);
      } catch (error) {
        app.showStatus("Enter a valid minimum bet.", true);
        return;
      }

      if (parsed <= 0n) {
        app.showStatus("Enter a minimum bet greater than zero.", true);
        return;
      }

      runAdminAction((contract) => contract.setMinBet(parsed), "Minimum bet updated.");
    });

    window.addEventListener("voltsonic:contractChanged", refreshAll);

    if (window.ethereum) {
      window.ethereum.on("accountsChanged", refreshAll);
      window.ethereum.on("chainChanged", () => window.location.reload());
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    app.wireContractAddressControls();
    wireEvents();
    if (app.getStoredContractAddress()) {
      await refreshAll();
    }
  });
})();
