// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @notice Native tMSTC escrow for mock Razorpay INR. Never deploys on mainnet.
/// @dev Trusted server attestations, NOT bank credit proofs or ZK proofs.
contract GhostChatTestTrade is ReentrancyGuard, EIP712 {
    struct Trade {
        address seller;
        address buyer;
        uint256 amount;
        uint256 inrPaise;
        uint256 acceptUntil;
        uint256 acceptedAt;
        uint256 payUntil;
        bytes32 termsHash;
        uint8 state; // 1 offered, 2 accepted, 3 settled, 4 returned
    }
    address public attestor; // storage keeps the published runtime reproducible
    uint256 public nextId = 1;
    mapping(uint256 => Trade) private trades;
    mapping(bytes32 => bool) public consumedPayments;
    bytes32 public constant PAYMENT_TYPEHASH = keccak256("TestPayment(uint256 tradeId,bytes32 termsHash,bytes32 paymentId,uint256 paidAt,uint256 validUntil)");
    event Offered(uint256 indexed tradeId, address indexed seller, address indexed buyer);
    event Accepted(uint256 indexed tradeId);
    event Released(uint256 indexed tradeId, bytes32 indexed paymentId, uint256 amount);
    event Returned(uint256 indexed tradeId);
    constructor(address signer) EIP712("GhostChat Razorpay Test", "1") {
        require(block.chainid == 91562037 || block.chainid == 31337, "TestnetOnly");
        require(signer != address(0), "InvalidSigner");
        attestor = signer;
    }
    function getTrade(uint256 id) external view returns (Trade memory) { return trades[id]; }
    function offer(address buyer, uint256 inrPaise, uint256 acceptUntil) external payable returns (uint256 id) {
        require(buyer != address(0) && buyer != msg.sender, "InvalidBuyer");
        require(msg.value > 0 && msg.value <= 10 ether && inrPaise >= 100 && inrPaise <= 10000000, "DemoLimits");
        require(acceptUntil > block.timestamp && acceptUntil <= block.timestamp + 1 days, "InvalidExpiry");
        id = nextId++;
        bytes32 terms = keccak256(abi.encode(block.chainid, address(this), id, msg.sender, buyer, msg.value, inrPaise, acceptUntil));
        trades[id] = Trade(msg.sender, buyer, msg.value, inrPaise, acceptUntil, 0, 0, terms, 1);
        emit Offered(id, msg.sender, buyer);
    }
    function accept(uint256 id, bytes32 termsHash) external {
        Trade storage t = trades[id];
        require(t.state == 1 && msg.sender == t.buyer, "WrongStateOrParty");
        require(block.timestamp <= t.acceptUntil && termsHash == t.termsHash, "InvalidTerms");
        t.state = 2; t.acceptedAt = block.timestamp; t.payUntil = block.timestamp + 30 minutes;
        emit Accepted(id);
    }
    function settle(uint256 id, bytes32 paymentId, uint256 paidAt, uint256 validUntil, bytes calldata signature) external nonReentrant {
        Trade storage t = trades[id];
        require(t.state == 2, "WrongState");
        require(paymentId != bytes32(0) && !consumedPayments[paymentId], "PaymentUsed");
        require(paidAt >= t.acceptedAt && paidAt <= t.payUntil && paidAt <= block.timestamp, "InvalidPaymentTime");
        require(validUntil >= block.timestamp && validUntil <= t.payUntil + 7 days, "ExpiredProof");
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(PAYMENT_TYPEHASH, id, t.termsHash, paymentId, paidAt, validUntil)));
        require(ECDSA.recover(digest, signature) == attestor, "InvalidAttestation");
        consumedPayments[paymentId] = true; t.state = 3;
        (bool ok,) = payable(t.buyer).call{value: t.amount}(""); require(ok, "PayoutFailed");
        emit Released(id, paymentId, t.amount);
    }
    /// @notice Seller cancels only unaccepted offers. After acceptance only buyer can return the allocation.
    function refund(uint256 id) external nonReentrant {
        Trade storage t = trades[id];
        require((t.state == 1 && msg.sender == t.seller) || (t.state == 2 && msg.sender == t.buyer), "WrongStateOrParty");
        t.state = 4;
        (bool ok,) = payable(t.seller).call{value: t.amount}(""); require(ok, "PayoutFailed");
        emit Returned(id);
    }
}
