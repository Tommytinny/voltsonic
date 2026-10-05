// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {VoltSonic} from "../src/voltsonic.sol";

contract TransferOwnership is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address payable contractAddress = payable(vm.envAddress("VOLTSONIC_CONTRACT_ADDRESS"));
        address newOwner = vm.envAddress("OWNER_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        VoltSonic(contractAddress).transferOwnership(newOwner);

        vm.stopBroadcast();

        console2.log("Started ownership transfer for contract:", contractAddress);
        console2.log("Pending owner:", newOwner);
    }
}
