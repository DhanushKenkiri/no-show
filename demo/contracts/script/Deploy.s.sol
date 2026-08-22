// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {NoShow} from "../src/NoShow.sol";

/**
 * Deploys NoShow with an explicit admin.
 *
 * The admin is the only address that may call finalize and payout, so it must be
 * the organiser account. Defaults to the broadcasting key, which is what you want
 * when deploying from the keystore, but ADMIN can override it.
 *
 *   forge script script/Deploy.s.sol:Deploy \
 *     --rpc-url https://testnet-rpc.monad.xyz \
 *     --account monad-deployer --broadcast
 */
contract Deploy is Script {
    function run() external returns (NoShow noShow) {
        address admin = vm.envOr("ADMIN", msg.sender);

        vm.startBroadcast();
        noShow = new NoShow(admin);
        vm.stopBroadcast();

        console.log("NoShow deployed to:", address(noShow));
        console.log("admin:            ", admin);
    }
}
