export const CELL_DEAD: [number, number, number] = [15, 15, 15];
export const CELL_BLUE: [number, number, number] = [59, 130, 246];
export const CELL_RED: [number, number, number] = [239, 68, 68];

export type RenderedBoard = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export function renderBoardPixels(
  board: { width: number; height: number; blueRows: bigint[]; redRows: bigint[] },
  options: { scale: number },
): RenderedBoard {
  const { width, height, blueRows, redRows } = board;
  const { scale } = options;
  const pxW = width * scale;
  const pxH = height * scale;
  const data = new Uint8ClampedArray(pxW * pxH * 4);

  for (let y = 0; y < height; y++) {
    const blue = blueRows[y];
    const red = redRows[y];
    for (let x = 0; x < width; x++) {
      const bit = 1n << BigInt(x);
      let color: [number, number, number];
      if ((blue & bit) !== 0n) {
        color = CELL_BLUE;
      } else if ((red & bit) !== 0n) {
        color = CELL_RED;
      } else {
        color = CELL_DEAD;
      }

      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const offset = ((y * scale + sy) * pxW + (x * scale + sx)) * 4;
          data[offset] = color[0];
          data[offset + 1] = color[1];
          data[offset + 2] = color[2];
          data[offset + 3] = 255;
        }
      }
    }
  }

  return { width: pxW, height: pxH, data };
}
