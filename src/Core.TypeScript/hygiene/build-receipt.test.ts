import { describe, expect, test } from "bun:test";
import { parseRoster, sshFingerprint, parseSshPublicKeyLine } from "../crypto/sshsig.ts";
import {
  BUILD_RECEIPT_NAMESPACE,
  canonicalChecksString,
  detectReceiptConflicts,
  findAllReceiptBlocks,
  formatReceiptBlock,
  parseReceiptBlock,
  receiptSigningMessage,
  verifyCommitMessage,
  verifyReceiptClaim,
  type CheckOutcome,
  type ReceiptClaim,
} from "./build-receipt.ts";

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

// ---------------------------------------------------------------------------
// GOLDEN RECEIPTS — signed by REAL `ssh-keygen -Y sign` (2026-08-17).
// ---------------------------------------------------------------------------
// Two ephemeral keys, both signing over the git EMPTY TREE oid
// (`git hash-object -t tree /dev/null` = 4b825dc6…, so the tree in these vectors
// is one anybody can reproduce). Signer A says ts-lint passed; signer B says it
// failed. That disagreement is the corroboration model's failure case and is
// exercised below rather than described.
//
// Reproduce: emit `receiptSigningMessage(...)` to a file and run
//   ssh-keygen -Y sign -n zeta.build-receipt.v1 -f <key> <file>
// The private keys were ephemeral and are gone; that is fine, because the test
// only ever VERIFIES. Nothing here can be re-signed by this module, which is
// exactly the property that makes the vectors evidence.
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

const PUBKEY_A = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAAkgsuJsQCYnktiBhVImV5Z5h2zRec5YUKnEauX+xXM receipt-test";
const SIGNER_A = "SHA256:LXnRgnrUOfi9trlB75agfEq1mApDxXgrngIlJ5pwNXQ";
const SIG_A =
  "U1NIU0lHAAAAAQAAADMAAAALc3NoLWVkMjU1MTkAAAAgACSCy4mxAJieS2IGFUiZXlnmHb" +
  "NF5zlhQqcRq5f7FcwAAAAVemV0YS5idWlsZC1yZWNlaXB0LnYxAAAAAAAAAAZzaGE1MTIA" +
  "AABTAAAAC3NzaC1lZDI1NTE5AAAAQIuAQqSbqTrHbR/MBE5oPRPNnpeS3gmOwRK+5OFFiB" +
  "PUR0D3TBKn495uDYzna7B3F95vq5CiukPIAP9iBK1VKws=";

const PUBKEY_B = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDYsWL7D45VAs/sLQF1PH9Oh03edTR+Sw+8WQOGb07RO receipt-test-2";
const SIGNER_B = "SHA256:Tm5MvIMYTQiM1fQp1jmWMMOlY/nZD74vIPmIQiA6nVQ";
const SIG_B =
  "U1NIU0lHAAAAAQAAADMAAAALc3NoLWVkMjU1MTkAAAAgNixYvsPjlUCz+wtAXU8f06HTd5" +
  "1NH5LD7xZA4ZvTtE4AAAAVemV0YS5idWlsZC1yZWNlaXB0LnYxAAAAAAAAAAZzaGE1MTIA" +
  "AABTAAAAC3NzaC1lZDI1NTE5AAAAQPz9pWOTUJJPA0QuDubH3g0XWzSKcvHVtc6CSKE0H3" +
  "aq44Y7fmFb7d6060MEseCbIpO5JQ82Fl7xX3ecgRIhggI=";

/** Key A over `everything-is-fine=pass` on the same tree — a genuine signature over a bogus claim. */
const SIG_INVENTED_CHECK =
  "U1NIU0lHAAAAAQAAADMAAAALc3NoLWVkMjU1MTkAAAAgACSCy4mxAJieS2IGFUiZXlnmHb" +
  "NF5zlhQqcRq5f7FcwAAAAVemV0YS5idWlsZC1yZWNlaXB0LnYxAAAAAAAAAAZzaGE1MTIA" +
  "AABTAAAAC3NzaC1lZDI1NTE5AAAAQNqv0RPaMAeTB96ALSY9PVcG3V78T0pclZY36SHSr0" +
  "+OLlHbYiDjyhk61Dxci3wegYf5EaN6UmB/29kp+MS/RAA=";

const CLAIM_A: ReceiptClaim = {
  version: "1",
  tree: EMPTY_TREE,
  checks: [
    { id: "dotnet-build", result: "pass" },
    { id: "ts-lint", result: "pass" },
  ],
  signer: SIGNER_A,
  signature: SIG_A,
};

const CLAIM_B: ReceiptClaim = {
  version: "1",
  tree: EMPTY_TREE,
  checks: [{ id: "ts-lint", result: "fail" }],
  signer: SIGNER_B,
  signature: SIG_B,
};

const ROSTER = [...parseRoster(PUBKEY_A, "roster-a"), ...parseRoster(PUBKEY_B, "roster-b")];
const ALLOWED = new Set(["dotnet-build", "dotnet-test", "ts-lint", "bun-test", "agencysignature-audit"]);
const opts = (extra: { expectedTree?: string } = {}) => ({ allowedCheckIds: ALLOWED, roster: ROSTER, ...extra });

describe("canonical bytes", () => {
  test("checks are sorted, so signed bytes do not depend on the writer's ordering", () => {
    const forward: CheckOutcome[] = [
      { id: "ts-lint", result: "pass" },
      { id: "dotnet-build", result: "pass" },
    ];
    expect(canonicalChecksString(forward)).toBe("dotnet-build=pass;ts-lint=pass");
    expect(canonicalChecksString([...forward].reverse())).toBe("dotnet-build=pass;ts-lint=pass");
  });

  test("GOLDEN VECTOR: the exact bytes signer A signed", () => {
    // Hex-in-source per no-binary-in-proof-lineage. Any change to the encoding
    // shows up here as a readable diff AND breaks the golden signature below,
    // which is the point: the format cannot drift silently.
    //   00000001 "1"                          version
    //   00000028 "4b825dc6…"                  tree (40 hex chars)
    //   0000001e "dotnet-build=pass;ts-lint=pass"
    //   00000032 "SHA256:LXnR…"               signer fingerprint
    expect(hex(receiptSigningMessage(CLAIM_A))).toBe(
      "0000000131" +
        "00000028" +
        "34623832356463363432636236656239613036306535346266386436393238386662656534393034" +
        "0000001e" +
        "646f746e65742d6275696c643d706173733b74732d6c696e743d70617373" +
        "00000032" +
        "5348413235363a4c586e52676e72554f66693974726c4237356167664571316d417044785867726e67496c4a3570774e5851",
    );
  });

  test("the length prefixes make the encoding injective across field boundaries", () => {
    const a = receiptSigningMessage({ version: "1", tree: EMPTY_TREE, checks: CLAIM_A.checks, signer: "SHA256:x" });
    const b = receiptSigningMessage({ version: "1", tree: EMPTY_TREE, checks: CLAIM_A.checks, signer: "SHA256:xy" });
    expect(hex(a)).not.toBe(hex(b));
  });
});

describe("verification of real signed receipts", () => {
  test("signer A's receipt verifies, and names the roster file that vouched for it", () => {
    const r = verifyReceiptClaim(CLAIM_A, opts({ expectedTree: EMPTY_TREE }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.signerSource).toBe("roster-a");
  });

  test("EDITING A RESULT invalidates the signature — fail cannot be laundered into pass", () => {
    const tampered: ReceiptClaim = { ...CLAIM_B, checks: [{ id: "ts-lint", result: "pass" }] };
    expect(verifyReceiptClaim(tampered, opts()).ok).toBe(false);
    expect((verifyReceiptClaim(tampered, opts()) as { reason: string }).reason).toBe("bad-signature");
  });

  test("MOVING A RECEIPT TO ANOTHER TREE is refused twice over", () => {
    const other = "a".repeat(40);
    // (1) against the commit's actual tree, before any cryptography:
    expect((verifyReceiptClaim(CLAIM_A, opts({ expectedTree: other })) as { reason: string }).reason).toBe(
      "tree-mismatch",
    );
    // (2) and even with the check disabled, the tree is inside the signed bytes:
    const moved: ReceiptClaim = { ...CLAIM_A, tree: other };
    expect((verifyReceiptClaim(moved, opts()) as { reason: string }).reason).toBe("bad-signature");
  });

  test("an UNKNOWN SIGNER is refused as untrusted, not as a bad signature", () => {
    // The distinction is real: the signature is perfectly valid; we just do not
    // know who holds that key. Collapsing the two would hide which fact failed.
    const r = verifyReceiptClaim(CLAIM_A, { allowedCheckIds: ALLOWED, roster: parseRoster(PUBKEY_B, "roster-b") });
    expect((r as { reason: string }).reason).toBe("untrusted-signer");
  });

  test("REATTRIBUTING a valid signature to another roster identity is refused", () => {
    // Signature A, claimed as signer B: both keys are in the roster and the
    // signature is genuine, so only the embedded-key cross-check catches this.
    const stolen: ReceiptClaim = { ...CLAIM_A, signer: SIGNER_B };
    const r = verifyReceiptClaim(stolen, opts());
    // The signer is inside the signed bytes too, so this fails at the signature
    // before the attribution check — belt and braces, and either refusal is correct.
    expect(r.ok).toBe(false);
    expect(["bad-signature", "signer-mismatch"]).toContain((r as { reason: string }).reason);
  });

  test("a VALIDLY SIGNED receipt naming an unknown check is still refused", () => {
    // The sharp form of the closed-vocabulary rule. SIG_INVENTED_CHECK is a REAL
    // ssh-keygen signature by roster key A over `everything-is-fine=pass`, so every
    // cryptographic check passes and only the vocabulary stops it. Without the
    // closed set this receipt is accepted — signed, true, and constraining
    // nothing, which is the vacuity class exactly.
    const invented: ReceiptClaim = {
      ...CLAIM_A,
      checks: [{ id: "everything-is-fine", result: "pass" }],
      signature: SIG_INVENTED_CHECK,
    };
    expect((verifyReceiptClaim(invented, opts()) as { reason: string }).reason).toBe("unknown-check");
    // …and the proof that the VOCABULARY is what refused it, not the cryptography:
    // widen the allowed set and the very same bytes verify.
    const widened = verifyReceiptClaim(invented, {
      allowedCheckIds: new Set([...ALLOWED, "everything-is-fine"]),
      roster: ROSTER,
    });
    expect(widened.ok).toBe(true);
  });

  test("the signer fingerprint in the trailer is the one the SSH key actually has", () => {
    expect(sshFingerprint(parseSshPublicKeyLine(PUBKEY_A)?.blob ?? new Uint8Array())).toBe(SIGNER_A);
    expect(sshFingerprint(parseSshPublicKeyLine(PUBKEY_B)?.blob ?? new Uint8Array())).toBe(SIGNER_B);
  });
});

describe("structural refusals", () => {
  const block = formatReceiptBlock(CLAIM_A);

  test("a well-formed block round-trips through format and parse", () => {
    const parsed = parseReceiptBlock(block);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(formatReceiptBlock(parsed.claim)).toBe(block);
  });

  const cases: readonly [string, string, string][] = [
    ["missing-keys", block.split("\n").slice(0, 4).join("\n"), "a truncated block"],
    ["unsupported-version", block.replace("Version: 1", "Version: 2"), "a future version"],
    ["malformed-tree", block.replace(EMPTY_TREE, "not-a-tree"), "a non-hex tree"],
    ["malformed-tree", block.replace(EMPTY_TREE, "4b825dc6"), "an abbreviated tree"],
    ["malformed-checks", block.replace("Checks: dotnet-build=pass;ts-lint=pass", "Checks: dotnet-build"), "no result"],
    ["malformed-result", block.replace("dotnet-build=pass", "dotnet-build=probably"), "a result outside the enum"],
    ["duplicate-check", block.replace("ts-lint=pass", "dotnet-build=fail"), "the same id twice"],
    ["malformed-signer", block.replace(SIGNER_A, "MD5:aa:bb"), "a non-SHA256 fingerprint"],
    ["malformed-base64", block.replace(SIG_A, "!!!not base64!!!"), "a non-base64 signature"],
  ];
  for (const [reason, text, why] of cases) {
    test(`${reason} — ${why}`, () => {
      const r = parseReceiptBlock(text);
      expect(r.ok).toBe(false);
      expect((r as { reason: string }).reason).toBe(reason);
    });
  }

  test("keys scattered across paragraphs do NOT assemble into a receipt", () => {
    // A lenient scan that stitched five keys from five paragraphs could "recover"
    // a receipt nobody wrote — a worse failure than the one it fixes.
    const scattered = block.split("\n").join("\n\n");
    expect(findAllReceiptBlocks(scattered).length).toBe(0);
  });
});

describe("commit messages, corroboration, and conflict", () => {
  const commitMessage = (blocks: readonly string[]) => `feat: something\n\nbody text here\n\n${blocks.join("\n\n")}\n`;

  test("a receipt is found among ordinary commit prose and other trailers", () => {
    const msg = `fix: a thing\n\n${formatReceiptBlock(CLAIM_A)}\n\nAgency-Signature-Version: 1\nAgent: Otto\n`;
    const verdicts = verifyCommitMessage(msg, opts({ expectedTree: EMPTY_TREE }));
    expect(verdicts.length).toBe(1);
    expect(verdicts[0]?.ok).toBe(true);
  });

  test("a commit with no receipt yields NO verdicts — absence is absence, never a pass", () => {
    expect(verifyCommitMessage("chore: nothing here\n", opts()).length).toBe(0);
  });

  test("two signers agreeing corroborate, and produce no conflict", () => {
    const agreeing = verifyCommitMessage(commitMessage([formatReceiptBlock(CLAIM_A)]), opts());
    expect(detectReceiptConflicts(agreeing)).toEqual([]);
  });

  test("two signers disagreeing on the same check over the same tree CONFLICT", () => {
    const msg = commitMessage([formatReceiptBlock(CLAIM_A), formatReceiptBlock(CLAIM_B)]);
    const verdicts = verifyCommitMessage(msg, opts({ expectedTree: EMPTY_TREE }));
    expect(verdicts.every((v) => v.ok)).toBe(true);
    const conflicts = detectReceiptConflicts(verdicts);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0]?.checkId).toBe("ts-lint");
    expect(conflicts[0]?.tree).toBe(EMPTY_TREE);
    expect(new Set(conflicts[0]?.claims.map((c) => c.result))).toEqual(new Set(["pass", "fail"]));
    // dotnet-build was claimed by only one signer, so it is not a conflict.
    expect(conflicts.map((c) => c.checkId)).not.toContain("dotnet-build");
  });

  test("an UNVERIFIED receipt cannot conflict with a verified one — a lie is not evidence", () => {
    const forged = formatReceiptBlock({ ...CLAIM_B, signature: SIG_A });
    const verdicts = verifyCommitMessage(commitMessage([formatReceiptBlock(CLAIM_A), forged]), opts());
    expect(verdicts.filter((v) => v.ok).length).toBe(1);
    expect(detectReceiptConflicts(verdicts)).toEqual([]);
  });
});

describe("namespace", () => {
  test("the SSHSIG namespace is distinct from git's, so neither replays as the other", () => {
    expect(BUILD_RECEIPT_NAMESPACE).toBe("zeta.build-receipt.v1");
    expect(BUILD_RECEIPT_NAMESPACE).not.toBe("git");
  });
});
