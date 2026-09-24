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

// ---------------------------------------------------------------------------
// THE ROOT FLOOR — what root needs, so `longhorn1` can have the REST.
//
// EVERY TERM BELOW IS GiB (binary, 1024^3). The measurement it is built from is
// published in GB (decimal, 10^9) and is converted here with the arithmetic
// shown. Mixing the two in a capacity floor is the Mars Climate Orbiter class
// this repo cites by name, and `single-node-readiness.ts` already carries one
// units trap of its own (`free -h --si`, so a registration's `66G` is 62942Mi).
// If you edit these, keep them in GiB and show the conversion.
// ---------------------------------------------------------------------------

/**
 * Unpacked container images for the WHOLE roster, GiB.
 *
 * `image-footprint.measured.json` (measured 2026-09-01) reports the `all`
 * cohort at 29.10 GB compressed and **77.69 GB** estimated on disk, applying a
 * x2.67 unpack ratio because containerd stores layers UNPACKED. Converted:
 *
 *   77.69 GB x 10^9 / 1024^3 = 72.35 GiB  ->  73 GiB, rounded UP
 *
 * The `all` cohort rather than `applied` (34.18 GB / 31.8 GiB): a root
 * filesystem that only fits the apps applied today would need repartitioning
 * the first time somebody runs `argocd app sync` on a deferred one, and
 * repartitioning is the one thing this layout cannot do after the fact.
 *
 * WHICH WAY THE ERROR LEANS, and this is the sentence that matters most here:
 * the x2.67 ratio is a MEASURED OVER-ESTIMATE for the two images that dominate
 * — that file records a CI run that pulled them and found hindsight-api
 * extracts at x1.77 and vllm at x2.35 — so this term is HIGH, by roughly 57%
 * for the largest. On the ROOT side of the comparison, high is the SAFE
 * direction: root gets more than it needs and Longhorn gets less than it could,
 * which costs capacity and cannot cause a failure. The SAME ratio on the
 * DEMAND side of a capacity check would be the ACQUITTING direction and would
 * have to be argued for separately. It is used here and nowhere else.
 */
export const IMAGE_FOOTPRINT_ALL_COHORT_GIB = 73;

/**
 * OS, swap, /nix/store generations and logs, GiB. A BUDGET CHOICE, not a
 * measurement — the same 30 GiB `single-node-readiness.ts` already carries as
 * `OS_ROOT_ALLOWANCE_GIB`, reused rather than re-guessed so there is one number
 * to argue with. It does NOT include the ESP, which is its own partition here.
 */
export const OS_ROOT_ALLOWANCE_GIB = 30;

/** Safety factor over (images + OS). Stated so the rounding is a decision rather than a habit. */
export const ROOT_FLOOR_SAFETY_FACTOR = 1.15;

/**
 * What root gets on a single-disk install before `longhorn1` takes the rest, GiB.
 *
 *   (73 images + 30 OS) x 1.15 = 118.45  ->  120 GiB
 *
 * NOT INCLUDED, AND DELIBERATELY SO: the local-path PVC ceilings that also land
 * on root — `LOCAL_PATH_ADVISORY_GIB` below, 220 GiB today. Reserving them
 * would starve the Longhorn pool for bytes nobody has written, because
 * `local-storage.nix` binds `zeta-block-local` `WaitForFirstConsumer` and the
 * local-path provisioner's own helper is `mkdir -m 0777 -p "$VOL_DIR"` — a
 * directory with no quota and no reference to the requested size. A PVC there
 * consumes the bytes WRITTEN and nothing more. So the ceiling is advisory, and
 * the installer REPORTS it instead of reserving it. It is still the first thing
 * that fills root, which is why it is printed rather than merely commented.
 */
export const ROOT_FLOOR_GIB = 120;

/**
 * Declared local-path PVC capacity that lands on the ROOT filesystem, GiB.
 * ADVISORY, NOT RESERVED — see `ROOT_FLOOR_GIB`.
 *
 * MEASURED 2026-09-24 from `rendered-storage-claims.snapshot.json` over the
 * classes bound to `rancher.io/local-path` (`zeta-block-local` plus the cluster
 * default): gitlab 66, dapr 48, forgejo 20, loki 20, opensearch 20, seaweedfs
 * 20, openbao 15, mimir 6, spire 5 = 220 GiB. Pinned by test to that snapshot,
 * so it cannot drift silently any more than the Longhorn demand can.
 */
export const LOCAL_PATH_ADVISORY_GIB = 220;

/** The ESP, GiB. `sgdisk -n "1:0:+1G"` in zeta-install.sh. */
export const ESP_GIB = 1;

/**
 * The smallest `longhorn1` tail zeta-install.sh will create, GiB.
 *
 * Reached ONLY under `ZETA_ALLOW_LONGHORN_UNDERSIZED=1`, on a boot disk too
 * small for the root floor. It is the pre-WP28 layout — a minimum tail, root
 * takes the rest — kept as a NAMED FALLBACK rather than as a default, because
 * as a default it is the exact defect this work package exists to close: a
 * 1 TiB disk handing Longhorn one gibibyte. As an explicitly-named fallback on
 * a 40 GiB virtual disk it is the only layout that installs at all.
 *
 * ONE OVERRIDE COVERS BOTH REFUSALS — the root floor and the pool — because
 * they are the same claim measured at two points ("this disk cannot hold the
 * committed roster"). A second env var would make an operator name the same
 * fact twice, and the second one would be the one nobody sets.
 */
export const LONGHORN_MIN_TAIL_GIB = 1;

/** `LONGHORN1_TAIL`'s value when the installer should compute the tail from the disk. */
export const LONGHORN1_TAIL_AUTO = "auto";

/**
 * The `longhorn1` tail for a boot disk of `diskGib`, under `LONGHORN1_TAIL=auto`.
 *
 * THE DEFECT THIS REPLACES: the tail was a fixed `1G` and root took everything
 * else, so a 1 TiB single-disk install gave Longhorn ONE GIBIBYTE and root
 * ~930, of which root needs ~120. The remainder was not spent, it was simply
 * not reachable — the root filesystem is never a Longhorn data path.
 *
 * Inverted: root gets a computed floor and `longhorn1` gets the REST.
 *
 * Returns 0 when the disk cannot hold ESP + root floor + a 1 GiB minimum tail.
 * 0 is not a tail — it is the caller's signal to REFUSE, which
 * `assert_boot_disk_large_enough` already does with the numbers printed. A
 * clamped-to-1 tail would be the old defect wearing a computation.
 */
export function autoLonghornTailGib(diskGib: number, rootFloorGib: number = ROOT_FLOOR_GIB): number {
  const disk = clampGib(diskGib);
  const floor = clampGib(rootFloorGib);
  if (disk === 0 || floor === 0) return 0;
  const tail = disk - ESP_GIB - floor;
  return tail >= 1 ? tail : 0;
}

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
