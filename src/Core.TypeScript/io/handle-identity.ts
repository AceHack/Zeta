// src/Core.TypeScript/io/handle-identity.ts
//
// "ARE THESE TWO DESCRIPTORS THE SAME OBJECT?" — asked of the DESCRIPTORS, answered in
// three registers, and never answered `same` on a guess.
//
// WHY IT EXISTS. Some verifications have to re-open a path. A read-back that reuses the
// write handle proves only that the bytes this process wrote are the bytes this process
// wrote — a check that cannot fail, which is worse than no check — so the fresh `open` IS
// the assertion and removing it is not a fix. But a path resolves afresh on every call, so
// the fresh handle can land on a DIFFERENT object, and then the verification passes against
// the wrong file and reports success. That is CodeQL's `js/file-system-race` reading of
// `zflash/flash-and-inject.ts` (alert #259) and `zflash/esp-inject.test.ts` (alert #256),
// and the shape of the report is right even where the path is not attacker-reachable.
//
// Node exposes no `openat`, so the second resolution cannot be ELIMINATED. It can be made
// unable to pass on the wrong object, which is all this file does.
//
// THE THIRD REGISTER IS THE POINT. `fstat` does not give a meaningful (dev, ino) for every
// object on every platform — a raw device handle is the case this was written for. A
// comparison that silently read two zeroes as "same" would be the vacuity class exactly, so
// unknown identity is reported as `unknown` and is never reported as a match. A caller
// decides what to do with `unknown`; this function refuses to decide for it.

import { fstatSync } from "node:fs";

/** What a descriptor says about which object it names. `known` is false when it says nothing. */
export interface HandleIdentity {
  readonly dev: number;
  readonly ino: number;
  readonly known: boolean;
}

/** Three registers, and `same` is only ever returned on evidence. */
export type IdentityVerdict = "same" | "different" | "unknown";

/**
 * The identity of the object behind this descriptor.
 *
 * `dev === 0 && ino === 0` is the platform declining to answer (raw devices, and some
 * non-file handles). It is recorded as `known: false` rather than as the value zero.
 */
export function handleIdentity(fd: number): HandleIdentity {
  try {
    const { dev, ino } = fstatSync(fd);
    return { dev, ino, known: !(dev === 0 && ino === 0) };
  } catch {
    return { dev: 0, ino: 0, known: false };
  }
}

/** Do two descriptors name one object? `unknown` whenever either side declined to say. */
export function compareHandleIdentity(a: HandleIdentity, b: HandleIdentity): IdentityVerdict {
  if (!a.known || !b.known) return "unknown";
  return a.dev === b.dev && a.ino === b.ino ? "same" : "different";
}

/** A short, ordinal rendering for a log line — no locale formatting anywhere near an identity. */
export function describeHandleIdentity(id: HandleIdentity): string {
  return id.known ? `dev=${String(id.dev)} ino=${String(id.ino)}` : "identity-unavailable";
}
