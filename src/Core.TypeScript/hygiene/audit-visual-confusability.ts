#!/usr/bin/env bun
// audit-visual-confusability.ts — the mechanical half of the confusable-shape guard.
//
// WHY THIS FILE EXISTS
// --------------------
// Zeta encodes meaning in marks so that agreement does not depend on shared vocabulary. That
// buys escape from etymological drift and it costs a new failure mode: PERCEPTUAL collision.
// `state-du.test.ts:128` already asserts glyph uniqueness — by codepoint. A codepoint check is
// the machine's comparison, and the machine is not the reader at risk.
//
// This audit asks the reader's question instead: under a declared perceptual quotient
// (`visual-skeleton.ts`), do two marks that mean DIFFERENT things reduce to the SAME mark?
//
// WHAT IT CHECKS — three tiers, weakest first
// -------------------------------------------
//   TIER 0  IDENTITY      Two differently-named entries in the shape catalog whose rendered
//                         bytes are equal. No perceptual model is needed: nothing distinguishes
//                         them for any observer, machine included.
//   TIER 1  SKELETON      Two state-DU members whose glyphs collide under the quotient.
//                         Graded: a collision WITHIN a claim class is a usability cost; a
//                         collision ACROSS claim classes makes the interface state a claim
//                         nobody made, and is an error.
//   TIER 2  ONE CHANNEL   Two DU members separated by hue alone — no greyscale separation, no
//                         distinct glyph skeleton, no distinct texture. Colour-blindness,
//                         greyscale printing and a monochrome terminal each erase that pair.
//
// COVERAGE IS REPORTED, NOT ASSUMED. Every mark absent from the skeleton table is listed as
// UNAUDITED. A check that silently passes what it cannot see is the defect it exists to catch.
//
// Register: TIER 0 is exact. TIERS 1 and 2 are only as good as the declared quotient and the
// declared threshold in `visual-skeleton.ts`, both of which are models. See that file's REGISTER
// section before quoting any result here outward.

import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { STATE_DU, type StateMember } from "../cluster/state-du.ts";
import {
  skeletonOf,
  skeletonKey,
  unicodeNameOf,
  contrastRatio,
  GREYSCALE_SEPARATION_FLOOR,
  asciiSkeletonKey,
} from "./visual-skeleton.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export interface Finding {
  readonly tier: 0 | 1 | 2 | 3;
  /** Stable identity, independent of prose. What the baseline matches on. */
  readonly key: string;
  readonly severity: "error" | "warn";
  readonly what: string;
  readonly why: string;
}

// ── TIER 0 — two catalog names, one picture ─────────────────────────────────────────────────

export function auditCatalogIdentity(goldenDir: string): Finding[] {
  const byDigest = new Map<string, string[]>();
  for (const file of readdirSync(goldenDir)
    .filter((f) => f.endsWith(".svg"))
    .sort()) {
    const digest = createHash("sha256")
      .update(readFileSync(join(goldenDir, file)))
      .digest("hex");
    byDigest.set(digest, [...(byDigest.get(digest) ?? []), file]);
  }
  const findings: Finding[] = [];
  for (const [digest, files] of byDigest) {
    if (files.length < 2) continue;
    findings.push({
      tier: 0,
      key: `tier0:${files.join("==")}`,
      severity: "error",
      what: `${files.join(" == ")} are byte-identical (sha256 ${digest.slice(0, 12)})`,
      why:
        "Two catalog entries with different names render the same picture, so the name carries " +
        "meaning the mark does not. The golden lock cannot see this: it compares each shape to " +
        "its own generator's output and never across entries — agreement by construction.",
    });
  }
  return findings;
}

// ── TIER 1 — glyphs that reduce to the same mark ────────────────────────────────────────────

/**
 * `members` is a parameter, not a closed-over constant, so the detector can be exercised
 * against controls in a test. A check that can only ever be run against the real data is a
 * check nobody can prove is capable of failing.
 */
export function auditGlyphSkeletons(members: readonly StateMember[] = STATE_DU): {
  findings: Finding[];
  unaudited: string[];
} {
  const findings: Finding[] = [];
  const unaudited: string[] = [];

  for (const m of members) {
    if (skeletonOf(m.glyph) === undefined) unaudited.push(`${m.id} "${m.glyph}"`);
  }

  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      const a = members[i]!;
      const b = members[j]!;
      const sa = skeletonOf(a.glyph);
      const sb = skeletonOf(b.glyph);
      if (sa === undefined || sb === undefined) continue; // reported as unaudited, never as pass
      if (skeletonKey(sa) !== skeletonKey(sb)) continue;

      const crossesClaimClass = a.claim !== b.claim;
      findings.push({
        tier: 1,
        key: `tier1:${a.id}~${b.id}`,
        severity: crossesClaimClass ? "error" : "warn",
        what:
          `${a.id} "${a.glyph}" (${unicodeNameOf(a.glyph) ?? "?"}) and ` +
          `${b.id} "${b.glyph}" (${unicodeNameOf(b.glyph) ?? "?"}) ` +
          `both reduce to [${skeletonKey(sa)}]`,
        why: crossesClaimClass
          ? `ACROSS CLAIM CLASSES (${a.claim} vs ${b.claim}). This is not a usability wrinkle: ` +
            `the reader who reads one as the other is told a different KIND of thing about the ` +
            `world. "${a.sentence}" and "${b.sentence}" are not degrees of one claim.`
          : `Both are ${a.claim} claims, so a misread costs precision rather than truth. Still a ` +
            `collision: separate them by base form, or accept that the glyph channel does not ` +
            `carry this distinction and say so at the definition site.`,
      });
    }
  }
  return { findings, unaudited };
}

// ── TIER 2 — pairs held apart by hue and nothing else ───────────────────────────────────────

/** The tokens, read from the stylesheet rather than restated here — one source of truth. */
export function readStateColours(cssPath: string): Map<string, string> {
  const css = readFileSync(cssPath, "utf-8");
  const colours = new Map<string, string>();
  for (const match of css.matchAll(/--state-([a-z]+):\s*(#[0-9A-Fa-f]{6})/g)) {
    colours.set(match[1]!, match[2]!);
  }
  return colours;
}

/** Which members carry a texture treatment — a non-hue, non-glyph channel. */
function textureOf(id: string): string {
  if (id === "unobserved" || id === "sealed") return "hatch-45";
  if (id === "frost") return "blur";
  if (id === "unavailable") return "strike";
  return "none";
}

export function auditSingleChannelPairs(
  colours: Map<string, string>,
  members: readonly StateMember[] = STATE_DU,
): Finding[] {
  const findings: Finding[] = [];
  const tokenName = (t: string): string => t.replace("--state-", "");

  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      const a = members[i]!;
      const b = members[j]!;
      const ca = colours.get(tokenName(a.token));
      const cb = colours.get(tokenName(b.token));
      if (ca === undefined || cb === undefined) continue;

      const ratio = contrastRatio(ca, cb);
      const greyscaleSeparates = ratio >= GREYSCALE_SEPARATION_FLOOR;
      const textureSeparates = textureOf(a.id) !== textureOf(b.id);
      const sa = skeletonOf(a.glyph);
      const sb = skeletonOf(b.glyph);
      const glyphSeparates = sa !== undefined && sb !== undefined && skeletonKey(sa) !== skeletonKey(sb);

      if (greyscaleSeparates || textureSeparates || glyphSeparates) continue;

      findings.push({
        tier: 2,
        key: `tier2:${a.id}~${b.id}`,
        severity: "error",
        what:
          `${a.id} (${ca}) and ${b.id} (${cb}) are separated by HUE ALONE — ` +
          `contrast ratio ${ratio.toFixed(3)} (floor ${GREYSCALE_SEPARATION_FLOOR}), ` +
          `same texture (${textureOf(a.id)}), colliding glyph skeletons`,
        why:
          "Greyscale, a monochrome terminal, a printed page and several forms of colour vision " +
          "each erase this pair completely. The stylesheet's own sentence applies: a " +
          "distinction carried only by hue is not a distinction.",
      });
    }
  }
  return findings;
}

// ── TIER 3 — the ASCII fallback channel ─────────────────────────────────────────────────────

/**
 * A reassignment that fixes the visual channel and collides the fallback has moved the bug, not
 * closed it. This checks the channel a terminal actually renders.
 */
export function auditAsciiMarks(members: readonly StateMember[] = STATE_DU): Finding[] {
  const findings: Finding[] = [];
  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      const a = members[i]!;
      const b = members[j]!;
      const ka = asciiSkeletonKey(a.ascii);
      const kb = asciiSkeletonKey(b.ascii);
      if (ka !== kb) continue;
      const crossesClaimClass = a.claim !== b.claim;
      findings.push({
        tier: 3,
        key: `tier3:${a.id}~${b.id}`,
        severity: crossesClaimClass ? "error" : "warn",
        what: `${a.id} "${a.ascii}" and ${b.id} "${b.ascii}" collide in the ASCII channel [${ka}]`,
        why:
          "This is what a terminal, a log line, a plain-text export and an ASCII-only notebook " +
          "render. Colour, texture and motion are all absent there, so the ASCII mark is the " +
          "ONLY channel left" +
          (crossesClaimClass ? ` — and this pair crosses ${a.claim}/${b.claim}.` : "."),
      });
    }
  }
  return findings;
}

// ── The baseline — empty, and that is the point ─────────────────────────────────────────────
//
// This map held three entries when the guard landed (2026-08-19): the byte-identical catalogue
// pair and the two cross-claim-class glyph collisions. All three are now closed, so it is empty.
//
// It is kept rather than deleted because the mechanism is load-bearing in BOTH directions. An
// entry lets a real finding be tracked against a work-item while the fix is scheduled, WITHOUT
// suppressing it — baselined findings still print in full on every run. And a line that outlives
// its finding is reported as STALE and fails the audit, so a baseline cannot quietly become an
// allowlist. That second half is not theoretical: it is what went red during this very change,
// after the glyphs were reassigned and the two lines were still here.
//
// A new entry requires a work-item id. That is the difference between a baseline and a licence.
export const KNOWN_OPEN: ReadonlyMap<string, string> = new Map([]);

/** A stable key for a finding, so the baseline does not depend on prose wording. */
export function findingKey(f: Finding): string {
  return f.key;
}

// ── main ────────────────────────────────────────────────────────────────────────────────────

export function runAudit(): { findings: Finding[]; unaudited: string[] } {
  const goldenDir = join(repoRoot, "db", "shapes", "golden");
  const cssPath = join(
    repoRoot,
    "docs",
    "design",
    "root-site-iris",
    "_ds",
    "design-system-f52fe130-fd0d-4310-93c2-19b6ce2a4ecc",
    "zeta-state.css",
  );
  const glyphs = auditGlyphSkeletons();
  return {
    findings: [
      ...auditCatalogIdentity(goldenDir),
      ...glyphs.findings,
      ...auditSingleChannelPairs(readStateColours(cssPath)),
      ...auditAsciiMarks(),
    ],
    unaudited: glyphs.unaudited,
  };
}

if (import.meta.main) {
  const { findings, unaudited } = runAudit();
  const errors = findings.filter((f) => f.severity === "error");
  const unbaselined = errors.filter((f) => !KNOWN_OPEN.has(f.key));

  for (const tier of [0, 1, 2, 3] as const) {
    const inTier = findings.filter((f) => f.tier === tier);
    const names = { 0: "IDENTITY", 1: "SKELETON", 2: "ONE CHANNEL", 3: "ASCII" } as const;
    console.log(`\n-- TIER ${String(tier)} ${names[tier]} -- ${String(inTier.length)} finding(s)`);
    if (inTier.length === 0) {
      // Names what was examined, so "no findings" is a measurement and not a silence.
      console.log("   no colliding pair found among the marks this tier examined");
    }
    for (const f of inTier) {
      const item = KNOWN_OPEN.get(f.key);
      const tag = item === undefined ? f.severity.toUpperCase() : `${f.severity.toUpperCase()} / known-open ${item}`;
      console.log(`   [${tag}] ${f.what}`);
      console.log(`            ${f.why}`);
    }
  }

  console.log(`\n-- COVERAGE -- ${String(unaudited.length)} unaudited mark(s)`);
  if (unaudited.length === 0) {
    console.log("   every state-DU glyph has a skeleton row");
  }
  for (const u of unaudited) console.log(`   UNAUDITED (no skeleton row, NOT a pass): ${u}`);

  // A baseline entry with no live finding is stale: the fix landed and the line did not.
  const stale = [...KNOWN_OPEN.keys()].filter((k) => !findings.some((f) => f.key === k));
  for (const k of stale) console.log(`   STALE BASELINE (finding gone, line remains): ${k}`);

  const failing = unbaselined.length + stale.length;
  console.log(
    `\n${failing === 0 ? "PASS" : "FAIL"} -- ` +
      `${String(errors.length)} error(s) of which ${String(unbaselined.length)} unbaselined, ` +
      `${String(findings.length - errors.length)} warning(s), ` +
      `${String(stale.length)} stale baseline line(s), ` +
      `${String(unaudited.length)} unaudited`,
  );
  process.exit(failing === 0 ? 0 : 1);
}
