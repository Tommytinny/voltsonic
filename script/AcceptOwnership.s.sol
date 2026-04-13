// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {VoltSonic} from "../src/voltsonic.sol";

contract AcceptOwnership is Script {
    function run() external {
        uint256 pendingOwnerPrivateKey = vm.envUint("PRIVATE_KEY");
        address payable proxyAddress = payable(vm.envAddress("VOLTSONIC_PROXY_ADDRESS"));
        address pendingOwnerAddress = vm.addr(pendingOwnerPrivateKey);

        vm.startBroadcast(pendingOwnerPrivateKey);

        VoltSonic(proxyAddress).acceptOwnership();

        vm.stopBroadcast();

        console2.log("Accepted ownership for proxy:", proxyAddress);
        console2.log("New owner:", pendingOwnerAddress);
    }
}
