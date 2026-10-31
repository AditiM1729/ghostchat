// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Testnet-only escrow. Payment confirmations are user statements, not bank verification.
contract GhostChatSellerTrade is ReentrancyGuard {
    struct Trade {
        address seller;
        address buyer;
        uint256 amount;
        uint256 inrPaise;
        uint8 state; // 1 offered, 2 accepted, 3 buyer reports payment, 4 released, 5 returned, 6 disputed
    }
    mapping(uint256 => Trade) public trades;
    uint256 public nextId = 1;
    event Offered(uint256 indexed id, address indexed seller, address indexed buyer);
    event StateChanged(uint256 indexed id, uint8 state);

    constructor() { require(block.chainid == 91562037 || block.chainid == 31337, "TestnetOnly"); }

    function offer(address buyer, uint256 inrPaise) external payable returns (uint256 id) {
        require(buyer != address(0) && buyer != msg.sender, "InvalidBuyer");
        require(msg.value > 0 && msg.value <= 10 ether && inrPaise >= 100 && inrPaise <= 10000000, "DemoLimits");
        id = nextId++;
        trades[id] = Trade(msg.sender, buyer, msg.value, inrPaise, 1);
        emit Offered(id, msg.sender, buyer);
    }
    function accept(uint256 id) external {
        Trade storage t = trades[id];
        require(t.state == 1 && msg.sender == t.buyer, "WrongStateOrParty");
        t.state = 2; emit StateChanged(id, 2);
    }
    function reportPaid(uint256 id) external {
        Trade storage t = trades[id];
        require(t.state == 2 && msg.sender == t.buyer, "WrongStateOrParty");
        t.state = 3; emit StateChanged(id, 3);
    }
    function release(uint256 id) external nonReentrant {
        Trade storage t = trades[id];
        require((t.state == 3 || t.state == 6) && msg.sender == t.seller, "WrongStateOrParty");
        t.state = 4;
        (bool ok,) = payable(t.buyer).call{value: t.amount}(""); require(ok, "PayoutFailed");
        emit StateChanged(id, 4);
    }
    function dispute(uint256 id) external {
        Trade storage t = trades[id];
        require((t.state == 2 || t.state == 3) && (msg.sender == t.seller || msg.sender == t.buyer), "WrongStateOrParty");
        t.state = 6; emit StateChanged(id, 6);
    }
    /// @dev Once accepted, only the buyer may return the allocation, even during a dispute.
    function refund(uint256 id) external nonReentrant {
        Trade storage t = trades[id];
        require((t.state == 1 && msg.sender == t.seller) || ((t.state == 2 || t.state == 3 || t.state == 6) && msg.sender == t.buyer), "WrongStateOrParty");
        t.state = 5;
        (bool ok,) = payable(t.seller).call{value: t.amount}(""); require(ok, "PayoutFailed");
        emit StateChanged(id, 5);
    }
}
