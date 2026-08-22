/**
 * CHIP-8 cross-run store — the TypeScript READER/VERIFIER half.
 *
 * Mirrors `src/Core/Chip8CrossRunStore.fs` (the F# oracle that writes these artifacts). Run 1 computes
 * a trajectory in F#; the result is written down as text; run 2 — in either language — reads it.
 *
 * REGISTER DISCIPLINE. Aaron's framing is that run 1 "can affect the start of the 2nd run" in a
 * "2nd retrocausal way". That is the Mirror register, quoted in the design doc. The Beacon register —
 * what this code does — is memoization of a deterministic transition function over a finite state
 * space (Michie, "Memo functions and machine learning", Nature 218, 19-22, 1968). Nothing propagates
 * backward in time. No identifier here claims otherwise, and none may acquire one.
 *
 * WHY READ-ONLY, HONESTLY. `./chip9.ts` is a treaty conformer for the DRAW subset: its `Frame` has no
 * `delay`, `sound`, `keys`, or `rng`, and it mutates in place. It therefore cannot execute a full
 * CHIP-8 orbit, so TypeScript cannot WRITE these artifacts. What it can do — and what actually matters
 * for the byte-lock — is independently PARSE, VERIFY, and REDUCE them. A second implementation that
 * refuses the same corrupt bytes and computes the same digest is the cross-oracle check; a second
 * emulator would be a separate work item.
 *
 * THE BUDGET IS AN ORACLE, SO IT IS ON THE RECORD (Aaron 2026-08-17: "always be on the lookout where
 * the measurement or the limit/budget becomes the oracle silently"). `verdict: "open-at-bound"` is a
 * DISTINCT case from `"closed"`, and `reduceStep` REFUSES a step beyond an open orbit's recorded
 * prefix rather than reducing modulo a cycle nobody observed.
 *
 * NO CULTURE-SENSITIVE COMPARISON. Never `localeCompare` here — sorting is
 * `(a, b) => (a < b ? -1 : a > b ? 1 : 0)` and hex is parsed with an explicit radix.
 */

export const CHIP8_CROSS_RUN_STORE_SCHEMA = "zeta.chip8.cross-run-orbit.v1" as const;

/** Bump in lockstep with `Chip8CrossRunStore.StepMapVersion` in F#. */
export const STEP_MAP_VERSION = "chip8cow-step-v1" as const;

export type CrossRunFeedbackCode =
  | "unknown-schema"
  | "malformed-artifact"
  | "malformed-snapshot"
  | "digest-mismatch"
  | "not-closed-at-bound"
  | "negative-step";

export interface CrossRunFeedback {
  readonly code: CrossRunFeedbackCode;
  readonly detail: string;
}

export type CrossRunResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: CrossRunFeedback };

const fail = <T,>(code: CrossRunFeedbackCode, detail: string): CrossRunResult<T> => ({
  ok: false,
  feedback: { code, detail },
});

export type TerminalKind = "halt" | "awaiting-input" | "cycle";

export type Verdict =
  | { readonly kind: "closed"; readonly mu: number; readonly lambda: number; readonly terminal: TerminalKind }
  /** The walk hit the injected bound without revisiting a state. Says NOTHING about whether a cycle exists. */
  | { readonly kind: "open-at-bound"; readonly maxSteps: number };

export interface RunKey {
  readonly romSha256: string;
  readonly seedHex: string;
  readonly loadAddrHex: string;
  readonly dialect: string;
  readonly stepMapVersion: string;
}

export interface PrecomputeBudget {
  readonly maxSteps: number;
  /** Who set this bound and why. The F# writer refuses an empty one before doing any work. */
  readonly attribution: string;
}

export interface Checkpoint {
  readonly step: number;
  readonly stateDigest: string;
  readonly snapshot: string | null;
}

export interface OrbitArtifact {
  readonly schema: string;
  readonly key: RunKey;
  readonly budget: PrecomputeBudget;
  readonly verdict: Verdict;
  readonly checkpoints: readonly Checkpoint[];
  readonly firstFaultStep: number | null;
  readonly bodyDigest: string;
}

/** The decoded snapshot. A superset of `chip9.ts`'s `Frame` — this is data, not a machine. */
export interface SnapshotFrame {
  readonly pc: number;
  readonly i: number;
  readonly delay: number;
  readonly sound: number;
  readonly plane: number;
  readonly rngHex: string;
  readonly v: readonly number[];
  readonly keys: readonly boolean[];
  readonly stack: readonly number[];
  readonly mem: ReadonlyMap<number, number>;
  readonly litPixels: readonly number[];
  readonly extra: ReadonlyMap<number, number>;
  readonly fault: string | null;
}

// ── hex helpers (explicit radix; no locale anywhere) ─────────────────────────────────────────────

const HEX = /^[0-9a-f]*$/;

const isHex = (s: string): boolean => HEX.test(s);

const parseHex = (s: string): number | null => {
  if (s.length === 0 || !isHex(s)) return null;
  const n = Number.parseInt(s, 16);
  return Number.isNaN(n) ? null : n;
};

/** Ordinal string order. NEVER `localeCompare` — it is culture-sensitive and broke `main`. */
export function ordinal(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// ── digest (Web Crypto; available in browsers, Bun and Node ≥ 18) ────────────────────────────────

const toHex = (bytes: Uint8Array): string => {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
};

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(digest));
}

// ── canonical body text — must match `Chip8CrossRunStore.bodyText` byte for byte ─────────────────

export function keyText(k: RunKey): string {
  return [
    "k1",
    `rom=${k.romSha256}`,
    `seed=${k.seedHex}`,
    `load=${k.loadAddrHex}`,
    `dialect=${k.dialect}`,
    `stepmap=${k.stepMapVersion}`,
  ].join("|");
}

function verdictText(v: Verdict): string {
  return v.kind === "closed"
    ? ["closed", String(v.mu), String(v.lambda), v.terminal].join(",")
    : ["open-at-bound", String(v.maxSteps)].join(",");
}

/**
 * The canonical body the `bodyDigest` is taken over. The digest field itself is excluded (it would be
 * self-referential), and so is every JSON nicety — the digest covers MEANING, not formatting.
 */
export function bodyText(a: OrbitArtifact): string {
  const checkpoints = a.checkpoints
    .map((c) => [String(c.step), c.stateDigest, c.snapshot ?? ""].join(";"))
    .join("\n");

  return [
    "b1",
    a.schema,
    keyText(a.key),
    `budget=${String(a.budget.maxSteps)};${a.budget.attribution}`,
    `verdict=${verdictText(a.verdict)}`,
    `fault=${a.firstFaultStep === null ? "" : String(a.firstFaultStep)}`,
    "checkpoints:",
    checkpoints,
  ].join("\n");
}

// ── parse + verify ───────────────────────────────────────────────────────────────────────────────

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function readString(o: Record<string, unknown>, name: string): string | null {
  const v = o[name];
  return typeof v === "string" ? v : null;
}

function readInt(o: Record<string, unknown>, name: string): number | null {
  const v = o[name];
  return typeof v === "number" && Number.isInteger(v) ? v : null;
}

function parseVerdict(root: Record<string, unknown>): CrossRunResult<Verdict> {
  const vtext = readString(root, "verdict");
  if (vtext === null) return fail("malformed-artifact", "missing verdict");

  if (vtext === "closed") {
    const mu = readInt(root, "mu");
    const lambda = readInt(root, "lambda");
    const terminal = readString(root, "terminalKind");
    if (mu === null || lambda === null) return fail("malformed-artifact", "closed verdict needs mu and lambda");
    if (terminal !== "halt" && terminal !== "awaiting-input" && terminal !== "cycle") {
      return fail("malformed-artifact", `bad terminalKind: ${String(terminal)}`);
    }
    if (lambda < 1) return fail("malformed-artifact", "lambda must be >= 1");
    return { ok: true, value: { kind: "closed", mu, lambda, terminal } };
  }

  if (vtext === "open-at-bound") {
    const maxSteps = readInt(root, "openAtSteps");
    if (maxSteps === null) return fail("malformed-artifact", "open verdict needs openAtSteps");
    return { ok: true, value: { kind: "open-at-bound", maxSteps } };
  }

  return fail("malformed-artifact", `bad verdict: ${vtext}`);
}

function parseRunKey(keyRaw: unknown): CrossRunResult<RunKey> {
  if (!isRecord(keyRaw)) return fail("malformed-artifact", "missing key object");
  const romSha256 = readString(keyRaw, "romSha256");
  const seedHex = readString(keyRaw, "seedHex");
  const loadAddrHex = readString(keyRaw, "loadAddrHex");
  const dialect = readString(keyRaw, "dialect");
  const stepMapVersion = readString(keyRaw, "stepMapVersion");
  if (
    romSha256 === null ||
    seedHex === null ||
    loadAddrHex === null ||
    dialect === null ||
    stepMapVersion === null
  ) {
    return fail("malformed-artifact", "incomplete key");
  }
  return { ok: true, value: { romSha256, seedHex, loadAddrHex, dialect, stepMapVersion } };
}

function parseBudget(budgetRaw: unknown): CrossRunResult<PrecomputeBudget> {
  if (!isRecord(budgetRaw)) return fail("malformed-artifact", "missing budget object");
  const maxSteps = readInt(budgetRaw, "maxSteps");
  const attribution = readString(budgetRaw, "attribution");
  if (maxSteps === null || attribution === null) return fail("malformed-artifact", "incomplete budget");
  return { ok: true, value: { maxSteps, attribution } };
}

function parseCheckpoints(cpsRaw: unknown): CrossRunResult<Checkpoint[]> {
  if (!Array.isArray(cpsRaw)) return fail("malformed-artifact", "checkpoints not an array");
  const checkpoints: Checkpoint[] = [];
  for (const c of cpsRaw) {
    if (!isRecord(c)) return fail("malformed-artifact", "checkpoint not an object");
    const step = readInt(c, "step");
    const stateDigest = readString(c, "stateDigest");
    if (step === null || stateDigest === null) return fail("malformed-artifact", "incomplete checkpoint");
    checkpoints.push({ step, stateDigest, snapshot: readString(c, "snapshot") });
  }
  return { ok: true, value: checkpoints };
}

/**
 * Parse and VERIFY. A body whose digest does not match is REFUSED — a corrupt memo is worse than no
 * memo, because it is confident and wrong.
 */
export async function parseArtifact(json: string): Promise<CrossRunResult<OrbitArtifact>> {
  let raw: unknown;
  try {
    raw = JSON.parse(json) as unknown;
  } catch (err) {
    return fail("malformed-artifact", err instanceof Error ? err.message : "unparseable JSON");
  }

  if (!isRecord(raw)) return fail("malformed-artifact", "root is not an object");

  const schema = readString(raw, "schema");
  if (schema !== CHIP8_CROSS_RUN_STORE_SCHEMA) {
    return fail("unknown-schema", `found: ${String(schema)}`);
  }

  const keyResult = parseRunKey(raw.key);
  if (!keyResult.ok) return keyResult;

  const budgetResult = parseBudget(raw.budget);
  if (!budgetResult.ok) return budgetResult;

  const verdictResult = parseVerdict(raw);
  if (!verdictResult.ok) return verdictResult;

  const checkpointsResult = parseCheckpoints(raw.checkpoints);
  if (!checkpointsResult.ok) return checkpointsResult;

  const stored = readString(raw, "bodyDigest");
  if (stored === null) return fail("malformed-artifact", "missing bodyDigest");

  const firstFaultStepRaw = raw.firstFaultStep;
  const firstFaultStep =
    typeof firstFaultStepRaw === "number" && Number.isInteger(firstFaultStepRaw) ? firstFaultStepRaw : null;

  const artifact: OrbitArtifact = {
    schema,
    key: keyResult.value,
    budget: budgetResult.value,
    verdict: verdictResult.value,
    checkpoints: checkpointsResult.value,
    firstFaultStep,
    bodyDigest: stored,
  };

  const actual = await sha256Hex(bodyText(artifact));
  if (actual !== stored) {
    return fail("digest-mismatch", `stored=${stored} actual=${actual}`);
  }

  return { ok: true, value: artifact };
}

// ── the run-2 side ───────────────────────────────────────────────────────────────────────────────

/**
 * Reduce an absolute step index into the recorded prefix, using the cycle when one was OBSERVED.
 *
 * Past `mu`, step `n` is step `mu + ((n - mu) mod lambda)` — the finite description of an unbounded
 * future. Under `open-at-bound` this REFUSES rather than guessing: answering there would promote the
 * injected precompute budget into a claim about the machine, which is the exact hidden-oracle defect
 * this design exists to avoid.
 */
export function reduceStep(a: OrbitArtifact, n: number): CrossRunResult<number> {
  if (!Number.isInteger(n) || n < 0) return fail("negative-step", String(n));

  if (a.verdict.kind === "closed") {
    const { mu, lambda } = a.verdict;
    return { ok: true, value: n < mu ? n : mu + ((n - mu) % lambda) };
  }

  const recorded = a.checkpoints.reduce((m, c) => (c.step > m ? c.step : m), 0);
  if (n <= recorded) return { ok: true, value: n };
  return fail(
    "not-closed-at-bound",
    `orbit did not close within ${String(a.verdict.maxSteps)} steps (bound set by: ${a.budget.attribution})`,
  );
}

/**
 * The canonical snapshot at absolute step `n`, or `null` when the reduced step has no snapshot row.
 * `null` means "not memoized — compute it yourself", never a guess. A memo that guesses is not a memo.
 */
export function snapshotTextAt(a: OrbitArtifact, n: number): CrossRunResult<string | null> {
  const reduced = reduceStep(a, n);
  if (!reduced.ok) return reduced;
  const row = a.checkpoints.find((c) => c.step === reduced.value);
  return { ok: true, value: row?.snapshot ?? null };
}

// ── the canonical frame codec (must match `Chip8CrossRunStore.encodeFrame`) ───────────────────────

function parsePairs(section: string): ReadonlyMap<number, number> | null {
  const out = new Map<number, number>();
  if (section.length === 0) return out;
  for (const kv of section.split(",")) {
    const parts = kv.split(":");
    if (parts.length !== 2) return null;
    const [addrText, byteText] = parts;
    if (addrText === undefined || byteText === undefined) return null;
    const addr = parseHex(addrText);
    const value = parseHex(byteText);
    if (addr === null || value === null || byteText.length !== 2) return null;
    out.set(addr, value);
  }
  return out;
}

function parseHexList(section: string): number[] | null {
  if (section.length === 0) return [];
  const out: number[] = [];
  for (const s of section.split(",")) {
    const v = parseHex(s);
    if (v === null) return null;
    out.push(v);
  }
  return out;
}

const SNAPSHOT_FIELDS = ["pc", "i", "dl", "sn", "pl", "rng", "v", "k", "st", "mem", "dsp", "xtr", "flt"] as const;

type SnapshotField = (typeof SNAPSHOT_FIELDS)[number];

/** Split the canonical text into its named sections, refusing if any is absent. */
function snapshotFields(text: string): CrossRunResult<Record<SnapshotField, string>> {
  const found = new Map<string, string>();
  for (const part of text.split("|")) {
    const at = part.indexOf("=");
    if (at >= 0) found.set(part.slice(0, at), part.slice(at + 1));
  }

  const out = {} as Record<SnapshotField, string>;
  for (const name of SNAPSHOT_FIELDS) {
    const v = found.get(name);
    if (v === undefined) return fail("malformed-snapshot", `missing field: ${name}`);
    out[name] = v;
  }
  return { ok: true, value: out };
}

/** Shape/charset checks. A corrupt nibble must fail here, never decode to a plausible frame. */
function checkSnapshotShape(f: Record<SnapshotField, string>): CrossRunFeedback | null {
  if (f.v.length !== 32 || !isHex(f.v)) return { code: "malformed-snapshot", detail: "V must be 32 hex chars" };
  if (!/^[01]{16}$/.test(f.k)) return { code: "malformed-snapshot", detail: "keys must be 16 bits" };
  if (f.rng.length !== 16 || !isHex(f.rng)) return { code: "malformed-snapshot", detail: "rng must be 16 hex chars" };
  if (f.flt.length % 2 !== 0 || !isHex(f.flt)) return { code: "malformed-snapshot", detail: "fault must be hex" };
  return null;
}

/** Decode a canonical frame snapshot. Refuses anything malformed — never a plausible wrong frame. */
export function decodeSnapshot(text: string): CrossRunResult<SnapshotFrame> {
  if (!text.startsWith("f1|")) return fail("malformed-snapshot", "bad frame prefix");

  const gathered = snapshotFields(text);
  if (!gathered.ok) return gathered;
  const f = gathered.value;

  const shape = checkSnapshotShape(f);
  if (shape !== null) return { ok: false, feedback: shape };

  const { rng: rngHex, v: vText, k: kText, st: stText, mem: memText, dsp: dspText, xtr: xtrText, flt: fltText } = f;

  const pc = parseHex(f.pc);
  const i = parseHex(f.i);
  const delay = parseHex(f.dl);
  const sound = parseHex(f.sn);
  const plane = parseHex(f.pl);
  if (pc === null || i === null || delay === null || sound === null || plane === null) {
    return fail("malformed-snapshot", "bad scalar");
  }

  const mem = parsePairs(memText);
  const extra = parsePairs(xtrText);
  const stack = parseHexList(stText);
  const litPixels = parseHexList(dspText);
  if (mem === null || extra === null || stack === null || litPixels === null) {
    return fail("malformed-snapshot", "bad list section");
  }

  const v: number[] = [];
  for (let n = 0; n < 16; n++) {
    const b = parseHex(vText.slice(n * 2, n * 2 + 2));
    if (b === null) return fail("malformed-snapshot", "bad V byte");
    v.push(b);
  }

  let fault: string | null = null;
  if (fltText.length > 0) {
    const bytes = new Uint8Array(fltText.length / 2);
    for (let n = 0; n < bytes.length; n++) {
      const b = parseHex(fltText.slice(n * 2, n * 2 + 2));
      if (b === null) return fail("malformed-snapshot", "bad fault byte");
      bytes[n] = b;
    }
    fault = new TextDecoder().decode(bytes);
  }

  const keyBits: boolean[] = [];
  for (let n = 0; n < 16; n++) keyBits.push(kText.charAt(n) === "1");

  return {
    ok: true,
    value: {
      pc,
      i,
      delay,
      sound,
      plane,
      rngHex,
      v,
      keys: keyBits,
      stack,
      mem,
      litPixels,
      extra,
      fault,
    },
  };
}

// ── the injected read port (noninterference §13) ──────────────────────────────────────────────────

/**
 * A room RECEIVES one of these; it never constructs one by reaching out to a filesystem, an
 * IndexedDB, or a network. That is what keeps the memo a declared channel rather than an ambient
 * side door into an otherwise deterministic run.
 */
export interface CrossRunReader {
  readonly tryGet: (key: RunKey) => OrbitArtifact | null;
}

/** The honest default for a room with no store injected: it knows nothing and says so. */
export const emptyCrossRunReader: CrossRunReader = { tryGet: () => null };

/** A reader over an in-memory set of already-VERIFIED artifacts. */
export function readerOf(artifacts: readonly OrbitArtifact[]): CrossRunReader {
  const index = new Map<string, OrbitArtifact>();
  for (const a of artifacts) index.set(keyText(a.key), a);
  return { tryGet: (key) => index.get(keyText(key)) ?? null };
}

/**
 * The room-facing lookup: given the digest of the frame a run is currently at, where is this machine
 * `ahead` steps later? `null` means "not memoized — compute it yourself".
 */
export function fastForward(
  reader: CrossRunReader,
  key: RunKey,
  currentStateDigest: string,
  ahead: number,
): string | null {
  if (!Number.isInteger(ahead) || ahead < 0) return null;
  const a = reader.tryGet(key);
  if (a === null) return null;
  const here = a.checkpoints.find((c) => c.stateDigest === currentStateDigest);
  if (here === undefined) return null;
  const at = snapshotTextAt(a, here.step + ahead);
  return at.ok ? at.value : null;
}
