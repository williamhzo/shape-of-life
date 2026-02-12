// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ConwayArenaRound} from "../src/ConwayArenaRound.sol";

interface Vm {
    function warp(uint256) external;
    function deal(address account, uint256 newBalance) external;
}

contract ReentrantPayoutProbe {
    ConwayArenaRound internal immutable round;
    uint8 internal immutable team;
    uint8 internal immutable slotIndex;
    uint64 internal immutable seedBits;
    bytes32 internal immutable salt;

    bool internal probeActive;
    bool public reentrantWithdrawSucceeded;

    constructor(ConwayArenaRound round_, uint8 team_, uint8 slotIndex_, uint64 seedBits_, bytes32 salt_) {
        round = round_;
        team = team_;
        slotIndex = slotIndex_;
        seedBits = seedBits_;
        salt = salt_;
    }

    receive() external payable {
        if (!probeActive) {
            return;
        }

        (bool success,) = address(round).call(abi.encodeWithSignature("withdrawKeeperCredit()"));
        reentrantWithdrawSucceeded = success;
    }

    function reserveSlot() external {
        bytes32 commitHash = round.hashCommit(1, address(this), team, slotIndex, seedBits, salt);
        round.commit(team, slotIndex, commitHash);
    }

    function revealSlot() external {
        round.reveal(1, team, slotIndex, seedBits, salt);
    }

    function stepRound(uint16 steps) external {
        round.stepBatch(steps);
    }

    function claimAndProbe() external {
        probeActive = true;
        round.claim(slotIndex);
        probeActive = false;
    }
}

contract ConwayArenaRoundReentrancyTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function testClaimBlocksCrossFunctionReentrancyIntoKeeperWithdraw() public {
        vm.warp(100);
        ConwayArenaRound round = new ConwayArenaRound(10, 10, 4, 2);
        vm.deal(address(round), 20 ether);
        round.configureAccounting(20 ether, 1 ether);

        ReentrantPayoutProbe attacker = new ReentrantPayoutProbe(round, 0, 2, 0x3, bytes32("probe"));
        attacker.reserveSlot();

        vm.warp(111);
        round.beginReveal();
        attacker.revealSlot();

        vm.warp(122);
        round.initialize();
        attacker.stepRound(2);
        attacker.stepRound(2);
        round.finalize();

        attacker.claimAndProbe();

        require(!attacker.reentrantWithdrawSucceeded(), "reentrant withdraw should be blocked");
    }
}
