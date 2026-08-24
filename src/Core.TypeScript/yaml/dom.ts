// Layer 2: the DOM fold (`YamlValue` + `parse`), built ON TOP of the L1 event stream.
//
// This is the `JsonDocument` half of the `Utf8JsonReader`-vs-`JsonDocument` split:
// reader.ts scans once and emits events; this module folds that flat event stream into a
// value tree. It does not re-scan text — it consumes `readEvents`/`tryReadEvents` output.

import { tryReadEvents } from "./reader.ts";
import type { YamlEvent, YamlFeedback } from "./reader.ts";

export type YamlValue =
  | { t: "Null" }
  | { t: "Bool"; value: boolean }
  | { t: "Int"; value: bigint } // int64
  | { t: "Float"; value: number }
  | { t: "Str"; value: string }
  | { t: "Seq"; items: YamlValue[] }
  | { t: "Map"; entries: Array<[string, YamlValue]> }; // ordered pairs

export type ParseResult =
  | { ok: true; value: YamlValue }
  | { ok: false; feedback: YamlFeedback };

// A structural problem folding a well-formed-looking stream (should not occur for output
// of this reader; surfaced as UnsupportedConstruct defensively). Field declared
// explicitly (no parameter-property shorthand) for erasableSyntaxOnly.
class FoldError extends Error {
  readonly feedback: YamlFeedback;
  constructor(feedback: YamlFeedback) {
    super(feedback);
    this.name = "FoldError";
    this.feedback = feedback;
  }
}

function scalarToValue(ev: Extract<YamlEvent, { e: "Scalar" }>): YamlValue {
  switch (ev.kind) {
    case "Null":
      return { t: "Null" };
    case "Bool":
      return { t: "Bool", value: ev.raw === "true" || ev.raw === "True" || ev.raw === "TRUE" };
    case "Int":
      return { t: "Int", value: BigInt(ev.raw) };
    case "Float":
      return { t: "Float", value: Number(ev.raw) };
    case "Str":
      return { t: "Str", value: ev.raw };
  }
}

// Cursor-based fold over the flat event array.
class Folder {
  private readonly events: YamlEvent[];
  private pos = 0;

  constructor(events: YamlEvent[]) {
    this.events = events;
  }

  private peek(): YamlEvent {
    const ev = this.events[this.pos];
    if (ev === undefined) throw new FoldError("UnsupportedConstruct");
    return ev;
  }

  private next(): YamlEvent {
    const ev = this.peek();
    this.pos++;
    return ev;
  }

  private expect(kind: YamlEvent["e"]): void {
    const ev = this.next();
    if (ev.e !== kind) throw new FoldError("UnsupportedConstruct");
  }

  // top-level: StreamStart <value> StreamEnd
  fold(): YamlValue {
    this.expect("StreamStart");
    const value = this.foldValue();
    this.expect("StreamEnd");
    return value;
  }

  private foldValue(): YamlValue {
    const ev = this.peek();
    switch (ev.e) {
      case "Scalar":
        this.pos++;
        return scalarToValue(ev);
      case "MappingStart":
        return this.foldMapping();
      case "SequenceStart":
        return this.foldSequence();
      default:
        throw new FoldError("UnsupportedConstruct");
    }
  }

  private foldMapping(): YamlValue {
    this.expect("MappingStart");
    const entries: Array<[string, YamlValue]> = [];
    while (this.peek().e !== "MappingEnd") {
      const keyEv = this.next();
      if (keyEv.e !== "Scalar") throw new FoldError("UnsupportedConstruct");
      const value = this.foldValue();
      entries.push([keyEv.raw, value]);
    }
    this.expect("MappingEnd");
    return { t: "Map", entries };
  }

  private foldSequence(): YamlValue {
    this.expect("SequenceStart");
    const items: YamlValue[] = [];
    while (this.peek().e !== "SequenceEnd") {
      items.push(this.foldValue());
    }
    this.expect("SequenceEnd");
    return { t: "Seq", items };
  }
}

export function parse(text: string): ParseResult {
  const read = tryReadEvents(text);
  if (!read.ok) return { ok: false, feedback: read.feedback };
  try {
    return { ok: true, value: new Folder(read.events).fold() };
  } catch (err) {
    if (err instanceof FoldError) return { ok: false, feedback: err.feedback };
    throw err;
  }
}
