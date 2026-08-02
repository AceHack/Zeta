import { describe, expect, test } from "bun:test";
import {
  type Corner,
  type CornerSet,
  type FourCorner,
  type Input,
  EXTRACTION_CORNERS,
  FULL_FOUR_CORNERS,
  dualCorner,
  dualCorners,
  isWellFormed,
  extractionInput,
  liftExtraction,
  noFeedbackSink,
  projectExtraction,
  recordingFeedbackSink,
} from "./four-corner.ts";

// THE FOUR-CORNER INTERFACE (shadow*, Aaron 2026-07-04) — the mutual-empowerment shape; chat-completions is
// its feedback-free projection. Proofs:
//   1. project ∘ lift = id — extraction is a genuine SUB-OBJECT (round-trip identity), not a rewrite.
//   2. noFeedbackSink drops silently, never throws — the chat-completions fill (a wire that isn't there).
//   3. recordingFeedbackSink carries signals in order — the real duplex fill.
//   4. a feedback corner CARRIES a live control signal (interrupt) — the thing chat-completions provably can't.

async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of stream) out.push(x);
  return out;
}

async function* fromArray<T>(xs: readonly T[]): AsyncIterable<T> {
  await Promise.resolve();
  for (const x of xs) yield x;
}

describe("four-corner interface", () => {
  test("project ∘ lift = id: extraction is a genuine sub-object (round-trip identity)", async () => {
    // a plain extraction completer: uppercase each message into a delta stream
    const completer = (msgs: readonly string[]): AsyncIterable<string> => fromArray(msgs.map((m) => m.toUpperCase()));
    const roundTripped = projectExtraction(liftExtraction(completer));
    expect(await collect(roundTripped(["a", "b"]))).toEqual(["A", "B"]); // same output as the bare completer
    expect(await collect(completer(["a", "b"]))).toEqual(["A", "B"]);
  });

  test("noFeedbackSink drops silently and never throws (the chat-completions fill)", async () => {
    const pushed = noFeedbackSink.push(undefined as never);
    await pushed;
    expect(pushed).toBeInstanceOf(Promise); // resolved without throwing — the dropped signal is not an error
  });

  test("recordingFeedbackSink carries pushed signals in order (the real duplex fill)", async () => {
    const sink = recordingFeedbackSink<string>();
    await sink.push("interrupt");
    await sink.push("resume");
    expect(sink.signals).toEqual(["interrupt", "resume"]);
  });

  test("extractionInput wears the four-corner type with the feedback wire dark", async () => {
    const input = extractionInput(["hello"]);
    expect(input.payload).toEqual(["hello"]);
    const pushed = input.feedback.push(undefined as never); // dark corner, no-op
    await pushed;
    expect(pushed).toBeInstanceOf(Promise);
  });

  test("a feedback corner carries a LIVE control signal (what chat-completions cannot do)", async () => {
    // A four-corner producer that WATCHES its output feedback corner: when the caller pushes "stop", it
    // stops emitting. This is the mutual-interruption chat-completions has no channel for.
    type Ctl = "stop";
    let stopped = false;
    const fc: FourCorner<number, number, Ctl> = (input: Input<number, Ctl>) => {
      const callerFeedback = recordingFeedbackSink<Ctl>();
      async function* gen(): AsyncIterable<number> {
        for (let i = 0; i < input.payload; i++) {
          if (callerFeedback.signals.includes("stop")) {
            stopped = true;
            return;
          }
          yield i;
          // caller interrupts after the first token
          if (i === 0) await callerFeedback.push("stop");
        }
      }
      return { stream: gen(), feedback: callerFeedback };
    };
    const out = fc({ payload: 5, feedback: noFeedbackSink });
    const emitted = await collect(out.stream);
    expect(emitted).toEqual([0]); // interrupted after the first token — never reached 1..4
    expect(stopped).toBe(true); // the feedback corner actually steered the running output
  });
});

/**
 * DUALITY — the law that makes "four corners" checkable rather than aspirational.
 *
 * Before this, the module NAMED four corners and nothing enforced that a transport filled them
 * coherently: a three-corner transport type-checked and was silently broken, because a wire with one
 * live end cannot carry a round trip. The gap was not that duality went unenforced — there was no
 * `dual` operator to enforce anything with.
 *
 * Honda's session types supply the law (the two endpoints hold DUAL types; duality is an involution).
 * Aaron reached the same shape from physics, 2026-08-01: "this is duals like electron and positron on
 * the CPT reversal, it's like dual in reverse." Both say: flip every direction, keep the structure,
 * and flipping twice is identity. Same fixpoint discipline as `gen(gen) == gen`.
 */
const ALL_CORNERS: readonly Corner[] = ["normal-out", "normal-in", "feedback-out", "feedback-in"];

describe("duality is an involution — the CPT law, made checkable", () => {
  test("dual(dual(corner)) = corner, for every corner", () => {
    // The involution itself. If this failed, "dual" would be a relabelling rather than a symmetry,
    // and nothing built on it would mean anything.
    for (const corner of ALL_CORNERS) {
      expect(dualCorner(dualCorner(corner))).toBe(corner);
    }
  });

  test("dual is a genuine flip — no corner is its own dual", () => {
    // The negative control. An identity function would satisfy the involution law vacuously; this is
    // what distinguishes a symmetry from doing nothing at all.
    for (const corner of ALL_CORNERS) {
      expect(dualCorner(corner)).not.toBe(corner);
    }
  });

  test("dual pairs a NORMAL corner with a normal corner, feedback with feedback", () => {
    // Duality reverses direction; it does not cross wires. A dual that mapped normal-out to
    // feedback-in would type-check and be nonsense.
    expect(dualCorner("normal-out")).toBe("normal-in");
    expect(dualCorner("feedback-out")).toBe("feedback-in");
  });

  test("dualCorners(dualCorners(set)) = set — the involution lifts to whole endpoints", () => {
    for (const set of [EXTRACTION_CORNERS, FULL_FOUR_CORNERS, new Set<Corner>(["feedback-in"])]) {
      expect([...dualCorners(dualCorners(set))].sort()).toEqual([...set].sort());
    }
  });
});

describe("well-formedness — an absent wire is honest, a HALF-wire is not", () => {
  test("the full four corners are well-formed", () => {
    expect(isWellFormed(FULL_FOUR_CORNERS)).toBe(true);
  });

  test("chat-completions (both feedback corners dark) is WELL-FORMED", () => {
    // The load-bearing legality claim. Chat-completions is a legal PROJECTION, not a broken transport:
    // it omits the feedback wire entirely rather than half of it. If this test failed, the module's
    // central claim — that extraction is a genuine sub-object — would be false.
    expect(isWellFormed(EXTRACTION_CORNERS)).toBe(true);
  });

  test("THE CATCH: a three-corner transport is ill-formed", () => {
    // This is the defect that type-checked before today. Three corners means one wire has a single
    // live end — a round trip that cannot complete — and nothing in the type system objected.
    for (const missing of ALL_CORNERS) {
      const threeCorners: CornerSet = new Set(ALL_CORNERS.filter((c) => c !== missing));
      expect(isWellFormed(threeCorners)).toBe(false);
    }
  });

  test("a lone feedback corner is ill-formed in EITHER direction", () => {
    // Symmetry of the rejection: it is not that outbound feedback is special. Half a wire is half a
    // wire whichever end is lit.
    expect(isWellFormed(new Set<Corner>(["feedback-out"]))).toBe(false);
    expect(isWellFormed(new Set<Corner>(["feedback-in"]))).toBe(false);
  });

  test("the empty set is well-formed — no wires is not the same as a broken wire", () => {
    expect(isWellFormed(new Set<Corner>())).toBe(true);
  });

  test("well-formedness is preserved by duality", () => {
    // The two properties compose: looking at a coherent endpoint from the other side gives a coherent
    // endpoint. If this failed, "both ends are both" would be false and one side would be privileged.
    for (const set of [EXTRACTION_CORNERS, FULL_FOUR_CORNERS, new Set<Corner>()]) {
      expect(isWellFormed(dualCorners(set))).toBe(isWellFormed(set));
    }
  });
});
