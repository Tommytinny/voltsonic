VoltSonic is a blockchain gaming project built around fast, round-based play on Base.

Right now, the live game experience is focused on the dice game. Players use the `$VOLT` token to place bets on the outcome of a dice roll during an active round.

VoltSonic is being designed as a multi-game platform, so the dice game is just the beginning. More games are planned and will be added over time.

The jackpot system is also part of the broader vision for VoltSonic, but it is still a coming-soon feature and should be treated as not fully live yet.

## Mainnet Readiness

VoltSonic can be deployed to Base mainnet, but this repo should be treated as testnet-first until the checklist below is complete.

Mainnet blockers to resolve first:

1. Upgrade safety: the recent token recovery issue showed that every upgrade needs an explicit migration plan and upgrade regression test.
2. Proxy implementation safety: the project uses custom upgradeable utility contracts instead of the OpenZeppelin audited implementations, so the upgrade path deserves an extra review before production funds are involved.
3. Operational safety: Base mainnet deployment requires the mainnet token address, VRF coordinator, key hash, subscription, automation setup, multisig ownership, and verified recovery procedures.
4. Fund safety: this contract is custodial over the pooled token balance, so a full audit or at minimum an external review is strongly recommended before holding meaningful value.

Recommended pre-mainnet checklist:

1. Run fork tests against Base mainnet RPC for deploy, bet, settle, claim, and upgrade flows.
2. Add an explicit upgrade-and-migrate script for any future storage or config changes.
3. Move ownership from an EOA to a multisig before launch.
4. Configure and fund Chainlink VRF and Automation on Base mainnet.
5. Verify the implementation contract and record the proxy and implementation addresses.
6. Dry-run deployment from fresh env files and confirm the frontend and backend both point to the proxy address.
7. Rehearse incident response: pause betting, restore config, rotate owner, and recover from a failed upgrade.

## Foundry

### Build

```sh
forge build
```

### Test

```sh
forge test
```

## Deploy To Base Sepolia

The deploy script reads these environment variables:

- `PRIVATE_KEY`: deployer private key used to broadcast the transaction
- `OWNER_ADDRESS`: optional contract owner/admin address; defaults to the deployer address
- `TOKEN_ADDRESS`: deployed ERC-20 VOLT token address used by VoltSonic
- `BASE_SEPOLIA_RPC_URL`: Base Sepolia RPC endpoint
- `VRF_COORDINATOR`: optional Chainlink VRF coordinator
- `VRF_KEY_HASH`: optional VRF key hash
- `VRF_SUBSCRIPTION_ID`: optional VRF subscription id
- `VRF_REQUEST_CONFIRMATIONS`: optional, defaults to `3`
- `VRF_CALLBACK_GAS_LIMIT`: optional, defaults to `250000`

Example:

```sh
export PRIVATE_KEY=0x...
export OWNER_ADDRESS=0xYourPreferredOwnerAddress
export TOKEN_ADDRESS=0xYourVoltTokenAddress
export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

forge script script/DeployVoltSonic.s.sol:DeployVoltSonic \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
  --broadcast
```

If you want the deployer wallet and owner/admin wallet to be the same, omit `OWNER_ADDRESS`.

## Deploy To Base Mainnet

Use the same scripts, but switch all addresses and RPC values to Base mainnet values.

Minimum values to update before a mainnet deployment:

- `TOKEN_ADDRESS`
- `BASE_MAINNET_RPC_URL`
- `VRF_COORDINATOR`
- `VRF_KEY_HASH`
- `VRF_SUBSCRIPTION_ID`
- `OWNER_ADDRESS`

Example:

```sh
export PRIVATE_KEY=0x...
export OWNER_ADDRESS=0xYourMultisig
export TOKEN_ADDRESS=0xYourBaseMainnetVoltToken
export BASE_MAINNET_RPC_URL=https://mainnet.base.org
export VRF_COORDINATOR=0xYourBaseMainnetCoordinator
export VRF_KEY_HASH=0xYourBaseMainnetKeyHash
export VRF_SUBSCRIPTION_ID=123

forge script script/DeployVoltSonic.s.sol:DeployVoltSonic \
  --rpc-url "$BASE_MAINNET_RPC_URL" \
  --broadcast
```

After deployment:

1. Save the proxy address to `frontend/.env` and `backend/.env`.
2. Verify the implementation on the explorer.
3. Confirm `voltToken()`, `owner()`, `getCurrentRoundState()`, and VRF config on-chain before opening betting.

## Environment Files

Use the example files as your starting point:

```sh
cp .env.example .env
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

Then fill in:

- root `.env`: `PRIVATE_KEY`, `OWNER_ADDRESS`, `TOKEN_ADDRESS`, RPC, and VRF values
- `frontend/.env`: deployed VoltSonic proxy address for the React app
- `backend/.env`: deployed VoltSonic proxy address and indexer RPC settings

Typical order:

1. Launch your `$VOLT` token and copy its token address into root `.env` as `TOKEN_ADDRESS`
2. Deploy VoltSonic
3. Copy the deployed VoltSonic proxy address into `frontend/.env` and `backend/.env`

## Reconfigure VRF On An Existing Proxy

If the proxy was deployed with the wrong VRF key hash or subscription details, you can update it without redeploying:

```sh
forge script script/ConfigureRandomness.s.sol:ConfigureRandomness \
  --rpc-url https://sepolia.base.org \
  --broadcast
```

This reads:

- `VOLTSONIC_PROXY_ADDRESS`
- `VRF_COORDINATOR`
- `VRF_KEY_HASH`
- `VRF_SUBSCRIPTION_ID`
- `VRF_REQUEST_CONFIRMATIONS`
- `VRF_CALLBACK_GAS_LIMIT`

from the root `.env`.
