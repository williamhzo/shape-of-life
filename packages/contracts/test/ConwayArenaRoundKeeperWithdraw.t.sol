// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ConwayArenaRound} from "../src/ConwayArenaRound.sol";

interface Vm {
    function warp(uint256) external;
    function deal(address account, uint256 newBalance) external;
}

contract ConwayArenaRoundKeeperWithdrawTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    ConwayArenaRound internal round;

    receive() external payable {}

    function setUp() public {
        vm.warp(100);
        round = new ConwayArenaRound(10, 10, 4, 2);
    }

    function testWithdrawKeeperCreditTransfersFundsAndClearsCredit() public {
        vm.deal(address(round), 10 ether);

        round.configureAccounting(10 ether, 5 ether);
        transitionToSim();

        round.stepBatch(10);

        uint256 keeperCredit = round.keeperCredits(address(this));
        require(keeperCredit == 2 ether, "expected keeper reward credit");

        uint256 beforeBalance = address(this).balance;
        uint256 withdrawn = round.withdrawKeeperCredit();

        require(withdrawn == 2 ether, "withdrawn amount mismatch");
        require(round.keeperCredits(address(this)) == 0, "credit should be cleared");
        require(address(this).balance == beforeBalance + 2 ether, "keeper balance mismatch");
    }

    function testWithdrawKeeperCreditRevertsWhenNoCredit() public {
        expectRevertSelector(
            ConwayArenaRound.NoKeeperCredit.selector,
            abi.encodeWithSignature("withdrawKeeperCredit()")
        );
    }

    function transitionToSim() internal {
        vm.warp(111);
        round.beginReveal();
        vm.warp(122);
        round.initialize();
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
