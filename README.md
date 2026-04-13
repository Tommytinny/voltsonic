# VoltSonic

VoltSonic is a Foundry-based Base Sepolia game contract with a lightweight frontend and backend.

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
