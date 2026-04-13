// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {VoltSonic} from "../src/voltsonic.sol";

contract ConfigureRandomness is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address payable proxyAddress = payable(vm.envAddress("VOLTSONIC_PROXY_ADDRESS"));
        address vrfCoordinator = vm.envAddress("VRF_COORDINATOR");
        bytes32 vrfKeyHash = vm.envBytes32("VRF_KEY_HASH");
        uint256 vrfSubscriptionId = vm.envUint("VRF_SUBSCRIPTION_ID");
        uint16 vrfRequestConfirmations = uint16(vm.envOr("VRF_REQUEST_CONFIRMATIONS", uint256(3)));
        uint32 vrfCallbackGasLimit = uint32(vm.envOr("VRF_CALLBACK_GAS_LIMIT", uint256(250000)));

        vm.startBroadcast(deployerPrivateKey);

        VoltSonic(proxyAddress).configureRandomness(
            vrfCoordinator,
            vrfKeyHash,
            vrfSubscriptionId,
            vrfRequestConfirmations,
            vrfCallbackGasLimit
        );

        vm.stopBroadcast();

        console2.log("Configured randomness for proxy:", proxyAddress);
        console2.log("VRF coordinator:", vrfCoordinator);
        console2.logBytes32(vrfKeyHash);
        console2.log("VRF subscription id:", vrfSubscriptionId);
    }
}
