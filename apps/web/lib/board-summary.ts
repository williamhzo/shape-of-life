export type BoardInput = {
  width: number;
  height: number;
  blueRows: bigint[];
  redRows: bigint[];
};

export type BoardSummary = {
  blue: number;
  red: number;
  total: number;
};

const U64_MASK = (1n << 64n) - 1n;

function assertBoard(input: BoardInput): void {
  const { width, height, blueRows, redRows } = input;

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

function popcountBits(word: bigint): number {
  let value = BigInt.asUintN(64, word) & U64_MASK;
  let count = 0;
  while (value !== 0n) {
    value &= value - 1n;
    count += 1;
  }
  return count;
}

export function summarizeBoard(input: BoardInput): BoardSummary {
  assertBoard(input);
  const widthMask = getWidthMask(input.width);

  let blue = 0;
  let red = 0;

  for (let y = 0; y < input.height; y += 1) {
    const blueRow = BigInt.asUintN(64, input.blueRows[y]);
    const redRow = BigInt.asUintN(64, input.redRows[y]);
    if ((blueRow & ~widthMask) !== 0n || (redRow & ~widthMask) !== 0n) {
      throw new Error("invalid board: bits outside board width");
    }
    if ((blueRow & redRow) !== 0n) {
      throw new Error("invalid board: overlapping team bits");
    }

    blue += popcountBits(blueRow);
    red += popcountBits(redRow);
  }

  return {
    blue,
    red,
    total: blue + red,
  };
}
