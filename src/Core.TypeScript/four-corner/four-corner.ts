/**
 * four-corner — the bidirectional-feedback I/O object (four corners = data×feedback × in×out).
 * TS parity oracle; mirrors src/Core/FourCorner.fs (the F# oracle that LOCKED the treaty bytes) and
 * src/Core.CSharp/FourCornerOwnership.cs. Descends from the ORIGINAL FourCornerOwnership in
 * src/Core.TypeScript/workflow-engine/types.ts — this is its treaty-codec-bearing core sibling (the tools→src
 * graduation, 081KTQD8A0008QG0R0005EFYPV). `tInFeedback` is co-owned — both sides contribute — "each is backpressure from
 * the other's perspective".
 *
 * TREATY: toLine/ofLine is the canonical text wire form for the string-quad instantiation; this oracle
 * MUST produce/consume byte-identical lines to F#/C# against ./golden-vectors.lines.
 */

export interface FourCornerOwnership {
  /** what comes in (e.g. an OperatorMessage) */
  readonly tIn: string;
  /** what the agent emits back (null = not yet filled — mirrors F# option / C# string?) */
  readonly tOut: string | null;
  /** control-flow the agent authors on the channel */
  readonly tOutFeedback: string | null;
  /** the co-owned channel — BOTH sides contribute; each side's contribution is the other's backpressure */
  readonly tInFeedback: string | null;
}

/** Just the input — no output, no feedback yet (the resting corner). */
export function ofIn(tIn: string): FourCornerOwnership {
  return { tIn, tOut: null, tOutFeedback: null, tInFeedback: null };
}

/** Has the tick produced output yet? (the forward corner is filled) */
export function hasOutput(o: FourCornerOwnership): boolean {
  return o.tOut !== null;
}

/** Has feedback crossed in either direction? (the backpressure corners) */
export function hasFeedback(o: FourCornerOwnership): boolean {
  return o.tOutFeedback !== null || o.tInFeedback !== null;
}

function esc(s: string): string {
  return s.replaceAll("\\", "\\\\").replaceAll("\t", "\\t").replaceAll("\n", "\\n").replaceAll("\r", "\\r");
}

function unesc(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && i + 1 < s.length) {
      const c = s[i + 1];
      out += c === "t" ? "\t" : c === "n" ? "\n" : c === "r" ? "\r" : c;
      i++;
    } else {
      out += s[i];
    }
  }
  return out;
}

function optToText(v: string | null): string {
  return v === null ? "-" : `+${esc(v)}`;
}

/** undefined = malformed (distinct from null = None). */
function optOfText(s: string): string | null | undefined {
  if (s === "-") return null;
  if (s.startsWith("+")) return unesc(s.slice(1));
  return undefined;
}

/** Serialize to the canonical treaty line (byte-identical to the F#/C# oracles). */
export function toLine(o: FourCornerOwnership): string {
  return `fourcorner1\t${esc(o.tIn)}\t${optToText(o.tOut)}\t${optToText(o.tOutFeedback)}\t${optToText(o.tInFeedback)}`;
}

/** Parse a canonical treaty line; null on malformed input (honest refusal). */
export function ofLine(line: string): FourCornerOwnership | null {
  const parts = line.split("\t");
  // NOTE: escaped tabs never survive esc(), so a 5-way split is exact for well-formed lines.
  if (parts.length !== 5 || parts[0] !== "fourcorner1") return null;
  const tOut = optOfText(parts[2]!);
  const tOutFeedback = optOfText(parts[3]!);
  const tInFeedback = optOfText(parts[4]!);
  if (tOut === undefined || tOutFeedback === undefined || tInFeedback === undefined) return null;
  return { tIn: unesc(parts[1]!), tOut, tOutFeedback, tInFeedback };
}
