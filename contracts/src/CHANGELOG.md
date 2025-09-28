# YansTokenUUPS – Changelog

This changelog tracks functional and upgrade-related changes for the token across major versions in `contracts/src`.

## v1 — YansTokenUUPS.sol
- Base: `Initializable`, `UUPSUpgradeable`, `OwnableUpgradeable`.
- Token: `ERC20Upgradeable` with 18 decimals.
- Permit: `ERC20PermitUpgradeable` (EIP-2612) — domain separator, nonces, `permit` maintained on upgrades.
- Initialization: `initialize(string name, string symbol, address initialRecipient, uint256 initialSupply)`
  - Sets owner via `__Ownable_init(msg.sender)` (OZ v5 pattern), initializes ERC20/Permit/UUPS, mints initial supply.
- Upgrade Auth: `_authorizeUpgrade` restricted to `onlyOwner`.

Notes
- No custom storage variables beyond inherited layouts.
- Deploy behind `ERC1967Proxy`; never call constructors for logic contracts.

## v2 — YansTokenUUPSV2.sol
- Extends v1 and adds:
  - `function mint(address to, uint256 amount) external onlyOwner`.
- Storage layout: unchanged (no new storage variables introduced).

Upgrade Guidance
- Simple `upgradeToAndCall(address implV2, "")` from the owner is sufficient (no reinitializer state needed in this version).

Annotations
- `@custom:oz-upgrades-from src/YansTokenUUPS.sol:YansTokenUUPS` — enables automatic baseline detection for validations when `REFERENCE_CONTRACT` is not supplied.

Test Coverage (examples)
- Upgrade invariants preserved (name, symbol, decimals, totalSupply, owner, balances).
- `mint` is `onlyOwner` and emits Transfer from zero address.
- `permit` nonces/behavior preserved post-upgrade.

## v3 — YansTokenUUPSV3.sol
- Inherits from `YansTokenUUPSV2` and adds:
  - Access control: `AccessControlUpgradeable` with roles
    - `DEFAULT_ADMIN_ROLE`
    - `PAUSER_ROLE`
  - Pause mechanics: `ERC20PausableUpgradeable` (`pause`, `unpause`) — transfers blocked when paused.
  - Burning: `ERC20BurnableUpgradeable` (`burn`, `burnFrom`).
- One-time reinitializer for role setup:
  - `function initializeV3(address admin) public reinitializer(3)`
    - Initializes AccessControl/Pausable/Burnable facets and grants `DEFAULT_ADMIN_ROLE` and `PAUSER_ROLE` to `admin`.
- Overrides:
  - `_update(...)` to resolve multiple inheritance between `ERC20Upgradeable` and `ERC20PausableUpgradeable`.
  - `supportsInterface` to surface AccessControl’s ERC165 support.

Upgrade Guidance
- Upgrade with data so `initializeV3` runs exactly once:
  - `upgradeToAndCall(address implV3, abi.encodeWithSelector(YansTokenUUPSV3.initializeV3.selector, admin))`
- Ensure the caller is the token owner (UUPS `onlyOwner`).

Annotations
- `@custom:oz-upgrades-from src/YansTokenUUPSV2.sol:YansTokenUUPSV2` — allows validator to infer the v2 baseline automatically.

Behavioral Notes
- When paused, `transfer`, `burn`, and `burnFrom` revert.
- Owner-only `mint` from v2 remains available in v3.
- `permit` continues to function and nonces remain intact across upgrades.

Test Coverage (examples)
- Roles assigned in `initializeV3` and enforced (only pauser can pause/unpause).
- Pause blocks transfers and burns; unpause restores operations.
- Reinitialization attempts revert (`InvalidInitialization()`).
- Storage invariants preserved across v1→v3 upgrade.

## v4 — YansTokenUUPSV4.sol
- Builds on v3 and adds:
  - Governance roles: `MINTER_ROLE`, `BURNER_ROLE`, `GOVERNOR_ROLE` (AccessControl-based).
  - Supply cap managed via `_cap`, `cap()`, and `setCap` (governor-only, cannot dip below `totalSupply`).
  - Vote checkpoints via `ERC20VotesUpgradeable`; governance is advisory (owner/Safe retains admin controls) but historical voting power is recorded.
  - Guardian pause semantics extend to allowances, permit, and vote movement through overrides of `_update` and `_approve` (custom `TransfersPaused()` error keeps mint/burn operable while paused).
  - Role-gated mint (`MINTER_ROLE`) and delegated burn (`burnFromAddress` restricted to `BURNER_ROLE`).
  - Reinitializer `initializeV4(admin, minter, burner, governor, cap)` wires new modules, assigns roles, and seeds the cap.
  - UX helper `selfDelegate()` so holders can enable voting power locally.
- Custom errors: `CapExceeded`, `NotAuthorized`, `ZeroAddress`, `TransfersPaused`.
- Storage layout: appends `_cap` at the end of v3 layout; no reordering of prior state.

Upgrade Guidance
- Deploy v4 implementation and upgrade via `upgradeToAndCall` with ABI-encoded `initializeV4` arguments.
- Configure new roles immediately after upgrade and verify the cap before resuming normal operations.
- Ensure callers operating while paused understand mint/burn remain possible but transfers/approvals (and permit) are blocked.

Test Coverage (recommended additions)
- Vote delegation/self-delegation behavior and checkpoint reads.
- Cap boundary conditions (exact cap, cap raise/lower, revert when exceeding cap).
- Pause interaction with permit/approve.
- Role restrictions for mint/burnFromAddress/setCap.

## Upgrade Checklist
- Validate proxy owner matches the signer executing the upgrade.
- For v3, always pass `initializeV3(admin)` data in `upgradeToAndCall`.
- For v4, upgrade with ABI-encoded `initializeV4(admin, minter, burner, governor, cap)` and confirm the cap/roles immediately.
- Post-upgrade sanity:
  - Verify `owner()` unchanged and key state (name/symbol/decimals/totalSupply/balances) intact.
  - For v3, confirm roles (`DEFAULT_ADMIN_ROLE`, `PAUSER_ROLE`) are configured as intended.
  - Optionally perform a minimal action (e.g., owner `mint` on v2/v3, or `pause`/`unpause` on v3) to verify behavior.

## References
- Contracts: `YansTokenUUPS.sol`, `YansTokenUUPSV2.sol`, `YansTokenUUPSV3.sol`
- Tests:
  - Audit-style: `contracts/test/TokenUUPS_Audit.t.sol`, `contracts/test/TokenUUPSV2_Audit.t.sol`, `contracts/test/TokenUUPSV3_Audit.t.sol`.
  - Functional v2/v3: `contracts/test/TokenUUPS.t.sol`, `contracts/test/TokenUUPSv3.t.sol`.
  - Gas snapshots: `contracts/test/GasSnapshot.t.sol`.
