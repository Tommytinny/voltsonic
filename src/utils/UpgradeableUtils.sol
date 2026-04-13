// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

abstract contract Initializable {
    bool private _initialized;
    bool private _initializing;

    modifier initializer() {
        require(!_initialized || _initializing, "InvalidInitialization");

        bool isTopLevelCall = !_initializing;
        if (isTopLevelCall) {
            _initialized = true;
            _initializing = true;
        }

        _;

        if (isTopLevelCall) {
            _initializing = false;
        }
    }

    modifier onlyInitializing() {
        require(_initializing, "NotInitializing");
        _;
    }

    function _disableInitializers() internal virtual {
        require(!_initializing, "Currently initializing");
        _initialized = true;
    }
}

abstract contract OwnableUpgradeable is Initializable {
    address private _owner;
    address private _pendingOwner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == _owner, "Ownable: caller is not the owner");
        _;
    }

    function __Ownable_init(address initialOwner) internal onlyInitializing {
        require(initialOwner != address(0), "Ownable: zero owner");
        _owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    function owner() public view returns (address) {
        return _owner;
    }

    function pendingOwner() public view returns (address) {
        return _pendingOwner;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "Ownable: zero owner");
        _pendingOwner = newOwner;
        emit OwnershipTransferStarted(_owner, newOwner);
    }

    function acceptOwnership() public {
        require(msg.sender == _pendingOwner, "Ownable: caller is not the pending owner");
        address previousOwner = _owner;
        _owner = _pendingOwner;
        _pendingOwner = address(0);
        emit OwnershipTransferred(previousOwner, _owner);
    }
}

abstract contract UUPSUpgradeable is Initializable {
    address private immutable __self = address(this);
    bytes32 internal constant _IMPLEMENTATION_SLOT =
        bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);

    event Upgraded(address indexed implementation);

    function __UUPSUpgradeable_init() internal onlyInitializing {}

    function _authorizeUpgrade(address newImplementation) internal virtual;

    modifier onlyProxy() {
        require(address(this) != __self, "UUPSUpgradeable: must be called through delegatecall");
        require(_getImplementation() == __self, "UUPSUpgradeable: must be active proxy");
        _;
    }

    modifier notDelegated() {
        require(address(this) == __self, "UUPSUpgradeable: must not be called through delegatecall");
        _;
    }

    function upgradeTo(address newImplementation) external virtual onlyProxy {
        _authorizeUpgrade(newImplementation);
        _upgradeToAndCall(newImplementation, bytes(""), false);
    }

    function upgradeToAndCall(address newImplementation, bytes memory data) external payable virtual onlyProxy {
        _authorizeUpgrade(newImplementation);
        _upgradeToAndCall(newImplementation, data, true);
    }

    function proxiableUUID() external view virtual notDelegated returns (bytes32) {
        return _IMPLEMENTATION_SLOT;
    }

    function _upgradeToAndCall(address newImplementation, bytes memory data, bool executeCall) internal {
        require(newImplementation.code.length > 0, "UUPSUpgradeable: new implementation is not a contract");
        _checkProxiableUUID(newImplementation);
        _setImplementation(newImplementation);
        emit Upgraded(newImplementation);

        if (executeCall && data.length > 0) {
            (bool success, bytes memory returndata) = address(this).delegatecall(data);
            if (!success) {
                assembly {
                    revert(add(returndata, 32), mload(returndata))
                }
            }
        }
    }

    function _checkProxiableUUID(address newImplementation) private view {
        (bool success, bytes memory returndata) =
            newImplementation.staticcall(abi.encodeWithSignature("proxiableUUID()"));
        require(success && returndata.length == 32, "UUPSUpgradeable: unsupported proxiableUUID");

        bytes32 slot = abi.decode(returndata, (bytes32));
        require(slot == _IMPLEMENTATION_SLOT, "UUPSUpgradeable: unsupported storage slot");
    }

    function _getImplementation() internal view returns (address implementation) {
        bytes32 slot = _IMPLEMENTATION_SLOT;
        assembly {
            implementation := sload(slot)
        }
    }

    function _setImplementation(address newImplementation) private {
        bytes32 slot = _IMPLEMENTATION_SLOT;
        assembly {
            sstore(slot, newImplementation)
        }
    }
}

abstract contract ReentrancyGuardUpgradeable is Initializable {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    function __ReentrancyGuard_init() internal onlyInitializing {
        _status = _NOT_ENTERED;
    }
}
