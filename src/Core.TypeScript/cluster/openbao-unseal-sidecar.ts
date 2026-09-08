#!/usr/bin/env bun
// openbao-unseal-sidecar.ts — the process that runs BESIDE openbao and unseals it.
//
// -- WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT -------------------------
// `vault-unsealer.ts` is the decision loop and says of itself that it is "the
// payload that commit will call". It is pure: every effect arrives through an
// injected port, it has no CLI, and its `UnsealHttp` type has NO init method --
// "a client that can init is a client this module must not be handed; the type
// is the gate." This file is that commit's other half: the real adapters, and
// nothing else. It adds no decision of its own.
//
// It therefore CANNOT initialise a store, by construction rather than by
// promise. On a fresh cluster the loop classifies `not-initialized` and returns
// `refuse-init` forever. That is the correct behaviour and it is not a stall
// dressed as progress: an uninitialised store needs a ceremony, and a sidecar
// that could perform one would be a sidecar that could mint and hold root
// material next to the thing it guards.
//
// -- WHERE THE SHARES COME FROM, AND WHY A SECRET IS ALLOWED HERE ----------
// `docs/trajectories/cluster-encryption-credential-substrate/MENO.md:39-41`:
// "Shamir shares / HSM authkey references. USB / Keychain / k8s Secret are
// caches." and "Shamir N-of-M on kind/CI until an emulator job inits without
// it. Threshold 1 is coercion (S=4)." So a mounted Secret is a sanctioned
// CACHE for the kind/CI Shamir path -- not the custody model, and not metal.
//
// This is the reason the fetcher reads the directory on EVERY sealed tick
// rather than at startup: `ShareFetcher` is documented as "called every sealed
// tick -- never cached across ticks by this module", so a rotated or removed
// Secret takes effect on the next tick instead of living in this process's
// memory until it restarts.
//
// -- WHY IT DOES NOT TOUCH `ephemeral-vault-init.ts` ------------------------
// That module is the CI-only half and holds shares in memory on purpose; its
// header says a module that grows a way to persist material "must be deleted,
// not amended". Nothing here amends it, and nothing here writes a share.
//
// -- HONEST SCOPE ----------------------------------------------------------
// SHAMIR / KIND ONLY. Metal auto-unseal is PKCS#11 (`seal "pkcs11"`), which
// replaces this loop rather than calling it, and is blocked on a same-libc
// OpenBao image. Running this against metal would be substituting a Secret-
// cached Shamir share for an HSM, which is the coercion MENO names.

import { runUnsealerTick, UNSEAL_THRESHOLD, VAULT_LOCAL } from "./vault-unsealer.ts";
import type { HealthResponse, ShareFetcher, UnsealHttp, UnsealResponse } from "./vault-unsealer.ts";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Default mount for the Shamir share cache. One share per file. */
export const DEFAULT_SHARE_DIR = "/etc/openbao/unseal-shares";
export const DEFAULT_TICK_MS = 5000;

/**
 * HTTP against the co-located listener, and NOTHING ELSE.
 *
 * Structurally incapable of init: the object exposes exactly `health` and
 * `putUnseal`, so no call site inside the loop can reach `/v1/sys/init` even by
 * mistake. That is the type gate the payload asks for, honoured rather than
 * asserted.
 */
export function httpUnsealClient(base: string = VAULT_LOCAL): UnsealHttp {
  return {
    async health(): Promise<HealthResponse> {
      try {
        const res = await fetch(`${base}/v1/sys/health?standbyok=true&sealedcode=503&uninitcode=501`);
        // A body is best-effort: the STATUS is the classifier's primary signal
        // and `classifyHealth` treats a stale body as subordinate to it.
        let body: { initialized?: boolean; sealed?: boolean } = {};
        try {
          body = (await res.json()) as typeof body;
        } catch {
          body = {};
        }
        // Keys are SPREAD only when present: `exactOptionalPropertyTypes` is on,
        // so an explicit `initialized: undefined` is not the same as an absent
        // key. `classifyHealth` distinguishes them -- absent means "the body did
        // not say", which is subordinate to the status code, whereas a literal
        // `false` is load-bearing (not-initialized must never look like sealed).
        return {
          status: res.status,
          ...(body.initialized !== undefined ? { initialized: body.initialized } : {}),
          ...(body.sealed !== undefined ? { sealed: body.sealed } : {}),
        };
      } catch {
        // Unreachable is status 0 -- NOT a seal. The loop must not read a
        // connection refusal as "sealed" and start spending shares at it.
        return { status: 0 };
      }
    },
    async putUnseal(key: string): Promise<UnsealResponse> {
      const res = await fetch(`${base}/v1/sys/unseal`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key }),
      });
      let sealed: boolean;
      try {
        sealed = ((await res.json()) as { sealed?: boolean }).sealed !== false;
      } catch {
        // Unparseable body: stay sealed. Never report unsealed on a guess.
        sealed = true;
      }
      return { status: res.status, sealed };
    },
  };
}

/**
 * Read every share file in the mount, fresh, on each call.
 *
 * Returns `[]` rather than throwing when the mount is absent or empty: a
 * missing cache is a legitimate state (nobody has run the ceremony yet), and
 * the loop's own `validateShares` is what refuses a short or duplicate set. An
 * exception here would turn "no shares yet" into a crash-looping sidecar beside
 * a healthy store.
 */
export function directoryShareFetcher(dir: string = DEFAULT_SHARE_DIR): ShareFetcher {
  return {
    async fetchSharesThisTick(): Promise<readonly string[]> {
      let names: readonly string[];
      try {
        names = readdirSync(dir).filter((n) => !n.startsWith(".")).sort();
      } catch {
        return [];
      }
      const out: string[] = [];
      for (const name of names) {
        try {
          const text = readFileSync(join(dir, name), "utf8").trim();
          if (text.length > 0) out.push(text);
        } catch {
          // One unreadable file must not discard the others; `validateShares`
          // decides whether what remains is enough.
        }
      }
      return out;
    },
  };
}

export interface SidecarOptions {
  readonly shareDir: string;
  readonly tickMs: number;
  readonly base: string;
  readonly threshold: number;
  readonly once: boolean;
}

export function parseSidecarArgs(argv: readonly string[]): SidecarOptions {
  const value = (flag: string, fallback: string): string => {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? (argv[i + 1] ?? fallback) : fallback;
  };
  return {
    shareDir: value("--share-dir", DEFAULT_SHARE_DIR),
    tickMs: Number(value("--tick-ms", String(DEFAULT_TICK_MS))),
    base: value("--addr", VAULT_LOCAL),
    threshold: Number(value("--threshold", String(UNSEAL_THRESHOLD))),
    once: argv.includes("--once"),
  };
}

/** One tick, wired to the real adapters. Exported so a test can drive it. */
export async function sidecarTick(options: SidecarOptions): Promise<string> {
  const outcome = await runUnsealerTick({
    http: httpUnsealClient(options.base),
    fetcher: directoryShareFetcher(options.shareDir),
    threshold: options.threshold,
  });
  const detail = outcome.ok ? `ops=${String(outcome.unsealOperations)}` : `error=${outcome.error}`;
  return `${outcome.decision.kind} (${outcome.decision.reason}) ${detail}`;
}

if (import.meta.main) {
  const options = parseSidecarArgs(process.argv.slice(2));
  if (!Number.isFinite(options.tickMs) || options.tickMs < 250) {
    console.error("--tick-ms must be a number >= 250");
    process.exit(2);
  }
  if (!Number.isFinite(options.threshold) || options.threshold < 2) {
    // MENO: "Threshold 1 is coercion (S=4)." Refused here as well as in the
    // payload, because a sidecar is the place someone would try to lower it.
    console.error("--threshold must be >= 2; threshold 1 is coercion");
    process.exit(2);
  }
  // No try/catch around the loop: a genuine defect should restart the container
  // and be visible in its restart count, not be swallowed into a quiet tick.
  for (;;) {
    console.log(await sidecarTick(options));
    if (options.once) break;
    await new Promise((resolve) => setTimeout(resolve, options.tickMs));
  }
}
