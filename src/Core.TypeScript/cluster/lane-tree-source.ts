#!/usr/bin/env bun

/**
 * src/Core.TypeScript/cluster/lane-tree-source.ts
 *
 * THE RESOURCE-RUNG OVERRIDE POINT: let the CI lane sync a tree that is not the
 * committed one, without changing the committed one and without pushing anything.
 *
 * -- THE PROBLEM, STATED BY THE HARNESS ITSELF ------------------------------
 * `argocd-health-test.ts` already names this, in the blocker note for hindsight:
 *
 *     "THE `dev` RESOURCE RUNG CANNOT REACH THIS LANE, which is the part that
 *      looked like the fix and is not. `storage-profiles.ts --resource-profile
 *      dev --apply` rewrites the WORKING TREE; ArgoCD syncs the COMMITTED tree at
 *      `--git-ref` ... One committed tree, two substrates, no override point."
 *
 * MEASURED 2026-09-03, `storage-profiles.ts --resource-profile <rung> --budget`:
 *
 *     budget: 2500m / 9216Mi   (runner 4000m / 15360Mi, less 1500m / 6144Mi reserved)
 *     dev    dev lane (39 apps):  1165m /  9164Mi   FITS
 *     metal  dev lane (39 apps):  6390m / 14352Mi   DOES NOT FIT
 *
 * The committed tree is `metal` (`single-node-budget.json` -> activeResourceProfile),
 * so CI applies 6390m of requests to one 4000m node. On run 33790413535 that showed
 * up as four pods the scheduler could never place -- `mimir-kafka-0` (metal 1000m
 * against dev 25m), `hindsight-api` (500m/25m), `hindsight-control-plane` and
 * `hindsight-postgresql` (250m/25m each) -- each reporting
 * `0/1 nodes are available: 1 Insufficient cpu`, which leaves `mimir` Degraded and
 * fails the included Synced+Healthy proof.
 *
 * IT IS NOT FIXABLE BY TRIMMING NUMBERS. The gap is 2.5x, and the metal rung is
 * correct for the substrate it names: 6390m on a 16-core box is unremarkable. The
 * two rungs are both right; what is missing is a way for one deployment to get one
 * of them.
 *
 * -- THE OVERRIDE POINT ALREADY EXISTS; NOTHING PUT A RUNG THROUGH IT ---------
 * `ports.ts` builds the root Application from `gitRepoUrl` + `gitRef` + `path`,
 * and `gitRepoUrl` is already an injected parameter (`ZETA_ARGOCD_GIT_REPO_URL`).
 * ArgoCD will clone whatever it is pointed at. So the override point is not a new
 * concept to invent -- it is a repository to point at.
 *
 * This module builds that repository: a copy of `full-ai-cluster/` with the chosen
 * rung applied, committed, and served read-only INSIDE the cluster.
 *
 * -- WHY IN-CLUSTER, AND NOT A PUSHED REF ------------------------------------
 * The obvious alternative is to push the rung-applied tree to a ref and point
 * `--git-ref` at it. Three costs, and the third is disqualifying:
 *
 *   1. It grows the repository on every run. The maintainer's standing concern is
 *      exactly this ("i just really want to protect our repo growth").
 *   2. It needs push credentials, so it cannot work for a fork PR.
 *   3. A SHARED ref races. Two runs in flight force-push the same branch and one
 *      lane silently syncs the other's tree -- a correctness fault, not churn. Per-run
 *      refs avoid the race and make (1) worse.
 *
 * Serving in-cluster has none of those: nothing leaves the runner, nothing is
 * pushed, and two concurrent runs cannot see each other because each cluster holds
 * its own copy.
 *
 * -- WHY DUMB HTTP, AND WHY NO GIT ON THE SERVER -----------------------------
 * The bare repository is built HERE, by the local `git`, including
 * `git update-server-info` -- which is the whole of what git's "dumb HTTP"
 * transport needs. The server is then a STATIC FILE SERVER over that directory,
 * so the serving pod needs no git binary, no smart-HTTP CGI and no credentials.
 * That is deliberate: every capability the server does not have is a thing that
 * cannot break in a lane whose failures cost forty minutes each. `git://` was
 * rejected for the same reason -- the daemon protocol is disabled by default in
 * some hardened git builds, and a transport that might be refused is a transport
 * this lane should not depend on.
 *
 * -- THREE GIT SURFACES, NOT THREE VERSIONS OF ONE BINARY --------------------
 *   BUILDER  host `git` in `buildBareRepo`. GitHub `ubuntu-24.04` is 2.43.x
 *            (this checkout: 2.43.0). That is the only git that WRITES the tree.
 *   SERVER   none. `busybox:1.37.0` `nc` + `LANE_TREE_SERVE_SH` (ash payload
 *            in a ConfigMap; the checkout must not grow a `.sh` entrypoint). No git binary,
 *            no CGI, no credentials. Speaks just enough smart HTTP for the
 *            single pack `buildBareRepo` already built (advertisement + NAK +
 *            pack). busybox `httpd` is not used: it 200s `?service=` with the
 *            dumb refs body, and go-git (Argo CD LsRemote) dies
 *            `failed to list refs: unexpected EOF` (MEASURED 33824995558;
 *            argoproj/argo-cd#17267). Git CLI falls back; go-git does not.
 *            404ing the probe is also wrong: git 2.43 treats 404 as
 *            "repository not found".
 *   CLIENT   Argo CD v3.5.2 repo-server (`quay.io/argoproj/argocd:v3.5.2`,
 *            chart `argo-cd` 10.7.0). LsRemote is go-git (smart HTTP only).
 *            Fetch/clone after that is the distro `git` CLI.
 *
 * -- WHY THIS IS NOT A GITHUB PULL-THROUGH -----------------------------------
 * Same shape as GHCR not being a docker.io pull-through (081M1F1ZG0A). A
 * missing SHA cannot be fetched from GitHub by THIS server:
 *
 *   1. The pod is busybox `nc` plus a smart-HTTP shim over the packed files.
 *      It has no git binary, so it cannot fetch a missing SHA from GitHub. The
 *      TypeScript dumb-HTTP reader already exists
 *      (`docs/design/root-site-iris/site/gitpull.html`, browser-node adapter
 *      `git-dumb-http`): GET `/objects/ab/cd…` + inflate, same-origin so CORS
 *      never fires. That client talks to a GitHub *Pages* bare repo
 *      (`/repo.git/`), not to this pod. Putting it here is a different job.
 *   2. `git clone github.com/...` is smart HTTP (`git-upload-pack`). Pointing
 *      `objects/info/http-alternates` at the forge clone URL therefore 404s.
 *      Pointing it at a Pages-hosted `/repo.git/` is the gitpull.html shape
 *      and could serve missing *blobs*. The miss on 33822942615 was the
 *      GitHub COMMIT object itself, which Pages does not rewrite into the
 *      overlay commit.
 *   3. Fetching the GitHub SHA would return the COMMITTED metal tree. That is
 *      the silent fallback this override exists to refuse. MEASURED
 *      33822942615: ArgoCD asked for `dc2e16e3e…` as an OBJECT; the served
 *      commit is a NEW hash. Serve `main`; ask for `main`.
 *
 * A future object-cache (gitpull.html's `loadObject`, in-cluster) is welcome
 * and is how we will learn to work with in-cluster git. It still must not
 * satisfy a GitHub SHA with the un-overlaid tree.
 *
 * -- WHY THE TREE TRAVELS AS A ConfigMap -------------------------------------
 * MEASURED 2026-09-03: `full-ai-cluster/k8s` is 367 KiB gzipped, `applications/`
 * alone 214 KiB. That fits one ConfigMap with room to spare, so the tree can be
 * delivered by `kubectl apply` like anything else -- no host mount, no `kind`
 * config change (so k3d gets it for free), no image build, no registry.
 * `MAX_TREE_BYTES` below refuses rather than discovering the etcd limit in a
 * lane, and the refusal is a falsifier: it is what will fire the day the tree
 * outgrows this delivery mechanism, which is a real possibility and should arrive
 * as a message rather than as an unexplained apply failure.
 *
 * MEASURED 2026-09-04, live-k3d + live-kind-included 33821540802: packed=411676B
 * (under MAX_TREE_BYTES), then `kubectl apply -f -` died
 * `metadata.annotations: Too long: may not be more than 262144 bytes`. Client-side
 * apply writes the whole YAML into last-applied-configuration. Delivery therefore
 * uses `--server-side --force-conflicts` (see `applyLaneTreeSource`). The 700 KiB
 * packed budget is still the etcd-object ceiling, not the annotation one.
 *
 * -- WHAT THIS MODULE REFUSES ------------------------------------------------
 *   1. a staging copy with zero files                 -> the copy is broken; a
 *      served empty tree would make every Application vanish and read as a clean
 *      prune rather than as a fault
 *   2. a rung whose apply produces zero edits when the committed rung differs
 *      -> the override did nothing, and a lane that believes it is running `dev`
 *      while serving `metal` is the exact false-green this module exists to remove
 *   3. no self-referencing `repoURL` rewritten        -> the child Applications
 *      would still fetch OUR manifests from GitHub at the committed rung, so the
 *      override would cover the Applications and miss everything they point at
 *   4. a packed tree over `MAX_TREE_BYTES`            -> named, not discovered
 */

import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { LANE_TREE_SERVE_SH } from "./lane-tree-serve";

/**
 * Largest packed tree this delivery mechanism accepts, in bytes.
 *
 * A ConfigMap is bounded by etcd's ~1.5 MiB object limit, and the manifest carries
 * the payload base64-encoded (4 bytes per 3), plus the rest of the object. 700 KiB
 * packed is ~933 KiB encoded, which leaves real headroom under that ceiling while
 * being more than twice the measured 367 KiB. Chosen to fire well before the
 * cluster does, because a refusal here names the cause and an etcd rejection in a
 * lane does not.
 */
export const MAX_TREE_BYTES = 700 * 1024;

/** Directory of the repository that the lane serves and ArgoCD clones. */
export const SERVED_SUBTREE = "full-ai-cluster/k8s";

/** Namespace, names and port of the in-cluster server. Lane-only; never in `applications/`. */
export const LANE_TREE_NAMESPACE = "zeta-lane-tree";
export const LANE_TREE_NAME = "zeta-lane-tree";
export const LANE_TREE_PORT = 8080;
export const LANE_TREE_REPO_PATH = "tree.git";

/**
 * Branch the served repository actually has, and therefore the only
 * `targetRevision` ArgoCD may request from it.
 *
 * MEASURED live-k3d + live-kind-included 33822942615: the served repo was
 * initialised with `--initial-branch <GitHub SHA>` and the root Application
 * asked for that SHA. ArgoCD treats a 40-hex `targetRevision` as an OBJECT,
 * not a branch: `git fetch origin dc2e16e3e…` then
 * `Unable to find dc2e16e3e…` / `Cannot obtain needed object`. The commit in
 * the served repo is a NEW hash. Child Applications already say
 * `targetRevision: main`. Serve `main`; ask for `main`.
 */
export const SERVED_GIT_REF = "main";

/**
 * Git (and go-git) probe smart HTTP with `GET info/refs?service=git-upload-pack`.
 * A 200 here is treated as a pkt-line advertisement. Dumb-HTTP servers must 404
 * (or 403) it so the client falls back to GET `info/refs`.
 */
export function isSmartHttpServiceQuery(query: string): boolean {
  return /(?:^|&)service=/.test(query);
}

/** Indent a YAML `|` block so the serve script can ride in a ConfigMap. */
function yamlBlock(value: string, indent: number): string {
  const pad = " ".repeat(indent);
  const trimmed = value.endsWith("\n") ? value.slice(0, -1) : value;
  return trimmed
    .split("\n")
    .map((line) => `${pad}${line}`)
    .join("\n");
}

/**
 * How a repoURL is recognised as pointing at THIS repository.
 *
 * Matched on the owner/name pair rather than a full URL so that the SSH form, the
 * `.git` suffix and a fork's clone_url are all recognised. A rewrite that missed
 * one spelling would leave that Application fetching the committed rung, which
 * refusal 3 above turns into a failure rather than a silent partial override.
 */
const SELF_REPO_MARKERS: readonly string[] = ["Lucent-Financial-Group/Zeta", "AceHack/Zeta"];

export interface StagedTree {
  /** Absolute path of the staging root; contains `full-ai-cluster/...`. */
  readonly root: string;
  /** How many files were copied. Zero is refusal 1. */
  readonly files: number;
  /** Manifests whose `repoURL` was pointed at the in-cluster server. */
  readonly rewritten: readonly string[];
}

/** Count every file under a directory, recursively. */
export function countFiles(dir: string): number {
  let total = 0;
  // `withFileTypes` rather than a follow-up `statSync`: the kind arrives WITH the
  // listing, so there is no second syscall for an entry to change under. A
  // readdir-then-stat pair is a check-then-use race whose check already knew the
  // answer (CWE-367).
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) total += countFiles(path);
    else total += 1;
  }
  return total;
}

/**
 * Point every self-referencing `repoURL` at the in-cluster server.
 *
 * Deliberately a TEXT substitution rather than a YAML round-trip. Re-emitting each
 * Application through a YAML printer would reformat files this lane is supposed to
 * be serving unchanged apart from the rung, and a diff between what CI syncs and
 * what a human reads is a difference nobody asked for. Returns the new text and
 * whether anything matched, so the caller can enforce refusal 3.
 */
export function rewriteSelfRepoUrls(source: string, servedUrl: string): { text: string; rewrote: boolean } {
  let rewrote = false;
  const text = source.replace(/^(\s*repoURL:\s*)(\S+)\s*$/gm, (whole, prefix: string, url: string) => {
    if (!SELF_REPO_MARKERS.some((marker) => url.includes(marker))) return whole;
    rewrote = true;
    return `${prefix}${servedUrl}`;
  });
  return { text, rewrote };
}

/** Walk a tree and apply `rewriteSelfRepoUrls` to every YAML file. */
function rewriteTree(root: string, servedUrl: string): readonly string[] {
  const rewritten: string[] = [];
  const walk = (dir: string): void => {
    // Same reason as `countFiles`: one listing, one answer, no window.
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.name.endsWith(".yaml") && !entry.name.endsWith(".yml")) continue;
      const source = readFileSync(path, "utf8");
      const { text, rewrote } = rewriteSelfRepoUrls(source, servedUrl);
      if (!rewrote) continue;
      writeFileSync(path, text);
      rewritten.push(path.slice(root.length + 1));
    }
  };
  walk(root);
  return rewritten;
}

/** The URL ArgoCD is pointed at. In-cluster DNS, so it resolves from any pod. */
export function laneTreeRepoUrl(namespace = LANE_TREE_NAMESPACE, name = LANE_TREE_NAME): string {
  return `http://${name}.${namespace}.svc.cluster.local:${String(LANE_TREE_PORT)}/${LANE_TREE_REPO_PATH}`;
}

/**
 * Copy `full-ai-cluster/` into a staging root and point its self-references at the
 * served URL. The rung is applied by the CALLER, through
 * `storage-profiles.applyResourceProfile(catalogue, profile, stagedRoot)` -- which
 * already takes a repo root, so no working tree is ever mutated and the rung
 * numbers come from the same code path `--verify` checks.
 */
export function stageLaneTree(repoRoot: string, stagingRoot: string, servedUrl: string): StagedTree {
  rmSync(stagingRoot, { recursive: true, force: true });
  mkdirSync(stagingRoot, { recursive: true });
  cpSync(join(repoRoot, SERVED_SUBTREE), join(stagingRoot, SERVED_SUBTREE), { recursive: true });

  const files = countFiles(join(stagingRoot, SERVED_SUBTREE));
  if (files === 0) {
    throw new Error(
      `lane-tree-source: staged 0 files from ${join(repoRoot, SERVED_SUBTREE)} — serving an empty tree would ` +
        `make every Application disappear, which ArgoCD reports as a clean prune rather than as a fault`,
    );
  }

  const rewritten = rewriteTree(stagingRoot, servedUrl);
  if (rewritten.length === 0) {
    throw new Error(
      "lane-tree-source: no self-referencing repoURL was rewritten — the child Applications would still fetch " +
        "OUR manifests from GitHub at the committed rung, so the override would cover the Applications and miss " +
        "everything they point at",
    );
  }
  return { root: stagingRoot, files, rewritten };
}

export interface BareRepo {
  readonly dir: string;
  readonly sha: string;
}

/**
 * Commit the staged tree and produce a bare repository ready for dumb HTTP.
 *
 * `update-server-info` is the load-bearing call: without it a static server hands
 * a client no `objects/info/packs` and the clone fails with a message about the
 * repository not being found, which is a long way from the cause.
 */
export function buildBareRepo(stagingRoot: string, bareDir: string, gitRef: string): BareRepo {
  const git = (cwd: string, ...args: readonly string[]): string =>
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

  git(stagingRoot, "init", "--quiet", "--initial-branch", SERVED_GIT_REF);
  // Identity is set on the repository, never globally: this runs on a shared
  // runner and on developer machines, and a tool that edits a user's global git
  // config to do its own job is reaching outside its declared channel.
  git(stagingRoot, "config", "user.name", "zeta-lane-tree");
  git(stagingRoot, "config", "user.email", "zeta-lane-tree@localhost");
  git(stagingRoot, "add", "--all");
  git(stagingRoot, "commit", "--quiet", "-m", `lane tree (${gitRef})`);
  const sha = git(stagingRoot, "rev-parse", "HEAD");

  rmSync(bareDir, { recursive: true, force: true });
  mkdirSync(bareDir, { recursive: true });
  git(".", "clone", "--quiet", "--bare", stagingRoot, bareDir);

  // REPACK BEFORE update-server-info, and it is a size fix rather than tidiness.
  // `clone --bare` leaves LOOSE objects: one zlib stream per blob, tree and commit,
  // which is close to gzipping every file separately and throws away all
  // cross-file redundancy. MEASURED 2026-09-03 on this tree: 1,382,400 bytes
  // packed loose against 219,231 for a plain `tar cz` of the same files, i.e. the
  // repository was SIX TIMES larger than the directory it holds and blew the
  // ConfigMap budget on the first run. A single delta-compressed packfile is what
  // makes ConfigMap delivery viable at all.
  //
  // `-a -d` (repack everything into one pack, drop the now-redundant loose
  // objects) rather than `gc --aggressive`, which spends minutes recomputing
  // deltas for a repository that exists for one clone and is then thrown away.
  git(bareDir, "repack", "-adq");
  git(bareDir, "prune-packed");
  // AFTER the repack, never before: `update-server-info` writes the list of packs
  // a dumb-HTTP client fetches, and a list written before the repack names a pack
  // that no longer exists — a clone that 404s on an object it was told to expect.
  git(bareDir, "update-server-info");
  return { dir: bareDir, sha };
}

/** gzip the bare repo, refusing a payload this delivery mechanism cannot carry. */
export function packBareRepo(bareDir: string): Buffer {
  const packed = execFileSync("tar", ["-cz", "-C", bareDir, "."], {
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (packed.length > MAX_TREE_BYTES) {
    throw new Error(
      `lane-tree-source: packed tree is ${String(packed.length)} bytes, over the ${String(MAX_TREE_BYTES)}-byte ` +
        `ConfigMap budget. The tree has outgrown ConfigMap delivery; move it to a volume or split it, and note ` +
        `that this refusal is the intended way to find that out rather than an etcd rejection inside a lane.`,
    );
  }
  return packed;
}

/**
 * The lane-only manifests: a ConfigMap carrying the packed repository, a
 * ConfigMap carrying the smart-HTTP script, and a pod that unpacks once and
 * serves just enough smart HTTP for one pack.
 *
 * `busybox` supplies tar, gzip and `nc` in one small public image, so the
 * server needs nothing built and nothing private. busybox `httpd` is NOT used:
 * it 200s `?service=` with a dumb body and go-git dies unexpected EOF
 * (MEASURED 33824995558). 404ing that probe is also wrong (git 2.43: repo not
 * found). The serve script answers smart HTTP for one pack.
 * The unpack runs in an initContainer so the serving container starts only
 * after the tree is on disk -- otherwise the first clone can race the untar
 * and fail with a 404 that looks like a missing repository.
 */
export function renderLaneTreeManifests(packedBase64: string, image: string): string {
  return `apiVersion: v1
kind: Namespace
metadata:
  name: ${LANE_TREE_NAMESPACE}
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: ${LANE_TREE_NAME}
  namespace: ${LANE_TREE_NAMESPACE}
binaryData:
  tree.tar.gz: ${packedBase64}
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: ${LANE_TREE_NAME}-serve
  namespace: ${LANE_TREE_NAMESPACE}
data:
  serve.sh: |
${yamlBlock(LANE_TREE_SERVE_SH, 4)}
---
apiVersion: v1
kind: Service
metadata:
  name: ${LANE_TREE_NAME}
  namespace: ${LANE_TREE_NAMESPACE}
spec:
  selector:
    app: ${LANE_TREE_NAME}
  ports:
    - port: ${String(LANE_TREE_PORT)}
      targetPort: ${String(LANE_TREE_PORT)}
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${LANE_TREE_NAME}
  namespace: ${LANE_TREE_NAMESPACE}
spec:
  replicas: 4
  selector:
    matchLabels:
      app: ${LANE_TREE_NAME}
  template:
    metadata:
      labels:
        app: ${LANE_TREE_NAME}
    spec:
      initContainers:
        - name: unpack
          image: ${image}
          command: ["sh", "-c", "mkdir -p /srv/${LANE_TREE_REPO_PATH} && tar -xz -C /srv/${LANE_TREE_REPO_PATH} -f /payload/tree.tar.gz"]
          volumeMounts:
            - name: payload
              mountPath: /payload
            - name: srv
              mountPath: /srv
          resources:
            requests:
              cpu: 10m
              memory: 32Mi
      containers:
        - name: serve
          image: ${image}
          # listen: tcpsvd forks per connection when the applet exists; else
          # nc -l is one-at-a-time. replicas: 4 covers the nc fallback.
          # MEASURED live-kind-included 33830308187: ls-remote succeeded, then
          # parallel compares hit connect: connection refused on 10.96.98.57:8080.
          # defaultMode 365 is 0555, so that exec has +x. sh listen is PID 1.
          command: ["sh", "/serve/serve.sh", "listen"]
          ports:
            - containerPort: ${String(LANE_TREE_PORT)}
          readinessProbe:
            # Probes the repository's own info file, not "/" — a server that is up
            # while the tree is missing would otherwise read as ready and hand
            # ArgoCD a 404 that looks like a bad repoURL. No query string: the
            # smart-HTTP probe is a pkt-line advertisement, not the dumb file.
            httpGet:
              path: /${LANE_TREE_REPO_PATH}/info/refs
              port: ${String(LANE_TREE_PORT)}
            initialDelaySeconds: 1
            periodSeconds: 2
          volumeMounts:
            - name: srv
              mountPath: /srv
            - name: serve
              mountPath: /serve
              readOnly: true
          resources:
            requests:
              cpu: 10m
              memory: 32Mi
      volumes:
        - name: payload
          configMap:
            name: ${LANE_TREE_NAME}
        - name: srv
          emptyDir: {}
        - name: serve
          configMap:
            name: ${LANE_TREE_NAME}-serve
            defaultMode: 365
`;
}

/**
 * The only part of the served subtree ArgoCD ever reads: every root and child
 * Application's `source.path` is `full-ai-cluster/k8s/applications[/...]`.
 */
export const SERVED_APPLICATIONS_DIR = `${SERVED_SUBTREE}/applications`;

/**
 * Drop everything in the staged subtree except `applications/`, AFTER the rung has
 * been applied (the rung reads the staged ledgers) and BEFORE the commit.
 *
 * MEASURED 2026-09-22: the packed tree reached 1001072 B against the 716800 B
 * budget and every served-tree lane died at bootstrap. Most of it was never served
 * to ArgoCD at all: `bootstrap/gateway-api-crds.yaml` alone is 598 KB (k3s applies
 * it, not ArgoCD), plus the JSON ledgers, `tests/` and docs. Tools that need
 * `bootstrap/` read it from the repo checkout, never from this tree.
 */
export function pruneToServedApplications(stagingRoot: string): void {
  const subtree = join(stagingRoot, SERVED_SUBTREE);
  for (const entry of readdirSync(subtree)) {
    if (entry !== "applications") rmSync(join(subtree, entry), { recursive: true, force: true });
  }
  if (countFiles(join(stagingRoot, SERVED_APPLICATIONS_DIR)) === 0) {
    throw new Error(`lane-tree-source: ${SERVED_APPLICATIONS_DIR} is empty after pruning -- nothing for ArgoCD to sync`);
  }
}

/** Convenience for callers that want the whole pipeline in one call. */
export function buildLaneTreeBundle(options: {
  readonly repoRoot: string;
  readonly workDir: string;
  readonly gitRef: string;
  readonly image: string;
  readonly applyRung: (stagedRoot: string) => number;
}): { readonly manifests: string; readonly staged: StagedTree; readonly repo: BareRepo; readonly packedBytes: number } {
  const stagingRoot = resolve(options.workDir, "tree");
  const bareDir = resolve(options.workDir, "tree.git");
  const staged = stageLaneTree(options.repoRoot, stagingRoot, laneTreeRepoUrl());

  const edits = options.applyRung(stagingRoot);
  if (edits === 0) {
    throw new Error(
      "lane-tree-source: applying the rung to the staged tree produced 0 edits — the override did nothing, and a " +
        "lane that believes it is running one rung while serving another is the false-green this exists to remove",
    );
  }

  pruneToServedApplications(stagingRoot);
  const repo = buildBareRepo(stagingRoot, bareDir, options.gitRef);
  const packed = packBareRepo(bareDir);
  return {
    manifests: renderLaneTreeManifests(packed.toString("base64"), options.image),
    staged,
    repo,
    packedBytes: packed.length,
  };
}
