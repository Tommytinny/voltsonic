// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {VoltSonic} from "../src/voltsonic.sol";

contract SimpleERC1967Proxy {
    bytes32 private constant IMPLEMENTATION_SLOT =
        bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);

    constructor(address implementation, bytes memory initData) payable {
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly {
            sstore(slot, implementation)
        }

        if (initData.length > 0) {
            (bool success, bytes memory returndata) = implementation.delegatecall(initData);
            if (!success) {
                assembly {
                    revert(add(returndata, 32), mload(returndata))
                }
            }
        }
    }

    fallback() external payable {
        _delegate();
    }

    receive() external payable {
        _delegate();
    }

    function _delegate() internal {
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly {
            let implementation := sload(slot)
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())

            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}

contract DeployVoltSonic is Script {
    function run() external returns (address proxyAddress, address implementationAddress) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address ownerAddress = vm.envOr("OWNER_ADDRESS", vm.addr(deployerPrivateKey));
        address voltTokenAddress = vm.envAddress("TOKEN_ADDRESS");
        address vrfCoordinator = vm.envOr("VRF_COORDINATOR", address(0));
        bytes32 vrfKeyHash = vm.envOr("VRF_KEY_HASH", bytes32(0));
        uint256 vrfSubscriptionId = vm.envOr("VRF_SUBSCRIPTION_ID", uint256(0));
        uint16 vrfRequestConfirmations = uint16(vm.envOr("VRF_REQUEST_CONFIRMATIONS", uint256(3)));
        uint32 vrfCallbackGasLimit = uint32(vm.envOr("VRF_CALLBACK_GAS_LIMIT", uint256(250000)));

        vm.startBroadcast(deployerPrivateKey);

        VoltSonic implementation = new VoltSonic();
        SimpleERC1967Proxy proxy = new SimpleERC1967Proxy(
            address(implementation),
            abi.encodeCall(VoltSonic.initialize, (ownerAddress, voltTokenAddress))
        );
        address payable proxyAddressPayable = payable(address(proxy));

        if (vrfCoordinator != address(0)) {
            VoltSonic(proxyAddressPayable).configureRandomness(
                vrfCoordinator,
                vrfKeyHash,
                vrfSubscriptionId,
                vrfRequestConfirmations,
                vrfCallbackGasLimit
            );
        }

        vm.stopBroadcast();

        implementationAddress = address(implementation);
        proxyAddress = address(proxy);

        console2.log("VoltSonic implementation deployed at:", implementationAddress);
        console2.log("VoltSonic proxy deployed at:", proxyAddress);
        console2.log("VoltSonic owner set to:", ownerAddress);
        console2.log("Volt token set to:", voltTokenAddress);
        if (vrfCoordinator != address(0)) {
            console2.log("VRF coordinator configured:", vrfCoordinator);
            console2.log("VRF subscription id:", vrfSubscriptionId);
        }
    }
}
