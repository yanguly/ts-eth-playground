# Crypto Playground

A minimal TypeScript + Foundry setup for experimenting with Ethereum and cryptography.  
The focus is on learning by doing: wallets, transactions, and simple ERC-20 contracts on Sepolia.

---

## Features

- Wallet generation and crypto utilities  
- ETH balance checks and transfers (Sepolia testnet)  
- ERC-20 token deployment, reading, and transfers  
- Modular TypeScript scripts using [viem](https://viem.sh/)  
- Contracts built with [Foundry](https://book.getfoundry.sh/)
- Upgradeable ERC‑20 (UUPS) + Foundry scripts to deploy/upgrade

---

## Getting started

```bash
git clone https://github.com/yanguly/ts-eth-playground.git # or SSH
cd ts-eth-playground
npm install
```

Create a .env file (see .env.example) with your Sepolia RPC, private key, and addresses.

## Usage

### Wallet & ETH

```bash
npm run dev:wallet     # generate a wallet
npm run dev:balance    # check ETH balance
npm run dev:send       # send ETH transaction
```

### ERC-20

```bash
npm run dev:deploy     # deploy ERC-20 token
npm run dev:read       # read token data and balances
npm run dev:transfer   # transfer tokens
```

### Upgradeable ERC-20 (UUPS)

- Deploy proxy + implementation via Foundry (env in your shell or pass with --env):

```bash
cd contracts
forge script scripts/DeployUUPS.s.sol:DeployUUPS \
  --rpc-url $RPC --private-key $PK --broadcast -vv

# Required env for deploy:
# TOKEN_NAME, TOKEN_SYMBOL, INITIAL_RECIPIENT, INITIAL_SUPPLY
```

- Upgrade proxy to V2 (uses IMPL_V2 if provided, otherwise deploys V2):

```bash
cd contracts
forge script scripts/UpgradeUUPS.s.sol:UpgradeUUPS \
  --rpc-url $RPC --private-key $PK --broadcast --skip-simulation -vv

# Required env: TOKEN_ADDRESS, PRIVATE_KEY
# Optional: IMPL_V2 (impl address), MINT_TO, MINT_AMOUNT
```

## Example

```bash
npm run dev:deploy
# → contract address: 0xABC...

npm run dev:read
# → Yan's Token (YAN), decimals: 18
# → Balance of 0xYourAddress: 1000000 YAN
```

## Notes

- Contracts are compiled with Foundry (`forge build`).
- Scripts are written in TypeScript and use `tsx` for execution.
- This project is for experimentation — not production use.

---

## Contracts quickref

- UUPS token (upgradeable): `contracts/src/YansTokenUUPS.sol`  
- V2 token (adds owner‑only `mint`): `contracts/src/YansTokenUUPSv2.sol`  
- Simple token (non‑upgradeable): `contracts/src/YansToken.sol`  
- Deploy script: `contracts/scripts/DeployUUPS.s.sol`  
- Upgrade script: `contracts/scripts/UpgradeUUPS.s.sol`

Testing (clean env helpers):
- From `contracts/`: `make testv` (or `make testv-all` for per‑test isolation)  
- More details in `contracts/README.md`
