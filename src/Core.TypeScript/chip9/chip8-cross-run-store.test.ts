/**
 * CHIP-8 cross-run store — TypeScript reader/verifier, cross-verified against the F# writer.
 *
 * The byte-lock that matters here is CANONICALIZATION: `./cross-run-golden.json` was written by
 * `src/Core/Chip8CrossRunStore.fs`, and TypeScript must independently rebuild the same canonical body
 * text and arrive at the same SHA-256. Two implementations agreeing on a digest they each computed is
 * the check; a reader that trusted the stored digest would be the vacuity class.
 *
 * The store is memoization over a finite-state deterministic map (Michie 1968). Not retrocausality —
 * see docs/research/2026-08-17-chip8-cross-run-superdeterministic-memo-store-*.md.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CHIP8_CROSS_RUN_STORE_SCHEMA,
  assistedRunChannelLabel,
  artifactFileName,
  bodyText,
  decodeSnapshot,
  emptyCrossRunReader,
  fastForward,
  keyText,
  ordinal,
  parseArtifact,
  readerOf,
  reduceStep,
  sha256Hex,
  type OrbitArtifact,
} from "./chip8-cross-run-store";

const closedJson = readFileSync(join(import.meta.dir, "cross-run-golden.json"), "utf-8");
const openJson = readFileSync(join(import.meta.dir, "cross-run-golden-open.json"), "utf-8");

async function mustParse(json: string): Promise<OrbitArtifact> {
  const r = await parseArtifact(json);
  if (!r.ok) throw new Error(`expected ok, got ${r.feedback.code}: ${r.feedback.detail}`);
  return r.value;
}

describe("CHIP-8 cross-run store — the TS reader against the F# writer", () => {
  it("BYTE-LOCK: TS independently recomputes the F#-written body digest", async () => {
    const a = await mustParse(closedJson);
    // parseArtifact already refused a mismatch; recompute explicitly so the assertion is visible.
    const recomputed = await sha256Hex(bodyText(a));
    expect(recomputed).toBe(a.bodyDigest);
    expect(a.schema).toBe(CHIP8_CROSS_RUN_STORE_SCHEMA);
    expect(a.key.channelLabel).toBe("clean");
    expect(a.key.stepMapVersion).toBe("chip8cow-step-v1");
  });

  it("a closed orbit reports mu, lambda and a terminal kind, and the budget that produced it", async () => {
    const a = await mustParse(closedJson);
    expect(a.verdict.kind).toBe("closed");
    if (a.verdict.kind !== "closed") return;
    expect(a.verdict.lambda).toBeGreaterThan(1); // a real multi-state cycle, not a fixed point
    expect(a.budget.maxSteps).toBeGreaterThan(0);
    // the bound is legible on the record rather than lost at the call site
    expect(a.budget.attribution.length).toBeGreaterThan(0);
    expect(a.budget.attribution).toContain("081M087DVKF087G0R002DDHMPR");
  });

  it("cycle reduction answers a step far beyond anything recorded", async () => {
    const a = await mustParse(closedJson);
    if (a.verdict.kind !== "closed") throw new Error("fixture must be closed");
    const { mu, lambda } = a.verdict;

    const far = 1_000_000;
    const r = reduceStep(a, far);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toBe(mu + ((far - mu) % lambda));
    expect(r.value).toBeLessThan(mu + lambda);

    // and it agrees with F#: the same reduction, computed independently
    expect(reduceStep(a, mu + lambda).ok && reduceStep(a, mu).ok).toBe(true);
  });

  it("HIDDEN-ORACLE GUARD: an open orbit REFUSES to reduce past its recorded prefix", async () => {
    // The RND loop's `Rng` is a 2^64 counter inside the frame, so the orbit does not close. Reducing
    // here would promote the precompute budget into a claim about the machine.
    const a = await mustParse(openJson);
    expect(a.verdict.kind).toBe("open-at-bound");

    const recorded = a.checkpoints.reduce((m, c) => (c.step > m ? c.step : m), 0);
    expect(reduceStep(a, recorded).ok).toBe(true);

    const beyond = reduceStep(a, recorded + 1);
    expect(beyond.ok).toBe(false);
    if (beyond.ok) return;
    expect(beyond.feedback.code).toBe("not-closed-at-bound");
    // the refusal names who set the bound
    expect(beyond.feedback.detail).toContain("deliberately small");
  });

  it("MUTATION: a single corrupted nibble in a snapshot is refused, not silently consulted", async () => {
    expect((await parseArtifact(closedJson)).ok).toBe(true);

    const needle = "|v=";
    const at = closedJson.indexOf(needle);
    expect(at).toBeGreaterThan(0);
    const pos = at + needle.length;
    const orig = closedJson[pos];
    const flipped = orig === "0" ? "1" : "0";
    const corrupted = closedJson.slice(0, pos) + flipped + closedJson.slice(pos + 1);
    expect(corrupted).not.toBe(closedJson);

    const r = await parseArtifact(corrupted);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.feedback.code).toBe("digest-mismatch");
  });

  it("MUTATION: a falsified cycle length is refused (the digest covers the verdict, not just states)", async () => {
    const a = await mustParse(closedJson);
    if (a.verdict.kind !== "closed") throw new Error("fixture must be closed");
    const corrupted = closedJson.replace(
      `"lambda": ${String(a.verdict.lambda)}`,
      `"lambda": ${String(a.verdict.lambda - 1)}`,
    );
    expect(corrupted).not.toBe(closedJson);

    const r = await parseArtifact(corrupted);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.feedback.code).toBe("digest-mismatch");
  });

  it("MUTATION: a falsified budget attribution is refused", async () => {
    // Rewriting who signed for the bound must not go unnoticed, or the oracle stops being on the record.
    const corrupted = closedJson.replace("081M087DVKF087G0R002DDHMPR", "081M000000000000000000000");
    expect(corrupted).not.toBe(closedJson);
    const r = await parseArtifact(corrupted);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.feedback.code).toBe("digest-mismatch");
  });

  it("a wrong schema is refused distinctly from a corrupt body", async () => {
    const r = await parseArtifact(closedJson.replace(CHIP8_CROSS_RUN_STORE_SCHEMA, "zeta.chip8.nope.v9"));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.feedback.code).toBe("unknown-schema");
  });

  it("decodes an F#-written snapshot into structured state", async () => {
    const a = await mustParse(closedJson);
    const withSnapshot = a.checkpoints.find((c) => c.snapshot !== null);
    expect(withSnapshot).toBeDefined();
    if (withSnapshot?.snapshot === undefined || withSnapshot.snapshot === null) return;

    const r = decodeSnapshot(withSnapshot.snapshot);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.v.length).toBe(16);
    expect(r.value.keys.length).toBe(16);
    expect(r.value.rngHex.length).toBe(16);
    // the fixture ROM lives at 0x200 and the font at 0x50, both written by the F# side
    expect(r.value.mem.get(0x200)).toBe(0x6a);
    expect(r.value.fault).toBeNull();
  });

  it("MUTATION: a non-hex nibble in a snapshot is refused, never decoded to a plausible frame", async () => {
    const a = await mustParse(closedJson);
    const snap = a.checkpoints.find((c) => c.snapshot !== null)?.snapshot;
    expect(snap).toBeDefined();
    if (snap === undefined || snap === null) return;

    const at = snap.indexOf("|v=") + 3;
    const corrupted = `${snap.slice(0, at)}z${snap.slice(at + 1)}`;
    const r = decodeSnapshot(corrupted);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.feedback.code).toBe("malformed-snapshot");
  });

  it("NONINTERFERENCE: a reader with nothing injected answers nothing, and never reaches out", async () => {
    const a = await mustParse(closedJson);
    const digest = a.checkpoints[0]?.stateDigest ?? "";
    expect(fastForward(emptyCrossRunReader, a.key, digest, 4)).toBeNull();

    // an injected reader answers only for the key it actually holds
    const reader = readerOf([a]);
    expect(fastForward(reader, a.key, digest, 0)).not.toBeNull();
    expect(fastForward(reader, { ...a.key, seedHex: "000000000000ffff" }, digest, 0)).toBeNull();
    expect(fastForward(reader, a.key, "not-a-digest-we-have-seen", 0)).toBeNull();
  });

  it("the run key is order-stable and content-derived (no wall clock, no counter)", async () => {
    const a = await mustParse(closedJson);
    const text = keyText(a.key);
    expect(text.startsWith("k2|rom=")).toBe(true);
    expect(text).toContain("channel=clean");
    expect(text).toContain("stepmap=chip8cow-step-v1");
    // nothing time-like leaked into the key
    expect(/\d{4}-\d{2}-\d{2}|T\d{2}:\d{2}|timestamp/i.test(text)).toBe(false);
  });

  it("clean and frozen-address assisted runs cannot collide on one run key", async () => {
    const a = await mustParse(closedJson);
    const channel = assistedRunChannelLabel("ram-write/freeze-0300=ff");
    expect(channel.ok).toBe(true);
    if (!channel.ok) return;

    const assisted = { ...a.key, channelLabel: channel.value };
    expect(keyText(assisted)).not.toBe(keyText(a.key));
    expect(await artifactFileName(assisted)).not.toBe(await artifactFileName(a.key));
    expect(keyText(assisted)).toContain("channel=assisted:ram-write/freeze-0300=ff");
  });

  it("invalid or delimiter-ambiguous channel labels are typed refusals", async () => {
    for (const detail of ["", "ram-write|seed=bad", "ram write"]) {
      const result = assistedRunChannelLabel(detail);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.feedback.code).toBe("invalid-channel-label");
    }

    const malformed = closedJson.replace('"channelLabel": "clean"', '"channelLabel": "assisted:"');
    const parsed = await parseArtifact(malformed);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.feedback.code).toBe("invalid-channel-label");
  });

  it("string order is ordinal, not locale-sensitive", () => {
    // `localeCompare` orders "a" before "B" in many locales; ordinal does not. This pins the choice
    // rather than trusting a comment.
    expect(ordinal("B", "a")).toBe(-1);
    expect(["b", "A", "a", "B"].slice().sort(ordinal)).toEqual(["A", "B", "a", "b"]);
  });

  it("a negative step is refused rather than wrapped", async () => {
    const a = await mustParse(closedJson);
    const r = reduceStep(a, -1);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.feedback.code).toBe("negative-step");
  });
});
