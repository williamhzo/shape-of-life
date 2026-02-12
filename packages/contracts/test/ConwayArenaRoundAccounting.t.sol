// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ConwayArenaRound} from "../src/ConwayArenaRound.sol";

interface Vm {
    function warp(uint256) external;
    function deal(address account, uint256 newBalance) external;
    function prank(address caller) external;
}

contract ConwayArenaRoundAccountingTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant BLUE_TWO = address(0xBEEF);
    address private constant BLUE_THREE = address(0xCAFE);

    ConwayArenaRound internal round;

    receive() external payable {}

    function setUp() public {
        vm.warp(100);
        round = new ConwayArenaRound(10, 10, 4, 2);
    }

    function testKeeperShortfallClampPreventsOverpay() public {
        vm.deal(address(round), 11);
        round.configureAccounting(11, 5);
        transitionToSim();

        round.stepBatch(10);

        require(round.winnerPool() == 8, "winner pool mismatch");
        require(round.keeperPaid() == 2, "keeper should be clamped by pool");
        require(round.keeperPoolRemaining() == 0, "keeper pool should be exhausted");
        require(round.keeperCredits(address(this)) == 2, "keeper credit mismatch");
        require(round.treasuryDust() == 1, "bps split dust mismatch");
    }

    function testConfigureAccountingRevertsWhenContractIsUnderfunded() public {
        expectRevertSelector(
            ConwayArenaRound.InsufficientRoundBalance.selector,
            abi.encodeWithSignature("configureAccounting(uint256,uint256)", 1, 0)
        );
    }

    function testAccountingInvariantHoldsAfterWinnerClaimsAndRoundingDust() public {
        vm.deal(address(round), 11);
        round.configureAccounting(11, 0);

        commitFor(address(this), 0, 1, 0x1, bytes32("blue-1"));
        commitFor(BLUE_TWO, 0, 2, 0x1, bytes32("blue-2"));
        commitFor(BLUE_THREE, 0, 3, 0x1, bytes32("blue-3"));

        vm.warp(111);
        round.beginReveal();

        round.reveal(1, 0, 1, 0x1, bytes32("blue-1"));
        vm.prank(BLUE_TWO);
        round.reveal(1, 0, 2, 0x1, bytes32("blue-2"));
        vm.prank(BLUE_THREE);
        round.reveal(1, 0, 3, 0x1, bytes32("blue-3"));

        vm.warp(122);
        round.initialize();
        round.setExtinction(false, true);
        round.finalize();

        round.claim(1);
        vm.prank(BLUE_TWO);
        round.claim(2);
        vm.prank(BLUE_THREE);
        round.claim(3);

        uint256 totalAccounted = round.winnerPool() + round.winnerPaid() + round.keeperPaid() + round.treasuryDust();
        require(totalAccounted <= round.totalFunded(), "accounting invariant violated");
        require(totalAccounted == round.totalFunded(), "expected fully accounted funds");
    }

    function testZeroEligibleWinnersRoutesWinnerPoolToDustAtFinalize() public {
        vm.deal(address(round), 10);
        round.configureAccounting(10, 0);
        transitionToSim();

        round.setExtinction(true, false);
        round.finalize();

        require(round.winnerPaid() == 0, "winner payout should be zero");
        require(round.winnerPool() == 0, "winner pool should be zeroed");
        require(round.treasuryDust() == 10, "winner pool should route to dust");
        require(round.winnerPaid() + round.keeperPaid() + round.treasuryDust() == round.totalFunded(), "funds mismatch");
    }

    function testManualSettleDisabledForAccountingRounds() public {
        vm.deal(address(round), 10);
        round.configureAccounting(10, 0);
        transitionToSim();
        round.setExtinction(true, false);
        round.finalize();

        expectRevertSelector(
            ConwayArenaRound.ManualSettlementDisabled.selector,
            abi.encodeWithSignature("settleWinnerClaims(uint256)", 1)
        );
    }

    function transitionToSim() internal {
        vm.warp(111);
        round.beginReveal();
        vm.warp(122);
        round.initialize();
    }

    function commitFor(address player, uint8 team, uint8 slotIndex, uint64 seedBits, bytes32 salt) internal {
        bytes32 commitHash = round.hashCommit(1, player, team, slotIndex, seedBits, salt);

        if (player == address(this)) {
            round.commit(team, slotIndex, commitHash);
            return;
        }

        vm.prank(player);
        round.commit(team, slotIndex, commitHash);
    }

    function expectRevertSelector(bytes4 expectedSelector, bytes memory callData) internal {
        (bool success, bytes memory revertData) = address(round).call(callData);
        require(!success, "expected revert");
        require(revertData.length >= 4, "missing selector");

        bytes4 actualSelector;
        assembly {
            actualSelector := mload(add(revertData, 32))
        }

        require(actualSelector == expectedSelector, "unexpected selector");
    }
}
