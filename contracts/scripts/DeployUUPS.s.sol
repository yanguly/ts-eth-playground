// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * Forge deploy script for UUPS ERC20 + Permit.
 *
 * Env (passed to forge script via --env or .env):
 *  - TOKEN_NAME            (string)  e.g., "YAN"
 *  - TOKEN_SYMBOL          (string)  e.g., "YAN"
 *  - MY_ADDRESS     (address) your wallet to receive initial supply
 *  - INITIAL_SUPPLY        (uint256) e.g., 1000000e18 -> 1000000000000000000000000
 *
 * Run:
 * forge script scripts/DeployUUPS.s.sol:DeployUUPS \
 *   --rpc-url $NETWORK_RPC_URL \
 *   --private-key $DEPLOYER_PK \
 *   --broadcast -vv
 */

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {YansTokenUUPS} from "../src/YansTokenUUPS.sol";

contract DeployUUPS is Script {
    function run() external {
        string memory name_   = vm.envString("TOKEN_NAME");
        string memory symbol_ = vm.envString("TOKEN_SYMBOL");
        address initialRecipient = vm.envAddress("INITIAL_RECIPIENT");
        uint256 initialSupply   = vm.envUint("INITIAL_SUPPLY");

        vm.startBroadcast();

        // 1) Deploy implementation (logic) contract
        YansTokenUUPS impl = new YansTokenUUPS();

        // 2) Prepare initializer calldata for the proxy
        bytes memory initData = abi.encodeWithSelector(
            YansTokenUUPS.initialize.selector,
            name_,
            symbol_,
            initialRecipient,
            initialSupply
        );

        // 3) Deploy ERC1967Proxy pointing to implementation, calling initialize
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);

        vm.stopBroadcast();

        console2.log("Implementation:", address(impl));
        console2.log("Proxy (TOKEN_ADDRESS):", address(proxy));
    }
}
