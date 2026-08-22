import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AUTOMATIC_VERIFICATION_PATH,
  canQueueGeneratedVerification,
  canQueueSuppliedProposal,
  createAutomaticVerificationPatch,
  queueHarmlessVerification,
} from "./verificationPatch";

const authorizedEmptyTextarea = {
  capability: {
    capability: "device-capability",
    credentialId: "cred-1",
    authorRegistrySequence: 4,
    expiresAt: "2026-08-17T00:00:00.000Z",
  },
  registrySequence: 4,
  baseSha: "a".repeat(40),
  payload: "",
};

describe("automatic Pages verification patch", () => {
  const baseSha = "a".repeat(40);

  it("emits one bounded new-file unified patch tied to the immutable base", () => {
    const patch = createAutomaticVerificationPatch(baseSha);
    expect(patch).toContain(`diff --git a/${AUTOMATIC_VERIFICATION_PATH} b/${AUTOMATIC_VERIFICATION_PATH}`);
    expect(patch).toContain(`Immutable base: \`${baseSha}\``);
    expect(patch).toContain("Direct writes to `main`: prohibited.");
    expect(patch.length).toBeLessThan(24_000);
  });

  it("conforms to Git's real patch parser, including the terminal newline", () => {
    const directory = mkdtempSync(join(tmpdir(), "zeta-pages-patch-"));
    try {
      execFileSync("git", ["init", "--quiet", directory]);
      const patchPath = join(directory, "verification.patch");
      writeFileSync(patchPath, createAutomaticVerificationPatch(baseSha), "utf8");
      expect(() => execFileSync("git", ["-C", directory, "apply", "--check", "--whitespace=error", patchPath])).not.toThrow();
      const truncated = readFileSync(patchPath, "utf8").trimEnd();
      writeFileSync(patchPath, truncated, "utf8");
      expect(() => execFileSync("git", ["-C", directory, "apply", "--check", "--whitespace=error", patchPath])).toThrow();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("FAULT INJECTION: refuses a non-immutable base", () => {
    expect(() => createAutomaticVerificationPatch("not-a-commit")).toThrow("40-character immutable base SHA");
  });
});

describe("queue harmless verification after authorize with an empty textarea", () => {
  it("enables the generated button and keeps the supplied-proposal button disabled", () => {
    expect(canQueueGeneratedVerification(authorizedEmptyTextarea)).toBe(true);
    expect(canQueueSuppliedProposal(authorizedEmptyTextarea)).toBe(false);
  });

  it("keeps the payload.trim() gate on the supplied-proposal path only", () => {
    expect(canQueueSuppliedProposal({ ...authorizedEmptyTextarea, payload: "   " })).toBe(false);
    expect(canQueueSuppliedProposal({ ...authorizedEmptyTextarea, payload: "diff --git a/docs/x.md b/docs/x.md\n" })).toBe(
      true,
    );
    expect(canQueueGeneratedVerification({ ...authorizedEmptyTextarea, payload: "   " })).toBe(true);
  });

  it("clicking queue harmless verification generates the bounded patch and submits it", async () => {
    let submitted: string | undefined;
    const generated = await queueHarmlessVerification({
      baseSha: authorizedEmptyTextarea.baseSha,
      submit: (payload) => {
        submitted = payload;
      },
    });
    expect(submitted).toBe(generated);
    expect(generated).toContain(`diff --git a/${AUTOMATIC_VERIFICATION_PATH} b/${AUTOMATIC_VERIFICATION_PATH}`);
    expect(generated).toContain(`Immutable base: \`${authorizedEmptyTextarea.baseSha}\``);
    expect(canQueueSuppliedProposal({ ...authorizedEmptyTextarea, payload: generated })).toBe(true);
  });

  it("FAULT INJECTION: missing capability, registry sequence, or base SHA still blocks generated queue", () => {
    expect(canQueueGeneratedVerification({ ...authorizedEmptyTextarea, capability: null })).toBe(false);
    expect(canQueueGeneratedVerification({ ...authorizedEmptyTextarea, registrySequence: null })).toBe(false);
    expect(canQueueGeneratedVerification({ ...authorizedEmptyTextarea, baseSha: "not-a-commit" })).toBe(false);
  });

  it("wires the panel buttons to the split gates instead of a shared payload-gated enabled flag", () => {
    const panelSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../components/PasskeyProposalPanel.tsx"), "utf8");
    expect(panelSource).toContain("canQueueGeneratedVerification");
    expect(panelSource).toContain("canQueueSuppliedProposal");
    expect(panelSource).toContain("queueHarmlessVerification");
    expect(panelSource).toMatch(/disabled=\{!canGenerate/);
    expect(panelSource).toMatch(/disabled=\{!canSupply/);
    expect(panelSource).not.toMatch(/const enabled = /);
    expect(panelSource).not.toMatch(/payload\.trim\(\)\.length > 0/);
  });
});
