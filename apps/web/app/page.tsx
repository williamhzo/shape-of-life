import { summarizeBoard } from "../lib/board-summary";

const previewSummary = summarizeBoard({
  width: 8,
  height: 8,
  blueRows: [0b00110000n, 0b00110000n, 0n, 0n, 0n, 0n, 0n, 0n],
  redRows: [0n, 0n, 0n, 0n, 0n, 0n, 0b00001100n, 0b00001100n],
});

export default function HomePage() {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Shape L2</p>
        <h1>Conway Arena</h1>
        <p className="lede">
          Spectator-first multiplayer Conway&apos;s Game of Life with onchain
          commit/reveal rounds.
        </p>
      </section>

      <section className="panel">
        <h2>Prototype Status</h2>
        <ul>
          <li>Engine parity fixtures: ready</li>
          <li>Contracts parity tests: ready</li>
          <li>Web app bootstrap: in progress</li>
        </ul>
      </section>

      <section className="panel">
        <h2>Preview Board Summary</h2>
        <p>Blue cells: {previewSummary.blue}</p>
        <p>Red cells: {previewSummary.red}</p>
        <p>Total live cells: {previewSummary.total}</p>
      </section>
    </main>
  );
}
