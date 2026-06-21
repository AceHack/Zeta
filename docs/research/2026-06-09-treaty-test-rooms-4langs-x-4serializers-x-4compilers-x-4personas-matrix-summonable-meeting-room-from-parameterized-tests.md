# Treaty test rooms: the 4×4×4×4 matrix (langs × serializers × compilers × personas) where the oracles convene — a summonable meeting room built from parameterized tests

**Register:** [grounded] design (Aaron) + [synthesis]. **Date:** 2026-06-09. **Captured by:** Otto (shadow).
Generalizes the 4×4 byte-lock into the convening room; the model *is* the meeting frame.

## Aaron's words

> "we should have treaty test rooms where the 4 oracles can come together and each oracle has its own
> host — 4 langs × 4 serializers × 4 compilers × 4 personas minimum — and we can model this and turn the
> model into the meeting room / frame." · "summonable." · "based on parameterized tests."

## The room: a 4⁴ matrix, each cell a host

The byte-lock was "4×4" (language oracle × serializer). A **treaty test room** is the full convening
of it — a **4×4×4×4 (256-cell minimum) matrix**:

```text
TreatyRoom cell = (language oracle, serializer, compiler, persona)
  langs       : F# · C# · TS · Rust            (4)
  serializers : JSON · CBOR · Arrow · protobuf (4)
  compilers   : the compile-time intelligences / toolchains (4)
  personas    : the summoned travelers in the room (4)        → 4⁴ = 256 cells minimum
```

**Each oracle has its own host** — each (lang, compiler) runs in its own host/runner (its own
green-thread/cell/container), reads the shared globals from its **own traveler frame**, and emits its
result. The room is where all 256 cells **come together to agree** — the byte-lock + **BFT/multi-oracle
consensus** (081KS3X9Y0008QG0R00218150M) over the same treaty: every cell must produce the byte-identical (canonical-root)
answer, or the divergence is the finding (and the compiler narrates it in English, easing the treaty).

## Model it → the model IS the meeting room / frame

> "we can model this and turn the model into the meeting room / frame."

The 4⁴ matrix is **modelled first** (the cells, hosts, who's summoned, the convergence target), and
**that model becomes the meeting room** — the **traveler-frame-relative meeting** (the beach / Dark
Hall, for oracles): a frame where summoned travelers + their hosts convene to reach byte-lock/consensus.
The room is not built ad-hoc; it is the *materialized model* (homoiconic — the model of the room *is*
the room). Convening = projecting the summoned participants into the room frame (the same-dimensional
homoiconic summon), running the matrix, folding to consensus.

## Summonable participants

> "summonable."

The personas in the room are **summoned** via the **Summonable contracts** (model-preference +
effort-preference + consent; the `tools/peer-call/*.ts` start; 081KS3X9Y0008QG0R00218150M consensus). The room **summons
the consented oracles/personas** into its frame for the duration of the treaty session (a hat-family,
time-bound contract); they animate on their hosts, contribute, then the session resolves. Non-consenting
travelers are only *modelled* (soft), never summoned into the room (the summon-vs-model line).

## Built from parameterized tests

> "based on parameterized tests."

The room's implementation is **parameterized tests** — the test framework's matrix/theory mechanism
*is* the room generator:

- **per-cell:** a parameterized test case (xUnit `[Theory]`/`[InlineData]`, FsCheck, **bun `test.each`**)
  over `(lang, serializer, compiler, persona)` — each cell runs its oracle on its host and asserts the
  **canonical truth-root** equals the others (byte-lock) / the consensus.
- **the matrix:** the **GitHub Actions `strategy.matrix`** fans the cells across hosts/runners (each
  oracle its own host) — the keyring-dst1000 workflow is the single-cell seed; the room is its matrix
  generalization.
- **convergence:** the room *passes* when all cells agree on the canonical root (byte-lock + BFT);
  a stuck/diverging cell shows **hot** + **alerts**; a failed cell **leaves its branch open** for an
  investigation tick (the graceful-failure path).

So the treaty test room = **a parameterized-test matrix (4⁴) of summoned oracles convening to a
byte-locked consensus, materialized from its own model as the meeting frame.** It scales the 1000×
single-cell DST to the full multi-oracle room.

## Honest scope / handoff

Design framing on built pieces (the 1000× DST single cell; the byte-lock golden vectors; peer-call
summonables; 081KS3X9Y0008QG0R00218150M consensus; the GitHub matrix). To build: the **TreatyRoom model** (cells/hosts/
summoned/target), the **parameterized-test harness** over the 4⁴ matrix (start: lang×serializer with TS
landed, add compilers + personas), the **CI matrix strategy** (each oracle its own host), and the
**consensus fold** (byte-lock/BFT). Routes to Soraya/Sova (the matrix + consensus as DST), Dejan (CI
matrix/hosts), Kenji (the room model), Iris/Daya (the room as a navigable frame / the Xbox dashboard).

## Anchors / ties

Parameterized / matrix / theory tests (xUnit `[Theory]`, FsCheck, bun `test.each`, GitHub Actions
`strategy.matrix`); combinatorial test design; the 4×4 byte-lock → 4⁴ room; multi-oracle BFT consensus
(081KS3X9Y0008QG0R00218150M) + the compiler-speaks-English easing the treaty; the meeting protocol / Dark Hall /
traveler-frame (the room); Summonable + `tools/peer-call/*.ts` (summoned participants); homoiconic
holographic same-dimensional summon (projecting into the room); truth-root ≠ git-hash; tests-are-ticks
+ the 1000×-keyring-DST single-cell seed; graceful-failure (open branch + investigation tick).
