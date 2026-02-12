# Conway Arena Concept and Player Rules

This doc has two jobs:

1. Explain the core idea behind Conway’s Game of Life in plain language.
2. Explain Conway Arena’s user-facing rules without implementation or spec-level detail.

`plan.md` remains the technical planning/spec document.

## Part I: The Concept (Conway’s Game of Life)

## 1. What Conway’s Game of Life Is

Conway’s Game of Life is a zero-player simulation created by mathematician John Conway.

- The board is a grid of cells.
- Each cell is either alive or dead.
- No player moves after the initial setup.
- The system evolves automatically in steps called generations.

The remarkable part: very simple local rules create complex global behavior.

It became widely known in 1970 through Martin Gardner’s Scientific American column and has remained a foundational example in complexity science, computer science education, and emergent-systems research.

### 1.1 Mental Model

Think of Life as a microscopic physics sandbox:

- There are no explicit objects, only cells following local laws.
- “Objects” (like gliders or oscillators) are patterns that persist under those laws.
- Macro behavior is the accumulated side effect of local neighbor interactions.

This is exactly why it is compelling for spectators: coherent structures appear without scripted choreography.

## 2. The Four Local Rules

For each generation, every cell updates at the same time:

- Underpopulation: a live cell with fewer than two live neighbors dies.
- Survival: a live cell with two or three live neighbors survives.
- Overcrowding: a live cell with more than three live neighbors dies.
- Birth: a dead cell with exactly three live neighbors becomes alive.

This is often summarized as `B3/S23`.

## 3. Why It Matters

Game of Life is famous because it demonstrates emergence:

- You define tiny deterministic rules.
- Unexpected higher-level structures appear.
- Those structures can move, collide, stabilize, or amplify.

It is not random, but it can feel unpredictable at scale because interactions compound quickly.

It also matters because it sits at the boundary between order and chaos:

- Too sparse: activity dies out quickly.
- Too dense: patterns collapse from overcrowding.
- Mid-density: rich long-lived behavior appears.

This “edge-of-chaos” zone is where the most interesting competitive rounds usually happen.

### 3.1 Computation and Universality

Life is not just a toy. It can support computational structures:

- Memory-like stable structures.
- Signal-like moving patterns.
- Logic-like interactions through collisions.

In the theoretical sense, Life is computationally universal: complex computation can be encoded in pattern interactions. You do not need to build logic circuits to play, but this explains why expert play can feel surprisingly deep.

## 4. Pattern Language (How People Think About Life)

Players and researchers usually reason in pattern classes:

- Still lifes: stable shapes that stop changing.
- Oscillators: shapes that repeat after N generations.
- Spaceships: patterns that translate across the board.
- Guns: patterns that periodically emit moving objects (like gliders).
- Puffers and breeders: growth-oriented structures that leave trails or create more generators.
- Methuselahs: tiny seeds that evolve for a long time before stabilizing.

You do not need all of these to play, but this language explains why strong seeds are more about structure than raw cell count.

### 4.1 Pattern Ecology (How Patterns Interact)

Experienced players evaluate seeds by ecological behavior:

- Does the seed stabilize fast or stay volatile?
- Does it emit outward pressure?
- Does it create resilient cores after collisions?
- Does it self-poison (destroy itself) when crowded?
- Does it leave useful debris your team can leverage?

Competitive strength usually comes from reliable interaction behavior, not isolated beauty.

## 5. Strategic Intuition

Useful intuition from Life:

- Local geometry beats brute force density.
- Front-line interactions matter more than isolated clusters.
- Timing matters: delayed growth can beat fast early spread.
- Collision outcomes are often the real objective.
- Edges/topology change strategy; what wraps and what does not wrap matters.

In short: Life rewards shape design, not button mashing.

### 5.1 Common New-Player Mistakes

- Overfilling seeds with too many live cells.
- Ignoring lane direction and only optimizing for local survival.
- Choosing fragile seeds that look strong at generation 1 but collapse by generation 10+.
- Treating every round the same despite different topology/season settings.

## 6. Why This Works as a Multiplayer Game

Classic Life is usually single-seed exploration. Conway Arena turns it into social competition by:

- Assigning teams.
- Letting many players seed the same board.
- Keeping rules deterministic and public.
- Scoring by final territorial and population outcomes.

That turns a mathematical toy into a spectator-friendly strategy game.

### 6.1 What Spectators Actually Watch

Strong rounds are readable because they produce visible phases:

1. Opening: initial expansion from seed placements.
2. Midgame: wavefront collisions and territory contests.
3. Endgame: stabilization, cleanup, and score-defining remnants.

That structure makes outcomes legible even to viewers who do not know pattern names.

## Part II: User-Facing Conway Arena Rules

## 7. Match Objective

Help your team win the round by contributing a strong seed that survives, spreads, and contests territory effectively over the full simulation.

## 8. Round Flow

Every round follows the same user-visible lifecycle:

1. Commit
- Choose team, slot, and seed.
- Submit a hidden commitment.

2. Reveal
- Reveal exactly what you committed.
- Valid reveals become active on the board.

3. Simulation
- The board runs forward automatically under fixed rules.
- No mid-simulation board editing by players.

4. Claim
- Final result is available.
- Eligible participants claim their outcomes.

## 9. Participation Rules

- One player contributes one seed per round.
- Seeds must fit the round’s seed constraints.
- Commit and reveal must match.
- Missing or invalid reveal means your seed does not participate.
- Team and slot constraints are enforced by the round setup.

## 10. Board and Color Rules (Player View)

- Core Life update rule is fixed for the whole round.
- Two-color immigration behavior is used:
  - survivors keep color
  - births inherit majority parent color
- The board topology for the round is fixed in advance.

You can trust that the same rules are applied uniformly to every participant.

## 11. Winning and Outcomes

A round ends when the simulation reaches its stop condition.

Winner determination is based on final board outcomes:

- Team survival and sustained population matter.
- Territorial pressure/invasion matters.
- Draws can occur.

Scoring weights and payout splits are season parameters, communicated in the round UI.

## 12. Fairness and Verifiability

Conway Arena is designed around deterministic fairness:

- Hidden commit reduces copy and last-second imitation.
- Fixed round parameters prevent rule changes mid-match.
- Deterministic simulation means outcomes are reproducible.
- Public state transitions make results auditable.

## 13. Quick Start for New Players

If you are new:

1. Start with compact, stable seeds that do not self-destruct.
2. Prefer seeds that project pressure toward the midline.
3. Avoid over-dense shapes that collapse early.
4. Always reveal on time.
5. Watch replays and iterate your seed library.
