// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract Uint64ArrayContract {
    uint64[64] public rows;

    function loadToMemory() external view returns (uint64[] memory result) {
        result = new uint64[](64);
        for (uint8 y = 0; y < 64;) {
            result[y] = rows[y];
            unchecked { y += 1; }
        }
    }

    function storeFromMemory(uint64[] memory input) external {
        for (uint8 y = 0; y < 64;) {
            rows[y] = input[y];
            unchecked { y += 1; }
        }
    }

    function loadAndStore() external {
        uint64[] memory temp = new uint64[](64);
        for (uint8 y = 0; y < 64;) {
            temp[y] = rows[y];
            unchecked { y += 1; }
        }
        for (uint8 y = 0; y < 64;) {
            rows[y] = temp[y];
            unchecked { y += 1; }
        }
    }
}

contract Uint256PackedContract {
    uint256[16] public packed;

    function loadToMemory() external view returns (uint64[] memory result) {
        result = new uint64[](64);
        for (uint8 slot = 0; slot < 16;) {
            uint256 packedSlot = packed[slot];
            unchecked {
                uint8 base = slot * 4;
                result[base] = uint64(packedSlot);
                result[base + 1] = uint64(packedSlot >> 64);
                result[base + 2] = uint64(packedSlot >> 128);
                result[base + 3] = uint64(packedSlot >> 192);
                slot += 1;
            }
        }
    }

    function storeFromMemory(uint64[] memory input) external {
        for (uint8 slot = 0; slot < 16;) {
            unchecked {
                uint8 base = slot * 4;
                packed[slot] = uint256(input[base])
                    | (uint256(input[base + 1]) << 64)
                    | (uint256(input[base + 2]) << 128)
                    | (uint256(input[base + 3]) << 192);
                slot += 1;
            }
        }
    }

    function loadAndStore() external {
        uint64[] memory temp = new uint64[](64);
        for (uint8 slot = 0; slot < 16;) {
            uint256 packedSlot = packed[slot];
            unchecked {
                uint8 base = slot * 4;
                temp[base] = uint64(packedSlot);
                temp[base + 1] = uint64(packedSlot >> 64);
                temp[base + 2] = uint64(packedSlot >> 128);
                temp[base + 3] = uint64(packedSlot >> 192);
                slot += 1;
            }
        }
        for (uint8 slot = 0; slot < 16;) {
            unchecked {
                uint8 base = slot * 4;
                packed[slot] = uint256(temp[base])
                    | (uint256(temp[base + 1]) << 64)
                    | (uint256(temp[base + 2]) << 128)
                    | (uint256(temp[base + 3]) << 192);
                slot += 1;
            }
        }
    }
}

contract StorageLayoutGasTest {
    function testGasUint64ArrayLoad() public {
        Uint64ArrayContract uint64Contract = new Uint64ArrayContract();
        uint64[] memory testData = new uint64[](64);
        for (uint8 i = 0; i < 64; i++) {
            testData[i] = uint64(i) * 1000 + 12345;
        }
        uint64Contract.storeFromMemory(testData);
        uint64Contract.loadToMemory();
    }

    function testGasUint256PackedLoad() public {
        Uint256PackedContract uint256Contract = new Uint256PackedContract();
        uint64[] memory testData = new uint64[](64);
        for (uint8 i = 0; i < 64; i++) {
            testData[i] = uint64(i) * 1000 + 12345;
        }
        uint256Contract.storeFromMemory(testData);
        uint256Contract.loadToMemory();
    }

    function testGasUint64ArrayStore() public {
        Uint64ArrayContract uint64Contract = new Uint64ArrayContract();
        uint64[] memory testData = new uint64[](64);
        for (uint8 i = 0; i < 64; i++) {
            testData[i] = uint64(i) * 2000 + 54321;
        }
        uint64Contract.storeFromMemory(testData);
    }

    function testGasUint256PackedStore() public {
        Uint256PackedContract uint256Contract = new Uint256PackedContract();
        uint64[] memory testData = new uint64[](64);
        for (uint8 i = 0; i < 64; i++) {
            testData[i] = uint64(i) * 2000 + 54321;
        }
        uint256Contract.storeFromMemory(testData);
    }

    function testGasUint64ArrayLoadAndStore() public {
        Uint64ArrayContract uint64Contract = new Uint64ArrayContract();
        uint64[] memory testData = new uint64[](64);
        for (uint8 i = 0; i < 64; i++) {
            testData[i] = uint64(i) * 1000 + 12345;
        }
        uint64Contract.storeFromMemory(testData);
        uint64Contract.loadAndStore();
    }

    function testGasUint256PackedLoadAndStore() public {
        Uint256PackedContract uint256Contract = new Uint256PackedContract();
        uint64[] memory testData = new uint64[](64);
        for (uint8 i = 0; i < 64; i++) {
            testData[i] = uint64(i) * 1000 + 12345;
        }
        uint256Contract.storeFromMemory(testData);
        uint256Contract.loadAndStore();
    }
}
