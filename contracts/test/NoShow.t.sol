// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {NoShow} from "../src/NoShow.sol";

contract NoShowTest is Test {
    NoShow internal noShow;

    address internal constant ADMIN = address(0xA11CE);
    address internal constant ATTENDEE = address(0xB0B);

    bytes32 internal constant EVENT_ID = keccak256("monad-blitz-hyderabad-v3");
    uint40 internal constant HOLD = 2_000_000; // $2.00 at 6dp

    event Registered(bytes32 indexed eventId, address indexed who, uint40 holdUsdc, bytes32 authRef);
    event CheckedIn(bytes32 indexed eventId, address indexed who, uint40 at);
    event HoldCharged(bytes32 indexed eventId, address indexed who, uint40 amount);

    function setUp() public {
        noShow = new NoShow(ADMIN);
        // Start well clear of block 0 so `block.number - 4` is always valid.
        vm.roll(1_000);
    }

    function _register(address who) internal {
        vm.prank(who);
        noShow.register(EVENT_ID, HOLD, bytes32(uint256(0xA02F)));
    }

    /// register sets status 1 and increments registeredCount
    function test_Register_SetsStatusAndIncrementsCount() public {
        assertEq(noShow.registeredCount(EVENT_ID), 0);

        _register(ATTENDEE);

        (NoShow.Attendee memory a,,) = noShow.screen(EVENT_ID, ATTENDEE);
        assertEq(a.status, noShow.STATUS_REGISTERED());
        assertEq(a.holdUsdc, HOLD);
        assertEq(a.checkedInAt, 0);
        assertEq(noShow.registeredCount(EVENT_ID), 1);
    }

    /// checkIn with the current challenge succeeds and increments checkedInCount
    function test_CheckIn_WithCurrentChallenge_Succeeds() public {
        _register(ATTENDEE);
        assertEq(noShow.checkedInCount(EVENT_ID), 0);

        bytes32 challenge = noShow.currentChallenge(EVENT_ID);

        vm.prank(ATTENDEE);
        noShow.checkIn(EVENT_ID, challenge);

        (NoShow.Attendee memory a,,) = noShow.screen(EVENT_ID, ATTENDEE);
        assertEq(a.status, noShow.STATUS_CHECKED_IN());
        assertTrue(a.checkedInAt != 0);
        assertTrue(a.settled);
        assertEq(noShow.checkedInCount(EVENT_ID), 1);
    }

    /// checkIn with a challenge from 4 blocks ago reverts StaleChallenge
    function test_CheckIn_WithChallengeFrom4BlocksAgo_RevertsStale() public {
        _register(ATTENDEE);

        bytes32 stale = noShow.currentChallenge(EVENT_ID);

        // 4 blocks is more than CHALLENGE_BLOCKS, so the window has definitely moved on.
        vm.roll(block.number + 4);
        assertTrue(stale != noShow.currentChallenge(EVENT_ID), "window did not rotate");

        vm.prank(ATTENDEE);
        vm.expectRevert(NoShow.StaleChallenge.selector);
        noShow.checkIn(EVENT_ID, stale);
    }

    /// checkIn twice reverts AlreadyCheckedIn
    function test_CheckIn_Twice_RevertsAlreadyCheckedIn() public {
        _register(ATTENDEE);

        // Hoisted deliberately: vm.prank applies to the very next call, and an
        // inline noShow.currentChallenge(...) would consume it, so checkIn would
        // run as the test contract and revert NotRegistered instead.
        bytes32 challenge = noShow.currentChallenge(EVENT_ID);

        vm.prank(ATTENDEE);
        noShow.checkIn(EVENT_ID, challenge);

        vm.prank(ATTENDEE);
        vm.expectRevert(NoShow.AlreadyCheckedIn.selector);
        noShow.checkIn(EVENT_ID, challenge);
    }

    /// finalize marks a no-show and emits HoldCharged
    function test_Finalize_MarksNoShowAndEmitsHoldCharged() public {
        _register(ATTENDEE);

        address[] memory noShows = new address[](1);
        noShows[0] = ATTENDEE;

        vm.expectEmit(true, true, false, true);
        emit HoldCharged(EVENT_ID, ATTENDEE, HOLD);

        vm.prank(ADMIN);
        noShow.finalize(EVENT_ID, noShows);

        (NoShow.Attendee memory a,,) = noShow.screen(EVENT_ID, ATTENDEE);
        assertEq(a.status, noShow.STATUS_NO_SHOW());
        assertTrue(a.settled);
    }
}
