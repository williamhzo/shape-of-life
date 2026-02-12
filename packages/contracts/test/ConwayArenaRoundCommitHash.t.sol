// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ConwayArenaRound} from "../src/ConwayArenaRound.sol";

interface Vm {
    function chainId(uint256) external;
}

contract ConwayArenaRoundCommitHashTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function testHashCommitBindsChainArenaAndPlayer() public {
        ConwayArenaRound round = new ConwayArenaRound(10, 10, 4, 2);

        vm.chainId(11011);

        address player = address(0xBEEF);
        uint8 team = 1;
        uint8 slotIndex = 7;
        uint64 seedBits = 0xAA55;
        bytes32 salt = keccak256("salt");

        bytes32 expected = keccak256(abi.encode(1, block.chainid, address(round), player, team, slotIndex, seedBits, salt));
        bytes32 actual = round.hashCommit(1, player, team, slotIndex, seedBits, salt);

        require(actual == expected, "hash mismatch");
    }

    function testHashCommitChangesWhenPlayerDiffers() public {
        ConwayArenaRound round = new ConwayArenaRound(10, 10, 4, 2);

        bytes32 salt = keccak256("salt");
        bytes32 first = round.hashCommit(1, address(0xBEEF), 0, 1, 0x1234, salt);
        bytes32 second = round.hashCommit(1, address(0xCAFE), 0, 1, 0x1234, salt);

        require(first != second, "player should affect hash");
    }
}
