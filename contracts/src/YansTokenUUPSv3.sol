// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * V3: Pausable + Burnable on top of V2.
 * - Inherits from YansTokenUUPSV2 (evolution: V1 → V2 → V3).
 * - Adds PAUSER_ROLE via AccessControl; pause/unpause blocks transfers.
 * - Adds ERC20Burnable (holders can burn their tokens / allowance burnFrom).
 * - One-time reinitializer(3) to set roles after upgrade.
 *
 * @custom:oz-upgrades-from src/YansTokenUUPSV2.sol:YansTokenUUPSV2
 */

import {YansTokenUUPSV2} from './YansTokenUUPSV2.sol';
import {AccessControlUpgradeable} from '@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol';
import {ERC20PausableUpgradeable} from '@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol';
import {ERC20BurnableUpgradeable} from '@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol';
import {ERC20Upgradeable} from '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol';

contract YansTokenUUPSV3 is
  YansTokenUUPSV2,
  AccessControlUpgradeable,
  ERC20PausableUpgradeable,
  ERC20BurnableUpgradeable
{
  bytes32 public constant PAUSER_ROLE = keccak256('PAUSER_ROLE');

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    _disableInitializers();
  }

  /// One-time initializer for V3 (call after upgrade or via upgradeToAndCall).
  /// @custom:oz-upgrades-validate-as-initializer
  function initializeV3(address admin) public reinitializer(3) {
    __AccessControl_init();
    __Pausable_init();
    __ERC20Burnable_init();

    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _grantRole(PAUSER_ROLE, admin);
  }

  /// Pause/unpause restricted to PAUSER_ROLE.
  function pause() external onlyRole(PAUSER_ROLE) {
    _pause();
  }
  function unpause() external onlyRole(PAUSER_ROLE) {
    _unpause();
  }

  /// Resolve multiple inheritance of _update (ERC20 + Pausable).
  function _update(
    address from,
    address to,
    uint256 value
  ) internal override(ERC20Upgradeable, ERC20PausableUpgradeable) {
    super._update(from, to, value);
  }

  /// AccessControl supports ERC165.
  function supportsInterface(
    bytes4 interfaceId
  ) public view override(AccessControlUpgradeable) returns (bool) {
    return super.supportsInterface(interfaceId);
  }
}
