// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract ArenaRegistry {
    error NotOwner();
    error ZeroAddress();
    error RoundAlreadyCurrent(address round);

    event CurrentRoundUpdated(address indexed previousRound, address indexed newRound);
    event SeasonMetadataHashUpdated(bytes32 previousHash, bytes32 newHash);

    address public owner;
    address public currentRound;
    address[] public pastRounds;
    bytes32 public seasonMetadataHash;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setCurrentRound(address round) external onlyOwner {
        if (round == address(0)) revert ZeroAddress();
        if (round == currentRound) revert RoundAlreadyCurrent(round);

        address previous = currentRound;
        if (previous != address(0)) {
            pastRounds.push(previous);
        }
        currentRound = round;
        emit CurrentRoundUpdated(previous, round);
    }

    function setSeasonMetadataHash(bytes32 hash) external onlyOwner {
        bytes32 previous = seasonMetadataHash;
        seasonMetadataHash = hash;
        emit SeasonMetadataHashUpdated(previous, hash);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    function pastRoundCount() external view returns (uint256) {
        return pastRounds.length;
    }

    function allPastRounds() external view returns (address[] memory) {
        return pastRounds;
    }
}
