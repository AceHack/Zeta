// build-receipt.ts — THE canonical definition of a git-native BUILD RECEIPT.
//
// Work-item 081KYYJEJ4X08QG0R003P8GXSY. Pure: no fs, no git, no process — the
// git binding lives in `verify-build-receipt.ts`, so this module runs in a
// browser tab as readily as in a runner.
//
// ---------------------------------------------------------------------------
// WHAT A RECEIPT IS
// ---------------------------------------------------------------------------
// A trailer block in the commit message that says, signed:
//
//   Build-Receipt-Version: 1
//   Build-Receipt-Tree: 4b825dc642cb6eb9a060e54bf8d69288fbee4904
//   Build-Receipt-Checks: dotnet-build=pass;ts-lint=pass;bun-test=fail
//   Build-Receipt-Signer: SHA256:7DS+F+oWIaIY6g2LsoCBfDou38nWnfhbz5eUUI6yt+8
//   Build-Receipt-Signature: U1NIU0lHAAAAAQ...
//
// A CI gate is prevention by a host: a forge says "no". A receipt is
// ATTESTATION: a writer states, signed, "I ran these checks over this tree and
// this is what happened", and any peer with a clone can check that claim
// without asking anyone. Aaron 2026-08-01: *"CI gates are for corporate jobs
// not sovereign ones."*
//
// ---------------------------------------------------------------------------
// EXACTLY WHAT A VALID RECEIPT PROVES — READ THIS BEFORE CITING ONE
// ---------------------------------------------------------------------------
// PROVES (cryptographically, by ed25519 over SSHSIG):
//   * the holder of the private key whose fingerprint is `Build-Receipt-Signer`
//     produced these bytes, and
//   * those bytes name THIS tree oid and THESE check results — a signature
//     cannot be moved to another tree or have a `fail` edited to `pass`, because
//     both are inside the signed message.
//
// DOES NOT PROVE — and no field here should ever be read as proving it:
//   * that the checks were actually RUN. Nothing observes the signer's machine.
//     A receipt is a claim by an identity, so it is exactly as good as that
//     identity's standing, and its whole value is that a lie is now ATTRIBUTABLE
//     and RETRACTABLE rather than anonymous.
//   * that the code is good. `fail` is a legal, signable result; a receipt
//     reports, it does not permit.
//   * WHEN it was signed. SSHSIG carries no timestamp and this format adds none
//     (see "no timestamp" below).
//   * anything about the commit's HISTORY. The binding is to the TREE — content,
//     not lineage. See "why the tree" below.
//
// The corroboration model is therefore the point: a second signer who re-runs
// and posts a receipt over the SAME tree either agrees (corroboration) or does
// not (`detectReceiptConflict` — the −1 that retracts). Prevention is not
// available to us and is not wanted; convergence is.
//
// ---------------------------------------------------------------------------
// WHY THE TREE OID, AND NOT THE COMMIT OID
// ---------------------------------------------------------------------------
// A receipt riding INSIDE the commit message cannot name its own commit: the
// message is an input to the commit hash, so signing the commit oid is
// impossible by construction (`s = f(s)` with no fixed point available). The
// tree oid has no such problem — `git write-tree` fixes it BEFORE the commit
// object exists, so the writer can verify, sign the tree, and then commit.
//
// This is a stronger binding than it first looks, and one deliberate weakness:
//   * STRONGER: a git tree oid is the Merkle root of the entire worktree
//     content. Any byte of any file differs ⇒ different oid ⇒ the receipt does
//     not apply. The receipt cannot drift from the code it claims.
//   * WEAKER: it says nothing about parents, author, or message. The same
//     receipt is valid for ANY commit with that tree — a cherry-pick, a rebase
//     that changed no content, a revert-of-a-revert. That is correct rather
//     than a hole: identical content has identical build results, and it makes
//     receipts idempotent under replay (discipline #6). What it means in
//     practice is that a receipt attests to a SNAPSHOT, never to a history, and
//     must never be read as approving a merge.
//
// ---------------------------------------------------------------------------
// NO TIMESTAMP — deliberate
// ---------------------------------------------------------------------------
// The obvious sixth field is a signing time, to let a later receipt supersede
// an earlier one. It is omitted because `.claude/rules/local-time-never-enters-
// the-shared-fold.md` forbids exactly that: the instant a local wall-clock
// decides which evidence counts, two peers with different clocks fold different
// evidence sets and diverge. So conflicting receipts are SURFACED
// (`detectReceiptConflict`), never silently resolved by whoever's clock ran fast.
// Ordering, if it is ever needed, belongs to the commit DAG — which is agreed
// phase, not local time.
//
// ---------------------------------------------------------------------------
// CLOSED CHECK SET — a receipt may NAME a check, never DEFINE one
// ---------------------------------------------------------------------------
// `Build-Receipt-Checks` ids must come from a committed roster
// (`build-receipt-checks.json`). An open vocabulary would let a signer attest
// `everything-is-fine=pass` — true, signed, and meaningless, which is the
// vacuity class in its purest form. The closed set is the portable half of the
// hub/agent design in `.claude/rules/itron-hub-patent-boundary-p2p-is-the-
// upgrade.md`: the far side may name a command, never define one.
//
// Anchors (Beacon): Merkle, "A Digital Signature Based on a Conventional
// Encryption Function" (1987) — the tree oid is a Merkle root; in-toto (Torres-
// Arias et al., USENIX Security 2019) and SLSA provenance — signed statements
// about what produced an artifact, which this is the host-free rung of;
// OpenSSH `PROTOCOL.sshsig` for the signature envelope.

import { findRosterEntry, sshString, verifySshSig, type RosterEntry, type SshSigFailure } from "../crypto/sshsig.ts";

/** SSHSIG namespace. Distinct from git's `git` namespace so neither replays as the other. */
export const BUILD_RECEIPT_NAMESPACE = "zeta.build-receipt.v1";

export const RECEIPT_VERSION = "1";

/** The five required keys, in canonical order. */
export const RECEIPT_KEYS: readonly string[] = [
  "Build-Receipt-Version",
  "Build-Receipt-Tree",
  "Build-Receipt-Checks",
  "Build-Receipt-Signer",
  "Build-Receipt-Signature",
];

/** The closed result vocabulary. `skip` claims nothing and never corroborates. */
export const RESULTS: readonly string[] = ["pass", "fail", "skip"];
export type CheckResult = "pass" | "fail" | "skip";

export interface CheckOutcome {
  readonly id: string;
  readonly result: CheckResult;
}

export interface ReceiptClaim {
  readonly version: string;
  /** Git tree oid: 40 hex (sha1) or 64 hex (sha256 repositories). */
  readonly tree: string;
  readonly checks: readonly CheckOutcome[];
  /** `SHA256:<unpadded-base64>`, as `ssh-keygen -lf` prints it. */
  readonly signer: string;
  /** Single-line base64 SSHSIG blob (armor stripped). */
  readonly signature: string;
}

/** Why a receipt was refused. Data, not a printed message. */
export type ReceiptFailure =
  | "missing-keys"
  | "unsupported-version"
  | "malformed-tree"
  | "malformed-checks"
  | "duplicate-check"
  | "unknown-check"
  | "malformed-result"
  | "malformed-signer"
  | "signer-mismatch"
  | "untrusted-signer"
  | "tree-mismatch"
  | SshSigFailure;

export interface ReceiptRefusal {
  readonly ok: false;
  readonly reason: ReceiptFailure;
  /** Which value provoked it — enough to fix the receipt, never a stack trace. */
  readonly detail: string;
}

export type ParseResult = { readonly ok: true; readonly claim: ReceiptClaim } | ReceiptRefusal;

export interface ReceiptVerdict {
  readonly ok: true;
  readonly claim: ReceiptClaim;
  /** The roster entry that vouched for the signer — the verdict names its own evidence. */
  readonly signerSource: string;
}

export type VerifyResult = ReceiptVerdict | ReceiptRefusal;

const TREE_RE = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const CHECK_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const FINGERPRINT_RE = /^SHA256:[A-Za-z0-9+/]{43}$/;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const BLANK_LINE_RE = /^[\t ]*$/;

const refuse = (reason: ReceiptFailure, detail: string): ReceiptRefusal => ({ ok: false, reason, detail });

// ── canonical bytes ─────────────────────────────────────────────────────────

/**
 * The checks in canonical form: `id=result` pairs sorted by id, joined by `;`.
 *
 * Sorting makes the signed form order-independent, so re-serializing a parsed
 * receipt reproduces the exact bytes that were signed regardless of how the
 * writer ordered them. Ids are constrained to lowercase ASCII + digits + `-`
 * (`CHECK_ID_RE`), which is precisely the range where UTF-16 code-unit order,
 * UTF-8 byte order, and codepoint order all coincide — so the sort cannot
 * diverge between oracles (`.claude/rules/culture-invariant-by-default.md`).
 */
export function canonicalChecksString(checks: readonly CheckOutcome[]): string {
  return [...checks]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((c) => `${c.id}=${c.result}`)
    .join(";");
}

/**
 * The exact bytes a signer signs, length-prefixed per field.
 *
 * Length prefixing is what makes the encoding injective: without it, a tree of
 * `"aa"` with checks `"bb"` and a tree of `"aab"` with checks `"b"` would share
 * signed bytes, and a signature could be moved between them by re-splitting the
 * boundary. Same construction, and the same reason, as
 * `src/Core.TypeScript/observe/signed-stamp.ts` and `src/Core/MultiSignatureVerification.fs`.
 *
 * The signer fingerprint is inside the signed bytes as well as being checked
 * against the key embedded in the SSHSIG, so the claimed identity cannot be
 * edited in the trailer without invalidating the signature.
 */
export function receiptSigningMessage(claim: {
  readonly version: string;
  readonly tree: string;
  readonly checks: readonly CheckOutcome[];
  readonly signer: string;
}): Uint8Array {
  const parts = [
    sshString(claim.version),
    sshString(claim.tree),
    sshString(canonicalChecksString(claim.checks)),
    sshString(claim.signer),
  ];
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

// ── parse ───────────────────────────────────────────────────────────────────

function trailerValue(blockText: string, key: string): string | null {
  const prefix = `${key.toLowerCase()}:`;
  for (const line of blockText.split("\n")) {
    if (!line.toLowerCase().startsWith(prefix)) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    return line.slice(idx + 1).trim();
  }
  return null;
}

/**
 * Every complete receipt block in a commit message, in document order.
 *
 * Contiguity is required INSIDE a block — the same rule, for the same reason, as
 * `agencysignature-block.ts`: a scan that assembled five keys from five different
 * paragraphs could "recover" a receipt nobody wrote.
 *
 * Unlike AgencySignature there is no last-wins rule, because several receipts in
 * one message is the DESIGNED case, not a squash artifact: two signers
 * corroborating the same tree is the entire corroboration model. All blocks are
 * returned and all are verified.
 */
export function findAllReceiptBlocks(text: string): readonly string[] {
  const lines = text.split("\n");
  const found: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (BLANK_LINE_RE.test(lines[i] ?? "")) {
      i++;
      continue;
    }
    let j = i;
    while (j < lines.length && !BLANK_LINE_RE.test(lines[j] ?? "")) j++;
    const paragraph = lines.slice(i, j).join("\n");
    if (RECEIPT_KEYS.every((k) => trailerValue(paragraph, k) !== null)) found.push(paragraph);
    i = j;
  }
  return found;
}

/** Structural parse + field validation. No cryptography, no roster. */
export function parseReceiptBlock(blockText: string): ParseResult {
  const missing = RECEIPT_KEYS.filter((k) => trailerValue(blockText, k) === null);
  if (missing.length > 0) return refuse("missing-keys", missing.join(", "));

  const version = trailerValue(blockText, "Build-Receipt-Version") ?? "";
  if (version !== RECEIPT_VERSION) return refuse("unsupported-version", version);

  const tree = (trailerValue(blockText, "Build-Receipt-Tree") ?? "").toLowerCase();
  if (!TREE_RE.test(tree)) return refuse("malformed-tree", tree);

  const checksRaw = trailerValue(blockText, "Build-Receipt-Checks") ?? "";
  if (checksRaw.length === 0) return refuse("malformed-checks", "(empty)");
  const checks: CheckOutcome[] = [];
  const seen = new Set<string>();
  for (const item of checksRaw.split(";")) {
    const piece = item.trim();
    if (piece.length === 0) return refuse("malformed-checks", checksRaw);
    const eq = piece.indexOf("=");
    if (eq <= 0) return refuse("malformed-checks", piece);
    const id = piece.slice(0, eq);
    const result = piece.slice(eq + 1);
    if (!CHECK_ID_RE.test(id)) return refuse("malformed-checks", id);
    if (!RESULTS.includes(result)) return refuse("malformed-result", `${id}=${result}`);
    if (seen.has(id)) return refuse("duplicate-check", id);
    seen.add(id);
    checks.push({ id, result: result as CheckResult });
  }

  const signer = trailerValue(blockText, "Build-Receipt-Signer") ?? "";
  if (!FINGERPRINT_RE.test(signer)) return refuse("malformed-signer", signer);

  const signature = trailerValue(blockText, "Build-Receipt-Signature") ?? "";
  if (signature.length === 0 || !BASE64_RE.test(signature)) return refuse("malformed-base64", signature.slice(0, 24));

  return { ok: true, claim: { version, tree, checks, signer, signature } };
}

/** Render a claim as the canonical five-line trailer block. */
export function formatReceiptBlock(claim: ReceiptClaim): string {
  return [
    `Build-Receipt-Version: ${claim.version}`,
    `Build-Receipt-Tree: ${claim.tree}`,
    `Build-Receipt-Checks: ${canonicalChecksString(claim.checks)}`,
    `Build-Receipt-Signer: ${claim.signer}`,
    `Build-Receipt-Signature: ${claim.signature}`,
  ].join("\n");
}

// ── verify ──────────────────────────────────────────────────────────────────

export interface VerifyOptions {
  /** The closed check vocabulary. An id outside it is refused, never ignored. */
  readonly allowedCheckIds: ReadonlySet<string>;
  /** Public keys that may sign a receipt, from committed text. */
  readonly roster: readonly RosterEntry[];
  /**
   * The tree the receipt must apply to — normally `git rev-parse <commit>^{tree}`.
   * Omit ONLY when checking a receipt in isolation; a caller that omits it has
   * verified a signature over a tree it never compared to anything.
   */
  readonly expectedTree?: string;
}

/**
 * Verify one parsed claim. Every failure is a refusal with a reason; nothing throws.
 *
 * Order matters: cheap structural refusals first, signature last, and the
 * signature is checked even for an untrusted signer only in the sense that a
 * trust failure is reported as `untrusted-signer` rather than being disguised as
 * a bad signature. The two are different facts and a caller may care which.
 */
export function verifyReceiptClaim(claim: ReceiptClaim, opts: VerifyOptions): VerifyResult {
  for (const c of claim.checks) {
    if (!opts.allowedCheckIds.has(c.id)) return refuse("unknown-check", c.id);
  }
  if (opts.expectedTree !== undefined && opts.expectedTree.toLowerCase() !== claim.tree) {
    return refuse("tree-mismatch", `receipt ${claim.tree} != actual ${opts.expectedTree.toLowerCase()}`);
  }
  const entry = findRosterEntry(opts.roster, claim.signer);
  if (entry === null) return refuse("untrusted-signer", claim.signer);

  const message = receiptSigningMessage(claim);
  const verified = verifySshSig(claim.signature, message, BUILD_RECEIPT_NAMESPACE);
  if (!verified.ok) return refuse(verified.reason, claim.signer);
  // The SSHSIG embeds the public key it was made with. If that key's fingerprint
  // is not the one the trailer claims, the receipt is attributing a real
  // signature to the wrong identity — a distinct failure from a bad signature,
  // and the one an attacker would try.
  if (verified.fingerprint !== claim.signer) {
    return refuse("signer-mismatch", `embedded ${verified.fingerprint} != claimed ${claim.signer}`);
  }
  return { ok: true, claim, signerSource: entry.source };
}

/** Parse + verify every receipt block in a commit message. */
export function verifyCommitMessage(text: string, opts: VerifyOptions): readonly VerifyResult[] {
  return findAllReceiptBlocks(text).map((block) => {
    const parsed = parseReceiptBlock(block);
    return parsed.ok ? verifyReceiptClaim(parsed.claim, opts) : parsed;
  });
}

// ── corroboration / retraction ──────────────────────────────────────────────

export interface ReceiptConflict {
  readonly tree: string;
  readonly checkId: string;
  /** `signer -> result`, for each signer that reported this check. */
  readonly claims: readonly { readonly signer: string; readonly result: CheckResult }[];
}

/**
 * Conflicts among VERIFIED receipts: same tree, same check, different results.
 *
 * This is the retraction half of the model. It deliberately does not decide who
 * is right — it cannot, and a wall-clock tiebreak would be the divergence bug
 * (`local-time-never-enters-the-shared-fold`). A conflict is a fact peers must
 * resolve by re-running, which is the whole reason receipts beat a gate: a gate
 * can only say no once, whereas a conflicting receipt survives to be settled.
 *
 * Only verified receipts are considered — an unverifiable claim is not evidence,
 * so it cannot conflict with anything.
 */
export function detectReceiptConflicts(verdicts: readonly VerifyResult[]): readonly ReceiptConflict[] {
  const byTreeCheck = new Map<string, { signer: string; result: CheckResult }[]>();
  for (const v of verdicts) {
    if (!v.ok) continue;
    for (const c of v.claim.checks) {
      const key = JSON.stringify([v.claim.tree, c.id]);
      const list = byTreeCheck.get(key) ?? [];
      list.push({ signer: v.claim.signer, result: c.result });
      byTreeCheck.set(key, list);
    }
  }
  const conflicts: ReceiptConflict[] = [];
  for (const [key, claims] of byTreeCheck) {
    if (new Set(claims.map((c) => c.result)).size < 2) continue;
    const [tree = "", checkId = ""] = JSON.parse(key) as [string, string];
    conflicts.push({ tree, checkId, claims });
  }
  return conflicts;
}
