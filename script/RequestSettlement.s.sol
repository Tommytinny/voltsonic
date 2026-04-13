// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {VoltSonic} from "../src/voltsonic.sol";

contract RequestSettlement is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address payable proxyAddress = payable(vm.envAddress("VOLTSONIC_PROXY_ADDRESS"));

        vm.startBroadcast(deployerPrivateKey);

        uint256 requestId = VoltSonic(proxyAddress).requestRoundSettlement();

        vm.stopBroadcast();

        console2.log("Requested settlement for round, requestId:", requestId);
    }
}
