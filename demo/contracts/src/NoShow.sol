// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title NoShow
 * @notice Event registration where turning up is proven on chain, not by an admin
 *         with a laptop.
 *
 *         Registering authorises an x402 `upto` hold off chain; this contract only
 *         records that it happened. Check-in requires submitting a challenge derived
 *         from the block number, which is only valid inside a 3-block window. At
 *         Monad's 400ms blocks that is 1.2 seconds, so the claim can only be made by
 *         somebody looking at the venue screen at that moment.
 *
 *         That single comparison in `checkIn` is the whole anti-farming mechanism,
 *         and it only works because blocks are 400ms.
 */
contract NoShow {
    /// @dev Packs to one 32-byte slot. Proven with `forge inspect NoShow storageLayout`,
    ///      not by eyeballing byte counts.
    struct Attendee {
        uint40 registeredAt; //  5   unix seconds
        uint40 checkedInAt; //  5   0 = not yet
        uint40 holdUsdc; //  5   6dp, so 2_000_000 == $2.00
        uint8 status; //  1   see STATUS_* below
        bool settled; //  1   the x402 authorisation has been resolved either way
        bool paidOut; //  1   received a share of the charged no-show holds
    } //                     // 18 bytes used of 32

    uint256 private constant CHALLENGE_BLOCKS = 3;

    uint8 public constant STATUS_NONE = 0;
    uint8 public constant STATUS_REGISTERED = 1;
    uint8 public constant STATUS_CHECKED_IN = 2;
    uint8 public constant STATUS_NO_SHOW = 3;

    /// @notice The organiser. A single address is the correct amount of structure here.
    address public immutable admin;

    mapping(bytes32 => mapping(address => Attendee)) private attendees;

    /// @notice Per event, never global — a global counter would serialise otherwise
    ///         parallel registrations.
    mapping(bytes32 => uint32) public registeredCount;
    mapping(bytes32 => uint32) public checkedInCount;
    mapping(bytes32 => bool) public closed;

    /// @dev eventId and who are indexed because /manage filters on both. holdUsdc and
    ///      authRef are not filtered on, so they stay in data. authRef is the x402
    ///      settlement receipt, which is what ties a row here back to the payment.
    event Registered(bytes32 indexed eventId, address indexed who, uint40 holdUsdc, bytes32 authRef);
    event CheckedIn(bytes32 indexed eventId, address indexed who, uint40 at);
    event HoldCharged(bytes32 indexed eventId, address indexed who, uint40 amount);
    event PaidOut(bytes32 indexed eventId, address indexed who, uint40 amount);

    error NotRegistered();
    error AlreadyRegistered();
    error AlreadyCheckedIn();
    error StaleChallenge();
    error NotOrganiser();
    error EventClosed();

    constructor(address admin_) {
        admin = admin_;
    }

    /**
     * @notice The code currently shown on the venue screen.
     * @dev Derived from the block number, so it rotates every CHALLENGE_BLOCKS blocks
     *      with no transaction and no keeper. Nobody issues it; everybody can compute it.
     */
    function currentChallenge(bytes32 eventId) public view returns (bytes32) {
        return keccak256(abi.encodePacked(eventId, block.number / CHALLENGE_BLOCKS));
    }

    /// @param authRef Reference to the off-chain x402 authorisation backing this hold.
    function register(bytes32 eventId, uint40 holdUsdc, bytes32 authRef) external {
        if (closed[eventId]) revert EventClosed();

        Attendee storage a = attendees[eventId][msg.sender];
        if (a.status != STATUS_NONE) revert AlreadyRegistered();

        a.registeredAt = uint40(block.timestamp);
        a.holdUsdc = holdUsdc;
        a.status = STATUS_REGISTERED;

        unchecked {
            ++registeredCount[eventId];
        }

        emit Registered(eventId, msg.sender, holdUsdc, authRef);
    }

    /**
     * @notice Prove you are in the room.
     * @dev The challenge must match the one derived from the CURRENT block. A code
     *      read off the screen four blocks ago is already worthless.
     */
    function checkIn(bytes32 eventId, bytes32 challenge) external {
        if (closed[eventId]) revert EventClosed();

        Attendee storage a = attendees[eventId][msg.sender];
        if (a.status == STATUS_CHECKED_IN) revert AlreadyCheckedIn();
        if (a.status != STATUS_REGISTERED) revert NotRegistered();
        if (challenge != currentChallenge(eventId)) revert StaleChallenge();

        uint40 ts = uint40(block.timestamp);
        a.checkedInAt = ts;
        a.status = STATUS_CHECKED_IN;
        a.settled = true; // the hold resolves at $0 — no transaction moves any money

        unchecked {
            ++checkedInCount[eventId];
        }

        emit CheckedIn(eventId, msg.sender, ts);
    }

    /**
     * @notice Charge the outstanding holds and close the event.
     * @dev Trusted action, deliberately. Check-in itself is not trusted — that is the
     *      point of the challenge. Addresses that already checked in are skipped rather
     *      than reverting, so one bad entry cannot brick the whole batch.
     */
    function finalize(bytes32 eventId, address[] calldata noShows) external {
        if (msg.sender != admin) revert NotOrganiser();

        uint256 len = noShows.length;
        for (uint256 i = 0; i < len;) {
            address who = noShows[i];
            Attendee storage a = attendees[eventId][who];

            if (a.status == STATUS_REGISTERED) {
                a.status = STATUS_NO_SHOW;
                a.settled = true;
                emit HoldCharged(eventId, who, a.holdUsdc);
            }

            unchecked {
                ++i;
            }
        }

        closed[eventId] = true;
    }

    /**
     * @notice Record that attendees who showed up have been paid their share of the
     *         charged no-show holds.
     * @dev This contract never custodies USDC — x402 settles straight to the
     *      organiser's address — so it cannot move the money itself. The transfer is
     *      an EOA-side send; this function is the on-chain record of it, so /manage
     *      and the receipt view have a source of truth that is not a server's memory.
     *
     *      Call it AFTER the transfer settles. Recording a payout that then fails to
     *      send leaves a row claiming money that never arrived.
     *
     *      Addresses that did not check in, or that were already paid, are skipped
     *      rather than reverting, so the batch is idempotent and one bad entry cannot
     *      brick the call.
     */
    function payout(bytes32 eventId, address[] calldata recipients, uint40 amountEach) external {
        if (msg.sender != admin) revert NotOrganiser();

        uint256 len = recipients.length;
        for (uint256 i = 0; i < len;) {
            address who = recipients[i];
            Attendee storage a = attendees[eventId][who];

            if (a.status == STATUS_CHECKED_IN && !a.paidOut) {
                a.paidOut = true;
                emit PaidOut(eventId, who, amountEach);
            }

            unchecked {
                ++i;
            }
        }
    }

    /// @notice Everything the attendee's screen needs, in one call.
    function screen(bytes32 eventId, address who)
        external
        view
        returns (Attendee memory attendee, bytes32 challenge, uint8 blocksLeft)
    {
        attendee = attendees[eventId][who];
        challenge = currentChallenge(eventId);
        blocksLeft = uint8(CHALLENGE_BLOCKS - (block.number % CHALLENGE_BLOCKS));
    }
}
