# VoltSonic

VoltSonic is a round-based dice game that uses native ETH for bets, jackpot funding, and payouts. The game is deployed as a standalone, non-upgradeable contract. Its backend scheduler handles round settlement and submits the result to the owner-only `settleRound` function; the contract does not integrate Chainlink VRF or Automation.

## Build And Test

```sh
forge build
forge test
```

## Deploy

For a step-by-step deployment to Robinhood Chain testnet using `forge create`, see [DEPLOY_ROBINHOOD_TESTNET.md](DEPLOY_ROBINHOOD_TESTNET.md).

The constructor argument is:

1. `initialOwner`: owner address, which must be able to submit settlement transactions for the backend scheduler.

The deployment creates one contract address directly. There is no implementation/proxy pair and no upgrade mechanism.

## Backend Settlement

The scheduler should wait until the current round's `closeTime`, generate the round result off-chain, then call:

```solidity
settleRound(roundId, randomWord)
```

Only the contract owner can call this function. The contract maps `randomWord` to a dice result with `(randomWord % 6) + 1`; the backend and its signer are therefore part of the game's trust model.

## Environment Files

Create local environment files from the templates:

```sh
cp .env.example .env
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

Set `VOLTSONIC_CONTRACT_ADDRESS` in the backend environment and `VITE_VOLTSONIC_CONTRACT_ADDRESS` in the frontend environment to the deployed contract address. Players need native ETH in their Robinhood Chain wallet for wagers and gas. Keep private keys out of source control.

## Ownership

Ownership transfer uses a two-step flow. The current owner starts a transfer with `script/TransferOwnership.s.sol:TransferOwnership`; the pending owner accepts it with `script/AcceptOwnership.s.sol:AcceptOwnership`. Both scripts read `VOLTSONIC_CONTRACT_ADDRESS` and `PRIVATE_KEY` from the root environment.