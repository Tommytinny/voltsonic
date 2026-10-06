// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {Voltron} from "../src/voltron.sol";

contract DeployVoltron is Script {
    function run() external returns (address contractAddress) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address ownerAddress = vm.envOr("OWNER_ADDRESS", vm.addr(deployerPrivateKey));

        vm.startBroadcast(deployerPrivateKey);

        Voltron game = new Voltron(ownerAddress);

        vm.stopBroadcast();

        contractAddress = address(game);

        console2.log("Voltron deployed at:", contractAddress);
        console2.log("Voltron owner set to:", ownerAddress);
    }
}
