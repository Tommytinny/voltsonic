// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {VoltSonic} from "../src/voltsonic.sol";

contract DeployVoltSonic is Script {
    function run() external returns (address contractAddress) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address ownerAddress = vm.envOr("OWNER_ADDRESS", vm.addr(deployerPrivateKey));

        vm.startBroadcast(deployerPrivateKey);

        VoltSonic game = new VoltSonic(ownerAddress);

        vm.stopBroadcast();

        contractAddress = address(game);

        console2.log("VoltSonic deployed at:", contractAddress);
        console2.log("VoltSonic owner set to:", ownerAddress);
    }
}
