import { describe, expect, test } from "bun:test";
import {
  type FourCorner,
  type Input,
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
