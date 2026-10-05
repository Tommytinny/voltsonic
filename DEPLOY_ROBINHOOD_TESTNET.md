# Deploy VoltSonic To Robinhood Chain Testnet

This deploys the standalone VoltSonic contract directly with `forge create`. It does not deploy a proxy, configure Chainlink, or use an upgrade script.

## 1. Prerequisites

- Foundry installed (`forge` and `cast` available in your terminal).
- A Robinhood Chain testnet funded wallet for deployment gas and ETH wagers.
- The backend settlement wallet address. `settleRound` is owner-only, so the address passed as `OWNER_ADDRESS` must be controlled by the backend scheduler or ownership must later be transferred to it.

Network details:

- Chain ID: `46630` (`0xb626`)
- RPC: `https://rpc.testnet.chain.robinhood.com`

Get testnet ETH from the faucet currently listed in the official Robinhood Chain documentation. Confirm the RPC and chain ID against that documentation before broadcasting.

## 2. Build And Test

From the `voltsonic` directory:

```sh
forge build
forge test
```

## 3. Configure Deployment Values

Copy the root environment template and fill in the values locally:

```sh
cp .env.example .env
```

Set these values in `.env`:

```dotenv
PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
OWNER_ADDRESS=0xYOUR_BACKEND_SETTLEMENT_WALLET
ROBINHOOD_TESTNET_RPC_URL=https://rpc.testnet.chain.robinhood.com
```

`OWNER_ADDRESS` may differ from the deployer. Keep `.env` private and never commit it.

Load the values into the current shell:

```sh
set -a
source .env
set +a
```

## 4. Check The Network

Confirm the configured endpoint reports the expected chain ID:

```sh
cast chain-id --rpc-url "$ROBINHOOD_TESTNET_RPC_URL"
```

The command should return `46630`. The contract accepts native ETH; no ERC-20 token deployment or address is required.

## 5. Deploy VoltSonic

The constructor takes the owner address. `--broadcast` comes before the variadic constructor arguments:

```sh
forge create src/voltsonic.sol:VoltSonic \
  --rpc-url "$ROBINHOOD_TESTNET_RPC_URL" \
  --chain-id 46630 \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --constructor-args "$OWNER_ADDRESS"
```

Save the `Deployed to:` address printed by Foundry. This is the single contract address used by the frontend and backend.

## 6. Verify The Deployment

Set `CONTRACT_ADDRESS` to the address printed by `forge create`, then check the initialized owner and round state:

```sh
export CONTRACT_ADDRESS=0xYOUR_DEPLOYED_VOLTSONIC_ADDRESS

cast call "$CONTRACT_ADDRESS" "owner()(address)" --rpc-url "$ROBINHOOD_TESTNET_RPC_URL"
cast call "$CONTRACT_ADDRESS" "getCurrentRoundState()(uint256,bool,uint256,uint256,uint256,uint256,uint256,uint256)" --rpc-url "$ROBINHOOD_TESTNET_RPC_URL"
```

The returned owner should match `OWNER_ADDRESS`. Check the deployment transaction in the Robinhood Chain testnet explorer.

## 7. Connect The Applications

Set the deployed address in:

- `frontend/.env`: `VITE_VOLTSONIC_CONTRACT_ADDRESS`
- `backend/.env`: `VOLTSONIC_CONTRACT_ADDRESS`

Configure the backend settlement signer so its address is the on-chain owner. The scheduler should wait until a round closes, choose the `randomWord` according to the backend's configured randomness source, and call `settleRound(roundId, randomWord)`. There is no Chainlink callback or on-chain randomness in this contract.

In `backend/.env`, set `VOLTSONIC_PRIVATE_KEY` to the private key for that owner address. The backend signs settlement transactions locally; do not commit this key or paste it into chat.

## 8. Operational Notes

- The contract is not upgradeable. A code change requires a new deployment and application configuration update.
- `settleRound` is restricted to the owner; an unrelated backend signer cannot settle rounds.
- The backend supplies `randomWord`; settlement randomness and scheduler availability are backend responsibilities.
- Bet transactions send native ETH as `msg.value`; the supplied bet amounts must sum exactly to the ETH value.
- Jackpot funding calls payable `seedJackpot()` with the desired ETH amount.
- Players claim native ETH. Keep the deployer and owner keys secure, and verify the settlement scheduler before funding the game contract.