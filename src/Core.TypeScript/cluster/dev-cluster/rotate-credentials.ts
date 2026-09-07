#!/usr/bin/env bun
// Rotate dev/CI credentials against the current cluster control plane context.
//
// -- WHY THIS FILE EXISTS ---------------------------------------------------
// `rotateDevCredentials` landed as a library function with no way to invoke it,
// which does not satisfy what it was asked for. Aaron 2026-09-07: "the awkward
// bits we want to make easy, cause when key rotation is easy per identity then
// decorrelation measuring becomes much simpler." A verb reachable only from a
// test is not easy, and an instrument nobody can run measures nothing.
//
// This is the same shape as the other dev-cluster entrypoints (`kind-up.ts`,
// `k3d-up.ts`, `apply-root-app.ts`): one file, one verb, `import.meta.main`.
//
// -- WHAT IS DELIBERATE HERE ------------------------------------------------
// `--all` EXISTS AND IS NOT THE DEFAULT. Bare invocation prints usage rather
// than rotating anything, because the one thing that must never be easy is
// rotating everything BY ACCIDENT. That is a different property from rotating
// everything being hard: `--all` is one flag when you mean it.
//
// A REFUSAL IS A NON-ZERO EXIT. Rotation is the kind of operation a script runs
// unattended, and a refusal that exits 0 is a rotation that silently did not
// happen -- the same class as a check that did not run looking like one that
// passed. Each outcome prints for itself, so a partial batch says exactly which
// moved and which did not.
//
// THE RESTART ADVISORY IS PRINTED, LOUDLY. `CredentialRotation.restartRequired`
// names workloads still holding the OLD value; this process cannot restart them
// (the control-plane port has no rollout). Printing the swap without printing
// that would leave an operator believing a rotation took effect while the
// running service still presents the credential it started with.

import { liveDevClusterPorts } from "./deps.ts";
import { allDevCredentialTargets, rotateDevCredentials } from "./use-cases.ts";

function usage(): never {
  console.error(
    [
      "usage: bun src/Core.TypeScript/cluster/dev-cluster/rotate-credentials.ts <target>... | --all",
      "       --list   print every rotatable credential and exit",
      "",
      "  <target> is `namespace/name` for a per-service credential, or `name` for a shared one.",
      "  Rotation NEVER mints: an absent or unknown credential is refused, not created.",
      "  Exits non-zero if any target was refused.",
    ].join("\n"),
  );
  process.exit(1);
}

export function rotateCredentialsMain(argv: readonly string[]): number {
  if (argv.length === 0 || argv.includes("-h") || argv.includes("--help")) usage();

  if (argv.includes("--list")) {
    for (const target of allDevCredentialTargets()) console.log(target);
    return 0;
  }

  const targets = argv.includes("--all")
    ? allDevCredentialTargets()
    : argv.filter((arg) => !arg.startsWith("--"));
  if (targets.length === 0) usage();

  const ports = liveDevClusterPorts({ clusterShape: "kind-in-docker" });
  const results = rotateDevCredentials(ports, targets);

  let refused = 0;
  for (const result of results) {
    if (result.rotated) {
      console.log(`rotated  ${result.credential}`);
      if (result.restartRequired.length > 0) {
        // Loud on purpose: until these restart they still present the OLD value.
        console.log(
          `         STILL ON THE OLD VALUE until restarted: ${result.restartRequired.join(", ")}`,
        );
      }
    } else {
      refused += 1;
      console.error(`REFUSED  ${result.credential}: ${result.refusal ?? "no reason given"}`);
    }
  }

  if (refused > 0) {
    console.error(`${String(refused)} of ${String(results.length)} refused; nothing was minted.`);
  }
  return refused === 0 ? 0 : 1;
}

if (import.meta.main) {
  process.exit(rotateCredentialsMain(process.argv.slice(2)));
}
