// src/Core.TypeScript/zflash/injection-rail.test.ts
//
// 081KTWFYC9108QG0R001C8RDPK — constitutional rail + workload identity, pure-core tests.
//
// No ISO, no QEMU, no filesystem, no hardware. Everything under test is a
// total function from a value to a value or a typed refusal, so the whole
// policy replays byte-identically (§7 DST).
//
// Run: bun test src/Core.TypeScript/zflash/injection-rail.test.ts

import { describe, expect, test } from "bun:test";
import {
  deriveNodeWorkloadSpiffeId,
  describeEspWriteVerdict,
  ESP_DESTINATION_CONTENT_CLASS,
  ESP_RAIL_EXCEPTIONS,
  evaluateEspWrite,
  PENDING_CLASSIFICATIONS,
  evaluateRail,
  planWorkloadIdentityFlashInjection,
  railFindingsForEspWrites,
  RAIL_DIVERGENCES,
  WORKLOAD_IDENTITY_ARTIFACT_CONTENT_CLASS,
  WORKLOAD_IDENTITY_CUSTODY_DECISIONS,
  type EspDestination,
} from "./injection-rail.ts";
import { planFileBackedZflashImage } from "./lib.ts";
import { runFileBackedZflashCli } from "./file-backed.ts";
import { parseSpiffe } from "../identity/actor-ref.ts";

describe("the rail is exhaustive over the destinations lib.ts can actually plan", () => {
  // The `satisfies` clause enforces this at compile time. This test enforces
  // the other direction at runtime: that the classification has no entries for
  // destinations that do not exist, and that the destinations the PLANNER
  // emits are all classified. A compile-time-only guard would pass against a
  // hand-maintained union that had drifted from the planner.
  test("every destination the planner emits carries a content class", () => {
    const planned = planFileBackedZflashImage({
      isoPath: "/tmp/installer.iso",
      outputImagePath: "/tmp/out.img",
      espOffsetBytes: 141_312,
      authorizedKeysContent: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExampleKeyMaterialHere operator@zeta",
      hostname: "node-a",
      credentialBlobPath: "/tmp/zeta-creds.enc",
      wifiCredentials: { ssid: "zeta-net", password: "correct-horse" },
      firstbootRole: {
        kind: "joiner",
        serverUrl: "https://control-plane.local:6443",
        tokenEspPath: "/zeta-join-token",
      },
      joinTokenSourcePath: "/tmp/node-token",
      bindUefiKeyfileMarker: true,
      qemuCredsPassphrase: "qemu-test-secret",
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const emitted = planned.value.espWrites.map((write) => write.destination);
    // All EIGHT destinations exercised, so the classification is total over what ships.
    // This read six when the module was written; the union grew to eight while the branch
    // sat, and the number is corrected here rather than left as a count that used to be
    // true — a stale total is the exact shape of vacuity this test exists to prevent.
    expect(new Set(emitted).size).toBe(8);
    for (const destination of emitted) {
      expect(ESP_DESTINATION_CONTENT_CLASS[destination]).toBeDefined();
    }
  });

  test("the classification names no destination the planner cannot produce", () => {
    const classified = Object.keys(ESP_DESTINATION_CONTENT_CLASS).sort();
    expect(classified).toEqual([
      "/zeta-authorized-keys.pub",
      "/zeta-bind-uefi-keyfile",
      "/zeta-creds.enc",
      "/zeta-firstboot.conf",
      "/zeta-hostname.txt",
      "/zeta-join-token",
      "/zeta-qemu-creds-passphrase",
      "/zeta-wifi-credentials.json",
    ]);
  });
});

describe("evaluateRail — the class decides, not the filename", () => {
  test("secret material is refused on the USB ESP", () => {
    const verdict = evaluateRail("secret-material", "usb-esp");
    expect(verdict.permitted).toBe(false);
    if (verdict.permitted !== false) return;
    expect(verdict.why).toContain("unencrypted USB ESP");
  });

  test("secret material is permitted at the operator-typed console", () => {
    expect(evaluateRail("secret-material", "cluster-console-operator-typed").permitted).toBe("by-class");
  });

  test("secret material is permitted into post-install secrets management", () => {
    expect(evaluateRail("secret-material", "post-install-secrets-manager").permitted).toBe("by-class");
  });

  test("public identifiers ride the ESP", () => {
    expect(evaluateRail("public-identifier", "usb-esp").permitted).toBe("by-class");
  });

  test("an encrypted envelope rides the ESP — the class is DECLARED, not measured", () => {
    expect(evaluateRail("encrypted-envelope", "usb-esp").permitted).toBe("by-class");
  });
});

describe("evaluateEspWrite — per-destination verdicts", () => {
  test("the three public identifiers pass by class", () => {
    for (const destination of [
      "/zeta-authorized-keys.pub",
      "/zeta-hostname.txt",
      "/zeta-firstboot.conf",
    ] satisfies EspDestination[]) {
      expect(evaluateEspWrite(destination).permitted).toBe("by-class");
    }
  });

  test("the credential blob passes as an encrypted envelope, not as a public identifier", () => {
    const verdict = evaluateEspWrite("/zeta-creds.enc");
    expect(verdict.permitted).toBe("by-class");
    if (verdict.permitted !== "by-class") return;
    expect(verdict.contentClass).toBe("encrypted-envelope");
  });

  test("the join token passes ONLY through its recorded exception", () => {
    const verdict = evaluateEspWrite("/zeta-join-token");
    expect(verdict.permitted).toBe("by-recorded-exception");
    if (verdict.permitted !== "by-recorded-exception") return;
    expect(verdict.exception.neverImplicit).toBe(true);
    expect(verdict.exception.recordedIn).toContain("INJECTION-POINTS.md");
  });

  test("the wifi PSK is REFUSED — no exception is on file for it", () => {
    // This is the finding this module exists to surface. If someone later adds
    // /zeta-wifi-credentials.json to ESP_RAIL_EXCEPTIONS, this test fails and
    // the addition has to be argued for rather than slipped in.
    const verdict = evaluateEspWrite("/zeta-wifi-credentials.json");
    expect(verdict.permitted).toBe(false);
    if (verdict.permitted !== false) return;
    expect(verdict.contentClass).toBe("secret-material");
    expect(ESP_RAIL_EXCEPTIONS).not.toHaveProperty("/zeta-wifi-credentials.json");
  });

  test("the divergence roster records the wifi path and calls it unresolved", () => {
    const divergence = RAIL_DIVERGENCES["/zeta-wifi-credentials.json"];
    expect(divergence.disposition).toContain("UNRESOLVED");
    expect(divergence.catalogSays).toContain("NEVER on USB ESP");
  });
});

describe("describeEspWriteVerdict / railFindingsForEspWrites — what a human sees", () => {
  test("a refusal leads with REFUSED", () => {
    expect(describeEspWriteVerdict("/zeta-wifi-credentials.json")).toContain("REFUSED BY THE RAIL");
  });

  test("an exception still says the words 'SECRET MATERIAL IN PLAINTEXT'", () => {
    // A recorded exception is not a clean bill of health; the disclosure has to
    // read as loudly as the refusal or the roster becomes a laundering step.
    expect(describeEspWriteVerdict("/zeta-join-token")).toContain("SECRET MATERIAL IN PLAINTEXT");
  });

  test("findings cover exactly the secret-class and unclassified writes, and nothing else", () => {
    const findings = railFindingsForEspWrites([
      "/zeta-authorized-keys.pub",
      "/zeta-hostname.txt",
      "/zeta-creds.enc",
      "/zeta-firstboot.conf",
      "/zeta-bind-uefi-keyfile",
      "/zeta-wifi-credentials.json",
      "/zeta-join-token",
      "/zeta-qemu-creds-passphrase",
    ]);
    expect(findings).toHaveLength(3);
    expect(findings.join("\n")).toContain("/zeta-wifi-credentials.json");
    expect(findings.join("\n")).toContain("/zeta-join-token");
    expect(findings.join("\n")).toContain("/zeta-qemu-creds-passphrase");
    expect(findings.join("\n")).not.toContain("/zeta-hostname.txt");
    // The marker is a public identifier, so it stays out of the findings.
    expect(findings.join("\n")).not.toContain("/zeta-bind-uefi-keyfile");
  });

  test("a plan with no secrets produces no findings", () => {
    expect(railFindingsForEspWrites(["/zeta-hostname.txt", "/zeta-firstboot.conf"])).toEqual([]);
  });
});

describe("an UNDECIDED content class — the state that exists so nobody has to guess", () => {
  // 081KTWFYC9108QG0R001C8RDPK's review gate names Nazar (ops) + Mateo (research) and says
  // the surface is reviewed BEFORE implementation. `/zeta-qemu-creds-passphrase` arrived on
  // `main` while this module sat unmerged, and classifying it is a security judgement — the
  // passphrase for an on-medium encrypted envelope, shipping on that same medium. These
  // falsifiers pin that the module REFUSES rather than decides, and that the refusal is
  // loud, so "undecided" can never quietly read as "reviewed and fine".

  test("its entry in the classification map is the sentinel, not a class", () => {
    expect(ESP_DESTINATION_CONTENT_CLASS["/zeta-qemu-creds-passphrase"]).toBe("pending-security-review");
  });

  test("the write is REFUSED, and the refusal names the reviewers and the question", () => {
    const verdict = evaluateEspWrite("/zeta-qemu-creds-passphrase");
    expect(verdict.permitted).toBe(false);
    if (verdict.permitted !== false) return;
    expect(verdict.contentClass).toBe("pending-security-review");
    expect(verdict.why).toContain("UNDECIDED");
    expect(verdict.why).toContain("Nazar");
    expect(verdict.why).toContain("Mateo");
  });

  test("the human-facing line says the class was never reviewed, not merely that it was refused", () => {
    // The two refusals must be distinguishable at a glance: a decided refusal is a policy
    // outcome, an undecided one is an open item. Collapsing them would make a missing
    // review look like a completed one.
    const undecided = describeEspWriteVerdict("/zeta-qemu-creds-passphrase");
    expect(undecided).toContain("CONTENT CLASS NOT YET REVIEWED");
    expect(describeEspWriteVerdict("/zeta-wifi-credentials.json")).not.toContain("NOT YET REVIEWED");
  });

  test("a recorded exception cannot rescue an unclassified destination", () => {
    // The ordering guard in `evaluateEspWrite`. An exception is a decision about a KNOWN
    // class; letting one apply here would let the review gate be satisfied by a roster
    // entry the named reviewers never saw.
    expect(ESP_RAIL_EXCEPTIONS).not.toHaveProperty("/zeta-qemu-creds-passphrase");
    expect(evaluateEspWrite("/zeta-qemu-creds-passphrase").permitted).toBe(false);
  });

  test("the pending roster states the question, the options and who decides — and stays undecided", () => {
    const pending = PENDING_CLASSIFICATIONS["/zeta-qemu-creds-passphrase"];
    expect(pending.decided).toBe(false);
    expect(pending.whoDecides).toContain("081KTWFYC9108QG0R001C8RDPK");
    // An option list of one is a recommendation wearing a roster's clothes.
    expect(pending.options.length).toBeGreaterThan(1);
    for (const option of pending.options) {
      expect(option.choice.length).toBeGreaterThan(0);
      expect(option.consequence.length).toBeGreaterThan(0);
    }
  });

  test("EVERY sentinel in the map has a roster entry — an invisible pending item is the vacuity class", () => {
    const sentinels = Object.entries(ESP_DESTINATION_CONTENT_CLASS)
      .filter(([, contentClass]) => contentClass === "pending-security-review")
      .map(([destination]) => destination)
      .sort();
    expect(sentinels).toEqual(Object.keys(PENDING_CLASSIFICATIONS).sort());
    // And the roster is non-empty, so the equality above is not two empty sets agreeing.
    expect(sentinels.length).toBeGreaterThan(0);
  });

  test("the UEFI bind marker is classified by its bytes, and they are a literal '1'", () => {
    // The other new destination. This one is not a judgement call: `lib.ts` writes the
    // string "1\n" and nothing else, so the test reads the planner rather than trusting
    // the comment beside the classification.
    const planned = planFileBackedZflashImage({
      isoPath: "/tmp/installer.iso",
      outputImagePath: "/tmp/out.img",
      espOffsetBytes: 141_312,
      hostname: "node-a",
      bindUefiKeyfileMarker: true,
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const marker = planned.value.espWrites.find((write) => write.destination === "/zeta-bind-uefi-keyfile");
    expect(marker?.content).toBe("1\n");
    expect(ESP_DESTINATION_CONTENT_CLASS["/zeta-bind-uefi-keyfile"]).toBe("public-identifier");
    expect(evaluateEspWrite("/zeta-bind-uefi-keyfile").permitted).toBe("by-class");
  });
});

describe("the flash path surfaces an unclassified destination to the operator", () => {
  const mockExecutor = {
    runCommand: () => ({ exitCode: 0, stderr: "", stdout: "" }),
    writeFile: () => {},
  };

  test("baking the QEMU passphrase warns, and the warning does not echo the passphrase", () => {
    const warnings: string[] = [];
    const result = runFileBackedZflashCli(
      {
        espOffsetBytes: 1_048_576,
        isoPath: "artifacts/zeta-installer.iso",
        outputImagePath: "artifacts/zflash-baked.img",
        hostname: "node-a",
        qemuCredsPassphrase: "qemu-test-secret",
      },
      {
        createInlineStagingDirectory: () => "/private/tmp/zflash-inline-test",
        executor: mockExecutor,
        warn: (line) => warnings.push(line),
      },
    );
    expect(result.ok).toBe(true);
    // EXACT-EQUALITY PIN, not a search. `not.toContain("qemu-test-secret")` alone would be
    // an absence-by-search discharging a taint claim — it passes whenever the leak takes a
    // form the predicate does not recognise (base64, a slice, a different framing). Pinning
    // the WHOLE warning list against the module's own rendering leaves no room for any
    // other byte, so "the passphrase does not appear" is entailed rather than searched for.
    // (R5 of `audit-check-arity-nonequality.ts`; the census entry for this file cites it.)
    expect(warnings).toEqual([
      `zflash: constitutional-rail finding: ${describeEspWriteVerdict("/zeta-qemu-creds-passphrase")}`,
    ]);
    expect(warnings[0]).toContain("CONTENT CLASS NOT YET REVIEWED");
    // Kept beside the pin as a directly-readable statement of the property, not as its proof.
    expect(warnings.join("\n")).not.toContain("qemu-test-secret");
  });
});

describe("deriveNodeWorkloadSpiffeId — the flash-time hostname is the node coordinate", () => {
  test("derives the treaty-canonical form and it round-trips", () => {
    const result = deriveNodeWorkloadSpiffeId({ persona: "otto", surface: "cli", nodeHostname: "node-a" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spiffeId).toBe("spiffe://zeta/persona/otto/cell/cli@node-a");
    expect(parseSpiffe(result.spiffeId).cell.node).toBe("node-a");
  });

  test("carries an instance when one is given", () => {
    const result = deriveNodeWorkloadSpiffeId({
      persona: "otto",
      surface: "cli",
      instance: "fg",
      nodeHostname: "node-a",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spiffeId).toBe("spiffe://zeta/persona/otto/cell/cli/fg@node-a");
  });

  test("REFUSES an uppercase hostname — RFC1123-valid, not a valid node segment", () => {
    // The forcing case. `--host Node-A` flashes cleanly today (VALID_HOSTNAME_REGEX
    // allows uppercase) and would produce a SPIFFE ID this repo's own parser
    // rejects. Without the round-trip check the derivation would emit it happily.
    const result = deriveNodeWorkloadSpiffeId({ persona: "otto", surface: "cli", nodeHostname: "Node-A" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("round-trip");
  });

  test("refuses a hostname that is not RFC1123-valid at all", () => {
    const result = deriveNodeWorkloadSpiffeId({ persona: "otto", surface: "cli", nodeHostname: "node_a!" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("RFC1123");
  });

  test("refuses an empty hostname", () => {
    const result = deriveNodeWorkloadSpiffeId({ persona: "otto", surface: "cli", nodeHostname: "   " });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("node hostname is required");
  });

  test("refuses a node coordinate with no surface — the grammar forbids it", () => {
    const result = deriveNodeWorkloadSpiffeId({ persona: "otto", surface: "", nodeHostname: "node-a" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("surface is required");
  });
});

describe("planWorkloadIdentityFlashInjection — what may ride the medium", () => {
  test("the SPIFFE ID and trust bundle are permitted; the private key is not", () => {
    const planned = planWorkloadIdentityFlashInjection({
      persona: "otto",
      surface: "cli",
      nodeHostname: "node-a",
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.value.espPermittedArtifacts).toEqual(["spiffe-id", "trust-bundle"]);
    expect(planned.value.espRefusedArtifacts).toHaveLength(1);
    expect(planned.value.espRefusedArtifacts[0]?.artifact).toBe("svid-private-key");
  });

  test("the refusal gives BOTH independent reasons", () => {
    const planned = planWorkloadIdentityFlashInjection({
      persona: "otto",
      surface: "cli",
      nodeHostname: "node-a",
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const why = planned.value.espRefusedArtifacts[0]?.why ?? "";
    expect(why).toContain("unencrypted USB ESP");
    expect(why).toContain("CSR");
  });

  test("the artifact classification puts exactly one artifact in the secret class", () => {
    const secrets = Object.entries(WORKLOAD_IDENTITY_ARTIFACT_CONTENT_CLASS)
      .filter(([, contentClass]) => contentClass === "secret-material")
      .map(([artifact]) => artifact);
    expect(secrets).toEqual(["svid-private-key"]);
  });

  test("a bad hostname refuses the whole plan rather than planning around it", () => {
    const planned = planWorkloadIdentityFlashInjection({
      persona: "otto",
      surface: "cli",
      nodeHostname: "Node-A",
    });
    expect(planned.ok).toBe(false);
  });
});

describe("the flash path READS the rail — a disclosure nobody sees is vacuous", () => {
  const mockExecutor = {
    runCommand: () => ({ exitCode: 0, stderr: "", stdout: "" }),
    writeFile: () => {},
  };

  test("flashing wifi credentials discloses the plaintext PSK on the ESP", () => {
    const warnings: string[] = [];
    const result = runFileBackedZflashCli(
      {
        espOffsetBytes: 1_048_576,
        isoPath: "artifacts/zeta-installer.iso",
        outputImagePath: "artifacts/zflash-baked.img",
        hostname: "node-a",
        wifiSsid: "Homelab",
        wifiPassword: "super-secret",
      },
      {
        createInlineStagingDirectory: () => "/private/tmp/zflash-inline-test",
        executor: mockExecutor,
        warn: (line) => warnings.push(line),
      },
    );
    expect(result.ok).toBe(true);
    // EXACT-EQUALITY PIN — see the note on the QEMU-passphrase case above for why the
    // absence assertion below is not what carries this claim.
    expect(warnings).toEqual([
      `zflash: constitutional-rail finding: ${describeEspWriteVerdict("/zeta-wifi-credentials.json")}`,
    ]);
    expect(warnings[0]).toContain("REFUSED BY THE RAIL");
    // The disclosure must not echo the secret it is warning about.
    expect(warnings.join("\n")).not.toContain("super-secret");
  });

  test("a flash carrying only public identifiers discloses nothing", () => {
    const warnings: string[] = [];
    const result = runFileBackedZflashCli(
      {
        espOffsetBytes: 1_048_576,
        isoPath: "artifacts/zeta-installer.iso",
        outputImagePath: "artifacts/zflash-baked.img",
        hostname: "node-a",
        firstbootRole: { kind: "first-control-plane" },
      },
      {
        createInlineStagingDirectory: () => "/private/tmp/zflash-inline-test",
        executor: mockExecutor,
        warn: (line) => warnings.push(line),
      },
    );
    expect(result.ok).toBe(true);
    expect(warnings).toEqual([]);
  });
});

describe("custody decisions are surfaced, never answered", () => {
  test("every custody question is still open", () => {
    expect(WORKLOAD_IDENTITY_CUSTODY_DECISIONS.length).toBeGreaterThan(0);
    for (const decision of WORKLOAD_IDENTITY_CUSTODY_DECISIONS) {
      expect(decision.decided).toBe(false);
      expect(decision.whoDecides).toContain("maintainer");
    }
  });

  test("sealing, TPM binding, and issuance authority are each named", () => {
    const questions = WORKLOAD_IDENTITY_CUSTODY_DECISIONS.map((d) => d.question).join(" ");
    expect(questions).toContain("sealed at rest");
    expect(questions).toContain("TPM-bound");
    expect(questions).toContain("authorizes issuance");
  });

  test("the plan carries them to its caller", () => {
    const planned = planWorkloadIdentityFlashInjection({
      persona: "otto",
      surface: "cli",
      nodeHostname: "node-a",
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    expect(planned.value.custodyDecisions).toHaveLength(WORKLOAD_IDENTITY_CUSTODY_DECISIONS.length);
  });
});
