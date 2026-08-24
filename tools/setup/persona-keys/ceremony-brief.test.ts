// ceremony-brief.ts falsifiers — and the EVIDENCE that the prompts this replaced could not
// carry a decision. No real Touch ID, no `sudo`, no network, no key material.
// Run: bun test ceremony-brief.test.ts   (from tools/setup/persona-keys)
//
// The first block is the load-bearing one. A design nobody can falsify is a design nobody
// looked at, so the claim "the old prompts were unevaluable" is not asserted in prose here —
// it is EXECUTED, by constructing the two materially different operations and showing the
// operator-facing strings are byte-identical.
import { test, expect } from "bun:test";
import {
  assertGatedCeremony,
  ceremonyPromptLine,
  CeremonyBriefError,
  realRequester,
  renderCeremonyBrief,
  resolveRequester,
  type CeremonyBrief,
} from "./ceremony-brief.ts";
import {
  ALL_OPERATIONS,
  ceremonyRequirementFor,
} from "../../../src/Core.TypeScript/federated-identity/ceremony-gate.ts";

// ── THE DEFECT, EXECUTED ─────────────────────────────────────────────────────────────────
//
// These two literals are the prompts `main` produced at 3ea8a044b, transcribed from
// `revoke.ts:142` and `publish.ts:213` as they stood before this change. They are pinned as
// constants because the claim they support is historical: it is about what an operator was
// shown, and it must stay checkable after the source lines are gone.

/** `revoke.ts:142` on main@3ea8a044b — a BARE CONSTANT. It interpolated nothing. */
const OLD_REVOKE_PROMPT = (_cert: string, _reason: string): string => "revoke SSH device cert (KRL)";

/** `publish.ts:213` on main@3ea8a044b — interpolated the operator-supplied TITLE only. */
const OLD_PUBLISH_PROMPT = (title: string, _fingerprint: string): string => `Publish ${title} to GitHub`;

test("BEFORE: two materially different REVOCATIONS produced byte-identical prompts", () => {
  // Retiring my own laptop.
  const benign = OLD_REVOKE_PROMPT("/config/zeta/machine/mymac-cert.pub", "decommissioned");
  // Revoking a cert I believe an attacker is holding — a different act, different urgency,
  // different consequence for the fleet.
  const urgent = OLD_REVOKE_PROMPT("/config/zeta/machine/build-runner-cert.pub", "key-compromise");

  expect(benign).toBe(urgent);
  // And the prompt named NONE of the things that distinguish them, though all were in scope.
  expect(benign).not.toContain("mymac");
  expect(benign).not.toContain("key-compromise");
  // There is no finger-press that tells these apart, so the gate could not have been carrying
  // the decision it was claimed to carry.
});

test("BEFORE: publishing two DIFFERENT keys under one title produced byte-identical prompts", () => {
  const mine = OLD_PUBLISH_PROMPT("zeta-aaron-mymac", "SHA256:AAAAmine");
  const other = OLD_PUBLISH_PROMPT("zeta-aaron-mymac", "SHA256:ZZZZsomeoneelses");
  expect(mine).toBe(other);
  // The fingerprint was computed THREE LINES ABOVE the gate and withheld from it.
  expect(mine).not.toContain("SHA256");
});

const revoke = (cert: string, reason: string): CeremonyBrief => ({
  operation: "revoke-device-cert-into-krl",
  summary: "Revoke an SSH device certificate",
  subjects: [
    { label: "certificate", value: cert },
    { label: "signing CA", value: "/config/zeta/ca/aaron.pub" },
    { label: "KRL", value: "/repo/keys/aaron.krl" },
    { label: "reason", value: reason },
  ],
  ifDeclined: "the KRL is not written; the certificate stays VALID.",
});

test("AFTER: the same two revocations are now distinguishable, and name what differs", () => {
  const benign = ceremonyPromptLine(revoke("/config/zeta/machine/mymac-cert.pub", "decommissioned"));
  const urgent = ceremonyPromptLine(revoke("/config/zeta/machine/build-runner-cert.pub", "key-compromise"));

  expect(benign).not.toBe(urgent);
  expect(benign).toContain("mymac-cert.pub");
  expect(benign).toContain("decommissioned");
  expect(urgent).toContain("key-compromise");
});

// ── ONE OBJECT, NOT TWO DERIVATIONS ─────────────────────────────────────────────────────

test("the block and the one-line prompt cannot disagree — both are functions of ONE brief", () => {
  const b = revoke("/config/zeta/machine/mymac-cert.pub", "decommissioned");
  const line = ceremonyPromptLine(b);
  const block = renderCeremonyBrief(b);
  // Every value in the derived line is present in the derived block. Neither is authored
  // beside the other, so a call site cannot show the operator one act and perform another.
  for (const s of b.subjects) {
    expect(line).toContain(s.value);
    expect(block).toContain(s.value);
  }
  expect(block).toContain(b.summary);
  expect(line).toContain(b.summary);
});

test("changing the brief changes BOTH renderings — no stale second copy survives", () => {
  const a = revoke("/a.pub", "r1");
  const b = revoke("/b.pub", "r2");
  expect(ceremonyPromptLine(a)).not.toBe(ceremonyPromptLine(b));
  expect(renderCeremonyBrief(a)).not.toBe(renderCeremonyBrief(b));
});

// ── AN UNEVALUABLE BRIEF IS REFUSED AT THE CALL SITE, NOT SHOWN TO A HUMAN ──────────────

test("a brief with NO subjects is refused — that is the defect, typed", () => {
  const naked: CeremonyBrief = {
    operation: "revoke-device-cert-into-krl",
    summary: "Revoke an SSH device certificate",
    subjects: [],
    ifDeclined: "nothing happens",
  };
  expect(() => ceremonyPromptLine(naked)).toThrow(CeremonyBriefError);
  expect(() => renderCeremonyBrief(naked)).toThrow(CeremonyBriefError);
});

test("a brief that does not say what declining does is refused", () => {
  const b = { ...revoke("/a.pub", "r"), ifDeclined: "   " };
  expect(() => ceremonyPromptLine(b)).toThrow(/declines/);
});

test("an empty subject value is refused — a blank field is worse than an absent one", () => {
  const b = revoke("", "r");
  expect(() => ceremonyPromptLine(b)).toThrow(/certificate/);
});

// ── FEWER PROMPTS: THE GATE REFUSES TO FIRE FOR ROUTINE WORK ────────────────────────────

test("assertGatedCeremony THROWS for every operation the closed set calls unattended", () => {
  const unattended = ALL_OPERATIONS.filter((op) => ceremonyRequirementFor(op).requirement === "unattended");
  expect(unattended.length).toBeGreaterThan(0); // control: the filter is not vacuous
  for (const op of unattended) {
    expect(() => assertGatedCeremony(op)).toThrow(CeremonyBriefError);
  }
});

test("assertGatedCeremony permits every operation the closed set calls a ceremony", () => {
  const gated = ALL_OPERATIONS.filter((op) => ceremonyRequirementFor(op).requirement === "biometric-ceremony");
  expect(gated.length).toBeGreaterThan(0); // control
  for (const op of gated) {
    expect(() => assertGatedCeremony(op)).not.toThrow();
  }
});

test("the two persona-keys operations added to the closed set are classified, not floating", () => {
  for (const op of ["publish-own-public-key-to-github", "revoke-device-cert-into-krl"] as const) {
    expect(ALL_OPERATIONS).toContain(op);
    const c = ceremonyRequirementFor(op);
    expect(c.requirement).toBe("biometric-ceremony");
    expect(c.reason.length).toBeGreaterThan(40); // a gate without a reason is a gate nobody trusts
  }
});

// ── THE MISMATCH IS SHOWN TO THE OPERATOR, NOT SWALLOWED ────────────────────────────────

test("a prompt raised for an UNATTENDED operation says so, loudly, on the prompt itself", () => {
  const leafRotation: CeremonyBrief = {
    operation: "rotate-leaf-signing-key", // classified `unattended` by ceremony-gate.ts
    summary: "Rotate this host's keys on the overlap window",
    subjects: [{ label: "host", value: "mymac" }],
    ifDeclined: "nothing is swapped; the keys in use stay in use.",
  };
  const block = renderCeremonyBrief(leafRotation);
  expect(block).toContain("NOT GATED");
  expect(block).toContain("MISMATCH");
  // It quotes ceremony-gate.ts's OWN recorded reason rather than restating one here.
  expect(block).toContain(ceremonyRequirementFor("rotate-leaf-signing-key").reason);
});

test("a genuinely gated operation shows the policy's own reason, not a restatement", () => {
  const block = renderCeremonyBrief({
    operation: "generate-node-root-key",
    summary: "Create a NEW SSH certificate-authority keypair",
    subjects: [{ label: "CA name", value: "aaron" }],
    ifDeclined: "no keypair is generated and no file is written.",
  });
  expect(block).toContain("WHY GATED");
  expect(block).not.toContain("MISMATCH");
  expect(block).toContain(ceremonyRequirementFor("generate-node-root-key").reason);
});

// ── THE FOUR QUESTIONS AN OPERATOR ACTUALLY ASKS ────────────────────────────────────────

test("the block answers: what, on what, who asked, what if I decline", () => {
  const block = renderCeremonyBrief({
    ...revoke("/config/zeta/machine/mymac-cert.pub", "decommissioned"),
    requestedBy: { command: "revoke-cli.ts --ca aaron --confirm", agent: "nazar" },
  });
  expect(block).toContain("OPERATION");
  expect(block).toContain("ON ");
  expect(block).toContain("REQUESTED");
  expect(block).toContain("revoke-cli.ts --ca aaron --confirm");
  expect(block).toContain("on behalf of agent: nazar");
  expect(block).toContain("DECLINE");
  expect(block).toContain("the certificate stays VALID");
});

test("an unresolved requester renders as unresolved — never as a guess", () => {
  const block = renderCeremonyBrief(revoke("/a.pub", "r"));
  expect(block).toContain("not resolved");
});

// ── WHO ASKED IS READ OFF THE PROCESS, NOT DECLARED BY THE CALLER ───────────────────────

test("resolveRequester renders the command an operator would recognise having run", () => {
  const r = resolveRequester({
    argv: ["/opt/homebrew/bin/bun", "/repo/tools/setup/persona-keys/rotate-cli.ts", "--user", "aaron", "--confirm"],
    env: {},
  });
  expect(r.command).toBe("rotate-cli.ts --user aaron --confirm");
  expect(r.agent).toBeUndefined(); // absent env ⇒ absent field, never an invented one
});

test("resolveRequester surfaces the agent when the environment declares one", () => {
  const r = resolveRequester({ argv: ["bun", "publish-cli.ts"], env: { ZETA_AGENT: "iris" } });
  expect(r.agent).toBe("iris");
});

test("resolveRequester is total on a degenerate argv", () => {
  expect(resolveRequester({ argv: [], env: {} }).command).toBe("(unknown command)");
});

test("realRequester touches the real process and still returns a well-formed record", () => {
  const r = realRequester();
  expect(typeof r.command).toBe("string");
  expect(r.command.length).toBeGreaterThan(0);
});

// ── NEVER CARRIES A SECRET ──────────────────────────────────────────────────────────────

test("the renderers are pure text over the brief — they read no file and no key", () => {
  // The module imports nothing that can read a key: its only import is the classifier.
  // This test pins the observable half — a brief renders identically twice, so nothing
  // ambient (clock, filesystem, process state) leaks into the operator-facing text.
  const b = revoke("/a.pub", "r");
  expect(renderCeremonyBrief(b)).toBe(renderCeremonyBrief(b));
  expect(ceremonyPromptLine(b)).toBe(ceremonyPromptLine(b));
});
