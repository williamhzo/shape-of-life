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
    address private constant RED_ONE = address(0xD00D);

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
        round.finalize();

        expectRevertSelector(
            ConwayArenaRound.ManualSettlementDisabled.selector,
            abi.encodeWithSignature("settleWinnerClaims(uint256)", 1)
        );
    }

    function testAccountingInvariantHoldsAcrossMixedClaimOrderingAndKeeperWithdraw() public {
        vm.deal(address(round), 13);
        round.configureAccounting(13, 1);

        commitFor(address(this), 0, 1, 0x303, bytes32("blue-one"));
        commitFor(BLUE_TWO, 0, 2, 0x303, bytes32("blue-two"));
        commitFor(RED_ONE, 1, 32, 0x1, bytes32("red-one"));

        vm.warp(111);
        round.beginReveal();

        round.reveal(1, 0, 1, 0x303, bytes32("blue-one"));
        vm.prank(BLUE_TWO);
        round.reveal(1, 0, 2, 0x303, bytes32("blue-two"));
        vm.prank(RED_ONE);
        round.reveal(1, 1, 32, 0x1, bytes32("red-one"));

        vm.warp(122);
        round.initialize();
        round.stepBatch(2);
        round.stepBatch(2);
        round.finalize();

        assertAccountingInvariantEqualsTotalFunded();

        vm.prank(RED_ONE);
        uint256 losingPayout = round.claim(32);
        require(losingPayout == 0, "losing claim should pay zero");
        assertAccountingInvariantEqualsTotalFunded();

        uint256 keeperBefore = address(this).balance;
        uint256 keeperWithdrawn = round.withdrawKeeperCredit();
        require(keeperWithdrawn == 2, "keeper withdraw mismatch");
        require(address(this).balance == keeperBefore + keeperWithdrawn, "keeper balance mismatch");
        assertAccountingInvariantEqualsTotalFunded();

        vm.prank(BLUE_TWO);
        uint256 blueTwoPayout = round.claim(2);
        require(blueTwoPayout == 5, "blue two payout mismatch");
        assertAccountingInvariantEqualsTotalFunded();

        uint256 blueOnePayout = round.claim(1);
        require(blueOnePayout == 5, "blue one payout mismatch");
        assertAccountingInvariantEqualsTotalFunded();
        require(round.winnerPool() == 0, "winner pool should be empty");
        require(round.winnerPaid() == 10, "winner paid mismatch");
        require(round.keeperPaid() == 2, "keeper paid mismatch");
        require(round.treasuryDust() == 1, "dust mismatch");
    }

    function testAccountingInvariantTracksRemainingWinnerPoolWithPartialClaims() public {
        vm.deal(address(round), 12);
        round.configureAccounting(12, 0);

        commitFor(address(this), 0, 1, 0x303, bytes32("partial-blue-one"));
        commitFor(BLUE_TWO, 0, 2, 0x303, bytes32("partial-blue-two"));

        vm.warp(111);
        round.beginReveal();
        round.reveal(1, 0, 1, 0x303, bytes32("partial-blue-one"));
        vm.prank(BLUE_TWO);
        round.reveal(1, 0, 2, 0x303, bytes32("partial-blue-two"));

        vm.warp(122);
        round.initialize();
        round.finalize();

        assertAccountingInvariantEqualsTotalFunded();

        vm.prank(BLUE_TWO);
        uint256 firstClaim = round.claim(2);
        require(firstClaim == 5, "partial first payout mismatch");
        assertAccountingInvariantEqualsTotalFunded();
        require(round.winnerPool() == 5, "remaining winner pool mismatch");

        uint256 secondClaim = round.claim(1);
        require(secondClaim == 5, "partial second payout mismatch");
        assertAccountingInvariantEqualsTotalFunded();
        require(round.winnerPool() == 0, "winner pool should settle to zero");
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

    function assertAccountingInvariantEqualsTotalFunded() internal view {
        uint256 settled = round.winnerPaid() + round.keeperPaid() + round.treasuryDust();
        require(settled <= round.totalFunded(), "settled accounting exceeds funded");

        uint256 totalAccounted = round.winnerPool() + round.keeperPoolRemaining() + settled;
        require(totalAccounted == round.totalFunded(), "accounting conservation mismatch");
    }
}
