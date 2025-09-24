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
npm run dev:mint -- --to 0x... --amount 100   # owner-only mint (or pass --amount-wei)
  # Flags override env vars (MINT_TO / MINT_AMOUNT / MINT_AMOUNT_WEI)
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

### Permit tools

- Revoke permit (value = 0):
  - `npm run dev:permit:revoke`          # 30 minutes TTL (deadline)
  - `npm run dev:permit:revoke -- 90`    # 90 minutes TTL
  - Submits using `SPENDER_PRIVATE_KEY` if set (relayer/spender submits), otherwise `OWNER_PRIVATE_KEY`.
  - Verifies EIP‑712 off‑chain and waits for the on‑chain receipt.
  - Docs: EIP‑2612 https://eips.ethereum.org/EIPS/eip-2612, EIP‑712 https://eips.ethereum.org/EIPS/eip-712

### Allowance tools

- Adjust allowance (increase/decrease/set):
  - `npm run dev:allowance:adjust -- inc 1.5 [spender]`
  - `npm run dev:allowance:adjust -- dec 0.75 [spender]`
  - `npm run dev:allowance:adjust -- set 2.1 [spender]` (sets exact target)
  - Tries `increaseAllowance/decreaseAllowance` first; if the token enforces zero‑first semantics, uses the fallback `approve(0)` → `approve(target)`.
  - Note: fallback is two transactions (not atomic). The tool simulates both steps before sending and attempts a best‑effort restore if the second step fails.
  - Extras: prints raw and human‑readable amounts, retries reads to avoid RPC lag; optional gas flags `--gas <gwei>` and `--priority <gwei>`.

### Upgradeable ERC-20 (UUPS)

- Deploy proxy + implementation via Foundry (env in your shell or pass with --env):

```bash
cd contracts
forge script scripts/DeployUUPS.s.sol:DeployUUPS \
  --rpc-url $NETWORK_RPC_URL --private-key $PRIVATE_KEY --broadcast -vv

# Required env for deploy:
# TOKEN_NAME, TOKEN_SYMBOL, INITIAL_RECIPIENT, INITIAL_SUPPLY
```

- Upgrade proxy to V2 (uses IMPL_V2 if provided, otherwise deploys V2):

```bash
cd contracts
forge script scripts/UpgradeUUPS.s.sol:UpgradeUUPS \
  --rpc-url $NETWORK_RPC_URL --private-key $PRIVATE_KEY --broadcast --skip-simulation -vv

# Required env: TOKEN_ADDRESS, PRIVATE_KEY
# Optional: IMPL_NEW (impl address)
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
## Upgrade validation (OpenZeppelin)

Install once:

```
forge install OpenZeppelin/openzeppelin-foundry-upgrades --no-commit
```

Validate a new implementation before upgrading:

```
# set env
export TOKEN_ADDRESS=<proxy>
export IMPL_NEW=<new_implementation>
export NETWORK_RPC_URL=<rpc>
export PRIVATE_KEY=<signer_private_key>

# dry-run validation (no tx)
make validate
```

Run tests for runtime invariants:

```
forge test -vv
```
