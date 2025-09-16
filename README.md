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

### ERC‑20 Permit (sign and spend)

- Sign a permit (owner):
  - Generates an EIP‑2612 signature authorizing a spender to spend your tokens without an on‑chain approve.
  - Command:
    - `npm run dev:permit:sign -- 2 60`  # 2 tokens, valid 60 minutes
    - Copy printed values into `.env`: `PERMIT_SIGNATURE`, `PERMIT_VALUE`, `PERMIT_DEADLINE`.

- Spend with the permit (spender):
  - Spender submits the permit and then calls `transferFrom` using the granted allowance.
  - Important: the spender account must have Sepolia ETH for gas.
  - Ensure `.env`:
    - `SPENDER_ADDRESS` matches `SPENDER_PRIVATE_KEY` (same account)
    - `TOKEN_ADDRESS` is your proxy; `OWNER_ADDRESS` is the signer who created the permit
  - Command:
    - `npm run dev:permit:spend`          # spends full `PERMIT_VALUE`
    - `npm run dev:permit:spend -- 1.25`  # spends a custom amount using the same permit

Notes

- The spend script pre‑verifies the EIP‑712 signature off‑chain, waits for the permit receipt, then reads back allowance before `transferFrom`.
- If you see “gas required exceeds allowance (0)” or a revert in estimation:
  - Re‑sign a fresh permit (nonce may have changed) and ensure the deadline is in the future
  - Confirm the spender has ETH and `SPENDER_ADDRESS` matches `SPENDER_PRIVATE_KEY`
- Ensure `TOKEN_ADDRESS` points to the proxy

Docs
- EIP‑712 (Typed Structured Data): https://eips.ethereum.org/EIPS/eip-712
- EIP‑2612 (ERC‑20 Permit): https://eips.ethereum.org/EIPS/eip-2612
- OpenZeppelin `ERC20Permit` (API): https://docs.openzeppelin.com/contracts/5.x/api/token/erc20#ERC20Permit
- viem `verifyTypedData`: https://viem.sh/docs/utility/verifyTypedData
- viem `writeContract`: https://viem.sh/docs/contract/writeContract

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
