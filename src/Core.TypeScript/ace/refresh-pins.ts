#!/usr/bin/env bun
// refresh-pins.ts — `ace refresh`: the REFRESH half of a pin.
//
// THE ONE SENTENCE THIS FILE EXISTS FOR:
//
//   A PIN NOBODY CAN REFRESH IS HOW A SECURITY POSTURE ROTS, AND A REFRESH THAT
//   DOES NOT RE-PIN IS HOW SUPPLY-CHAIN INTEGRITY IS LOST. So pinning and
//   refreshing are ONE mechanism with one registry, not two habits that drift.
//
// WHY IT EXISTS NOW. Scorecard's `PinnedDependenciesID` had 18 open alerts on
// 2026-09-09 (MEASURED: 8 containerImage, 3 nugetCommand, 2 npmCommand, 2
// pipCommand, 3 downloadThenRun). A previous agent deliberately declined to
// blind-pin digests, and its reasoning is this file's design brief: pinning a
// base image without any way to refresh it freezes that image at whatever CVEs
// it shipped with, which is WORSE posture than an unpinned tag that at least
// picks up upstream's rebuilds. The answer is not to skip the pin. It is to
// build the refresh, which is what the maintainer routed: "lets come up with a
// refresh mechanism and put it in our ace package manager that's what it's for
// for the pinned dependencies."
//
// ─────────────────────────────────────────────────────────────────────────────
// THE CONSTRAINT THAT SHAPES EVERYTHING BELOW: `ace` IS NEVER THE ONLY PATH.
//
// `.claude/rules/clone-at-tag-stays-sufficient.md` — `git clone` at a pinned tag
// must stay buildable with NO package manager present, forever. The
// discriminator is EXIT, not degree. So:
//
//   * THE PIN LIVES AT THE POINT OF USE. A container digest is written inline in
//     the Dockerfile as `FROM image:tag@sha256:...`. `docker build` resolves it
//     with nothing else installed. Delete this tool, delete all of ace, and every
//     pinned dependency in the tree still resolves exactly as it did.
//   * THIS REGISTRY IS A MIRROR, NEVER A SOURCE. Nothing in a build path reads
//     `tools/setup/manifests/pinned-refs`. It records what is pinned, where, how
//     to re-check it, and when it was last measured — so that a refresh has
//     somewhere to look and a staleness report has something to report ON.
//   * `--verify` IS THE FALSIFIER FOR THAT CLAIM. It refuses whenever the digest
//     in the registry differs from the digest actually written at the point of
//     use. If the registry ever quietly became the source of truth, the inline
//     pin would drift and this check would fire. That drift check is what keeps
//     the mirror honest; it is not bookkeeping.
//
// `refresh` is deliberately absent from the resolver verbs
// `lint-clone-at-tag-is-sufficient.ts` refuses (pull|install|restore|resolve|
// fetch|sync|add|bootstrap), and that is a statement about what it does rather
// than an evasion: refreshing REWRITES a committed pin so a human can read the
// diff. It never resolves a dependency at build time. Nothing needs it to build.
//
// ─────────────────────────────────────────────────────────────────────────────
// FOUR PROPERTIES, EACH WITH ITS MECHANISM.
//
//   1. PIN + REFRESH ARE ONE VERB.       one registry; `--report` and `--refresh`
//                                        read the same rows `--verify` polices.
//   2. REFRESH IS A REVIEWABLE DIFF.     `--refresh` edits the point of use in the
//                                        working tree and stops. It never commits,
//                                        never pushes, and touches exactly the
//                                        lines carrying the ref.
//   3. RE-VERIFY ON REFRESH.             every row declares `remeasure=`, and a new
//                                        digest is NOT written unless that command
//                                        exits 0. A digest whose re-measure did not
//                                        run is an unverified bump wearing a pin's
//                                        clothes. `remeasure=` is MANDATORY; a row
//                                        that omits it is a PARSE ERROR, not a
//                                        default. What "checked" MEANS differs per
//                                        kind — see the registry header.
//   4. STALENESS IS OBSERVABLE.          `--report` classifies every row as fresh /
//                                        moved / past-horizon / unknown and exits
//                                        non-zero on a finding, so "we pinned it in
//                                        March and never looked again" is a report
//                                        line rather than a silence.
//
// UNKNOWN IS NOT FRESH. A resolver that could not run — no network, an
// unimplemented kind, an HTTP error — yields `unknown`, and `unknown` is printed
// as its own class and never folded into the fresh count. A probe that did not
// run carries zero information about its subject; treating its silence as a pass
// is the check-that-cannot-fail in its most ordinary disguise.
//
// EFFECTS ARE INJECTED (discipline #7, noninterference). Network, filesystem,
// clock and subprocess all arrive through `RefreshEffects`, which is what lets
// the tests drive the real decision logic — including every refusal — instead of
// asserting against a mock nothing was wired to.
//
// WHERE THIS COMPOSES WITH WHAT ALREADY EXISTS, rather than duplicating it:
//   * `tools/setup/manifests/from-url` + `tools/setup/repin-rolling.ts` own every
//     fetched FILE (jars, tarballs, installer scripts). A `downloadThenRun` alert
//     is fixed by becoming a from-url row with a mandatory sha256 — NOT by a row
//     here. This tool has no `download` resolver on purpose.
//   * `src/Core.TypeScript/ace/pinned-artifact.ts` owns fetch→verify→prove for a
//     single named binary artifact. Same discipline, different subject.
//
// Usage:
//   bun src/Core.TypeScript/ace/refresh-pins.ts --verify          # offline drift check
//   bun src/Core.TypeScript/ace/refresh-pins.ts --report          # staleness (network)
//   bun src/Core.TypeScript/ace/refresh-pins.ts --resolve <ref>   # print upstream digest
//   bun src/Core.TypeScript/ace/refresh-pins.ts --refresh <ref>   # re-pin, re-measure
//
// Exit codes:
//   0  verified / everything fresh / refreshed and re-measured
//   1  a finding: drift, a stale row, or a re-measure that failed
//   2  the check could not run (bad argv, unknown ref, unreadable registry)

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

export const REGISTRY = "tools/setup/manifests/pinned-refs";
export const RECEIPTS = "tools/setup/manifests/pinned-refs-receipts";

/**
 * A pin kind. The list is CLOSED and the resolver switch is total, so a typo in
 * the registry is a parse error rather than a row that silently never resolves.
 *
 * `container` and `npm-advisory` have real resolvers. The others are named
 * because the Scorecard alerts name them and their `checked` meaning differs —
 * and a kind with an honest "no resolver" is worth strictly more than a stub
 * that returns fresh. See the registry header for each kind's remediation route.
 */
export const PIN_KINDS = ["container", "npm-advisory", "nuget", "npm-lock", "pip"] as const;
export type PinKind = (typeof PIN_KINDS)[number];

export interface PinRow {
  readonly kind: PinKind;
  /** Repo-relative path of the POINT OF USE — the file the pin is written into. */
  readonly file: string;
  /** The mutable upstream name, e.g. `mcr.microsoft.com/dotnet/sdk:10.0-noble`. */
  readonly ref: string;
  /** `sha256:<64hex>` for digest kinds; a version string for `npm-advisory`. */
  readonly pin: string;
  /** `follow-tag` — refresh re-resolves the tag. `frozen` — refresh refuses. */
  readonly update: "follow-tag" | "frozen";
  /** The run that must pass before a new pin is written. Never empty. */
  readonly remeasure: string;
  /** Days after which the row is REPORTED stale even if upstream has not moved. */
  readonly horizonDays: number;
  /** `YYYY-MM-DD` the current pin was measured. */
  readonly pinnedOn: string;
}

export type ParsedRegistry =
  | { readonly ok: true; readonly rows: readonly PinRow[] }
  | { readonly ok: false; readonly reason: string };

const SHA256_REF = /^sha256:[0-9a-f]{64}$/u;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/u;

function kv(fields: readonly string[], key: string): string | null {
  for (const f of fields) {
    if (f.startsWith(`${key}=`)) {
      const v = f.slice(key.length + 1);
      return v.length > 0 ? v : null;
    }
  }
  return null;
}

/**
 * Parse the registry. Every field this tool depends on is checked HERE, so a
 * malformed row is a refusal naming the line rather than an `undefined` that
 * flows into a fetch or, worse, into a file rewrite.
 */
export function parseRegistry(text: string): ParsedRegistry {
  const rows: PinRow[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const at = `${REGISTRY}:${String(i + 1)}`;
    const fields = line.split(/\s+/u);
    const [kind, file, ref, pin] = fields;
    if (kind === undefined || file === undefined || ref === undefined || pin === undefined)
      return { ok: false, reason: `${at}: row needs at least <kind> <file> <ref> <pin>` };
    if (!(PIN_KINDS as readonly string[]).includes(kind))
      return { ok: false, reason: `${at}: unknown kind '${kind}' (${PIN_KINDS.join("|")})` };
    const k = kind as PinKind;
    if (k !== "npm-advisory" && !SHA256_REF.test(pin))
      return { ok: false, reason: `${at}: pin '${pin}' is not sha256:<64 hex> — a short or non-hex digest verifies nothing` };

    const update = kv(fields, "update");
    if (update !== "follow-tag" && update !== "frozen")
      return { ok: false, reason: `${at}: update= must be follow-tag or frozen` };

    // MANDATORY. A default here would be a pin that can be bumped with nothing
    // judging the new bytes -- the exact failure this tool exists to stop.
    const remeasure = kv(fields, "remeasure");
    if (remeasure === null)
      return { ok: false, reason: `${at}: remeasure= is mandatory — a digest nothing re-measured is an unverified bump` };

    const horizonRaw = kv(fields, "horizon");
    const horizonDays = horizonRaw === null ? NaN : Number(horizonRaw);
    if (!Number.isInteger(horizonDays) || horizonDays <= 0)
      return { ok: false, reason: `${at}: horizon= must be a positive whole number of days` };

    const pinnedOn = kv(fields, "pinned");
    if (pinnedOn === null || !ISO_DAY.test(pinnedOn))
      return { ok: false, reason: `${at}: pinned= must be YYYY-MM-DD` };

    rows.push({ kind: k, file, ref, pin, update, remeasure, horizonDays, pinnedOn });
  }
  return { ok: true, rows };
}

// ── the drift falsifier ──────────────────────────────────────────────────────

export type DriftFinding = { readonly ref: string; readonly file: string; readonly reason: string };

/** A `#` (Dockerfile/YAML/shell) or `//` (TS) comment line. */
export function isCommentLine(line: string): boolean {
  const t = line.trimStart();
  return t.startsWith("#") || t.startsWith("//");
}

/**
 * For a container row the point of use is a `FROM <ref>@<digest>` line. Returns
 * the digest actually written there, or a reason it could not be read.
 *
 * Anchored on the REF rather than a line number: a line number in a registry is
 * a second source of truth that drifts the first time anyone edits above it.
 *
 * COMMENTS ARE STRIPPED FIRST, and the reason is that this check caught itself.
 * The windows-install-ps1-test Dockerfile documents its base image in a header
 * comment, so the FIRST run of --verify — with the FROM line correctly pinned —
 * reported the row unpinned, because the prose mention carries no `@sha256:`.
 * A guard that matches its own documentation is a guard reading the wrong text,
 * and this repo has hit that shape repeatedly. Nothing is lost: a commented-out
 * `FROM` is not a point of use either.
 */
export function digestAtPointOfUse(fileText: string, ref: string): { ok: true; digest: string } | { ok: false; reason: string } {
  const hits: string[] = [];
  for (const line of fileText.split("\n")) {
    if (isCommentLine(line)) continue;
    const idx = line.indexOf(ref);
    if (idx < 0) continue;
    const after = line.slice(idx + ref.length);
    const m = /^@(sha256:[0-9a-f]{64})\b/u.exec(after);
    if (m === null) return { ok: false, reason: `'${ref}' appears unpinned (no @sha256: immediately after it)` };
    hits.push(m[1] as string);
  }
  if (hits.length === 0) return { ok: false, reason: `'${ref}' does not appear in the file` };
  const first = hits[0] as string;
  // Two FROM lines on the same ref that disagree would let --verify pass against
  // whichever one it read first. Refuse instead of picking.
  if (hits.some((h) => h !== first)) return { ok: false, reason: `'${ref}' is pinned to different digests in the same file` };
  return { ok: true, digest: first };
}

/**
 * THE MIRROR CHECK. Offline, no network, no clock. Every digest row's registry
 * pin must equal the digest written at its point of use.
 *
 * `npm-advisory` rows carry no inline digest — their subject is a dismissal, not
 * a file — so they are not drift-checkable and are skipped here. Their premise is
 * enforced by `lint-mathjs-dismissal-premise.ts`; their staleness by `--report`.
 */
export function verifyMirror(rows: readonly PinRow[], read: (p: string) => string): readonly DriftFinding[] {
  const out: DriftFinding[] = [];
  for (const r of rows) {
    if (r.kind === "npm-advisory") continue;
    let text: string;
    try {
      text = read(r.file);
    } catch (e) {
      out.push({ ref: r.ref, file: r.file, reason: `unreadable: ${e instanceof Error ? e.message : String(e)}` });
      continue;
    }
    const found = digestAtPointOfUse(text, r.ref);
    if (!found.ok) {
      out.push({ ref: r.ref, file: r.file, reason: found.reason });
      continue;
    }
    if (found.digest !== r.pin)
      out.push({
        ref: r.ref,
        file: r.file,
        reason: `registry says ${r.pin} but the file pins ${found.digest} — the registry is a MIRROR, so the file wins and the row is wrong`,
      });
  }
  return out;
}

// ── staleness ────────────────────────────────────────────────────────────────

export type Freshness = "fresh" | "moved" | "past-horizon" | "unknown";

export interface RowStatus {
  readonly ref: string;
  readonly kind: PinKind;
  readonly freshness: Freshness;
  readonly detail: string;
  readonly ageDays: number;
}

export function ageInDays(pinnedOn: string, today: string): number {
  const a = Date.parse(`${pinnedOn}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Classify one row. `upstream` is what the resolver returned: a digest/version
 * string, or null meaning THE RESOLVER COULD NOT RUN.
 *
 * Order matters and is deliberate: `unknown` is decided FIRST. A row we could
 * not resolve is unknown even if it is also older than its horizon, because
 * calling it `past-horizon` would imply we know the pin is behind — and we do
 * not. Unknown never becomes a weaker claim it did not earn.
 */
export function classify(row: PinRow, upstream: string | null, today: string): RowStatus {
  const ageDays = ageInDays(row.pinnedOn, today);
  if (upstream === null)
    return { ref: row.ref, kind: row.kind, freshness: "unknown", detail: "resolver could not run — this is NOT a pass", ageDays };
  if (upstream !== row.pin)
    return { ref: row.ref, kind: row.kind, freshness: "moved", detail: `upstream is now ${upstream}`, ageDays };
  if (Number.isFinite(ageDays) && ageDays > row.horizonDays)
    return {
      ref: row.ref,
      kind: row.kind,
      freshness: "past-horizon",
      detail: `pin matches upstream but is ${String(ageDays)}d old (horizon ${String(row.horizonDays)}d) — re-measure it`,
      ageDays,
    };
  return { ref: row.ref, kind: row.kind, freshness: "fresh", detail: `matches upstream (${String(ageDays)}d old)`, ageDays };
}

// ── injected doors ───────────────────────────────────────────────────────────

export interface RefreshEffects {
  /** HEAD/GET a URL; headers are lower-cased. Rejects/throws on transport failure. */
  readonly httpGet: (url: string, headers: Record<string, string>) => Promise<{ status: number; headers: Record<string, string>; body: string }>;
  readonly readFile: (p: string) => string;
  readonly writeFile: (p: string, text: string) => void;
  /** Run argv; combined output. */
  readonly run: (cmd: string, args: readonly string[]) => { ok: boolean; output: string };
  /** `YYYY-MM-DD`, injected so staleness is not read off an ambient clock. */
  readonly today: () => string;
  readonly log: (line: string) => void;
}

const MANIFEST_ACCEPT = [
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.docker.distribution.manifest.list.v2+json",
  "application/vnd.oci.image.manifest.v1+json",
  "application/vnd.docker.distribution.manifest.v2+json",
].join(", ");

export function splitImageRef(ref: string): { host: string; repo: string; tag: string } | null {
  const at = ref.lastIndexOf(":");
  if (at <= 0) return null;
  const tag = ref.slice(at + 1);
  const name = ref.slice(0, at);
  if (tag.length === 0 || tag.includes("/")) return null;
  const slash = name.indexOf("/");
  if (slash < 0) return { host: "registry-1.docker.io", repo: `library/${name}`, tag };
  const maybeHost = name.slice(0, slash);
  // A first segment with a dot or a port is a registry host; otherwise it is a
  // Docker Hub namespace (`oven/bun`), which lives on registry-1.docker.io.
  if (maybeHost.includes(".") || maybeHost.includes(":"))
    return { host: maybeHost, repo: name.slice(slash + 1), tag };
  return { host: "registry-1.docker.io", repo: name, tag };
}

/**
 * Resolve a container tag to the registry's manifest digest.
 *
 * Returns null — never a guess and never a throw — when the registry cannot be
 * reached or does not answer with a digest, so the caller reports `unknown`.
 */
export async function resolveContainerDigest(ref: string, fx: RefreshEffects): Promise<string | null> {
  const parts = splitImageRef(ref);
  if (parts === null) return null;
  const headers: Record<string, string> = { accept: MANIFEST_ACCEPT };
  if (parts.host === "registry-1.docker.io") {
    try {
      const tok = await fx.httpGet(
        `https://auth.docker.io/token?service=registry.docker.io&scope=repository:${parts.repo}:pull`,
        {},
      );
      if (tok.status !== 200) return null;
      const parsed = JSON.parse(tok.body) as { token?: string };
      if (typeof parsed.token !== "string") return null;
      headers["authorization"] = `Bearer ${parsed.token}`;
    } catch {
      return null;
    }
  }
  try {
    const res = await fx.httpGet(`https://${parts.host}/v2/${parts.repo}/manifests/${parts.tag}`, headers);
    if (res.status !== 200) return null;
    const d = res.headers["docker-content-digest"];
    if (typeof d === "string" && SHA256_REF.test(d)) return d;
    // Some registries omit the header; the digest of the manifest BODY is the
    // same value by definition, so compute it rather than reporting unknown.
    if (res.body.length > 0) return `sha256:${createHash("sha256").update(res.body).digest("hex")}`;
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve an `npm-advisory` row: does the package's LATEST release still fail to
 * admit a patched dependency?
 *
 * The `ref` encodes the whole question so the row is self-describing:
 *   `npm:<package>!<dependency>@<first-patched-semver-major>`
 * e.g. `npm:quantum-circuit!mathjs@7` — "quantum-circuit's latest release, does
 * any declared mathjs range admit 7.x?"
 *
 * Returns the latest version string when the answer is still NO (the dismissal
 * stands), and `"FIX-AVAILABLE"` when a range now admits the patched major (the
 * dismissal is stale and must be revisited). Null when the registry is
 * unreachable — unknown, not a pass.
 */
export async function resolveNpmAdvisory(ref: string, fx: RefreshEffects): Promise<string | null> {
  const m = /^npm:([^!]+)!([^@]+)@(\d+)$/u.exec(ref);
  if (m === null) return null;
  const [, pkg, dep, majorRaw] = m;
  const major = Number(majorRaw);
  try {
    const res = await fx.httpGet(`https://registry.npmjs.org/${pkg as string}`, { accept: "application/json" });
    if (res.status !== 200) return null;
    const doc = JSON.parse(res.body) as {
      "dist-tags"?: { latest?: string };
      versions?: Record<string, { dependencies?: Record<string, string> }>;
    };
    const latest = doc["dist-tags"]?.latest;
    if (typeof latest !== "string") return null;
    const range = doc.versions?.[latest]?.dependencies?.[dep as string];
    if (typeof range !== "string") return "FIX-AVAILABLE";
    // A caret/tilde range never crosses a major, so the declared major IS the
    // ceiling. Deliberately narrow: anything this cannot read as bounded below
    // the patched major is reported as FIX-AVAILABLE, which errs toward
    // re-examining the dismissal rather than toward keeping it.
    const bounded = /^[\^~]?(\d+)\./u.exec(range.trim());
    if (bounded === null) return "FIX-AVAILABLE";
    return Number(bounded[1]) < major ? latest : "FIX-AVAILABLE";
  } catch {
    return null;
  }
}

/** Total over `PinKind`. A kind with no resolver returns null → `unknown`. */
export async function resolveUpstream(row: PinRow, fx: RefreshEffects): Promise<string | null> {
  switch (row.kind) {
    case "container":
      return await resolveContainerDigest(row.ref, fx);
    case "npm-advisory":
      return await resolveNpmAdvisory(row.ref, fx);
    case "nuget":
    case "npm-lock":
    case "pip":
      // Named, not stubbed. These kinds are pinned by a LOCKFILE rather than by a
      // digest at a point of use, so their refresh is `dotnet restore --locked-mode`
      // / `npm ci` / `pip install --require-hashes` and their registry row form is
      // not yet designed. Reporting `unknown` says exactly that; returning "fresh"
      // would be a check that cannot fail.
      return null;
  }
}

// ── the refresh ──────────────────────────────────────────────────────────────

export type RefreshOutcome =
  | { readonly ok: true; readonly changed: boolean; readonly message: string }
  | { readonly ok: false; readonly message: string };

/** Rewrite `<ref>@<old>` → `<ref>@<new>` at every occurrence. Returns null if nothing changed. */
export function rewritePin(fileText: string, ref: string, oldPin: string, newPin: string): string | null {
  const needle = `${ref}@${oldPin}`;
  if (!fileText.includes(needle)) return null;
  return fileText.split(needle).join(`${ref}@${newPin}`);
}

/**
 * Re-resolve → rewrite → re-measure → receipt, and RESTORE EVERYTHING if the
 * re-measure fails. The refusal is the whole point: a new digest that no run has
 * judged is an unverified bump, and this function will not leave one on disk.
 */
export async function refreshRow(row: PinRow, fx: RefreshEffects): Promise<RefreshOutcome> {
  if (row.update === "frozen")
    return { ok: false, message: `${row.ref} is update=frozen — change the row deliberately, not by running refresh` };
  if (row.kind === "npm-advisory")
    return { ok: false, message: `${row.ref} is an advisory disposition, not a file pin — use --report and revisit the dismissal by hand` };

  const upstream = await resolveUpstream(row, fx);
  if (upstream === null) return { ok: false, message: `${row.ref}: could not resolve upstream — refusing to write anything` };
  if (upstream === row.pin) return { ok: true, changed: false, message: `${row.ref}: already at ${row.pin}` };

  const before = fx.readFile(row.file);
  const after = rewritePin(before, row.ref, row.pin, upstream);
  if (after === null)
    return { ok: false, message: `${row.ref}: '${row.ref}@${row.pin}' is not present in ${row.file} — run --verify first` };

  fx.writeFile(row.file, after);
  fx.log(`[refresh] ${row.ref}  ${row.pin} -> ${upstream}`);
  fx.log(`[refresh] re-measuring: ${row.remeasure}`);

  const argv = row.remeasure.split(":");
  const cmd = argv[0] as string;
  const probe = fx.run(cmd, argv.slice(1));
  if (!probe.ok) {
    fx.writeFile(row.file, before);
    return {
      ok: false,
      message:
        `${row.ref}: re-measure '${row.remeasure}' FAILED, so the new digest was NOT kept and ${row.file} was restored.\n` +
        probe.output,
    };
  }

  const receiptLine =
    `${row.ref}  ${upstream}  measured=${fx.today()}  result=pass  remeasure=${row.remeasure}`;
  let receipts: string;
  try {
    receipts = fx.readFile(RECEIPTS);
  } catch {
    receipts = "";
  }
  fx.writeFile(RECEIPTS, `${receipts.replace(/\n*$/u, "")}\n${receiptLine}\n`);

  const reg = fx.readFile(REGISTRY);
  fx.writeFile(
    REGISTRY,
    reg
      .split("\n")
      .map((l) => (l.includes(` ${row.ref} `) && l.includes(row.pin) ? l.replace(row.pin, upstream).replace(`pinned=${row.pinnedOn}`, `pinned=${fx.today()}`) : l))
      .join("\n"),
  );

  return { ok: true, changed: true, message: `${row.ref}: re-pinned to ${upstream} and re-measured (receipt appended)` };
}

// ── cli ──────────────────────────────────────────────────────────────────────

export function realEffects(): RefreshEffects {
  return {
    httpGet: async (url, headers) => {
      if (!url.startsWith("https://")) throw new Error(`refusing non-HTTPS url: ${url}`);
      const res = await fetch(url, { headers, redirect: "follow" });
      const h: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        h[k.toLowerCase()] = v;
      });
      return { status: res.status, headers: h, body: await res.text() };
    },
    readFile: (p) => readFileSync(p, "utf-8"),
    writeFile: (p, text) => {
      writeFileSync(p, text);
    },
    run: (cmd, args) => {
      const r = spawnSync(cmd, [...args], { encoding: "utf-8" });
      return { ok: r.status === 0, output: `${r.stdout ?? ""}${r.stderr ?? ""}` };
    },
    today: () => new Date().toISOString().slice(0, 10),
    log: (l) => {
      console.log(l);
    },
  };
}

async function main(argv: readonly string[]): Promise<number> {
  const fx = realEffects();
  let text: string;
  try {
    text = fx.readFile(REGISTRY);
  } catch (e) {
    console.error(`refresh-pins: cannot read ${REGISTRY}: ${e instanceof Error ? e.message : String(e)}`);
    return 2;
  }
  const parsed = parseRegistry(text);
  if (!parsed.ok) {
    console.error(`refresh-pins: ${parsed.reason}`);
    return 2;
  }
  const rows = parsed.rows;
  const mode = argv[0] ?? "--verify";

  if (mode === "--verify") {
    const findings = verifyMirror(rows, fx.readFile);
    if (findings.length === 0) {
      console.log(
        `refresh-pins --verify: OK — ${String(rows.length)} row(s); every registry digest matches the pin written at its point of use.`,
      );
      return 0;
    }
    console.error(`refresh-pins --verify: ${String(findings.length)} row(s) drifted from their point of use:`);
    for (const f of findings) console.error(`  ${f.file}  ${f.ref}\n    ${f.reason}`);
    console.error(
      "\nThe registry is a MIRROR of the pins written where they are used, never a source.\n" +
        "Fix the row to match the file (or re-pin with --refresh); never make a build read this file.",
    );
    return 1;
  }

  if (mode === "--report") {
    const today = fx.today();
    const statuses: RowStatus[] = [];
    for (const r of rows) statuses.push(classify(r, await resolveUpstream(r, fx), today));
    const by = (f: Freshness): readonly RowStatus[] => statuses.filter((s) => s.freshness === f);
    for (const s of statuses) console.log(`  ${s.freshness.padEnd(12)} ${s.kind.padEnd(13)} ${s.ref}\n      ${s.detail}`);
    console.log(
      `\nfresh=${String(by("fresh").length)}  moved=${String(by("moved").length)}  ` +
        `past-horizon=${String(by("past-horizon").length)}  unknown=${String(by("unknown").length)}`,
    );
    if (by("unknown").length > 0)
      console.log("unknown is NOT fresh: a resolver that could not run says nothing about its pin.");
    return by("moved").length + by("past-horizon").length > 0 ? 1 : 0;
  }

  if (mode === "--resolve" || mode === "--refresh") {
    const ref = argv[1];
    if (ref === undefined) {
      console.error(`refresh-pins: ${mode} needs a <ref>`);
      return 2;
    }
    const row = rows.find((r) => r.ref === ref);
    if (row === undefined) {
      console.error(`refresh-pins: no row for '${ref}'. Known refs:\n${rows.map((r) => `  ${r.ref}`).join("\n")}`);
      return 2;
    }
    if (mode === "--resolve") {
      const up = await resolveUpstream(row, fx);
      console.log(up === null ? `${ref}: unknown (resolver could not run)` : `${ref}: ${up}`);
      return up === null ? 1 : 0;
    }
    const out = await refreshRow(row, fx);
    console.log(out.message);
    return out.ok ? 0 : 1;
  }

  console.error(`refresh-pins: unknown mode '${mode}' (--verify | --report | --resolve <ref> | --refresh <ref>)`);
  return 2;
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
