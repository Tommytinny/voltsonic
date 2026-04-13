// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {VoltSonic} from "../src/voltsonic.sol";

contract SetVoltToken is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address payable proxyAddress = payable(vm.envAddress("VOLTSONIC_PROXY_ADDRESS"));
        address tokenAddress = vm.envAddress("TOKEN_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        VoltSonic(proxyAddress).setVoltToken(tokenAddress);

        vm.stopBroadcast();

        console2.log("Updated VOLT token for proxy:", proxyAddress);
        console2.log("Token address:", tokenAddress);
    }
}
