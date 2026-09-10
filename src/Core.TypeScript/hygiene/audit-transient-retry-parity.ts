/**
 * audit-transient-retry-parity.ts — the retry predicate must not be broader in the shell
 * than it is where it is tested.
 *
 * `install.ps1` retries a failed toolchain install when the output matches a known transient
 * upstream signature. The list of signatures is mirrored: the authority is
 * `src/Core.TypeScript/ci/transient-toolchain-failure.ts`, where it is unit-tested and
 * mutation-checked; `install.ps1` carries a copy because a PowerShell bootstrap cannot import
 * TypeScript.
 *
 * A mirrored list drifts. And the direction that matters is asymmetric: a needle present in
 * the shell but ABSENT from the tested module is an UNTESTED retry, which is how a real,
 * reproducible failure quietly becomes intermittent green — strictly worse than staying red,
 * because nobody investigates a build that eventually passes.
 *
 * So this refuses any difference in either direction, and says which side is which.
 */

/**
 * Extract the needles from the PowerShell array literal ONLY.
 *
 * Deliberately NOT a whole-file grep: the block comment above the array quotes
 * "trust-metadata-api service unavailable" as prose, and a file-wide search would find the
 * comment and call the parity satisfied. A guard that its own comment can satisfy is the
 * failure this repo has hit repeatedly, so the parse is anchored to the assignment.
 */
export function parsePowershellNeedles(text: string): readonly string[] | null {
  const marker = "$script:TransientToolNeedles = @(";
  const start = text.indexOf(marker);
  if (start === -1) return null;
  const end = text.indexOf(")", start + marker.length);
  if (end === -1) return null;
  const body = text.slice(start + marker.length, end);
  const out: string[] = [];
  for (const raw of body.split(",")) {
    const t = raw.trim();
    if (t.length === 0) continue;
    const m = /^'(?<needle>[^']*)'$/u.exec(t);
    if (m?.groups?.["needle"] !== undefined) out.push(m.groups["needle"]);
  }
  return out;
}

export type ParityFinding =
  | { readonly kind: "ok"; readonly count: number }
  | { readonly kind: "refused"; readonly why: string };

export function checkParity(input: {
  readonly tested: readonly string[];
  readonly shell: readonly string[] | null;
}): ParityFinding {
  if (input.shell === null) {
    return {
      kind: "refused",
      why: "install.ps1 has no $script:TransientToolNeedles array — either the retry was removed (then remove this audit) or it was renamed (then this audit is reading nothing, which is a check that cannot fail)",
    };
  }
  if (input.tested.length === 0) {
    return { kind: "refused", why: "the tested roster is empty, so parity would hold vacuously" };
  }
  const testedSet = new Set(input.tested);
  const shellSet = new Set(input.shell);
  const untestedInShell = input.shell.filter((n) => !testedSet.has(n));
  const missingFromShell = input.tested.filter((n) => !shellSet.has(n));

  if (untestedInShell.length > 0) {
    return {
      kind: "refused",
      why: `install.ps1 retries on ${untestedInShell.map((n) => JSON.stringify(n)).join(", ")}, which the tested module does not recognise — an UNTESTED retry, and the direction that turns red into intermittent green. Add it to TRANSIENT_PATTERNS with the observation that justifies it, or remove it from the shell.`,
    };
  }
  if (missingFromShell.length > 0) {
    return {
      kind: "refused",
      why: `the tested module recognises ${missingFromShell.map((n) => JSON.stringify(n)).join(", ")} but install.ps1 does not — the shell will fail on a failure we have decided is transient. Mirror it into $script:TransientToolNeedles.`,
    };
  }
  return { kind: "ok", count: input.tested.length };
}

async function main(): Promise<number> {
  const { readFileSync } = await import("node:fs");
  const { TRANSIENT_PATTERNS } = await import("../ci/transient-toolchain-failure.ts");
  let text: string;
  try {
    text = readFileSync("tools/setup/install.ps1", "utf8");
  } catch {
    console.error("REFUSED — tools/setup/install.ps1 could not be read; this audit establishes nothing without it");
    return 1;
  }
  const finding = checkParity({
    tested: TRANSIENT_PATTERNS.map((p) => p.needle),
    shell: parsePowershellNeedles(text),
  });
  if (finding.kind === "refused") {
    console.error(`REFUSED — transient-retry parity: ${finding.why}`);
    return 1;
  }
  console.log(`OK — ${String(finding.count)} transient retry signature(s), identical in install.ps1 and transient-toolchain-failure.ts.`);
  return 0;
}

if (import.meta.main) process.exit(await main());
