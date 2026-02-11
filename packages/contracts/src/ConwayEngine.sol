// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

library ConwayEngine {
    error InvalidDimensions();
    error InvalidRowsLength();
    error OverlappingCells();

    function step(
        uint8 width,
        uint8 height,
        uint64[] memory blueRows,
        uint64[] memory redRows
    ) internal pure returns (uint64[] memory nextBlueRows, uint64[] memory nextRedRows) {
        if (width == 0 || width > 64 || height == 0) revert InvalidDimensions();
        if (blueRows.length != height || redRows.length != height) revert InvalidRowsLength();

        nextBlueRows = new uint64[](height);
        nextRedRows = new uint64[](height);

        uint64 widthMask = width == 64 ? type(uint64).max : uint64((uint256(1) << width) - 1);

        for (uint8 y = 0; y < height; y++) {
            if ((blueRows[y] & redRows[y]) != 0) revert OverlappingCells();

            for (uint8 x = 0; x < width; x++) {
                uint8 blueNeighbors;
                uint8 redNeighbors;

                for (int8 dy = -1; dy <= 1; dy++) {
                    for (int8 dx = -1; dx <= 1; dx++) {
                        if (dx == 0 && dy == 0) continue;
                        int16 nxI = int16(uint16(x)) + dx;
                        if (nxI < 0 || nxI >= int16(uint16(width))) continue;

                        uint8 ny = wrapY(y, dy, height);
                        uint64 bit = uint64(1) << uint16(nxI);

                        if ((blueRows[ny] & bit) != 0) {
                            blueNeighbors++;
                        } else if ((redRows[ny] & bit) != 0) {
                            redNeighbors++;
                        }
                    }
                }

                uint8 liveNeighbors = blueNeighbors + redNeighbors;
                uint64 cellBit = uint64(1) << x;
                bool aliveBlue = (blueRows[y] & cellBit) != 0;
                bool aliveRed = (redRows[y] & cellBit) != 0;

                if (aliveBlue || aliveRed) {
                    if (liveNeighbors == 2 || liveNeighbors == 3) {
                        if (aliveBlue) {
                            nextBlueRows[y] |= cellBit;
                        } else {
                            nextRedRows[y] |= cellBit;
                        }
                    }
                    continue;
                }

                if (liveNeighbors == 3) {
                    if (blueNeighbors > redNeighbors) {
                        nextBlueRows[y] |= cellBit;
                    } else if (redNeighbors > blueNeighbors) {
                        nextRedRows[y] |= cellBit;
                    }
                }
            }

            nextBlueRows[y] &= widthMask;
            nextRedRows[y] &= widthMask;
            if ((nextBlueRows[y] & nextRedRows[y]) != 0) revert OverlappingCells();
        }
    }

    function wrapY(uint8 y, int8 dy, uint8 height) private pure returns (uint8) {
        int16 nyI = int16(uint16(y)) + dy;
        if (nyI < 0) return height - 1;
        if (nyI >= int16(uint16(height))) return 0;
        return uint8(uint16(int16(nyI)));
    }
}
