import { createHash, sign } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  canonicalDeviceProposalIntent,
  decodeDelegatedDeviceProposalIssueBody,
  encodeDelegatedDeviceProposalIssueBody,
  verifyDelegatedDeviceProposal,
} from "./delegated-device-proposal";
import {
  fixture,
  FIXTURE_BASE_SHA as BASE_SHA,
  FIXTURE_NOW as NOW,
  FIXTURE_PATCH as PATCH,
  FIXTURE_REGISTRY_SEQUENCE,
  FIXTURE_ROOT_CREDENTIAL_ID as ROOT_CREDENTIAL_ID,
} from "./delegated-device-proposal-fixture";
import { loadProposalAuthorRegistry } from "./proposal-gated-commit";
import { toBase64url } from "./proposal-envelope";

/** Write a registry object to a real file and load it back through the production JSON loader. */
function loadRegistryFromDisk(registry: unknown): ReturnType<typeof loadProposalAuthorRegistry> {
  const path = join(mkdtempSync(join(tmpdir(), "zeta-registry-")), "proposal-author-registry.json");
  writeFileSync(path, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  return loadProposalAuthorRegistry(path);
}

describe("delegated browser device proposals", () => {
  test("DDP-1: a passkey-authorized device stages one bounded review branch", () => {
    const value = fixture();
    const result = verifyDelegatedDeviceProposal({ ...value, currentMainSha: BASE_SHA, now: NOW });

    expect(result).toMatchObject({
      ok: true,
      branch: "heartbeat/proposal-11111111-1111-4111-8111-111111111111",
      paths: ["docs/example.md"],
    });
  });

  test("DDP-2: the public issue carrier round-trips without carrying a GitHub credential", () => {
    const { submission } = fixture();
    const body = encodeDelegatedDeviceProposalIssueBody(submission);

    expect(body).toStartWith("<!-- zeta-delegated-device-proposal-v1 -->");
    expect(body).not.toContain("ghp_");
    expect(decodeDelegatedDeviceProposalIssueBody(body)).toEqual(submission);
  });

  test("DDP-3 FAULT INJECTION: unsigned issue spam cannot impersonate the delegated device", () => {
    const value = fixture();
    const submission = {
      ...value.submission,
      proposal: { ...value.submission.proposal, signature: toBase64url(Buffer.alloc(64)) },
    };
    const result = verifyDelegatedDeviceProposal({
      submission,
      registry: value.registry,
      currentMainSha: BASE_SHA,
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, code: "device-signature", retraction: { weight: -1 } });
  });

  test("DDP-4 FAULT INJECTION: changing the patch after signing is rejected", () => {
    const value = fixture();
    const result = verifyDelegatedDeviceProposal({
      submission: { ...value.submission, payload: `${PATCH}# injected` },
      registry: value.registry,
      currentMainSha: BASE_SHA,
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, code: "device-proposal", retraction: { weight: -1 } });
  });

  test("DDP-5 FAULT INJECTION: revoking the root passkey revokes its delegated device", () => {
    const value = fixture();
    const result = verifyDelegatedDeviceProposal({
      submission: value.submission,
      registry: {
        ...value.registry,
        revoked: { [ROOT_CREDENTIAL_ID]: { at: NOW.toISOString(), reason: "device lost" } },
      },
      currentMainSha: BASE_SHA,
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, code: "revoked-author", retraction: { weight: -1 } });
  });

  test("DDP-6 FAULT INJECTION: stale and replayed device proposals remain inert", () => {
    const value = fixture();
    const stale = verifyDelegatedDeviceProposal({
      ...value,
      currentMainSha: "b".repeat(40),
      now: NOW,
    });
    const replay = verifyDelegatedDeviceProposal({
      ...value,
      currentMainSha: BASE_SHA,
      consumedNonces: new Set([value.submission.proposal.nonce]),
      now: NOW,
    });

    expect(stale).toMatchObject({ ok: false, code: "device-stale-base" });
    expect(replay).toMatchObject({ ok: false, code: "device-replay" });
  });

  test("DDP-7 FAULT INJECTION: device authority cannot rewrite its verifier", () => {
    const value = fixture();
    const protectedPatch = PATCH.replaceAll("docs/example.md", "src/Core.TypeScript/planning/proposal-verifier.ts");
    const proposal = {
      ...value.submission.proposal,
      patchDigest: createHash("sha256").update(protectedPatch.trim()).digest("hex"),
    };
    const signature = sign("sha256", Buffer.from(canonicalDeviceProposalIntent(proposal), "utf8"), {
      key: value.devicePrivateKey,
      dsaEncoding: "ieee-p1363",
    });
    const result = verifyDelegatedDeviceProposal({
      submission: {
        ...value.submission,
        payload: protectedPatch,
        proposal: { ...proposal, signature: toBase64url(signature) },
      },
      registry: value.registry,
      currentMainSha: BASE_SHA,
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, code: "patch", generator: "maintainer-reviewed-pr" });
  });

  test("DDP-8 FAULT INJECTION: malformed carrier bytes are a typed refusal", () => {
    expect(decodeDelegatedDeviceProposalIssueBody("<!-- zeta-delegated-device-proposal-v1 -->\n\n***")).toMatchObject({
      ok: false,
      code: "device-carrier",
    });
  });

  test("DDP-9 FAULT INJECTION: a revoked browser device cannot spend an otherwise valid root delegation", () => {
    const value = fixture();
    const result = verifyDelegatedDeviceProposal({
      submission: value.submission,
      registry: {
        ...value.registry,
        revokedDevices: {
          [value.submission.proposal.deviceId]: { at: NOW.toISOString(), reason: "browser lost" },
        },
      },
      currentMainSha: BASE_SHA,
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, code: "device-key", retraction: { weight: -1 } });
  });

  test("DDP-10 FAULT INJECTION: device authority cannot rewrite future delegation verification", () => {
    const value = fixture();
    const protectedPatch = PATCH.replaceAll(
      "docs/example.md",
      "src/Core.TypeScript/planning/delegated-device-proposal.ts",
    );
    const proposal = {
      ...value.submission.proposal,
      patchDigest: createHash("sha256").update(protectedPatch.trim()).digest("hex"),
    };
    const signature = sign("sha256", Buffer.from(canonicalDeviceProposalIntent(proposal), "utf8"), {
      key: value.devicePrivateKey,
      dsaEncoding: "ieee-p1363",
    });
    const result = verifyDelegatedDeviceProposal({
      submission: {
        ...value.submission,
        payload: protectedPatch,
        proposal: { ...proposal, signature: toBase64url(signature) },
      },
      registry: value.registry,
      currentMainSha: BASE_SHA,
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, code: "patch", generator: "maintainer-reviewed-pr" });
  });
});

/**
 * The operator trap, pinned.
 *
 * `sequence` and `revoked`/`revokedDevices` look interchangeable from the outside — both are edits
 * to the same registry file, and "bump the sequence" is the reflex an operator reaches for in an
 * emergency. On the v2 proposal path that reflex is correct (`!==` invalidates every outstanding
 * proposal). On the device-delegation path it does **nothing**, because a delegation is valid
 * `until-authority-revoked` and the check is `>`, not `!==`.
 *
 * These three tests exist so that asymmetry is documented by something that fails when the code
 * changes, rather than by a comment that can quietly go stale. DDP-11 is the trap itself; DDP-12
 * proves the `>` clause is live (otherwise DDP-11 would pass for the wrong reason — a check that
 * accepts everything); DDP-13 names the levers that do work, against the same bumped registry.
 */
describe("registry sequence is not a revocation lever", () => {
  test("DDP-11: bumping the registry sequence does NOT revoke a device delegation", () => {
    const value = fixture();
    const result = verifyDelegatedDeviceProposal({
      submission: value.submission,
      registry: { ...value.registry, sequence: FIXTURE_REGISTRY_SEQUENCE + 98 },
      currentMainSha: BASE_SHA,
      now: NOW,
    });

    // Still ok. An operator who "revoked" by bumping the sequence has revoked nothing.
    expect(result).toMatchObject({ ok: true, paths: ["docs/example.md"] });
  });

  test("DDP-12 FAULT INJECTION: a delegation bound to a NEWER sequence than main is refused", () => {
    const value = fixture();
    const result = verifyDelegatedDeviceProposal({
      submission: value.submission,
      registry: { ...value.registry, sequence: FIXTURE_REGISTRY_SEQUENCE - 1 },
      currentMainSha: BASE_SHA,
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, code: "device-delegation", retraction: { weight: -1 } });
  });

  test("DDP-13: the levers that DO revoke still work at the bumped sequence", () => {
    const value = fixture();
    const bumped = { ...value.registry, sequence: FIXTURE_REGISTRY_SEQUENCE + 98 };

    const byAuthority = verifyDelegatedDeviceProposal({
      submission: value.submission,
      registry: { ...bumped, revoked: { [ROOT_CREDENTIAL_ID]: { at: NOW.toISOString(), reason: "root lost" } } },
      currentMainSha: BASE_SHA,
      now: NOW,
    });
    const byDevice = verifyDelegatedDeviceProposal({
      submission: value.submission,
      registry: {
        ...bumped,
        revokedDevices: {
          [value.submission.proposal.deviceId]: { at: NOW.toISOString(), reason: "browser lost" },
        },
      },
      currentMainSha: BASE_SHA,
      now: NOW,
    });

    expect(byAuthority).toMatchObject({ ok: false, code: "revoked-author" });
    expect(byDevice).toMatchObject({ ok: false, code: "device-key" });
  });
});

/**
 * `revokedDevices` end-to-end from registry FILE BYTES.
 *
 * DDP-9 exercises device revocation against an in-memory registry object, which skips the loader
 * entirely. The registry on protected `main` carries `"revoked": {}` and **no `revokedDevices` key
 * at all**, so the JSON path for that field — parse, `validRevocations`, propagate through
 * `validateProposalAuthorRegistry`'s returned value — has never run against real bytes. Its first
 * use would otherwise be its first exercise, during an emergency.
 *
 * DDP-15 is the control that keeps DDP-14 honest: a registry that failed to *load* would also
 * produce a refusal, so the same file without `revokedDevices` must verify `ok: true`.
 */
describe("device revocation loaded from a registry file", () => {
  test("DDP-14 FAULT INJECTION: a revokedDevices entry read from disk refuses the proposal", () => {
    const value = fixture();
    const loaded = loadRegistryFromDisk({
      ...value.registry,
      revokedDevices: {
        [value.submission.proposal.deviceId]: { at: NOW.toISOString(), reason: "audit DDP-14" },
      },
    });
    expect(loaded.ok).toBeTrue();
    if (!loaded.ok) throw new Error("registry fixture failed to load");
    expect(loaded.value.revokedDevices).toBeDefined();

    const result = verifyDelegatedDeviceProposal({
      submission: value.submission,
      registry: loaded.value,
      currentMainSha: BASE_SHA,
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, code: "device-key", retraction: { weight: -1 } });
  });

  test("DDP-15 CONTROL: the same file without revokedDevices verifies, so DDP-14 measures revocation", () => {
    const value = fixture();
    const loaded = loadRegistryFromDisk(value.registry);
    expect(loaded.ok).toBeTrue();
    if (!loaded.ok) throw new Error("registry fixture failed to load");
    expect(loaded.value.revokedDevices).toBeUndefined();

    const result = verifyDelegatedDeviceProposal({
      submission: value.submission,
      registry: loaded.value,
      currentMainSha: BASE_SHA,
      now: NOW,
    });

    expect(result).toMatchObject({ ok: true, paths: ["docs/example.md"] });
  });

  test("DDP-16 FAULT INJECTION: a malformed revokedDevices entry fails the registry load, not silently", () => {
    const value = fixture();
    const loaded = loadRegistryFromDisk({
      ...value.registry,
      revokedDevices: { [value.submission.proposal.deviceId]: { at: "not-a-timestamp" } },
    });

    expect(loaded).toMatchObject({ ok: false, code: "author-registry", generator: "loadProposalAuthorRegistry" });
  });
});
