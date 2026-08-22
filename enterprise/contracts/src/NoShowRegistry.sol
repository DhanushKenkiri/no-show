// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title NoShowRegistry
 * @notice Multi-tenant registry for deposit-free RSVP with on-chain proof of
 *         attendance.
 *
 *         One deployment serves every platform and every event. Each event carries
 *         its own organiser, set by whoever creates it, so a customer can only
 *         finalize their own events. The single-admin NoShow.sol in demo/ cannot do
 *         that — its admin is immutable and set at deploy, which is fine for one
 *         event and indefensible for an SDK.
 *
 *         Registering authorises an x402 `upto` hold off chain; this contract only
 *         records that it happened. Check-in requires submitting a challenge derived
 *         from the block number, valid only inside a 3-block window. At Monad's
 *         400ms blocks that is roughly a second, so the claim has to be made live.
 *
 *         That comparison in `checkIn` is the whole anti-farming mechanism. Note
 *         what it does and does not prove: the challenge is a pure function of the
 *         event id and the block number, both public, so it demonstrates LIVENESS
 *         inside a narrow window, not physical presence.
 */
contract NoShowRegistry {
    /// @dev One 32-byte slot. Proven with `forge inspect ... storageLayout --json`.
    struct Attendee {
        uint40 registeredAt; //  5   unix seconds
        uint40 checkedInAt; //   5   0 = not yet
        uint40 holdAmount; //    5   copied from the event at registration
        uint8 status; //         1   see STATUS_* below
        bool settled; //         1   the authorisation was resolved either way
        bool paidOut; //         1   received a share of the charged holds
    } //                        18 bytes of 32

    /**
     * @dev Also one slot: 20 + 5 + 1 = 26 bytes.
     *
     *      The counts deliberately live in separate mappings rather than in here.
     *      Packing them alongside `organiser` would mean every single registration
     *      rewrites the same slot that holds the organiser address, turning
     *      otherwise-parallel registrations into a queue on one storage location.
     */
    struct EventInfo {
        address organiser; // 20
        uint40 holdAmount; //  5   6dp, so 500_000 == 0.5
        bool closed; //        1
    }

    uint256 private constant CHALLENGE_BLOCKS = 3;

    uint8 public constant STATUS_NONE = 0;
    uint8 public constant STATUS_REGISTERED = 1;
    uint8 public constant STATUS_CHECKED_IN = 2;
    uint8 public constant STATUS_NO_SHOW = 3;

    mapping(bytes32 => EventInfo) public events;
    mapping(bytes32 => mapping(address => Attendee)) private attendees;

    /// @notice Per event, never global — a global counter would serialise
    ///         otherwise-parallel registrations across unrelated tenants.
    mapping(bytes32 => uint32) public registeredCount;
    mapping(bytes32 => uint32) public checkedInCount;

    /// @dev eventId and who are indexed because dashboards filter on both.
    ///      authRef ties a row here back to the off-chain x402 receipt.
    event EventCreated(bytes32 indexed eventId, address indexed organiser, uint40 holdAmount);
    event Registered(bytes32 indexed eventId, address indexed who, uint40 holdAmount, bytes32 authRef);
    event CheckedIn(bytes32 indexed eventId, address indexed who, uint40 at);
    event HoldCharged(bytes32 indexed eventId, address indexed who, uint40 amount);
    event PaidOut(bytes32 indexed eventId, address indexed who, uint40 amount);

    error EventExists();
    error EventNotFound();
    error NotRegistered();
    error AlreadyRegistered();
    error AlreadyCheckedIn();
    error StaleChallenge();
    error NotOrganiser();
    error EventClosed();

    /**
     * @notice Open an event. The caller becomes its organiser.
     * @dev No global admin gates this. Anyone may create an event under an id they
     *      choose; they can only ever finalize the ones they created. Tenants
     *      should namespace their ids (keccak256(tenantId, externalEventId)) so two
     *      customers cannot collide.
     */
    function createEvent(bytes32 eventId, uint40 holdAmount) external {
        if (events[eventId].organiser != address(0)) revert EventExists();

        events[eventId] = EventInfo({organiser: msg.sender, holdAmount: holdAmount, closed: false});

        emit EventCreated(eventId, msg.sender, holdAmount);
    }

    /**
     * @notice The code currently shown on the venue screen.
     * @dev Derived from the block number, so it rotates every CHALLENGE_BLOCKS
     *      blocks with no transaction and no keeper. Nobody issues it; everybody
     *      can compute it.
     */
    function currentChallenge(bytes32 eventId) public view returns (bytes32) {
        return keccak256(abi.encodePacked(eventId, block.number / CHALLENGE_BLOCKS));
    }

    /**
     * @notice Record an authorised hold.
     * @dev The amount is read from the event, NOT taken from the caller. The
     *      single-event version accepted a caller-supplied figure, which let an
     *      attendee record whatever hold they liked — including zero — while the
     *      real authorisation said something else.
     * @param authRef Reference to the off-chain x402 authorisation backing this hold.
     */
    function register(bytes32 eventId, bytes32 authRef) external {
        EventInfo storage info = events[eventId];
        if (info.organiser == address(0)) revert EventNotFound();
        if (info.closed) revert EventClosed();

        Attendee storage a = attendees[eventId][msg.sender];
        if (a.status != STATUS_NONE) revert AlreadyRegistered();

        a.registeredAt = uint40(block.timestamp);
        a.holdAmount = info.holdAmount;
        a.status = STATUS_REGISTERED;

        unchecked {
            ++registeredCount[eventId];
        }

        emit Registered(eventId, msg.sender, info.holdAmount, authRef);
    }

    /**
     * @notice Prove you are in the room.
     * @dev The challenge must match the one derived from the CURRENT block. A code
     *      read off the screen four blocks ago is already worthless.
     */
    function checkIn(bytes32 eventId, bytes32 challenge) external {
        EventInfo storage info = events[eventId];
        if (info.organiser == address(0)) revert EventNotFound();
        if (info.closed) revert EventClosed();

        Attendee storage a = attendees[eventId][msg.sender];
        if (a.status == STATUS_CHECKED_IN) revert AlreadyCheckedIn();
        if (a.status != STATUS_REGISTERED) revert NotRegistered();
        if (challenge != currentChallenge(eventId)) revert StaleChallenge();

        uint40 ts = uint40(block.timestamp);
        a.checkedInAt = ts;
        a.status = STATUS_CHECKED_IN;
        a.settled = true; // the hold resolves at zero — no money moves

        unchecked {
            ++checkedInCount[eventId];
        }

        emit CheckedIn(eventId, msg.sender, ts);
    }

    /**
     * @notice Charge the outstanding holds and close the event.
     * @dev Trusted, deliberately, and scoped to this event's organiser. Check-in
     *      itself is not trusted — that is the point of the challenge. Addresses
     *      that already checked in are skipped rather than reverting, so one bad
     *      entry cannot brick the batch.
     */
    function finalize(bytes32 eventId, address[] calldata noShows) external {
        EventInfo storage info = events[eventId];
        if (info.organiser == address(0)) revert EventNotFound();
        if (msg.sender != info.organiser) revert NotOrganiser();

        uint256 len = noShows.length;
        for (uint256 i = 0; i < len;) {
            address who = noShows[i];
            Attendee storage a = attendees[eventId][who];

            if (a.status == STATUS_REGISTERED) {
                a.status = STATUS_NO_SHOW;
                a.settled = true;
                emit HoldCharged(eventId, who, a.holdAmount);
            }

            unchecked {
                ++i;
            }
        }

        info.closed = true;
    }

    /**
     * @notice Record that attendees who showed up were paid their share.
     * @dev This contract never custodies funds — x402 settles straight to the
     *      organiser — so it records rather than transfers. Call it AFTER the
     *      transfer settles; recording a payout that then fails to send leaves a
     *      row claiming money that never arrived. Idempotent.
     */
    function payout(bytes32 eventId, address[] calldata recipients, uint40 amountEach) external {
        EventInfo storage info = events[eventId];
        if (info.organiser == address(0)) revert EventNotFound();
        if (msg.sender != info.organiser) revert NotOrganiser();

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

    /// @notice Everything one attendee's screen needs, in a single call.
    function screen(bytes32 eventId, address who)
        external
        view
        returns (Attendee memory attendee, bytes32 challenge, uint8 blocksLeft)
    {
        attendee = attendees[eventId][who];
        challenge = currentChallenge(eventId);
        blocksLeft = uint8(CHALLENGE_BLOCKS - (block.number % CHALLENGE_BLOCKS));
    }

    /// @notice Everything an organiser dashboard needs, in a single call.
    function eventScreen(bytes32 eventId)
        external
        view
        returns (EventInfo memory info, uint32 registered, uint32 checkedIn, bytes32 challenge)
    {
        info = events[eventId];
        registered = registeredCount[eventId];
        checkedIn = checkedInCount[eventId];
        challenge = currentChallenge(eventId);
    }
}
