// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {GhostPayNativeEscrow} from "./GhostPayNativeEscrow.sol";
import {GhostPayCommunity} from "./GhostPayCommunity.sol";
import {GhostChatMainnetTrade} from "./GhostChatMainnetTrade.sol";

/// @notice Creates the three current payment modules atomically, without funding them.
/// @dev The suite has no owner privileges, upgrades, or withdrawal methods.
contract GhostChatMainnetSuite {
    address public nativeEscrow;
    address public community;
    address public p2p;
    event SuiteDeployed(address indexed deployer, address nativeEscrow, address community, address p2p);

    constructor() {
        require(block.chainid == 4646 || block.chainid == 31337, "MSTMainnetOnly");
        nativeEscrow = address(new GhostPayNativeEscrow());
        community = address(new GhostPayCommunity());
        p2p = address(new GhostChatMainnetTrade());
        emit SuiteDeployed(msg.sender, nativeEscrow, community, p2p);
    }
}
