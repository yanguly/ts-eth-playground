// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {YansTokenUUPS} from "./YansTokenUUPS.sol";

/**
 * V2: adds owner-only mint. Storage layout unchanged.
 */
contract YansTokenUUPSV2 is YansTokenUUPS {
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}