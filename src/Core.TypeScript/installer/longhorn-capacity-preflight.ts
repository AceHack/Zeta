/**
 * longhorn-capacity-preflight.ts — 081M393B9TB087G0R000Y529Z8 (WP28).
 *
 * The pre-wipe decision behind zeta-install.sh's Longhorn capacity refusal, and
 * the TypeScript oracle its shell twin (the ZETA-LONGHORN-CAPACITY block in
 * zeta-install.sh) is compared against in
 * `longhorn-capacity-preflight-shell-parity.test.ts`.
 *
 * THE DEFECT THIS CLOSES
 * ----------------------
 * Measured 2026-09-24 on the committed tree. On a single-disk USB install:
 *
 *   zeta-install.sh:70       LONGHORN1_TAIL="${LONGHORN1_TAIL:-1G}"
 *   zeta-install.sh:~1682    sgdisk -n "2:0:-${LONGHORN1_TAIL}"   (root)
 *   zeta-install.sh:~1683    sgdisk -n "3:0:0"                    (longhorn1)
 *   zeta-install.sh:~1733    mount → /mnt/var/lib/longhorn-disk1
 *   longhorn-disks.nix       dataDisks ← that mountpoint (never the root fs)
 *   longhorn/Application.yaml  createDefaultDiskLabeledNodes: true
 *
 * so Longhorn's entire schedulable pool on a one-disk box is the 1 GiB tail —
 * whatever the disk's size. Against it the committed roster declares ~943 GiB
 * of `driver.longhorn.io` PVCs (see `COMMITTED_LONGHORN_DEMAND_GIB`). Fifteen
 * Applications' PVCs pend forever and the operator reads PVC events to find out
 * why.
 *
 * WHY NO LANE CATCHES IT, WHICH IS THE PART WORTH WRITING DOWN
 * -----------------------------------------------------------
 * `full-ai-cluster/dev-cluster/manifests/zeta-block-replicated.yaml` binds the
 * same StorageClass to `rancher.io/local-path` in dev/CI, with its own comment
 * saying metal binds it to `driver.longhorn.io` and that it is "Never applied
 * to the metal cluster". So every kind lane, every k3d lane and the Docker
 * replica satisfy these PVCs off the runner's root filesystem. The only
 * substrate where the defect exists is the one substrate nothing simulates.
 *
 * AND THE EXISTING CHECK READS GREEN ON IT. `single-node-readiness.ts`'s
 * `capacity-provenance` compares the roster against the SUM OF EVERY BLOCK
 * DEVICE on the smallest registered node — 1047 GiB for node-ad1efd — and
 * prints `no blockers.` Its own header already admits the gap: that bound
 * "counts the USB stick, and it ignores the ESP, the root filesystem, swap, and
 * Longhorn's own reserve". The missing term is PARTITIONING. Physical disks are
 * not schedulable capacity, and on a single-disk box the whole question is
 * `LONGHORN1_TAIL` regardless of how big the disk is.
 *
 * WHY THIS IS A SPEC AND NOT A CALLEE
 * -----------------------------------
 * Same standing fact as `disk-preflight.ts`: the installer ISO ships NO bun and
 * NO nodejs (`usb-nixos-installer/nixos/installer/configuration.nix`
 * systemPackages), and the repo is not cloned until AFTER the wipe
 * (zeta-install.sh Step 6). Nothing on the pre-wipe path can execute
 * TypeScript, so a module the shell "calls" would be a golden vector nothing
 * reads. The shell is the implementation; this module is the executable
 * specification; the parity test is the falsifier that fails when either side
 * drifts.
 *
 * PURE: no I/O, no child processes, nothing destructive.
 */

/**
 * Fraction of a Longhorn data disk that replicas may actually occupy, as a
 * PERCENT so the shell twin can do it in integer arithmetic.
 *
 * DERIVED, not chosen. `min(storageOverProvisioningPercentage,
 * 100 - storageMinimalAvailablePercentage)`, which is
 * `single-node-readiness.ts`'s `longhornUsableFraction` — `min` rather than a
 * product, because over-provisioning is a THIN-provisioning allowance while the
 * minimal-available floor is about real free bytes. Both inputs are the chart
 * defaults that `full-ai-cluster/k8s/applications/longhorn/Application.yaml`
 * leaves in place: 100 and 25 respectively, cited in that file's own reserve
 * comment and at longhorn-1.7.2/values.yaml lines ~214 and ~216. So
 * min(100, 75) = 75.
 *
 * `longhorn-capacity-preflight.test.ts` pins this against
 * `mostConservativeUsableFraction` computed from the deployed Application, so a
 * reserve edit that moves the real fraction fails here rather than silently
 * loosening the installer's refusal.
 *
 * WHAT IT STILL DOES NOT MODEL, stated because the number is inside the
 * comparator that convicts: filesystem overhead on the ext4 Longhorn
 * partitions, and `storageReservedPercentageForDefaultDisk`, a THIRD reserve
 * the chart leaves at `~` and whose default the chart does not state. Both push
 * real capacity DOWN. So this percentage is an OVER-estimate of what Longhorn
 * will place, which keeps the refusal one-way: falling below it convicts,
 * clearing it proves nothing.
 */
export const LONGHORN_USABLE_PERCENT = 75;

/**
 * The committed roster's `driver.longhorn.io`-class PVC demand, in GiB.
 *
 * MEASURED 2026-09-24 from `rendered-storage-claims.snapshot.json`
 * (measuredOn 2026-09-23) and the YAML-derived claims, taken per class as
 * `max(rendered, derived)` over the classes `metalPoolCapabilities()` reports
 * as bound to `driver.longhorn.io` in `local-storage.nix` — today
 * `zeta-block-replicated` and `zeta-shared`:
 *
 *   zeta-block-replicated   max(rendered 843, derived 779) = 843 GiB
 *   zeta-shared             max(rendered   0, derived 100) = 100 GiB
 *                                                          ---------
 *                                                            943 GiB
 *
 * `max` rather than either reading alone: the two are blind in OPPOSITE
 * directions. The derived extractor cannot see pod counts that live in an
 * upstream chart; the render snapshot covers only the trees it was run over.
 * A comparator that takes the smaller of two available readings because it is
 * the one that flatters the conclusion has chosen its own verdict.
 *
 * The 843 is 29 REPLICA-WEIGHTED claims across 15 Applications, not the 23
 * claim ROWS in the snapshot. The row count is the wrong number: a row carries
 * a `count` (a StatefulSet's `volumeClaimTemplate` renders one PVC per pod —
 * cockroachdb is 48Gi x 3), and it is the weighted total that has to fit on a
 * disk.
 *
 * THIS LITERAL CANNOT GO STALE SILENTLY. It is a number in shell-reachable
 * TypeScript only because nothing on the pre-wipe path can compute it (see the
 * header). `single-node-readiness.ts`'s `longhorn-geometry` check recomputes
 * the demand from the snapshot on every run and REFUSES when it disagrees with
 * this constant, so the roster growing past what the installer refuses at is a
 * red gate, not a quiet drift.
 */
export const COMMITTED_LONGHORN_DEMAND_GIB = 943;

/** Env var an operator sets to proceed past an undersized Longhorn pool. */
export const LONGHORN_UNDERSIZED_OVERRIDE_ENV = "ZETA_ALLOW_LONGHORN_UNDERSIZED";

/** The exact value `LONGHORN_UNDERSIZED_OVERRIDE_ENV` must carry. Any other value is not an override. */
export const LONGHORN_UNDERSIZED_OVERRIDE_TOKEN = "1";

/**
 * Raw Longhorn capacity, in GiB, that zeta-install.sh provisions for a node.
 *
 * This is the installer's OWN geometry, which is the term `capacity-provenance`
 * is missing:
 *
 *   - the boot disk contributes ONLY the `longhorn1` tail (`LONGHORN1_TAIL`),
 *     because ESP + root take the rest and the root filesystem is never a
 *     Longhorn data path (`longhorn-disks.nix` derives `dataDisks` from the
 *     `/var/lib/longhorn-disk*` mountpoints);
 *   - every OTHER internal disk is formatted whole as longhorn2..N.
 *
 * Anything that is not a positive WHOLE GiB collapses to 0 rather than
 * subtracting capacity: a junk reading must not manufacture headroom. Whole
 * numbers specifically, because the shell twin does this in `$(( ))` integer
 * arithmetic and a spec its implementation cannot express is not a spec — every
 * real input is already integral (`blockdev --getsize64` floored by
 * `bytesToGib`).
 */
export function provisionedLonghornGib(tailGib: number, dataDiskGib: readonly number[]): number {
  return dataDiskGib.reduce<number>((total, size) => total + clampGib(size), clampGib(tailGib));
}

/** A positive whole GiB, or 0. Shared by every entry point so both sides refuse junk identically. */
function clampGib(value: number): number {
  return Number.isInteger(value) && value > 0 ? value : 0;
}

/**
 * The shell twin's `zeta_clamp_gib`: a GiB figure parsed out of TEXT.
 *
 * SEPARATE FROM `clampGib` because the two sides receive different things, and
 * collapsing that difference is how a parity test passes while the pair
 * disagrees. The shell only ever holds strings — `blockdev --getsize64` output,
 * an env override, a `$(( ))` result — so its clamp is a PARSER, and what it
 * accepts is part of the specification. `clampGib` above is the internal
 * numeric guard, and JavaScript's own coercion is materially more permissive
 * than bash's: `Number(" 931")` is 931 and `Number("1e3")` is 1000, where the
 * shell's digits-only `case` refuses both. Written as a parser here, the spec
 * says what the implementation actually does.
 *
 * Accepts ASCII digits only, with no sign, no separator, no exponent and no
 * surrounding whitespace, and requires the result to be positive. Everything
 * else is 0 — a junk reading must not manufacture headroom.
 *
 * Deliberately NOT `Number.parseInt`, which stops at the first non-digit and
 * would read "931G" as 931 — a unit suffix silently reinterpreted as a bare
 * GiB count is precisely the misreading this refuses.
 */
export function clampGibFromText(raw: string): number {
  if (!/^[0-9]+$/.test(raw)) return 0;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : 0;
}

/**
 * GiB Longhorn will actually place out of `rawGib`, floored to an integer.
 *
 * FLOOR, deliberately: it rounds capacity DOWN, which is the convicting
 * direction. Rounding to nearest would let a fractional GiB acquit.
 */
export function schedulableLonghornGib(rawGib: number, usablePercent: number = LONGHORN_USABLE_PERCENT): number {
  const raw = clampGib(rawGib);
  const percent = clampGib(usablePercent);
  if (raw === 0 || percent === 0) return 0;
  return Math.floor((raw * percent) / 100);
}

/**
 * `"ok"`        — the provisioned pool covers the committed demand.
 * `"override"`  — it does not, and the operator named the exact override token.
 * `"undersized"`— it does not. zeta-install.sh bails, before anything is wiped.
 */
export type LonghornCapacityVerdict = "ok" | "override" | "undersized";

export function longhornCapacityVerdict(
  schedulableGib: number,
  demandGib: number = COMMITTED_LONGHORN_DEMAND_GIB,
  overrideValue = "",
): LonghornCapacityVerdict {
  if (schedulableGib >= demandGib) return "ok";
  return overrideValue === LONGHORN_UNDERSIZED_OVERRIDE_TOKEN ? "override" : "undersized";
}

/** Bytes → whole GiB, floored. Floor is the convicting direction (see `schedulableLonghornGib`). */
export function bytesToGib(bytes: number): number {
  if (!Number.isInteger(bytes) || bytes <= 0) return 0;
  return Math.floor(bytes / 1024 ** 3);
}
