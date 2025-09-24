// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * UUPS upgradeable ERC20 with EIP-2612 Permit.
 * - Initialize via initialize(...), NOT a constructor!
 * - Uses OpenZeppelin *Upgradeable* contracts.
 * - Upgrades are authorized by the owner (recommend multisig+timelock in prod).
 */

import {Initializable} from '@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol';
import {UUPSUpgradeable} from '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import {OwnableUpgradeable} from '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';

import {ERC20Upgradeable} from '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol';
import {ERC20PermitUpgradeable} from '@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol';

contract YansTokenUUPS is
  Initializable,
  ERC20Upgradeable,
  ERC20PermitUpgradeable,
  UUPSUpgradeable,
  OwnableUpgradeable
{
  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() {
    // Disable all initializers on the implementation contract
    _disableInitializers();
  }

  /**
   * @param name_   Token name (e.g., "YAN")
   * @param symbol_ Token symbol (e.g., "YAN")
   * @param initialRecipient Address receiving the initial supply
   * @param initialSupply    Initial supply in smallest units (e.g., 1_000_000e18)
   *
   * Note: decimals default to 18 (ERC20Upgradeable).
   */
  function initialize(
    string memory name_,
    string memory symbol_,
    address initialRecipient,
    uint256 initialSupply
  ) public initializer {
    // In OZ v5, OwnableUpgradeable requires the initial owner param
    __Ownable_init(msg.sender);
    __ERC20_init(name_, symbol_);
    __ERC20Permit_init(name_);
    __UUPSUpgradeable_init();

    _mint(initialRecipient, initialSupply);
  }

  /// Restrict upgrades to the owner (set via __Ownable_init above)
  function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
