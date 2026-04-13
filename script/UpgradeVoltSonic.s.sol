// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {VoltSonic} from "../src/voltsonic.sol";

contract UpgradeVoltSonic is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address proxyAddress = vm.envAddress("VOLTSONIC_PROXY_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy new implementation
        VoltSonic newImpl = new VoltSonic();
        console2.log("New implementation deployed at:", address(newImpl));

        // Upgrade proxy
        VoltSonic(payable(proxyAddress)).upgradeTo(address(newImpl));

        vm.stopBroadcast();

        console2.log("Upgraded proxy to:", address(newImpl));
    }
}
