// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {NoShowRegistry} from "../src/NoShowRegistry.sol";

/**
 * Deploys the registry. No constructor arguments: there is no global admin, since
 * every event carries its own organiser.
 *
 *   forge script script/Deploy.s.sol:Deploy \
 *     --rpc-url https://testnet-rpc.monad.xyz \
 *     --account monad-deployer --broadcast
 */
contract Deploy is Script {
    function run() external returns (NoShowRegistry registry) {
        vm.startBroadcast();
        registry = new NoShowRegistry();
        vm.stopBroadcast();

        console.log("NoShowRegistry deployed to:", address(registry));
    }
}
