#!/usr/bin/env bun
/**
 * src/Core.TypeScript/cluster/bootstrap-preload-blackhole.ts
 *
 * THE FALSIFIER FOR THE BOOTSTRAP IMAGE PRELOAD — boot the real
 * `services.k3s.manifests` roster with EVERY REGISTRY IN THE SET BLACKHOLED,
 * and find out whether the preload actually carried it. WP34
 * (081M3BZ111D087G0R000YBMKRY).
 *
 * -- WHY A BLACKHOLE, AND NOT A GREEN TEST -------------------------------
 * The claim is "first boot gets every bootstrap image with no registry
 * reachable". A test that preloads the images AND has a working network proves
 * nothing whatsoever: every pod comes up on an ordinary pull and the archive
 * could be empty, corrupt, or tagged under names containerd never looks up.
 * That is the check-that-cannot-fail class — `toy-is-free-metered-must-be-earned.md`
 * — and the only honest proof is a run where the pull WOULD have failed.
 *
 * So the registries are made unresolvable inside the container
 * (`--add-host <registry>:127.0.0.1`), and the hosts to blackhole are DERIVED
 * from the preload snapshot by `blackholeHostnames()` rather than typed here:
 * a test that blackholes a hand-written host list proves nothing about an
 * image that moved to a host nobody added to the list.
 *
 * -- THE NEGATIVE CONTROL IS NOT OPTIONAL ---------------------------------
 * `--both` runs the SAME boot twice — once with the archive, once with an
 * empty images directory — and refuses to report success unless:
 *
 *     positive run  =>  CARRIED    (every image resolved locally)
 *     negative run  =>  BLOCKED    (pulls were attempted and failed)
 *
 * If the negative run also passes, the blackhole is not working — the
 * container resolved the registries anyway, or the content came from
 * somewhere else — and THE POSITIVE RESULT IS DISCARDED rather than reported.
 * A blackhole test that passes on an empty images directory is the same defect
 * in a new costume, and half of it is not a result.
 *
 * -- THE OBSERVABLE, AND WHY IT IS A PROBE POD RATHER THAN THE CHARTS -----
 * Every image in the snapshot gets a Pod that names it VERBATIM and runs a
 * command that does not exist. The container therefore always fails to start,
 * and that is deliberate: what is under test is the IMAGE, not the workload,
 * and a probe that also has to run successfully would go red for reasons
 * (config, RBAC, a missing Secret) that say nothing about the preload.
 *
 * The verdict reads the kubelet's own words:
 *
 *   "already present on machine"   the preload carried it     -> CARRIED
 *   ErrImagePull / ImagePullBackOff  it had to pull, and could not -> BLOCKED
 *
 * That is the exact distinction the feature makes, and it is decided per
 * image rather than in aggregate, so a single reference the archive names
 * wrongly cannot hide behind twenty-four that it names correctly.
 *
 * The real roster is applied alongside and does boot, but the VERDICT READS
 * ONLY THE PROBE NAMESPACE, and that scoping is load-bearing rather than
 * tidiness. MEASURED 2026-09-25: reading events cluster-wide made a correct
 * positive run report BLOCKED, because the roster's own pods start SECONDS
 * into boot — before k3s has finished importing a 1 GB archive — and their
 * pre-import `ErrImagePull` events never expire. The probes are applied AFTER
 * the import completes, so they are the only pods observed under the condition
 * the claim is about. An experiment that also counts observations made before
 * the setup finished is not a controlled one.
 *
 * The verdict also does not wait for the roster to CONVERGE. That is
 * `first-boot-replica.ts`'s job and it takes an order of magnitude longer.
 *
 * -- WHAT IT PROVES, AND WHAT IT DOES NOT --------------------------------
 * PROVES: with every registry in the set unreachable, every image in the
 * preload set resolves out of the archive — i.e. the archive carries the right
 * blobs AND, the part no tarball inspection can establish, under the right
 * NAMES. That second half is not hypothetical: an archive built the obvious
 * way (`skopeo copy` into an OCI layout) fails it for the five digest-pinned
 * cilium references, measured 2026-09-25. See `archivePlan` in
 * `bootstrap-image-preload.ts`.
 *
 * DOES NOT PROVE: that the cluster reaches ArgoCD-landed, nor anything at all
 * about the ~109 catalog images, which still pull from eight registries.
 *
 * Usage:
 *   bun src/Core.TypeScript/cluster/bootstrap-preload-blackhole.ts --plan
 *   bun src/Core.TypeScript/cluster/bootstrap-preload-blackhole.ts --both --archive <path>
 *
 * Exit codes: 0 = the pair of verdicts proves the claim; 1 = a pair that does
 * not (including a negative control that passed); 2 = usage/environment error.
 */

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { stringCompare } from "../collation/collation.ts";
import {
  buildRoster,
  k3sVersionToDockerTag,
  readKubernetesVersionPin,
  type RosterEntry,
} from "./first-boot-replica.ts";
import {
  blackholeHostnames,
  K3S_SERVER_NIX,
  KUBE_VERSION_PATH,
  LOCAL_STORAGE_NIX,
  loadSnapshot,
  REPO_ROOT,
  type Snapshot,
} from "./bootstrap-image-preload.ts";

/** Where k3s looks — must equal `zeta.bootstrapImagePreload.imagesDir`. */
export const IMAGES_DIR = "/var/lib/rancher/k3s/agent/images";

/** Must equal `zeta.bootstrapImagePreload.archiveName`. */
export const ARCHIVE_NAME = "zeta-bootstrap-images.tar";

/** The namespace the probe pods live in. */
export const PROBE_NAMESPACE = "zeta-preload-probe";

/**
 * A command that cannot exist in any image.
 *
 * The probe must fail to START and must not fail to PULL, so the two outcomes
 * stay distinguishable. An absolute path with no plausible binary at it gives
 * `exec: ... no such file or directory` from runc — which happens strictly
 * AFTER the image has been obtained, and is therefore itself evidence the
 * image was obtained.
 */
export const PROBE_COMMAND = "/zeta-preload-probe-no-such-binary";

/**
 * Has k3s FINISHED importing the archive?
 *
 * MEASURED 2026-09-25, and the first version of this check was wrong in a way
 * that is worth keeping on the record because it produced a plausible-looking
 * red. k3s logs three shapes:
 *
 *     Importing images from /var/.../zeta-bootstrap-images.tar     <- START
 *     Imported quay.io/jetstack/trust-manager:v0.24.0              <- each one
 *     Imported 26 images from /var/.../zeta-bootstrap-images.tar in 35.6s
 *
 * The original test — "the logs contain `Imported` AND the archive name" — is
 * satisfied the instant the FIRST per-image line appears, because the archive
 * name is already on the START line. So the harness began probing mid-import
 * and reported BLOCKED for exactly the images that had not been reached yet:
 * the five cilium references and local-path-provisioner, i.e. the ones sorting
 * late in the layout. It looked like a naming defect and was a timing one.
 *
 * The completion line is the only one that carries a COUNT, so that is what is
 * matched. A check that can be satisfied by the beginning of the thing it is
 * waiting for is not a wait.
 */
export function importCompleted(logs: string, archiveName: string = ARCHIVE_NAME): boolean {
  // NO REGEX BUILT FROM `archiveName`. Escaping only `.` — which the first
  // version did — leaves every other metacharacter live, and CodeQL's
  // js/incomplete-sanitization is right that a half-escaped pattern is worse
  // than none: it reads as safe. A line scan needs no escaping at all, and is
  // easier to read besides.
  for (const line of logs.split("\n")) {
    if (!line.includes(archiveName)) continue;
    if (COMPLETION_LINE.test(line)) return true;
  }
  return false;
}

/** `Imported 26 images from <path> in 35.6s` — the only line carrying a COUNT. */
const COMPLETION_LINE = /Imported \d+ images? from /;

// ---------------------------------------------------------------------------
// Verdicts — named, never a timeout
// ---------------------------------------------------------------------------

/**
 * CARRIED       every probed image resolved WITHOUT a network pull.
 * BLOCKED       at least one image had to be pulled and could not be.
 * INCONCLUSIVE  the run neither settled nor failed within the budget. NOT a
 *               pass and NOT a failure: a timeout is an absence of evidence,
 *               and the one thing this harness must never do is let an absence
 *               read as a result.
 */
export type PreloadVerdict = "CARRIED" | "BLOCKED" | "INCONCLUSIVE";

export interface RunOutcome {
  readonly verdict: PreloadVerdict;
  /** Images the kubelet tried and failed to pull. */
  readonly blockedImages: readonly string[];
  /** Images the kubelet reported as already present. */
  readonly localImages: readonly string[];
  /** Probed images that produced neither answer inside the budget. */
  readonly undecidedImages: readonly string[];
  readonly detail: string;
}

/**
 * The pair verdict — and this function is the whole integrity of the harness.
 *
 * A positive run alone establishes nothing, because the two ways it can pass
 * (the preload worked / the blackhole did not) are indistinguishable from
 * inside the positive run. Only the negative control separates them, and only
 * if it goes red. So `PROVEN` requires both halves, and a negative control
 * that came back CARRIED does not weaken the result — it VOIDS it.
 */
export type PairVerdict = "PROVEN" | "NOT_PROVEN" | "BLACKHOLE_INEFFECTIVE";

export function pairVerdict(
  positive: RunOutcome,
  negative: RunOutcome,
): { readonly verdict: PairVerdict; readonly reason: string } {
  if (negative.verdict === "CARRIED") {
    return {
      verdict: "BLACKHOLE_INEFFECTIVE",
      reason:
        "the NEGATIVE control passed with an EMPTY images directory, so the images were obtainable without the " +
        "archive — the blackhole did not hold. The positive result is discarded, not reported: it cannot " +
        "distinguish 'the preload worked' from 'the blackhole did not'.",
    };
  }
  if (negative.verdict === "INCONCLUSIVE") {
    return {
      verdict: "NOT_PROVEN",
      reason:
        "the NEGATIVE control neither settled nor blocked within the budget. Absence of evidence is not evidence; " +
        "without a red negative control the positive run proves nothing.",
    };
  }
  if (positive.verdict !== "CARRIED") {
    return {
      verdict: "NOT_PROVEN",
      reason:
        `the POSITIVE run came back ${positive.verdict} with the archive mounted — the preload did not carry ` +
        `every image. Blocked: ${positive.blockedImages.join(", ") || "(none)"}. ` +
        `Undecided: ${positive.undecidedImages.join(", ") || "(none)"}.`,
    };
  }
  return {
    verdict: "PROVEN",
    reason:
      `with ${String(positive.localImages.length)} image(s) resolved locally and every registry in the set ` +
      "blackholed, the preload carried the boot (positive: CARRIED) and the same boot could NOT obtain them " +
      "without it (negative: BLOCKED). Both halves behaved as a falsifier requires.",
  };
}

// ---------------------------------------------------------------------------
// Reading the kubelet's own words
// ---------------------------------------------------------------------------

export type ImageOutcome = "local" | "blocked" | "undecided";

/** Kubelet waiting reasons that mean "not here, and could not be fetched". */
export const PULL_FAILURE_REASONS: readonly string[] = ["ImagePullBackOff", "ErrImagePull", "RegistryUnavailable"];

/**
 * The phrase the kubelet emits when it did NOT go to the network.
 *
 * Matching on the message rather than inferring from a state is deliberate:
 * "the container is running" is compatible with a successful PULL, and the
 * thing under test is precisely whether a pull happened. This string is the
 * only signal that distinguishes them, and it is stable across every
 * Kubernetes release this tree targets.
 */
export const ALREADY_PRESENT = "already present on machine";

/**
 * Event phrasings that mean a pull was attempted and failed.
 *
 * All three are needed. The capitalised form is the ordinary container case;
 * the sandbox form is the one with no container status to report through,
 * because the pod never gets far enough to have a container.
 */
export const PULL_FAILURE_EVENT_PHRASES: readonly string[] = [
  "Failed to pull image",
  "failed to pull image",
  "failed to get sandbox image",
];

export interface ProbeObservation {
  readonly image: string;
  readonly outcome: ImageOutcome;
}

/**
 * Classify each probed image from `kubectl get events` + pod container states.
 *
 * `blocked` wins over `local` when both appear for one image: a pull attempt
 * that failed is the stronger statement, and treating a later "already
 * present" as cancelling it would let a flake launder a real failure.
 */
export function classifyProbes(
  probedImages: readonly string[],
  eventMessages: readonly string[],
  waitingReasonsByImage: ReadonlyMap<string, readonly string[]>,
  runcFailedImages: ReadonlySet<string>,
): readonly ProbeObservation[] {
  return probedImages
    .map((image) => {
      const waiting = waitingReasonsByImage.get(image) ?? [];
      if (waiting.some((r) => PULL_FAILURE_REASONS.includes(r))) return { image, outcome: "blocked" as const };
      const quoted = `"${image}"`;
      // A PULL FAILURE REPORTED IN AN EVENT, not in a container's waiting reason.
      //
      // MEASURED 2026-09-25, and it is why this branch exists: the SANDBOX
      // image's pull failure never reaches a container status at all. The pod
      // sits in `ContainerCreating` forever and the only record is an event —
      // `FailedCreatePodSandBox ... failed to get sandbox image "...": failed to
      // pull image ...`. A classifier reading container states alone called the
      // NEGATIVE CONTROL "INCONCLUSIVE", which under this harness's own rule
      // would have voided a correct positive result. A pull that was attempted
      // and failed is BLOCKED wherever the cluster chose to write it down.
      if (eventMessages.some((m) => m.includes(quoted) && PULL_FAILURE_EVENT_PHRASES.some((p) => m.includes(p)))) {
        return { image, outcome: "blocked" as const };
      }
      if (eventMessages.some((m) => m.includes(quoted) && m.includes(ALREADY_PRESENT))) {
        return { image, outcome: "local" as const };
      }
      // runc refused to exec PROBE_COMMAND — which can only happen after the
      // image was obtained, so it is positive evidence even if the "already
      // present" event has aged out of the API server's event window.
      if (runcFailedImages.has(image)) return { image, outcome: "local" as const };
      return { image, outcome: "undecided" as const };
    })
    .sort((a, b) => stringCompare(a.image, b.image));
}

export function outcomeFromProbes(observations: readonly ProbeObservation[]): RunOutcome {
  const blocked = observations.filter((o) => o.outcome === "blocked").map((o) => o.image);
  const local = observations.filter((o) => o.outcome === "local").map((o) => o.image);
  const undecided = observations.filter((o) => o.outcome === "undecided").map((o) => o.image);
  if (blocked.length > 0) {
    return {
      verdict: "BLOCKED",
      blockedImages: blocked,
      localImages: local,
      undecidedImages: undecided,
      detail: `${String(blocked.length)} image(s) had to be pulled and could not be`,
    };
  }
  if (undecided.length > 0) {
    return {
      verdict: "INCONCLUSIVE",
      blockedImages: [],
      localImages: local,
      undecidedImages: undecided,
      detail: `${String(undecided.length)} image(s) produced neither a local hit nor a pull failure`,
    };
  }
  return {
    verdict: "CARRIED",
    blockedImages: [],
    localImages: local,
    undecidedImages: [],
    detail: `all ${String(local.length)} probed image(s) resolved locally — no pull was attempted`,
  };
}

// ---------------------------------------------------------------------------
// Parsing what the cluster reports
// ---------------------------------------------------------------------------

export interface PodEvent {
  readonly message: string;
}

export function parseEventMessages(eventsJson: string): readonly string[] {
  const parsed = JSON.parse(eventsJson) as { items?: readonly { message?: string }[] };
  return (parsed.items ?? []).map((i) => i.message ?? "").filter((m) => m !== "");
}

/** Waiting reasons and runc-refusal evidence, keyed by the image each container names. */
export function parsePodImageStates(podsJson: string): {
  readonly waitingReasonsByImage: ReadonlyMap<string, readonly string[]>;
  readonly runcFailedImages: ReadonlySet<string>;
} {
  const parsed = JSON.parse(podsJson) as {
    items?: readonly {
      spec?: { containers?: readonly { image?: string }[]; initContainers?: readonly { image?: string }[] };
      status?: {
        containerStatuses?: readonly unknown[];
        initContainerStatuses?: readonly unknown[];
      };
    }[];
  };
  const waiting = new Map<string, string[]>();
  const runcFailed = new Set<string>();
  for (const item of parsed.items ?? []) {
    // The SPEC's image string, not the status's — the status reports the
    // resolved name, which for a digest-pinned reference is not the string the
    // manifest wrote, and the whole question here is about that string.
    const specImages = [...(item.spec?.containers ?? []), ...(item.spec?.initContainers ?? [])].map((c) => c.image);
    const statuses = [...(item.status?.containerStatuses ?? []), ...(item.status?.initContainerStatuses ?? [])];
    for (let i = 0; i < statuses.length; i++) {
      const image = specImages[i];
      if (typeof image !== "string" || image === "") continue;
      const status = statuses[i] as {
        state?: { waiting?: { reason?: string; message?: string }; terminated?: { message?: string } };
        lastState?: { terminated?: { message?: string } };
      };
      const reason = status.state?.waiting?.reason;
      if (reason !== undefined) {
        const existing = waiting.get(image) ?? [];
        existing.push(reason);
        waiting.set(image, existing);
      }
      const messages = [
        status.state?.waiting?.message ?? "",
        status.state?.terminated?.message ?? "",
        status.lastState?.terminated?.message ?? "",
      ].join(" ");
      if (messages.includes(PROBE_COMMAND)) runcFailed.add(image);
    }
  }
  return { waitingReasonsByImage: waiting, runcFailedImages: runcFailed };
}

// ---------------------------------------------------------------------------
// The probe manifest
// ---------------------------------------------------------------------------

/** A Pod per image, naming it verbatim, running a command that cannot exist. */
export function probeManifest(images: readonly string[]): string {
  const documents = [
    `apiVersion: v1\nkind: Namespace\nmetadata:\n  name: ${PROBE_NAMESPACE}`,
    ...images.map((image, index) => {
      const name = `probe-${String(index).padStart(3, "0")}`;
      // The image goes through YAML single-quoting because a digest-pinned
      // reference contains `:` and `@`; an unquoted scalar would be parsed as
      // a mapping and the probe would name the wrong thing.
      return [
        "apiVersion: v1",
        "kind: Pod",
        "metadata:",
        `  name: ${name}`,
        `  namespace: ${PROBE_NAMESPACE}`,
        "spec:",
        "  restartPolicy: Never",
        // Tolerate the not-ready taint: the probes must run BEFORE a CNI
        // exists, which is exactly the moment the bootstrap images are needed.
        "  tolerations:",
        '    - operator: "Exists"',
        "  hostNetwork: true",
        "  containers:",
        `    - name: probe`,
        `      image: '${image.replace(/'/g, "''")}'`,
        "      imagePullPolicy: IfNotPresent",
        `      command: ["${PROBE_COMMAND}"]`,
      ].join("\n");
    }),
  ];
  return `${documents.join("\n---\n")}\n`;
}

// ---------------------------------------------------------------------------
// The docker invocation
// ---------------------------------------------------------------------------

export interface BlackholePlan {
  readonly k3sImage: string;
  /** DNS names pointed at 127.0.0.1 inside the container. */
  readonly blackholed: readonly string[];
  /** Roster files written into the container's server/manifests dir. */
  readonly rosterFiles: readonly string[];
  /** `null` for the negative control — an EMPTY images directory, not a missing mount. */
  readonly archivePath: string | null;
  readonly probedImages: readonly string[];
}

/**
 * The `docker run` argv.
 *
 * THE NEGATIVE CONTROL MOUNTS AN EMPTY DIRECTORY, NOT NOTHING. Leaving the
 * mount out would also change whether the directory exists, and two variables
 * differing between the runs is not a control. One variable changes: whether
 * the archive is in it.
 */
export function dockerRunArgs(opts: {
  readonly name: string;
  readonly plan: BlackholePlan;
  readonly manifestsHostDir: string;
  readonly imagesHostDir: string;
}): readonly string[] {
  const args = [
    "run",
    "-d",
    "--name",
    opts.name,
    "--privileged",
    "--tmpfs",
    "/run",
    "--tmpfs",
    "/var/run",
    "-v",
    // WRITABLE, and the `:ro` that used to be here cost a run: k3s stages its
    // OWN manifests into this directory at startup (`ccm.yaml`, the bundled
    // traefik charts) and dies `failed to stage files: read-only file system`
    // before an API server ever exists. MEASURED 2026-09-25. The images mount
    // below stays read-only, because k3s only ever reads that one.
    `${opts.manifestsHostDir}:/var/lib/rancher/k3s/server/manifests`,
    "-v",
    `${opts.imagesHostDir}:${IMAGES_DIR}:ro`,
  ];
  for (const host of opts.plan.blackholed) args.push("--add-host", `${host}:127.0.0.1`);
  args.push(opts.plan.k3sImage, "server", "--disable=traefik", "--disable=servicelb", "--disable-network-policy");
  return args;
}

/** Hosts to blackhole + the k3s image + the roster + the probe set, all derived. */
export function buildPlan(opts: {
  readonly repoRoot?: string;
  readonly snapshot?: Snapshot;
  readonly archivePath: string | null;
}): { readonly plan: BlackholePlan; readonly roster: readonly RosterEntry[] } {
  const repoRoot = opts.repoRoot ?? REPO_ROOT;
  const snapshot = opts.snapshot ?? loadSnapshot(repoRoot);
  const pin = readKubernetesVersionPin(join(repoRoot, KUBE_VERSION_PATH));
  const roster = buildRoster({
    k3sServerNixPath: join(repoRoot, K3S_SERVER_NIX),
    localStorageNixPath: join(repoRoot, LOCAL_STORAGE_NIX),
  });
  return {
    plan: {
      k3sImage: `rancher/k3s:${k3sVersionToDockerTag(pin.k3sVersion)}`,
      blackholed: blackholeHostnames(snapshot),
      rosterFiles: roster.map((e) => e.filename),
      archivePath: opts.archivePath,
      probedImages: snapshot.images.map((i) => i.reference),
    },
    roster,
  };
}

function docker(args: readonly string[], timeoutMs = 120_000): { status: number; stdout: string; stderr: string } {
  const r = spawnSync("docker", [...args], { encoding: "utf8", timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** One half of the pair. Never throws on a cluster failure — it returns a verdict. */
export async function runHalf(opts: {
  readonly label: string;
  readonly archivePath: string | null;
  readonly repoRoot?: string;
  readonly budgetMs?: number | undefined;
  readonly keep?: boolean | undefined;
}): Promise<RunOutcome> {
  const repoRoot = opts.repoRoot ?? REPO_ROOT;
  const budgetMs = opts.budgetMs ?? 600_000;
  const { plan, roster } = buildPlan({ repoRoot, archivePath: opts.archivePath });
  const nothing: RunOutcome = {
    verdict: "INCONCLUSIVE",
    blockedImages: [],
    localImages: [],
    undecidedImages: plan.probedImages,
    detail: "",
  };

  const workspace = mkdtempSync(join(tmpdir(), `zeta-blackhole-${opts.label}-`));
  const manifestsDir = join(workspace, "manifests");
  const imagesDir = join(workspace, "images");
  mkdirSync(manifestsDir, { recursive: true });
  mkdirSync(imagesDir, { recursive: true });
  for (const entry of roster) writeFileSync(join(manifestsDir, entry.filename), entry.content, "utf8");
  if (plan.archivePath !== null) {
    try {
      copyFileSync(plan.archivePath, join(imagesDir, ARCHIVE_NAME));
    } catch (e) {
      return { ...nothing, detail: `could not stage the archive: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  const name = `zeta-preload-blackhole-${opts.label}-${String(Date.now())}`;
  const started = docker(dockerRunArgs({ name, plan, manifestsHostDir: manifestsDir, imagesHostDir: imagesDir }));
  if (started.status !== 0) {
    return { ...nothing, detail: `docker run failed: ${started.stderr.trim().slice(0, 400)}` };
  }

  try {
    const deadline = Date.now() + budgetMs;

    // WAIT FOR THE IMPORT, AND THE FIRST RUN OF THIS HARNESS DID NOT.
    //
    // k3s brings the API SERVER up before the agent finishes importing
    // `/var/lib/rancher/k3s/agent/images/*` — a ~1.0 GB archive takes tens of
    // seconds — so probes applied at `readyz` land on a containerd that has
    // nothing in it yet and every one of them goes ImagePullBackOff. MEASURED
    // 2026-09-25: the positive run came back BLOCKED on 21 of 25 images with a
    // perfectly good archive mounted.
    //
    // That was the harness lying about the feature, which is the more dangerous
    // direction of the two only because the other direction is the one everyone
    // watches for. It is recorded here rather than quietly fixed because a
    // future edit that reorders these waits would reintroduce it silently.
    //
    // The wait is on k3s's OWN completion line, not on a sleep: a timer would
    // be a guess that gets shorter than the archive on somebody's slower disk.
    // If the line never appears, that is INCONCLUSIVE — never a pass — because
    // an import that did not happen is exactly what this harness must not
    // mistake for one that did.
    if (plan.archivePath !== null) {
      let imported = false;
      // No `&& !imported` in the condition: the only assignment to `imported`
      // is followed immediately by `break`, so the negation could never be
      // false and CodeQL is right to call it trivial (js/trivial-conditional).
      while (Date.now() < deadline) {
        const logs = docker(["logs", name], 120_000);
        if (importCompleted(`${logs.stdout}${logs.stderr}`)) {
          imported = true;
          break;
        }
        await sleep(5_000);
      }
      if (!imported) {
        return { ...nothing, detail: `k3s never reported importing ${ARCHIVE_NAME} inside the budget` };
      }
    }

    // Wait for an API server before applying probes; a failed apply would
    // otherwise read as "no probes ran", which is indistinguishable from a
    // clean run with nothing to say.
    let applied = false;
    while (Date.now() < deadline && !applied) {
      const ready = docker(["exec", name, "kubectl", "get", "--raw", "/readyz"], 60_000);
      if (ready.status === 0) {
        const manifest = probeManifest(plan.probedImages);
        writeFileSync(join(workspace, "probes.yaml"), manifest, "utf8");
        docker(["cp", join(workspace, "probes.yaml"), `${name}:/tmp/zeta-probes.yaml`], 120_000);
        const apply = docker(["exec", name, "kubectl", "apply", "-f", "/tmp/zeta-probes.yaml"], 120_000);
        applied = apply.status === 0;
        if (!applied) await sleep(5_000);
      } else {
        await sleep(5_000);
      }
    }
    if (!applied) return { ...nothing, detail: "the API server never accepted the probe manifest inside the budget" };

    let last = nothing;
    while (Date.now() < deadline) {
      const pods = docker(["exec", name, "kubectl", "get", "pods", "-n", PROBE_NAMESPACE, "-o", "json"], 60_000);
      const events = docker(["exec", name, "kubectl", "get", "events", "-n", PROBE_NAMESPACE, "-o", "json"], 60_000);
      if (pods.status === 0 && events.status === 0) {
        const { waitingReasonsByImage, runcFailedImages } = parsePodImageStates(pods.stdout);
        const messages = parseEventMessages(events.stdout);
        last = outcomeFromProbes(
          classifyProbes(plan.probedImages, messages, waitingReasonsByImage, runcFailedImages),
        );
        if (last.verdict !== "INCONCLUSIVE") return last;
      }
      await sleep(10_000);
    }
    return { ...last, verdict: "INCONCLUSIVE", detail: `${last.detail} (budget of ${String(budgetMs)}ms exhausted)` };
  } finally {
    if (opts.keep !== true) {
      docker(["rm", "-f", name], 120_000);
      rmSync(workspace, { recursive: true, force: true });
    }
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function describe(label: string, outcome: RunOutcome): string {
  const lines = [`  ${label}: ${outcome.verdict} — ${outcome.detail}`];
  for (const image of outcome.blockedImages) lines.push(`      BLOCKED    ${image}`);
  for (const image of outcome.undecidedImages) lines.push(`      UNDECIDED  ${image}`);
  return lines.join("\n");
}

export async function main(argv: readonly string[], repoRoot: string = REPO_ROOT): Promise<number> {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      plan: { type: "boolean" },
      both: { type: "boolean" },
      positive: { type: "boolean" },
      negative: { type: "boolean" },
      archive: { type: "string" },
      keep: { type: "boolean" },
      "budget-ms": { type: "string" },
    },
    strict: true,
  });

  const budgetMs = values["budget-ms"] === undefined ? undefined : Number(values["budget-ms"]);

  if (values.plan === true) {
    const { plan } = buildPlan({ repoRoot, archivePath: null });
    console.log(`k3s image:  ${plan.k3sImage}`);
    console.log(`roster:     ${plan.rosterFiles.join(", ")}`);
    console.log(`probes:     ${String(plan.probedImages.length)} pods, one per preloaded image`);
    console.log("blackholed (derived from the preload snapshot, never typed):");
    for (const host of plan.blackholed) console.log(`  ${host} -> 127.0.0.1`);
    return 0;
  }

  const archive = values.archive === undefined ? null : resolve(repoRoot, values.archive);
  const needsArchive = values.positive === true || values.both === true;
  if (needsArchive && (archive === null || !existsSync(archive))) {
    console.error("--positive and --both need --archive <path> pointing at an existing image archive");
    console.error("build one with: bun src/Core.TypeScript/cluster/bootstrap-image-preload.ts --build-archive --out <path>");
    return 2;
  }

  if (values.both === true) {
    console.log("=== POSITIVE: bootstrap roster, registries blackholed, archive mounted ===");
    const positive = await runHalf({ label: "positive", archivePath: archive, repoRoot, budgetMs, keep: values.keep });
    console.log(describe("positive", positive));
    console.log("\n=== NEGATIVE CONTROL: same boot, EMPTY images directory ===");
    const negative = await runHalf({ label: "negative", archivePath: null, repoRoot, budgetMs, keep: values.keep });
    console.log(describe("negative", negative));
    const pair = pairVerdict(positive, negative);
    console.log(`\n=== ${pair.verdict} ===`);
    console.log(pair.reason);
    return pair.verdict === "PROVEN" ? 0 : 1;
  }

  if (values.negative === true) {
    const outcome = await runHalf({ label: "negative", archivePath: null, repoRoot, budgetMs, keep: values.keep });
    console.log(describe("negative (empty images directory)", outcome));
    // A lone negative run is only informative about the BLACKHOLE, so it
    // "passes" when the pull is blocked — the opposite of the positive run.
    return outcome.verdict === "BLOCKED" ? 0 : 1;
  }

  if (values.positive === true) {
    const outcome = await runHalf({ label: "positive", archivePath: archive, repoRoot, budgetMs, keep: values.keep });
    console.log(describe("positive (archive mounted)", outcome));
    console.log(
      "\nNOTE: a positive run ALONE proves nothing — it cannot distinguish 'the preload worked' from " +
        "'the blackhole did not'. Use --both.",
    );
    return outcome.verdict === "CARRIED" ? 0 : 1;
  }

  console.error("usage: --plan | --both --archive <path> | --positive --archive <path> | --negative");
  return 2;
}

if (import.meta.main) {
  process.exit(await main(Bun.argv.slice(2)));
}
