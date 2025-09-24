# ETH Contracts

## Contracts
- `src/YansTokenUUPS.sol`: UUPS‑upgradeable ERC‑20 + Permit. Initialize via `initialize(name, symbol, recipient, supply)`. Owner controls upgrades.
- `src/YansTokenUUPSv2.sol`: V2 of the token. Adds `mint(address,uint256)` restricted to owner. Storage layout unchanged.
- `src/YansToken.sol`: Simple non‑upgradeable ERC‑20 + Permit. Constructor mints `initialSupply * 1e18` to deployer.
- `scripts/DeployUUPS.s.sol`: Deploys V1 impl + `ERC1967Proxy`, calls `initialize` with env params.
- `scripts/UpgradeUUPS.s.sol`: Upgrades proxy to V2 (from `IMPL_V2` or deploys); optional post‑upgrade mint.

## Testing

- Tests set env vars via `vm.setEnv`. Keep runtime env clean to avoid leaks from your shell `.env`.
- The included Make targets scrub `TOKEN_ADDRESS` and `IMPL_V2` for deterministic runs.

Commands (from `contracts/`):
- `make test`  — run tests (clean env)
- `make testq` — quiet
- `make testv` — verbose with traces
- `make one TEST=<pattern>` — run a single test, for example: `make one TEST=test02_`
- `make testv-all` — run each split test in isolation (separate processes)

Alternatively, run directly with a scrubbed env:
- `TOKEN_ADDRESS= IMPL_V2= forge test -vvv`
- or temporarily unset variables: `env -u TOKEN_ADDRESS -u IMPL_V2 forge test`

## Validating Upgrades

- Requires `NEW_IMPL_CONTRACT` and `REFERENCE_CONTRACT` (set in `.env` or passed inline).
- The target:
  - Builds with `FOUNDRY_PROFILE=validate` (tests ignored, build-info generated).
  - Normalizes missing `src/` prefixes on artifacts.
  - Runs `npx @openzeppelin/upgrades-core validate ... --requireReference` to check storage/layout safety.
- Example override:
  - `make validate NEW_IMPL_CONTRACT=YansTokenUUPSv3.sol:YansTokenUUPSV3 REFERENCE_CONTRACT=src/YansTokenUUPSv2.sol:YansTokenUUPSV2`

## Upgrade Script

- Script: `scripts/UpgradeUUPS.s.sol:UpgradeUUPS`
- Required env:
  - `TOKEN_ADDRESS` — proxy address (string)
  - `PRIVATE_KEY`  — 0x-prefixed 32-byte hex (controls the upgrade)
  - Optional: `IMPL_NEW` — implementation address; if omitted/invalid, the script deploys the latest contract

Running examples:
- Simulate only:
  - `forge script scripts/UpgradeUUPS.s.sol:UpgradeUUPS --rpc-url $NETWORK_RPC_URL --private-key $PRIVATE_KEY`
  - Note: On OZ v5, `upgradeTo` reverts and the script falls back to `upgradeToAndCall`.
    Some Foundry setups mark the initial revert as a failed simulation even if the fallback succeeds.
- Broadcast (skips simulation):
  - `forge script scripts/UpgradeUUPS.s.sol:UpgradeUUPS --rpc-url $NETWORK_RPC_URL --private-key $PRIVATE_KEY --broadcast --skip-simulation`

Tips:
- Ensure `IMPL_NEW` (if provided) is deployed on the target network: `cast code $IMPL_NEW` should be non-empty.
- Owner check: signer derived from `PRIVATE_KEY` must equal `owner()` of the proxy’s implementation.

## Permit Flow (ERC‑2612)

- Sign (owner): `npm run dev:permit:sign -- <amount> <minutes>`
  - Copies `PERMIT_SIGNATURE`, `PERMIT_VALUE`, `PERMIT_DEADLINE` to `.env`.
- Spend (spender): `npm run dev:permit:spend [-- <amount>]`
  - Spender must have Sepolia ETH for gas.
  - `SPENDER_ADDRESS` must match `SPENDER_PRIVATE_KEY`.
- The spend script:
  - Verifies the EIP‑712 signature off‑chain (domain, nonce, value, deadline)
  - Waits for the permit receipt, reads allowance, then calls `transferFrom`
- Common issues:
  - Stale nonce or expired deadline → re‑sign
  - Address/key mismatch → fix `.env`
  - Wrong `TOKEN_ADDRESS` (must be the proxy) → fix `.env`

## Docs / References

- UUPS upgradeable pattern (OpenZeppelin): https://docs.openzeppelin.com/contracts/5.x/upgradeable
- `UUPSUpgradeable` (API): https://docs.openzeppelin.com/contracts/5.x/api/proxy#UUPSUpgradeable
- `ERC1967Proxy` (API): https://docs.openzeppelin.com/contracts/5.x/api/proxy#ERC1967Proxy
- ERC‑20 (API): https://docs.openzeppelin.com/contracts/5.x/api/token/erc20#ERC20
- ERC‑20 Permit (API): https://docs.openzeppelin.com/contracts/5.x/api/token/erc20#ERC20Permit
- EIP‑2612 (ERC‑20 Permit): https://eips.ethereum.org/EIPS/eip-2612
- EIP‑712 (Typed Structured Data): https://eips.ethereum.org/EIPS/eip-712
- EIP‑1967 (proxy storage slots): https://eips.ethereum.org/EIPS/eip-1967
- EIP‑1822 (UUPS proxiable UUID): https://eips.ethereum.org/EIPS/eip-1822
- Foundry cheatcodes (overview): https://book.getfoundry.sh/cheatcodes
  - Env vars: https://book.getfoundry.sh/cheatcodes/env
  - Load/store (reading storage): https://book.getfoundry.sh/cheatcodes/load-store
  - Broadcast: https://book.getfoundry.sh/cheatcodes/start-stop-broadcast
  - Prank: https://book.getfoundry.sh/cheatcodes/prank
- Forge scripts (reference): https://book.getfoundry.sh/reference/forge/forge-script
