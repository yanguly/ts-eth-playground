// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract YansToken is ERC20 {
    constructor(string memory name_, string memory symbol_, uint256 initialSupply)
        ERC20(name_, symbol_)
    {
        _mint(msg.sender, initialSupply * 1e18);
    }
}