// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {YansTokenUUPSV3} from './YansTokenUUPSV3.sol';
import {ERC20VotesUpgradeable} from '@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol';
import {ERC20PermitUpgradeable} from '@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol';
import {ERC20Upgradeable} from '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol';
import {AccessControlUpgradeable} from '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol';
import {ERC20PausableUpgradeable} from '@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol';
import {NoncesUpgradeable} from '@openzeppelin/contracts-upgradeable/utils/NoncesUpgradeable.sol';

/// @notice V4 keeps owner/admin authority while exposing vote checkpoints for future governance compatibility.
contract YansTokenUUPSV4 is YansTokenUUPSV3, ERC20VotesUpgradeable {
  bytes32 public constant MINTER_ROLE = keccak256('MINTER_ROLE');
  bytes32 public constant BURNER_ROLE = keccak256('BURNER_ROLE');
  bytes32 public constant GOVERNOR_ROLE = keccak256('GOVERNOR_ROLE');

  error CapExceeded(uint256 cap, uint256 attempted);
  error NotAuthorized();
  error ZeroAddress();
  error TransfersPaused();

  // Storage append for v4: tracks global supply ceiling enforced on future mints (0 = uncapped).
  uint256 private _cap;

  // Maximum supported cap aligns with OZ's ERC20Votes expectation of uint224 backing storage.
  uint256 private constant MAX_CAP = type(uint224).max;

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  /// @notice Completes the V4 upgrade by restoring operator roles and wiring the voting extensions.
  /// @dev Should be executed once on the proxy immediately after upgrading to the V4 implementation.
  function initializeV4(
    address admin,
    address minter,
    address burner,
    address governor,
    uint256 cap_
  ) public reinitializer(4) {
    __ERC20Votes_init();
    __ERC20Permit_init(name());

    _requireNonZero(admin);
    _requireNonZero(minter);
    _requireNonZero(burner);
    _requireNonZero(governor);

    // Re-grant core roles in case the upgrade introduces refreshed operator keys.
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _grantRole(PAUSER_ROLE, admin);
    _grantRole(MINTER_ROLE, minter);
    _grantRole(BURNER_ROLE, burner);
    _grantRole(GOVERNOR_ROLE, governor);

    _updateCap(cap_);
  }

  /// @notice Returns the supply ceiling enforced on new mints (zero means uncapped).
  function cap() external view returns (uint256) {
    return _cap;
  }

  /// @notice Adjusts the minting ceiling; zero keeps the token uncapped for future supply.
  function setCap(uint256 newCap) external onlyRole(GOVERNOR_ROLE) {
    _updateCap(newCap);
  }

  /// @notice Mints tokens to the provided recipient while respecting the global supply cap.
  function mint(address to, uint256 amount) external override onlyRole(MINTER_ROLE) {
    _requireNonZero(to);
    _enforceCap(amount);
    _mint(to, amount);
  }

  /// @notice Burns tokens from a target account when executed by an authorized burner.
  function burnFromAddress(address account, uint256 amount) external onlyRole(BURNER_ROLE) {
    _requireNonZero(account);
    _burn(account, amount);
  }

  /// @dev Validates the post-mint supply will not exceed the configured cap.
  function _enforceCap(uint256 mintAmount) internal view {
    if (_cap == 0) {
      return;
    }
    uint256 newSupply = totalSupply() + mintAmount;
    if (newSupply > _cap) {
      revert CapExceeded(_cap, newSupply);
    }
  }

  /// @dev Governor can only lower the cap down to (but not below) the live supply; zero disables the limit entirely.
  function _updateCap(uint256 newCap) internal {
    if (newCap != 0 && newCap < totalSupply()) {
      revert CapExceeded(newCap, totalSupply());
    }
    if (newCap > MAX_CAP) {
      revert CapExceeded(MAX_CAP, newCap);
    }
    _cap = newCap;
  }

  /// @dev Preserves the pause semantics while making sure vote checkpoints stay in sync.
  function _update(
    address from,
    address to,
    uint256 value
  ) internal override(YansTokenUUPSV3, ERC20VotesUpgradeable) {
    // Block peer-to-peer transfers while paused but allow mint/burn (zero address involved) for guardianship ops.
    if (paused() && from != address(0) && to != address(0)) {
      revert TransfersPaused();
    }
    super._update(from, to, value);
  }

  /// @dev Prevents new allowance approvals while paused, covering both `approve` and `permit` flows.
  function _approve(
    address owner,
    address spender,
    uint256 value,
    bool emitEvent
  ) internal virtual override(ERC20Upgradeable) {
    // `approve` and `permit` funnel through the same hook; pause should freeze new allowances entirely.
    if (paused()) {
      revert TransfersPaused();
    }
    super._approve(owner, spender, value, emitEvent);
  }

  /// @notice Relays permit signatures through OZ while blocking new approvals during pauses.
  function permit(
    address owner,
    address spender,
    uint256 value,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) public override(ERC20PermitUpgradeable) {
    if (paused()) {
      revert TransfersPaused();
    }
    super.permit(owner, spender, value, deadline, v, r, s);
  }

  /// @notice Exposes the current permit nonce for an account (required by ERC-2612).
  function nonces(address owner)
    public
    view
    override(ERC20PermitUpgradeable, NoncesUpgradeable)
    returns (uint256)
  {
    return super.nonces(owner);
  }

  /// Allows holders to delegate voting power to themselves; owner remains ultimate admin.
  function selfDelegate() external {
    _delegate(_msgSender(), _msgSender());
  }

  /// @dev Mirrors OZ's ERC20Votes `_maxSupply` but keeps the cap optional (zero == infinite cap).
  function _maxSupply() internal view override returns (uint256) {
    return _cap == 0 ? MAX_CAP : uint256(uint224(_cap));
  }

  /// @dev Provides custom error messaging for AccessControl checks.
  function _checkRole(
    bytes32 role,
    address account
  ) internal view override(AccessControlUpgradeable) {
    if (!hasRole(role, account)) {
      revert NotAuthorized();
    }
  }

  /// @notice Surface inherited interface support downstream of AccessControl + ERC20Votes mixins.
  function supportsInterface(bytes4 interfaceId)
    public
    view
    override(YansTokenUUPSV3)
    returns (bool)
  {
    return super.supportsInterface(interfaceId);
  }

  /// @dev Helper that standardizes zero-address reverts across external entry points.
  function _requireNonZero(address account) private pure {
    if (account == address(0)) {
      revert ZeroAddress();
    }
  }
}
