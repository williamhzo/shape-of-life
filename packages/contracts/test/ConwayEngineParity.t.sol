// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ConwayEngine} from "../src/ConwayEngine.sol";

contract ConwayEngineHarness {
    function step(
        uint8 width,
        uint8 height,
        uint64[] memory blueRows,
        uint64[] memory redRows
    ) external pure returns (uint64[] memory nextBlueRows, uint64[] memory nextRedRows) {
        return ConwayEngine.step(width, height, blueRows, redRows);
    }
}

contract ConwayEngineParityTest {
    ConwayEngineHarness internal harness = new ConwayEngineHarness();

    function testVectorBlinkerBlueStep1() public view {
        uint64[] memory blue = rows5(0, 0, 0xE, 0, 0);
        uint64[] memory red = rows5(0, 0, 0, 0, 0);
        (uint64[] memory nextBlue, uint64[] memory nextRed) = harness.step(5, 5, blue, red);

        assertRowsEq(nextBlue, rows5(0, 0x4, 0x4, 0x4, 0));
        assertRowsEq(nextRed, rows5(0, 0, 0, 0, 0));
    }

    function testVectorImmigrationMajorityBlueStep1() public view {
        uint64[] memory blue = rows5(0, 0x4, 0x2, 0, 0);
        uint64[] memory red = rows5(0, 0, 0x8, 0, 0);
        (uint64[] memory nextBlue, uint64[] memory nextRed) = harness.step(5, 5, blue, red);

        assertRowsEq(nextBlue, rows5(0, 0x4, 0x4, 0, 0));
        assertRowsEq(nextRed, rows5(0, 0, 0, 0, 0));
    }

    function testVectorCylinderVerticalWrapStep1() public view {
        uint64[] memory blue = rows5(0, 0, 0, 0, 0xE);
        uint64[] memory red = rows5(0, 0, 0, 0, 0);
        (uint64[] memory nextBlue, uint64[] memory nextRed) = harness.step(5, 5, blue, red);

        assertRowsEq(nextBlue, rows5(0x4, 0, 0, 0x4, 0x4));
        assertRowsEq(nextRed, rows5(0, 0, 0, 0, 0));
    }

    function testVectorImmigrationMajorityRedStep1() public view {
        uint64[] memory blue = rows5(0, 0, 0x8, 0, 0);
        uint64[] memory red = rows5(0, 0, 0x6, 0, 0);
        (uint64[] memory nextBlue, uint64[] memory nextRed) = harness.step(5, 5, blue, red);

        assertRowsEq(nextBlue, rows5(0, 0, 0, 0, 0));
        assertRowsEq(nextRed, rows5(0, 0x4, 0x4, 0x4, 0));
    }

    function testVectorBlinkerBlueStep2() public view {
        uint64[] memory blue = rows5(0, 0, 0xE, 0, 0);
        uint64[] memory red = rows5(0, 0, 0, 0, 0);

        (uint64[] memory step1Blue, uint64[] memory step1Red) = harness.step(5, 5, blue, red);
        (uint64[] memory step2Blue, uint64[] memory step2Red) = harness.step(5, 5, step1Blue, step1Red);

        assertRowsEq(step2Blue, rows5(0, 0, 0xE, 0, 0));
        assertRowsEq(step2Red, rows5(0, 0, 0, 0, 0));
    }

    function testDeterministicSeedFuzzParity() public view {
        uint8 width = 16;
        uint8 height = 16;
        uint32 seeds = 25;
        uint8 stepsPerSeed = 6;

        for (uint32 seed = 1; seed <= seeds; seed++) {
            (uint64[] memory engineBlue, uint64[] memory engineRed) = randomBoard(width, height, seed);
            (uint64[] memory refBlue, uint64[] memory refRed) = randomBoard(width, height, seed);

            for (uint8 step = 0; step < stepsPerSeed; step++) {
                (engineBlue, engineRed) = harness.step(width, height, engineBlue, engineRed);
                (refBlue, refRed) = referenceStep(width, height, refBlue, refRed);
                assertRowsEq(engineBlue, refBlue);
                assertRowsEq(engineRed, refRed);
            }
        }
    }

    function referenceStep(
        uint8 width,
        uint8 height,
        uint64[] memory blueRows,
        uint64[] memory redRows
    ) internal pure returns (uint64[] memory nextBlueRows, uint64[] memory nextRedRows) {
        uint8[] memory grid = new uint8[](uint256(width) * uint256(height));
        uint8[] memory nextGrid = new uint8[](uint256(width) * uint256(height));

        for (uint8 y = 0; y < height; y++) {
            for (uint8 x = 0; x < width; x++) {
                uint256 idx = uint256(y) * uint256(width) + uint256(x);
                bool blue = (blueRows[y] & (uint64(1) << x)) != 0;
                bool red = (redRows[y] & (uint64(1) << x)) != 0;
                require(!(blue && red), "invalid input overlap");
                if (blue) {
                    grid[idx] = 1;
                } else if (red) {
                    grid[idx] = 2;
                }
            }
        }

        for (uint8 y = 0; y < height; y++) {
            for (uint8 x = 0; x < width; x++) {
                uint8 blueNeighbors;
                uint8 redNeighbors;

                for (int8 dy = -1; dy <= 1; dy++) {
                    for (int8 dx = -1; dx <= 1; dx++) {
                        if (dx == 0 && dy == 0) continue;
                        int16 nxI = int16(uint16(x)) + dx;
                        if (nxI < 0 || nxI >= int16(uint16(width))) continue;
                        uint8 ny = wrapY(y, dy, height);
                        uint256 nIdx = uint256(ny) * uint256(width) + uint256(uint16(int16(nxI)));
                        uint8 neighbor = grid[nIdx];
                        if (neighbor == 1) {
                            blueNeighbors++;
                        } else if (neighbor == 2) {
                            redNeighbors++;
                        }
                    }
                }

                uint8 liveNeighbors = blueNeighbors + redNeighbors;
                uint256 idx = uint256(y) * uint256(width) + uint256(x);
                uint8 current = grid[idx];

                if (current == 1 || current == 2) {
                    if (liveNeighbors == 2 || liveNeighbors == 3) {
                        nextGrid[idx] = current;
                    }
                    continue;
                }

                if (liveNeighbors == 3) {
                    if (blueNeighbors > redNeighbors) {
                        nextGrid[idx] = 1;
                    } else if (redNeighbors > blueNeighbors) {
                        nextGrid[idx] = 2;
                    }
                }
            }
        }

        nextBlueRows = new uint64[](height);
        nextRedRows = new uint64[](height);
        for (uint8 y = 0; y < height; y++) {
            for (uint8 x = 0; x < width; x++) {
                uint256 idx = uint256(y) * uint256(width) + uint256(x);
                if (nextGrid[idx] == 1) {
                    nextBlueRows[y] |= uint64(1) << x;
                } else if (nextGrid[idx] == 2) {
                    nextRedRows[y] |= uint64(1) << x;
                }
            }
        }
    }

    function randomBoard(
        uint8 width,
        uint8 height,
        uint32 seed
    ) internal pure returns (uint64[] memory blueRows, uint64[] memory redRows) {
        blueRows = new uint64[](height);
        redRows = new uint64[](height);
        uint32 state = seed == 0 ? 1 : seed;

        for (uint8 y = 0; y < height; y++) {
            for (uint8 x = 0; x < width; x++) {
                state = nextU32(state);
                uint32 roll = state % 10;
                uint64 bit = uint64(1) << x;
                if (roll < 2) {
                    blueRows[y] |= bit;
                } else if (roll < 4) {
                    redRows[y] |= bit;
                }
            }
        }
    }

    function rows5(
        uint64 a,
        uint64 b,
        uint64 c,
        uint64 d,
        uint64 e
    ) internal pure returns (uint64[] memory out) {
        out = new uint64[](5);
        out[0] = a;
        out[1] = b;
        out[2] = c;
        out[3] = d;
        out[4] = e;
    }

    function assertRowsEq(uint64[] memory a, uint64[] memory b) internal pure {
        require(a.length == b.length, "length mismatch");
        for (uint256 i = 0; i < a.length; i++) {
            require(a[i] == b[i], "row mismatch");
        }
    }

    function wrapY(uint8 y, int8 dy, uint8 height) internal pure returns (uint8) {
        int16 nyI = int16(uint16(y)) + dy;
        if (nyI < 0) return height - 1;
        if (nyI >= int16(uint16(height))) return 0;
        return uint8(uint16(int16(nyI)));
    }

    function nextU32(uint32 current) internal pure returns (uint32) {
        uint32 x = current;
        x ^= x << 13;
        x ^= x >> 17;
        x ^= x << 5;
        return x;
    }
}
