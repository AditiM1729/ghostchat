// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @notice Mutual reference confirmation, NOT bank-payment verification. MST Mainnet deployment variant.
contract GhostChatMainnetTrade is ReentrancyGuard {
    struct Trade { address seller; address buyer; uint256 amount; uint256 inrPaise; uint8 state; }
    // State compatibility with SellerTrade: 1 funded, 3 confirmation pending, 4 released, 5 returned, 6 mismatch/dispute.
    struct Confirmations { bytes32 buyer; bytes32 seller; }
    struct Cancellation { bool buyer; bool seller; }
    mapping(uint256 => Trade) public trades;
    mapping(uint256 => address) public verifiers;
    mapping(uint256 => Confirmations) public confirmations;
    mapping(uint256 => Cancellation) public cancellations;
    uint256 public nextId = 1;
    bytes32 public constant CONFIRMATION_TYPEHASH = keccak256("UTRConfirmation(uint256 tradeId,address actor,bytes32 commitment)");
    event Offered(uint256 indexed id, address indexed seller, address indexed buyer);
    event StateChanged(uint256 indexed id, uint8 state);
    event ReferenceConfirmed(uint256 indexed id, address indexed actor);
    event CancellationApproved(uint256 indexed id, address indexed actor);

    constructor() {
        require(block.chainid == 4646 || block.chainid == 31337, "MSTMainnetOnly");
    }
    function offer(address buyer, uint256 inrPaise, address verifier) external payable returns (uint256 id) {
        require(buyer != address(0) && buyer != msg.sender && verifier != address(0), "InvalidParty");
        require(msg.value > 0 && msg.value <= 10 ether && inrPaise >= 100 && inrPaise <= 10000000, "DemoLimits");
        id = nextId++; trades[id] = Trade(msg.sender, buyer, msg.value, inrPaise, 1); verifiers[id] = verifier;
        emit Offered(id, msg.sender, buyer);
    }
    function confirmUTR(uint256 id, bytes32 commitment, bytes calldata signature) external nonReentrant {
        Trade storage t = trades[id];
        require(_active(t.state) && (msg.sender == t.buyer || msg.sender == t.seller), "WrongStateOrParty");
        require(commitment != bytes32(0), "EmptyReference");
        bytes32 domain = keccak256(abi.encode(keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"), keccak256("GhostChat Mutual UTR"), keccak256("1"), block.chainid, address(this)));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domain, keccak256(abi.encode(CONFIRMATION_TYPEHASH, id, msg.sender, commitment))));
        require(ECDSA.recover(digest, signature) == verifiers[id], "InvalidReferenceAttestation");
        Confirmations storage c = confirmations[id];
        if (msg.sender == t.buyer) c.buyer = commitment; else c.seller = commitment;
        emit ReferenceConfirmed(id, msg.sender);
        if (c.buyer != bytes32(0) && c.buyer == c.seller) {
            _pay(id, t, true);
        } else {
            t.state = c.buyer != bytes32(0) && c.seller != bytes32(0) ? 6 : 3;
            emit StateChanged(id, t.state);
        }
    }
    /// @dev No seller timeout reclaim: buyer may already have sent INR but not yet reported it.
    function approveCancellation(uint256 id) external nonReentrant {
        Trade storage t = trades[id];
        require(_active(t.state) && (msg.sender == t.buyer || msg.sender == t.seller), "WrongStateOrParty");
        Cancellation storage c = cancellations[id];
        if (msg.sender == t.buyer) c.buyer = true; else c.seller = true;
        emit CancellationApproved(id, msg.sender);
        if (c.buyer && c.seller) _pay(id, t, false);
    }
    function revokeCancellation(uint256 id) external {
        Trade storage t = trades[id];
        require(_active(t.state) && (msg.sender == t.buyer || msg.sender == t.seller), "WrongStateOrParty");
        if (msg.sender == t.buyer) cancellations[id].buyer = false; else cancellations[id].seller = false;
    }
    function _active(uint8 state) private pure returns (bool) { return state == 1 || state == 3 || state == 6; }
    function _pay(uint256 id, Trade storage t, bool toBuyer) private {
        t.state = toBuyer ? 4 : 5;
        (bool ok,) = payable(toBuyer ? t.buyer : t.seller).call{value: t.amount}("");
        require(ok, "PayoutFailed"); emit StateChanged(id, t.state);
    }
}

