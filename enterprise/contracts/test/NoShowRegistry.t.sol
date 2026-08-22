// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {NoShowRegistry} from "../src/NoShowRegistry.sol";

contract NoShowRegistryTest is Test {
    NoShowRegistry internal registry;

    address internal constant ORGANISER_A = address(0xA11CE);
    address internal constant ORGANISER_B = address(0xB0B5);
    address internal constant ATTENDEE = address(0xB0B);
    address internal constant OTHER = address(0xCAFE);

    bytes32 internal constant EVENT_A = keccak256("tenant-a:event-1");
    bytes32 internal constant EVENT_B = keccak256("tenant-b:event-1");
    uint40 internal constant HOLD = 500_000; // 0.5 at 6dp

    event Registered(bytes32 indexed eventId, address indexed who, uint40 holdAmount, bytes32 authRef);
    event CheckedIn(bytes32 indexed eventId, address indexed who, uint40 at);
    event HoldCharged(bytes32 indexed eventId, address indexed who, uint40 amount);
    event PaidOut(bytes32 indexed eventId, address indexed who, uint40 amount);

    function setUp() public {
        registry = new NoShowRegistry();
        // Start well clear of block 0 so rolling backwards is always valid.
        vm.roll(1_000);

        vm.prank(ORGANISER_A);
        registry.createEvent(EVENT_A, HOLD);
    }

    function _register(bytes32 eventId, address who) internal {
        vm.prank(who);
        registry.register(eventId, bytes32(uint256(0xA02F)));
    }

    function _checkIn(bytes32 eventId, address who) internal {
        // Hoisted deliberately: vm.prank applies to the very next call, and an
        // inline registry.currentChallenge(...) would consume it, so checkIn would
        // run as the test contract and revert NotRegistered.
        bytes32 challenge = registry.currentChallenge(eventId);
        vm.prank(who);
        registry.checkIn(eventId, challenge);
    }

    // --- creation -----------------------------------------------------------

    function test_CreateEvent_SetsOrganiserAndHold() public view {
        (address organiser, uint40 holdAmount, bool closed) = registry.events(EVENT_A);
        assertEq(organiser, ORGANISER_A);
        assertEq(holdAmount, HOLD);
        assertFalse(closed);
    }

    function test_CreateEvent_Twice_Reverts() public {
        vm.prank(ORGANISER_B);
        vm.expectRevert(NoShowRegistry.EventExists.selector);
        registry.createEvent(EVENT_A, HOLD);
    }

    function test_Register_OnUnknownEvent_Reverts() public {
        vm.prank(ATTENDEE);
        vm.expectRevert(NoShowRegistry.EventNotFound.selector);
        registry.register(keccak256("nope"), bytes32(0));
    }

    // --- registration -------------------------------------------------------

    function test_Register_SetsStatusAndIncrementsCount() public {
        assertEq(registry.registeredCount(EVENT_A), 0);

        _register(EVENT_A, ATTENDEE);

        (NoShowRegistry.Attendee memory a,,) = registry.screen(EVENT_A, ATTENDEE);
        assertEq(a.status, registry.STATUS_REGISTERED());
        assertEq(a.holdAmount, HOLD);
        assertEq(a.checkedInAt, 0);
        assertEq(registry.registeredCount(EVENT_A), 1);
    }

    /// The amount comes from the event, never the caller.
    function test_Register_UsesEventHoldNotCallerSupplied() public {
        _register(EVENT_A, ATTENDEE);
        (NoShowRegistry.Attendee memory a,,) = registry.screen(EVENT_A, ATTENDEE);
        // There is no argument through which a caller could have influenced this.
        assertEq(a.holdAmount, HOLD);
    }

    function test_Register_Twice_Reverts() public {
        _register(EVENT_A, ATTENDEE);
        vm.prank(ATTENDEE);
        vm.expectRevert(NoShowRegistry.AlreadyRegistered.selector);
        registry.register(EVENT_A, bytes32(0));
    }

    // --- check-in -----------------------------------------------------------

    function test_CheckIn_WithCurrentChallenge_Succeeds() public {
        _register(EVENT_A, ATTENDEE);
        assertEq(registry.checkedInCount(EVENT_A), 0);

        _checkIn(EVENT_A, ATTENDEE);

        (NoShowRegistry.Attendee memory a,,) = registry.screen(EVENT_A, ATTENDEE);
        assertEq(a.status, registry.STATUS_CHECKED_IN());
        assertTrue(a.checkedInAt != 0);
        assertTrue(a.settled);
        assertEq(registry.checkedInCount(EVENT_A), 1);
    }

    function test_CheckIn_WithChallengeFrom4BlocksAgo_RevertsStale() public {
        _register(EVENT_A, ATTENDEE);

        bytes32 stale = registry.currentChallenge(EVENT_A);
        vm.roll(block.number + 4);
        assertTrue(stale != registry.currentChallenge(EVENT_A), "window did not rotate");

        vm.prank(ATTENDEE);
        vm.expectRevert(NoShowRegistry.StaleChallenge.selector);
        registry.checkIn(EVENT_A, stale);
    }

    function test_CheckIn_Twice_RevertsAlreadyCheckedIn() public {
        _register(EVENT_A, ATTENDEE);
        _checkIn(EVENT_A, ATTENDEE);

        bytes32 challenge = registry.currentChallenge(EVENT_A);
        vm.prank(ATTENDEE);
        vm.expectRevert(NoShowRegistry.AlreadyCheckedIn.selector);
        registry.checkIn(EVENT_A, challenge);
    }

    /// One event's challenge must not work on another.
    function test_CheckIn_WithAnotherEventsChallenge_RevertsStale() public {
        vm.prank(ORGANISER_B);
        registry.createEvent(EVENT_B, HOLD);
        _register(EVENT_A, ATTENDEE);

        bytes32 otherChallenge = registry.currentChallenge(EVENT_B);
        assertTrue(otherChallenge != registry.currentChallenge(EVENT_A));

        vm.prank(ATTENDEE);
        vm.expectRevert(NoShowRegistry.StaleChallenge.selector);
        registry.checkIn(EVENT_A, otherChallenge);
    }

    // --- finalize and payout ------------------------------------------------

    function test_Finalize_MarksNoShowAndEmitsHoldCharged() public {
        _register(EVENT_A, ATTENDEE);

        address[] memory noShows = new address[](1);
        noShows[0] = ATTENDEE;

        vm.expectEmit(true, true, false, true);
        emit HoldCharged(EVENT_A, ATTENDEE, HOLD);

        vm.prank(ORGANISER_A);
        registry.finalize(EVENT_A, noShows);

        (NoShowRegistry.Attendee memory a,,) = registry.screen(EVENT_A, ATTENDEE);
        assertEq(a.status, registry.STATUS_NO_SHOW());
        assertTrue(a.settled);
    }

    /// The whole reason this contract exists: tenants cannot touch each other.
    function test_Finalize_ByAnotherEventsOrganiser_Reverts() public {
        vm.prank(ORGANISER_B);
        registry.createEvent(EVENT_B, HOLD);
        _register(EVENT_A, ATTENDEE);

        address[] memory noShows = new address[](1);
        noShows[0] = ATTENDEE;

        vm.prank(ORGANISER_B);
        vm.expectRevert(NoShowRegistry.NotOrganiser.selector);
        registry.finalize(EVENT_A, noShows);
    }

    function test_Finalize_ByStranger_Reverts() public {
        address[] memory noShows = new address[](1);
        noShows[0] = ATTENDEE;

        vm.prank(OTHER);
        vm.expectRevert(NoShowRegistry.NotOrganiser.selector);
        registry.finalize(EVENT_A, noShows);
    }

    function test_Payout_MarksPaidAndIsIdempotent() public {
        _register(EVENT_A, ATTENDEE);
        _checkIn(EVENT_A, ATTENDEE);

        address[] memory recipients = new address[](1);
        recipients[0] = ATTENDEE;

        vm.expectEmit(true, true, false, true);
        emit PaidOut(EVENT_A, ATTENDEE, 250_000);

        vm.prank(ORGANISER_A);
        registry.payout(EVENT_A, recipients, 250_000);

        (NoShowRegistry.Attendee memory a,,) = registry.screen(EVENT_A, ATTENDEE);
        assertTrue(a.paidOut);

        // A second call must emit nothing at all.
        vm.recordLogs();
        vm.prank(ORGANISER_A);
        registry.payout(EVENT_A, recipients, 250_000);
        assertEq(vm.getRecordedLogs().length, 0, "second payout re-emitted");
    }

    // --- isolation ----------------------------------------------------------

    /// Two events must keep entirely separate books.
    function test_EventsAreIndependent() public {
        vm.prank(ORGANISER_B);
        registry.createEvent(EVENT_B, 999_999);

        _register(EVENT_A, ATTENDEE);
        _register(EVENT_B, ATTENDEE);
        _checkIn(EVENT_A, ATTENDEE);

        assertEq(registry.registeredCount(EVENT_A), 1);
        assertEq(registry.registeredCount(EVENT_B), 1);
        assertEq(registry.checkedInCount(EVENT_A), 1);
        assertEq(registry.checkedInCount(EVENT_B), 0, "check-in leaked across events");

        (NoShowRegistry.Attendee memory inB,,) = registry.screen(EVENT_B, ATTENDEE);
        assertEq(inB.status, registry.STATUS_REGISTERED());
        assertEq(inB.holdAmount, 999_999, "hold amount leaked across events");
    }

    /// Closing one event must not close another.
    function test_FinalizeDoesNotCloseOtherEvents() public {
        vm.prank(ORGANISER_B);
        registry.createEvent(EVENT_B, HOLD);

        address[] memory none = new address[](0);
        vm.prank(ORGANISER_A);
        registry.finalize(EVENT_A, none);

        (,, bool closedA) = registry.events(EVENT_A);
        (,, bool closedB) = registry.events(EVENT_B);
        assertTrue(closedA);
        assertFalse(closedB);

        // And B still accepts registrations.
        _register(EVENT_B, ATTENDEE);
        assertEq(registry.registeredCount(EVENT_B), 1);
    }
}
