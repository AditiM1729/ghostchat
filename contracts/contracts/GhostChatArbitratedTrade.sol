// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Experimental native MSTC escrow for direct UPI trades.
/// @dev User confirmations are not evidence of a bank credit. Not audited.
contract GhostChatArbitratedTrade is ReentrancyGuard {
    enum State { Missing, Offered, Accepted, PaymentReported, Disputed, Released, Refunded }
    struct Trade {
        address seller;
        address buyer;
        address arbitrator;
        uint256 amount;
        uint256 inrPaise;
        State state;
        bool arbitratorAccepted;
    }
    mapping(uint256 => Trade) public trades;
    uint256 public nextId = 1;
    event Offered(uint256 indexed id, address indexed seller, address indexed buyer, address arbitrator, uint256 amount, uint256 inrPaise);
    event StateChanged(uint256 indexed id, State state);
    event ArbitratorAccepted(uint256 indexed id, address indexed arbitrator);

    constructor() { require(block.chainid == 4646 || block.chainid == 91562037 || block.chainid == 31337, "UnsupportedChain"); }

    function offer(address buyer, address arbitrator, uint256 inrPaise) external payable returns (uint256 id) {
        require(buyer != address(0) && buyer != msg.sender, "InvalidBuyer");
        require(arbitrator != address(0) && arbitrator != buyer && arbitrator != msg.sender, "InvalidArbitrator");
        require(msg.value > 0 && inrPaise > 0, "InvalidAmount");
        id = nextId++;
        trades[id] = Trade(msg.sender, buyer, arbitrator, msg.value, inrPaise, State.Offered, false);
        emit Offered(id, msg.sender, buyer, arbitrator, msg.value, inrPaise);
    }
    function acceptArbitration(uint256 id) external {
        Trade storage t = trades[id];
        require(t.state == State.Offered && msg.sender == t.arbitrator && !t.arbitratorAccepted, "WrongStateOrParty");
        t.arbitratorAccepted = true; emit ArbitratorAccepted(id, msg.sender);
    }
    function accept(uint256 id) external {
        Trade storage t = trades[id];
        require(t.state == State.Offered && msg.sender == t.buyer && t.arbitratorAccepted, "WrongStateOrParty");
        t.state = State.Accepted; emit StateChanged(id, t.state);
    }
    function reportPaid(uint256 id) external {
        Trade storage t = trades[id];
        require(t.state == State.Accepted && msg.sender == t.buyer, "WrongStateOrParty");
        t.state = State.PaymentReported; emit StateChanged(id, t.state);
    }
    function release(uint256 id) external nonReentrant {
        Trade storage t = trades[id];
        require(t.state == State.PaymentReported && msg.sender == t.seller, "WrongStateOrParty");
        _pay(id, t, true);
    }
    function dispute(uint256 id) external {
        Trade storage t = trades[id];
        require((t.state == State.Accepted || t.state == State.PaymentReported) && (msg.sender == t.buyer || msg.sender == t.seller), "WrongStateOrParty");
        t.state = State.Disputed; emit StateChanged(id, t.state);
    }
    /// @notice The arbitrator can send the entire deposit to the buyer or seller only after a dispute.
    function resolve(uint256 id, bool releaseToBuyer) external nonReentrant {
        Trade storage t = trades[id];
        require(t.state == State.Disputed && msg.sender == t.arbitrator, "WrongStateOrParty");
        _pay(id, t, releaseToBuyer);
    }
    function refund(uint256 id) external nonReentrant {
        Trade storage t = trades[id];
        require((t.state == State.Offered && msg.sender == t.seller) || (t.state == State.Accepted && msg.sender == t.buyer), "WrongStateOrParty");
        _pay(id, t, false);
    }
    function _pay(uint256 id, Trade storage t, bool buyerWins) private {
        t.state = buyerWins ? State.Released : State.Refunded;
        (bool ok,) = payable(buyerWins ? t.buyer : t.seller).call{value: t.amount}("");
        require(ok, "PayoutFailed"); emit StateChanged(id, t.state);
    }
}
