// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ConwayArenaRound} from "../src/ConwayArenaRound.sol";

interface Vm {
    function warp(uint256) external;
    function prank(address) external;
    function deal(address account, uint256 newBalance) external;
}

contract ConwayArenaRoundWinnerPayoutTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant SECOND_PLAYER = address(0xBEEF);
    address private constant RED_PLAYER = address(0xCAFE);

    ConwayArenaRound internal round;

    receive() external payable {}

    function setUp() public {
        vm.warp(100);
        round = new ConwayArenaRound(10, 10, 4, 2);
        vm.deal(address(round), 12 ether);
        round.configureAccounting(12 ether, 0);
    }

    function testWinnerTeamClaimsReceiveEqualPayout() public {
        commitRevealSlot(address(this), 0, 3, 0x3, bytes32("blue-1"));
        commitRevealSlot(SECOND_PLAYER, 0, 4, 0x7, bytes32("blue-2"));

        transitionToClaimByBlueWin();

        uint256 firstBefore = address(this).balance;
        uint256 secondBefore = SECOND_PLAYER.balance;

        uint256 firstPaid = round.claim(3);
        vm.prank(SECOND_PLAYER);
        uint256 secondPaid = round.claim(4);

        require(firstPaid == 6 ether, "first payout mismatch");
        require(secondPaid == 6 ether, "second payout mismatch");
        require(address(this).balance == firstBefore + 6 ether, "first balance mismatch");
        require(SECOND_PLAYER.balance == secondBefore + 6 ether, "second balance mismatch");
    }

    function testDrawClaimsSplitAcrossBothTeams() public {
        commitRevealSlot(address(this), 0, 4, 0x0020908000078E80, bytes32("draw-blue"));
        commitRevealSlot(RED_PLAYER, 1, 32, 0x80880041C8881100, bytes32("draw-red"));

        transitionToClaimByDraw();

        uint256 blueBefore = address(this).balance;
        uint256 redBefore = RED_PLAYER.balance;

        uint256 bluePaid = round.claim(4);
        vm.prank(RED_PLAYER);
        uint256 redPaid = round.claim(32);

        require(bluePaid == 6 ether, "blue draw payout mismatch");
        require(redPaid == 6 ether, "red draw payout mismatch");
        require(address(this).balance == blueBefore + 6 ether, "blue draw balance mismatch");
        require(RED_PLAYER.balance == redBefore + 6 ether, "red draw balance mismatch");
    }

    function testNonWinningSlotClaimReturnsZeroButMarksClaimed() public {
        commitRevealSlot(address(this), 0, 1, 0x1, bytes32("loser-blue"));
        commitRevealSlot(RED_PLAYER, 1, 33, 0x303, bytes32("winner-red"));

        transitionToClaimByRedWin();

        uint256 loserBefore = address(this).balance;
        uint256 winnerBefore = RED_PLAYER.balance;

        uint256 loserPaid = round.claim(1);
        vm.prank(RED_PLAYER);
        uint256 winnerPaid = round.claim(33);

        (, , , , bool loserRevealed, bool loserClaimed) = round.slots(1);
        require(loserRevealed, "expected loser revealed");
        require(loserClaimed, "expected loser claimed");
        require(loserPaid == 0, "loser should get zero");
        require(winnerPaid == 12 ether, "winner should get full payout");
        require(address(this).balance == loserBefore, "loser balance should not change");
        require(RED_PLAYER.balance == winnerBefore + 12 ether, "winner balance mismatch");
    }

    function commitRevealSlot(address player, uint8 team, uint8 slotIndex, uint64 seedBits, bytes32 salt) internal {
        bytes32 commitHash = round.hashCommit(1, player, team, slotIndex, seedBits, salt);

        if (player == address(this)) {
            round.commit(team, slotIndex, commitHash);
            return;
        }

        vm.prank(player);
        round.commit(team, slotIndex, commitHash);
    }

    function transitionToClaimByBlueWin() internal {
        vm.warp(111);
        round.beginReveal();

        round.reveal(1, 0, 3, 0x3, bytes32("blue-1"));
        vm.prank(SECOND_PLAYER);
        round.reveal(1, 0, 4, 0x7, bytes32("blue-2"));

        vm.warp(122);
        round.initialize();
        round.finalize();
    }

    function transitionToClaimByDraw() internal {
        vm.warp(111);
        round.beginReveal();

        round.reveal(1, 0, 4, 0x0020908000078E80, bytes32("draw-blue"));
        vm.prank(RED_PLAYER);
        round.reveal(1, 1, 32, 0x80880041C8881100, bytes32("draw-red"));

        vm.warp(122);
        round.initialize();
        round.stepBatch(2);
        round.stepBatch(2);
        round.finalize();
    }

    function transitionToClaimByRedWin() internal {
        vm.warp(111);
        round.beginReveal();

        round.reveal(1, 0, 1, 0x1, bytes32("loser-blue"));
        vm.prank(RED_PLAYER);
        round.reveal(1, 1, 33, 0x303, bytes32("winner-red"));

        vm.warp(122);
        round.initialize();
        round.stepBatch(2);
        round.stepBatch(2);
        round.finalize();
    }
}
