import { describe, expect, it } from "vitest";

import {
  CELL_BLUE,
  CELL_DEAD,
  CELL_RED,
  renderBoardPixels,
} from "../lib/board-renderer";

describe("renderBoardPixels", () => {
  it("returns correct dimensions for a scaled board", () => {
    const result = renderBoardPixels(
      { width: 4, height: 4, blueRows: [0n, 0n, 0n, 0n], redRows: [0n, 0n, 0n, 0n] },
      { scale: 2 },
    );
    expect(result.width).toBe(8);
    expect(result.height).toBe(8);
    expect(result.data.length).toBe(8 * 8 * 4);
  });

  it("renders empty board as all dead pixels", () => {
    const result = renderBoardPixels(
      { width: 2, height: 2, blueRows: [0n, 0n], redRows: [0n, 0n] },
      { scale: 1 },
    );
    for (let i = 0; i < 4; i++) {
      const offset = i * 4;
      expect(result.data[offset]).toBe(CELL_DEAD[0]);
      expect(result.data[offset + 1]).toBe(CELL_DEAD[1]);
      expect(result.data[offset + 2]).toBe(CELL_DEAD[2]);
      expect(result.data[offset + 3]).toBe(255);
    }
  });

  it("renders a blue cell at (0,0) correctly", () => {
    const result = renderBoardPixels(
      { width: 4, height: 4, blueRows: [0b0001n, 0n, 0n, 0n], redRows: [0n, 0n, 0n, 0n] },
      { scale: 1 },
    );
    expect(result.data[0]).toBe(CELL_BLUE[0]);
    expect(result.data[1]).toBe(CELL_BLUE[1]);
    expect(result.data[2]).toBe(CELL_BLUE[2]);
    expect(result.data[3]).toBe(255);
  });

  it("renders a red cell at (1,0) correctly", () => {
    const result = renderBoardPixels(
      { width: 4, height: 4, blueRows: [0n, 0n, 0n, 0n], redRows: [0b0010n, 0n, 0n, 0n] },
      { scale: 1 },
    );
    const offset = 1 * 4;
    expect(result.data[offset]).toBe(CELL_RED[0]);
    expect(result.data[offset + 1]).toBe(CELL_RED[1]);
    expect(result.data[offset + 2]).toBe(CELL_RED[2]);
    expect(result.data[offset + 3]).toBe(255);
  });

  it("scales cells into blocks of scale x scale pixels", () => {
    const result = renderBoardPixels(
      { width: 2, height: 2, blueRows: [0b01n, 0n], redRows: [0n, 0n] },
      { scale: 3 },
    );
    expect(result.width).toBe(6);
    expect(result.height).toBe(6);
    for (let py = 0; py < 3; py++) {
      for (let px = 0; px < 3; px++) {
        const offset = (py * 6 + px) * 4;
        expect(result.data[offset]).toBe(CELL_BLUE[0]);
      }
    }
    const deadOffset = (0 * 6 + 3) * 4;
    expect(result.data[deadOffset]).toBe(CELL_DEAD[0]);
  });

  it("renders a full 64x64 board at scale 1", () => {
    const blueRows = Array.from({ length: 64 }, () => 0n);
    const redRows = Array.from({ length: 64 }, () => 0n);
    blueRows[0] = 1n;
    redRows[63] = 1n << 63n;
    const result = renderBoardPixels(
      { width: 64, height: 64, blueRows, redRows },
      { scale: 1 },
    );
    expect(result.width).toBe(64);
    expect(result.height).toBe(64);
    expect(result.data.length).toBe(64 * 64 * 4);
    expect(result.data[0]).toBe(CELL_BLUE[0]);
    const lastCellOffset = (63 * 64 + 63) * 4;
    expect(result.data[lastCellOffset]).toBe(CELL_RED[0]);
  });
});
