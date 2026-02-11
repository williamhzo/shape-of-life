export type Topology = "cylinder";

export type BoardState = {
  width: number;
  height: number;
  blueRows: bigint[];
  redRows: bigint[];
};

const U64_MASK = (1n << 64n) - 1n;

function assertBoardShape(
  width: number,
  height: number,
  blueRows: bigint[],
  redRows: bigint[],
): void {
  if (!Number.isInteger(width) || width < 1 || width > 64) {
    throw new Error("width must be an integer in [1, 64]");
  }
  if (!Number.isInteger(height) || height < 1) {
    throw new Error("height must be a positive integer");
  }
  if (blueRows.length !== height || redRows.length !== height) {
    throw new Error("row arrays must match board height");
  }
}

function getWidthMask(width: number): bigint {
  return width === 64 ? U64_MASK : (1n << BigInt(width)) - 1n;
}

export function packRows(rows: bigint[]): bigint[] {
  if (rows.length === 0 || rows.length % 4 !== 0) {
    throw new Error("rows length must be a non-zero multiple of 4");
  }

  const packed: bigint[] = [];
  for (let i = 0; i < rows.length; i += 4) {
    const r0 = BigInt.asUintN(64, rows[i]);
    const r1 = BigInt.asUintN(64, rows[i + 1]);
    const r2 = BigInt.asUintN(64, rows[i + 2]);
    const r3 = BigInt.asUintN(64, rows[i + 3]);
    packed.push(r0 | (r1 << 64n) | (r2 << 128n) | (r3 << 192n));
  }

  return packed;
}

export function unpackRows(words: bigint[], rowCount = 64): bigint[] {
  if (rowCount <= 0 || rowCount % 4 !== 0) {
    throw new Error("rowCount must be a positive multiple of 4");
  }
  if (words.length * 4 < rowCount) {
    throw new Error("insufficient packed words for rowCount");
  }

  const rows = new Array<bigint>(rowCount);
  for (let i = 0; i < rowCount; i += 1) {
    const word = words[Math.floor(i / 4)];
    const shift = BigInt((i % 4) * 64);
    rows[i] = (word >> shift) & U64_MASK;
  }
  return rows;
}

export function stepGeneration(
  state: BoardState,
  topology: Topology = "cylinder",
): BoardState {
  if (topology !== "cylinder") {
    throw new Error(`unsupported topology: ${topology}`);
  }

  const { width, height, blueRows, redRows } = state;
  assertBoardShape(width, height, blueRows, redRows);

  const mask = getWidthMask(width);
  const nextBlue = Array<bigint>(height).fill(0n);
  const nextRed = Array<bigint>(height).fill(0n);

  const isBlue = (x: number, y: number): boolean =>
    ((blueRows[y] >> BigInt(x)) & 1n) === 1n;
  const isRed = (x: number, y: number): boolean =>
    ((redRows[y] >> BigInt(x)) & 1n) === 1n;

  for (let y = 0; y < height; y += 1) {
    if ((blueRows[y] & redRows[y]) !== 0n) {
      throw new Error("invalid board: overlapping blue/red cells");
    }

    for (let x = 0; x < width; x += 1) {
      let blueNeighbors = 0;
      let redNeighbors = 0;

      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) {
            continue;
          }

          const nx = x + dx;
          if (nx < 0 || nx >= width) {
            continue;
          }

          const ny = (y + dy + height) % height;
          if (isBlue(nx, ny)) {
            blueNeighbors += 1;
          } else if (isRed(nx, ny)) {
            redNeighbors += 1;
          }
        }
      }

      const liveNeighbors = blueNeighbors + redNeighbors;
      const aliveBlue = isBlue(x, y);
      const aliveRed = isRed(x, y);
      const bit = 1n << BigInt(x);

      if (aliveBlue || aliveRed) {
        if (liveNeighbors === 2 || liveNeighbors === 3) {
          if (aliveBlue) {
            nextBlue[y] |= bit;
          } else {
            nextRed[y] |= bit;
          }
        }
        continue;
      }

      if (liveNeighbors === 3) {
        if (blueNeighbors > redNeighbors) {
          nextBlue[y] |= bit;
        } else if (redNeighbors > blueNeighbors) {
          nextRed[y] |= bit;
        }
      }
    }

    nextBlue[y] &= mask;
    nextRed[y] &= mask;
    if ((nextBlue[y] & nextRed[y]) !== 0n) {
      throw new Error("engine produced overlapping blue/red cells");
    }
  }

  return {
    width,
    height,
    blueRows: nextBlue,
    redRows: nextRed,
  };
}
