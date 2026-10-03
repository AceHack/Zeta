/**
 * storage-profile-selection.ts — docs/ops/INSTALL-TIME-CONFIG.md row 29.
 *
 * The pre-wipe decision behind zeta-install.sh's storage-profile choice, and the
 * TypeScript oracle its shell twin (the ZETA-STORAGE-PROFILE block in
 * zeta-install.sh) is replayed against in
 * `storage-profile-shell-parity.test.ts`.
 *
 * THE DEFECT THIS CLOSES
 * ----------------------
 * Measured on a real install (node-5b2dfa: one 1 TB boot NVMe plus one 1 TB NVMe
 * carrying old Longhorn data), the installer REFUSED:
 *
 *   longhorn1 tail on /dev/nvme0n1   810 GiB   x 75%  ->  607 GiB schedulable
 *   committed roster DECLARES        943 GiB
 *   ERROR: ... short by 336 GiB.
 *
 * on a perfectly ordinary single-1-TB-disk machine, with every remedy a manual
 * flag or a destructive wipe. The refusal compared the pool against ONE number —
 * the `measured` rung's total — as if the storage-profile LADDER did not exist. It
 * does: `full-ai-cluster/k8s/storage-profiles.json` already prices the same
 * claims at `minimal` / `standard` / `measured` / `large`, and `standard`
 * (571 GiB) fits 607 GiB with room to spare. So the installer now CHOOSES a rung
 * instead of refusing, and refuses only when even the smallest rung does not fit.
 *
 * NOT A FOURTH LADDER. The repo has three (resource rungs, storage profiles, the
 * runner disk envelope) and this module reads the second one. The rungs, their
 * order and their demand all come out of the catalogue —
 * `cluster/storage-profile-install.ts` derives `STORAGE_PROFILE_LADDER` from it,
 * `storage-profile-install.test.ts` fails when this file's copy disagrees, and the
 * same test pins the shell table. This file carries the numbers only because the
 * installer ISO ships NO bun and NO nodejs and the repo is not cloned until AFTER
 * the wipe (same standing fact as `longhorn-capacity-preflight.ts`): nothing on the
 * pre-wipe path can read the catalogue, so a copy has to be the thing the shell
 * sees, and a copy is only honest if a test makes it unable to drift.
 *
 * NEVER SHRINKS. Kubernetes can grow a PVC and cannot shrink one, so a profile
 * lower than one already applied cannot be honoured on a live cluster — the API
 * server refuses the shrink and the Application sticks OutOfSync. `floor` is the
 * profile already applied (recovered from an existing install's
 * /etc/zeta/storage-profile); selection never goes below it, and an explicit
 * request below it is REFUSED rather than silently raised.
 *
 * PURE: no I/O, no child processes.
 */

import { longhornCapacityVerdict, type LonghornCapacityVerdict } from "./longhorn-capacity-preflight.ts";

/** One rung of the install ladder. `demandGib` is what that rung ACTUALLY requests of Longhorn. */
export interface StorageProfileRung {
  readonly name: string;
  readonly demandGib: number;
}

/**
 * The profiles an install may choose between, SMALLEST FIRST, with what each one
 * actually asks of the Longhorn pool.
 *
 * GENERATED, not authored: `bun src/Core.TypeScript/cluster/storage-profile-install.ts --ladder`
 * prints it, and `storage-profile-install.test.ts` fails when it moves. The `ci`
 * profile is deliberately absent — it exists to serve the dev rung's hosted
 * runner (`storageProfileForResourceRung`), and a 23 GiB claim set is not a
 * choice for a node.
 *
 * `demandGib` is NOT `profileTotalGib`: a claim no Application can resize at
 * install time is charged at the size it will really request, and a claim no
 * Application applies at all is charged at the rung's size but cannot consume
 * Longhorn bytes. See `installDemandGib` in the cluster module.
 *
 * STORAGE_PROFILE_COMMITTED is the rung the committed tree is ALREADY written at
 * (`activeStorageProfile` in `single-node-budget.json`). Selecting it needs no
 * install-time config at all — the committed manifests are that rung — so the
 * installer writes /etc/zeta/storage-profile only for a DIFFERENT choice.
 */
// STORAGE-PROFILE-LADDER-BEGIN
export const STORAGE_PROFILE_LADDER: readonly StorageProfileRung[] = [
  { name: "minimal", demandGib: 279 },
  { name: "standard", demandGib: 671 },
  { name: "measured", demandGib: 1043 },
  { name: "large", demandGib: 1701 },
];

export const STORAGE_PROFILE_COMMITTED = "measured";
// STORAGE-PROFILE-LADDER-END

/** What the operator asks for: `auto` (the default) lets the installer choose. */
export const STORAGE_PROFILE_AUTO = "auto";

/** The env var carrying the request (ESP /zeta-firstboot.conf via zflash --storage-profile, or the shell). */
export const STORAGE_PROFILE_ENV = "ZETA_STORAGE_PROFILE";

export type StorageProfileSource = "auto" | "explicit" | "floor";

export type StorageProfilePlan =
  | { readonly ok: true; readonly value: string | null }
  | { readonly ok: false; readonly error: string };

/**
 * Validate zflash `--storage-profile <auto|name>` BEFORE anything is written to the ESP.
 *
 * `undefined` -> `null` (no line at all: the installer chooses, which is `auto`). `auto` and every rung
 * of the ladder pass. Anything else is refused here, on every machine, because a name that is not a
 * rung is wrong everywhere — what only the pool decides (does it fit?) is decided by the installer,
 * before the wipe. Same shape as `planLbPool`.
 */
export function planStorageProfile(
  raw: string | undefined,
  ladder: readonly StorageProfileRung[] = STORAGE_PROFILE_LADDER,
): StorageProfilePlan {
  if (raw === undefined) return { ok: true, value: null };
  if (raw === STORAGE_PROFILE_AUTO) return { ok: true, value: STORAGE_PROFILE_AUTO };
  if (ladder.some((rung) => rung.name === raw)) return { ok: true, value: raw };
  return {
    ok: false,
    error:
      `--storage-profile ${JSON.stringify(raw)} is neither "auto" nor a storage profile ` +
      `(${ladder.map((rung) => rung.name).join(", ")})`,
  };
}

/** The ESP `/zeta-firstboot.conf` line for a planned value. The value is a bare name, so it is safe single-quoted. */
export function renderStorageProfileConfLine(value: string): string {
  return `${STORAGE_PROFILE_ENV}='${value}'\n`;
}

export type StorageProfileSelection =
  | { readonly ok: true; readonly profile: string; readonly source: StorageProfileSource }
  | { readonly ok: false; readonly reason: "unknown" | "shrink" };

/** 1-based position on the ladder (smallest = 1); 0 when `name` is not a rung. */
export function storageProfileRank(name: string, ladder: readonly StorageProfileRung[] = STORAGE_PROFILE_LADDER): number {
  const index = ladder.findIndex((rung) => rung.name === name);
  return index + 1;
}

/** Demand of a named rung, or `null` when it is not on the ladder. */
export function storageProfileDemandGib(
  name: string,
  ladder: readonly StorageProfileRung[] = STORAGE_PROFILE_LADDER,
): number | null {
  return ladder.find((rung) => rung.name === name)?.demandGib ?? null;
}

/**
 * The higher of two rungs — the NEVER-SHRINK join. An empty/unknown side loses to
 * a known one; two empty/unknown sides give `""`.
 */
export function maxStorageProfile(
  a: string,
  b: string,
  ladder: readonly StorageProfileRung[] = STORAGE_PROFILE_LADDER,
): string {
  const rankA = storageProfileRank(a, ladder);
  const rankB = storageProfileRank(b, ladder);
  if (rankA === 0 && rankB === 0) return "";
  return rankA >= rankB ? a : b;
}

/**
 * Choose the CANDIDATE profile for a pool of `schedulableGib`.
 *
 *   auto      the LARGEST rung whose demand fits; when none fits, the SMALLEST (the
 *             candidate the refusal is reported against — fit is judged by
 *             `decideStorageProfile`, not here)
 *   <name>    exactly that rung, fitting or not (the operator asked)
 *   floor     the rung already applied; auto is raised to it, an explicit request
 *             below it is REFUSED ("shrink")
 *
 * `requested` of `""` means `auto`. Anything that is neither `auto` nor a rung is
 * REFUSED ("unknown") — a typo must not silently become `auto`.
 */
export function selectStorageProfile(
  schedulableGib: number,
  requested: string,
  floor: string,
  ladder: readonly StorageProfileRung[] = STORAGE_PROFILE_LADDER,
): StorageProfileSelection {
  const want = requested === "" ? STORAGE_PROFILE_AUTO : requested;
  const floorRank = storageProfileRank(floor, ladder);
  if (want !== STORAGE_PROFILE_AUTO) {
    const rank = storageProfileRank(want, ladder);
    if (rank === 0) return { ok: false, reason: "unknown" };
    if (floorRank > rank) return { ok: false, reason: "shrink" };
    return { ok: true, profile: want, source: "explicit" };
  }
  let candidate = ladder[0]?.name ?? "";
  for (const rung of ladder) {
    if (rung.demandGib <= schedulableGib) candidate = rung.name;
  }
  if (floorRank > storageProfileRank(candidate, ladder)) {
    return { ok: true, profile: floor, source: "floor" };
  }
  return { ok: true, profile: candidate, source: "auto" };
}

/**
 * What the installer does with a pool.
 *
 *   `profile`   the rung to install at, or `""` for "leave the committed tree alone"
 *   `verdict`   `ok` (it fits) / `override` (it does not, the operator named
 *               ZETA_ALLOW_LONGHORN_UNDERSIZED=1) / `undersized` (REFUSE)
 *   `write`     whether /etc/zeta/storage-profile is written: only for a rung that
 *               differs from the committed one
 *
 * An `auto` choice that fits NOTHING under the override proceeds on the COMMITTED
 * tree — `profile: ""` — which is exactly what the override has always meant ("those
 * PVCs will pend") and keeps the QEMU lanes that run under it byte-for-byte
 * unchanged. An explicit or floor choice under the override keeps that rung.
 */
export interface StorageProfileDecision {
  readonly selection: StorageProfileSelection;
  readonly profile: string;
  readonly demandGib: number | null;
  readonly verdict: LonghornCapacityVerdict | "refused";
  readonly write: boolean;
}

export function decideStorageProfile(
  schedulableGib: number,
  requested: string,
  floor: string,
  override: string,
  ladder: readonly StorageProfileRung[] = STORAGE_PROFILE_LADDER,
  committed: string = STORAGE_PROFILE_COMMITTED,
): StorageProfileDecision {
  const selection = selectStorageProfile(schedulableGib, requested, floor, ladder);
  if (!selection.ok) return { selection, profile: "", demandGib: null, verdict: "refused", write: false };
  const demandGib = storageProfileDemandGib(selection.profile, ladder);
  const verdict = longhornCapacityVerdict(schedulableGib, demandGib ?? Number.POSITIVE_INFINITY, override);
  const proceedOnCommitted = verdict === "override" && selection.source === "auto";
  const profile = verdict === "undersized" || proceedOnCommitted ? "" : selection.profile;
  return { selection, profile, demandGib, verdict, write: profile !== "" && profile !== committed };
}
