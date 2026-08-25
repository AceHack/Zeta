/**
 * CROSS-MANIFEST CONSISTENCY FOR THE RAW-YAML APPLY SET AT agentic-organization/deploy/k8s.
 *
 * WHY THIS EXISTS, AND WHAT IT IS *NOT* DUPLICATING.
 *
 * These files are not a Helm chart and not an ArgoCD Application set --
 * they are raw Kubernetes YAML that an operator applies with a single
 * `kubectl apply -f deploy/k8s/`. That is the tree a USB-booted node actually
 * runs, so a defect here is a machine that comes up broken in front of someone
 * holding a stick.
 *
 * Two checks already cover this directory, and both are real:
 *   - `yamllint -d relaxed` (gate.yml lint-yaml-k8s) -- syntax, indentation,
 *     duplicate keys. Catches a malformed file.
 *   - `kubeconform -strict -ignore-missing-schemas` (same job) -- the
 *     Kubernetes API schema. Catches a typo'd field or a wrong apiVersion.
 *
 * Neither can see ACROSS documents, and that is where this tree's real failures
 * live. Every finding below is schema-VALID YAML that a cluster accepts at apply
 * time and that fails later, at run time, with a symptom that does not name its
 * cause:
 *
 *   - a Service whose `targetPort: http` names a port no container declares --
 *     apply succeeds, the Service gets zero endpoints, and every client sees a
 *     connection refused that looks like the server crashed;
 *   - an env var pointing at `http://tempo:4318` when no Service `tempo` exposes
 *     4318 -- apply succeeds, telemetry silently goes nowhere;
 *   - a volume naming a ConfigMap that no document in the set creates -- the pod
 *     stays in ContainerCreating forever with the reason three `kubectl describe`
 *     levels down;
 *   - a template file that `kubectl apply -f <dir>` picks up ANYWAY because
 *     kubectl filters by EXTENSION, not by filename. `.example.yaml` still ends
 *     in `.yaml`.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. It does not re-check schema (kubeconform
 * owns that), it does not lint YAML style (yamllint owns that), and it does not
 * assert a node memory budget -- no hardware spec for the USB target is written
 * down anywhere in this repo, so a numeric ceiling here would be a toy wearing a
 * gate's uniform. What it does instead is REPORT the summed requests and limits
 * and FAIL only on a container that declares no requests at all, because a
 * BestEffort container is the kubelet's first eviction victim and that is a
 * property of the manifest, not of the node.
 *
 * Composes with:
 *   .github/workflows/gate.yml  lint-yaml-k8s   (the job that runs it)
 *   src/Core.TypeScript/cluster/audit-agentic-org-manifests.test.ts (the falsifiers)
 *   src/Core.TypeScript/hygiene/audit-observability-chain.ts (the same CLASS of
 *     check -- endpoint-names-a-port-the-Service-does-not-expose -- for the OTHER
 *     cluster tree, full-ai-cluster/k8s/applications. This file is that discipline
 *     pointed at the tree it never covered.)
 */

import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { parseAllDocuments } from "yaml";

/** A single cross-manifest defect. `check` is the stable machine-readable class. */
export type Finding = {
  readonly check: string;
  readonly file: string;
  readonly message: string;
};

export type AuditResult = {
  readonly findings: readonly Finding[];
  /** Files kubectl would apply from this directory, in apply order. */
  readonly applySet: readonly string[];
  /** Reported, not gated -- see CHECK H. `file:workload/container` each. */
  readonly containersWithoutLimits: readonly string[];
  /** Summed pod resource requests/limits across the apply set, for the report. */
  readonly totals: ResourceTotals;
  readonly documentCount: number;
};

export type ResourceTotals = {
  readonly requestCpuMilli: number;
  readonly requestMemoryMi: number;
  readonly limitCpuMilli: number;
  readonly limitMemoryMi: number;
};

type Doc = {
  readonly file: string;
  readonly index: number;
  readonly value: Record<string, unknown>;
};

type Workload = {
  readonly doc: Doc;
  readonly namespace: string;
  readonly podLabels: Readonly<Record<string, string>>;
  readonly containers: readonly Container[];
};

type Container = {
  readonly name: string;
  readonly image: string;
  readonly portNames: readonly string[];
  readonly portNumbers: readonly number[];
  readonly hasRequests: boolean;
  readonly hasLimits: boolean;
};

type ServiceDoc = {
  readonly doc: Doc;
  readonly name: string;
  readonly namespace: string;
  readonly selector: Readonly<Record<string, string>>;
  readonly ports: readonly ServicePort[];
};

type ServicePort = {
  readonly port: number;
  readonly targetPort: string | number | undefined;
};

export const DEFAULT_DIR = "agentic-organization/deploy/k8s";

/**
 * `kubectl apply -f <dir>` is NOT recursive and selects by EXTENSION ONLY.
 * Mirrors k8s.io/cli-runtime resource.FileVisitor: ".json", ".yaml", ".yml".
 * A file named `foo.example.yaml` matches. That is the whole point of check A.
 */
const KUBECTL_EXTENSIONS = [".json", ".yaml", ".yml"] as const;

/**
 * Filename fragments that declare a file to be a TEMPLATE for a human to copy,
 * fill in and apply -- never a document the apply set should contain.
 */
const TEMPLATE_MARKERS = [".example.", ".template.", ".sample.", ".tpl."] as const;

/** Hosts that are never in-cluster Service DNS names. */
const NON_SERVICE_HOSTS = new Set(["localhost"]);

/**
 * KNOWN, REASONED IMAGE EXCEPTIONS.
 *
 * Both entries below are REAL bring-up blockers for a USB-booted node, and both
 * are recorded here rather than "fixed", because the only fixes available offline
 * would be worse than the defect:
 *
 *   - pinning hindsight to a tag invented here produces ImagePullBackOff on a tag
 *     that may not exist, which is strictly worse than a floating tag;
 *   - `agentic-org-worker` has no registry to be pushed to, so rewriting the
 *     reference would name an image that certainly does not resolve.
 *
 * So the register's job is to turn two UNDOCUMENTED MANUAL STEPS into a committed,
 * diffable, machine-checked statement. It is STALE-GUARDED: an entry that matches
 * no image in the tree FAILS the audit, so a corrected reference cannot leave a
 * false excuse behind -- the exact failure mode gate.yml's "are the deferral
 * reasons still true" step exists for on the other cluster tree.
 */
export type ImageException = {
  readonly image: string;
  readonly check: string;
  readonly reason: string;
  readonly liftsWhen: string;
};

export const IMAGE_EXCEPTIONS: readonly ImageException[] = [
  {
    image: "ghcr.io/vectorize-io/hindsight:latest",
    check: "image-unpinned",
    reason:
      "The design docs specify the floating tag deliberately -- DYNAMIC_MEMORY_SYSTEM_DESIGN.md section 13 " +
      "and its H1 spike row both name 'ghcr.io/vectorize-io/hindsight:latest'. No concrete published tag for " +
      "this image is recorded anywhere in this repository, and inventing one offline would turn a " +
      "reproducibility weakness into a hard ImagePullBackOff.",
    liftsWhen:
      "A published hindsight tag is recorded in the tree, at which point 35-hindsight.yaml pins it and this " +
      "entry is deleted.",
  },
  {
    image: "agentic-org-worker:keepalive",
    check: "image-local-only",
    reason:
      "Built and side-loaded BY HAND; it exists in no registry. The only recorded procedure is " +
      "agentic-organization/docs/HANDOFF_GOAL_ORCHESTRATION_MOAT.md line 267: `docker build -t " +
      "agentic-org-worker:keepalive . && kind load docker-image agentic-org-worker:keepalive --name " +
      "agentic-org`. On any node where that load has not happened -- which includes every freshly " +
      "USB-booted node -- the worker Deployment sits in ImagePullBackOff, because IfNotPresent still PULLS " +
      "when the image is absent and docker.io/library/agentic-org-worker:keepalive does not exist.",
    liftsWhen:
      "The worker image is published to a registry and 30-worker.yaml names it by that fully-qualified " + "reference.",
  },
];

function exceptionFor(image: string, check: string): ImageException | undefined {
  return IMAGE_EXCEPTIONS.find((e) => e.image === image && e.check === check);
}

/**
 * IMAGES THIS REPOSITORY BUILDS ITSELF, by repository name (tag-independent).
 *
 * Deliberately a ROSTER and not a name-shape heuristic. "No registry host" would
 * also flag `nats:2.14.1-alpine`, which is a perfectly pullable docker.io/library
 * image -- a check that cannot tell a locally-built artifact from an official one
 * is a check that cries wolf, and those get switched off.
 *
 * A locally-built image is unpullable on any node where someone has not run the
 * build-and-side-load by hand, which is the property that matters for a USB boot.
 */
export const LOCALLY_BUILT_IMAGE_REPOSITORIES: readonly string[] = [
  // agentic-organization/Dockerfile -- ENTRYPOINT node apps/workers/src/main.ts
  "agentic-org-worker",
];

export function isLocallyBuiltImage(image: string): boolean {
  return LOCALLY_BUILT_IMAGE_REPOSITORIES.includes(imageRepository(image));
}

/** The repository part of a reference: everything before the final tag separator. */
export function imageRepository(image: string): string {
  const lastSlash = image.lastIndexOf("/");
  const colon = image.lastIndexOf(":");
  return colon > lastSlash ? image.slice(0, colon) : image;
}

/**
 * Bare single-label hosts only -- in-cluster Service DNS. A dotted host
 * (`api.linear.app`, `foo.svc.cluster.local`) is external or fully-qualified and
 * is deliberately out of scope: this check resolves same-namespace short names,
 * which is the form every manifest in this tree actually uses.
 */
const URL_RE =
  /\b[a-z][a-z0-9+.-]*:\/\/(?:[^/@\s"']*@)?([a-z0-9](?:[-a-z0-9]*[a-z0-9])?)(?::(\d{1,5}))?(?![a-z0-9.-])/gi;

const WORKLOAD_KINDS = new Set(["Deployment", "StatefulSet", "DaemonSet", "ReplicaSet"]);

export function auditDirectory(dir: string): AuditResult {
  const applySet = kubectlApplySet(dir);
  const findings: Finding[] = [];

  // ── CHECK A: apply-set hygiene ────────────────────────────────────────────
  // A template that still carries a kubectl-visible extension IS applied.
  for (const file of applySet) {
    const marker = TEMPLATE_MARKERS.find((m) => basename(file).includes(m));
    if (marker !== undefined) {
      findings.push({
        check: "apply-set-contains-template",
        file,
        message:
          `filename marks this a template ('${marker}') but it still ends in a kubectl-visible ` +
          `extension, so \`kubectl apply -f ${dir}/\` APPLIES IT. kubectl selects by EXTENSION ` +
          `(.json/.yaml/.yml) and never by filename. REMEDY: move it to a sibling directory that is ` +
          `not the apply target (preferred -- it stays inside the yamllint/kubeconform globs), or ` +
          `rename so '.example' is the FINAL extension (e.g. 'x.yaml.example').`,
      });
    }
  }

  const docs = loadDocuments(dir, applySet, findings);
  const workloads = docs.filter((d) => WORKLOAD_KINDS.has(kindOf(d))).map(toWorkload);
  const services = docs.filter((d) => kindOf(d) === "Service").map(toService);
  const configMaps = new Map<string, Set<string>>();
  const secrets = new Set<string>();

  for (const d of docs) {
    const name = metaName(d);
    const ns = metaNamespace(d);
    if (kindOf(d) === "ConfigMap") {
      const data = asRecord(d.value.data);
      configMaps.set(`${ns}/${name}`, new Set(Object.keys(data)));
    }
    if (kindOf(d) === "Secret") secrets.add(`${ns}/${name}`);
  }

  // ── CHECK B: every Service selector matches some workload's pod labels ─────
  for (const svc of services) {
    const matched = workloads.filter((w) => w.namespace === svc.namespace && isSuperset(w.podLabels, svc.selector));
    if (Object.keys(svc.selector).length === 0) {
      findings.push({
        check: "service-without-selector",
        file: svc.doc.file,
        message: `Service ${svc.namespace}/${svc.name} declares no selector, so it can never get endpoints from this apply set.`,
      });
      continue;
    }
    if (matched.length === 0) {
      findings.push({
        check: "service-selector-matches-nothing",
        file: svc.doc.file,
        message:
          `Service ${svc.namespace}/${svc.name} selects ${fmtLabels(svc.selector)} and NO workload in the ` +
          `apply set carries those pod-template labels. Apply succeeds; the Service gets zero endpoints and ` +
          `every client sees connection-refused.`,
      });
      continue;
    }

    // ── CHECK C: a NAMED targetPort must be declared by a selected container ─
    for (const p of svc.ports) {
      if (typeof p.targetPort !== "string") continue;
      const declared = matched.flatMap((w) => w.containers.flatMap((c) => c.portNames));
      if (!declared.includes(p.targetPort)) {
        findings.push({
          check: "service-named-targetport-undeclared",
          file: svc.doc.file,
          message:
            `Service ${svc.namespace}/${svc.name} port ${p.port} has targetPort '${p.targetPort}', but the ` +
            `selected pod declares containerPort name(s) [${declared.join(", ") || "<none>"}]. A named ` +
            `targetPort that no container declares yields an endpoint with no port: schema-valid, silently dead.`,
        });
      }
    }
  }

  // ── CHECK D: in-cluster host:port references resolve to a Service + port ───
  const svcByKey = new Map(services.map((s) => [`${s.namespace}/${s.name}`, s]));
  for (const d of docs) {
    const ns = metaNamespace(d);
    for (const ref of extractUrlRefs(d)) {
      if (NON_SERVICE_HOSTS.has(ref.host)) continue;
      const svc = svcByKey.get(`${ns}/${ref.host}`);
      if (svc === undefined) {
        // Only a reference that LOOKS like this tree's own naming is a finding;
        // an unknown single-label host may legitimately be an external name.
        // Restrict to hosts some document in the set names as a Service or workload.
        const knownHere =
          services.some((s) => s.name === ref.host) || workloads.some((w) => metaName(w.doc) === ref.host);
        if (!knownHere) continue;
        findings.push({
          check: "reference-to-service-in-other-namespace",
          file: d.file,
          message: `${describe(d)} references '${ref.raw}' but Service '${ref.host}' is not in namespace '${ns}'.`,
        });
        continue;
      }
      if (ref.port === undefined) continue;
      if (!svc.ports.some((p) => p.port === ref.port)) {
        findings.push({
          check: "reference-to-unexposed-service-port",
          file: d.file,
          message:
            `${describe(d)} references '${ref.raw}' but Service ${svc.namespace}/${svc.name} exposes port(s) ` +
            `[${svc.ports.map((p) => p.port).join(", ") || "<none>"}]. The connection is refused at run time; ` +
            `nothing fails at apply time.`,
        });
      }
    }
  }

  // ── CHECK E/F: volume + envFrom references are satisfied by the apply set ──
  for (const w of workloads) {
    const spec = podSpec(w.doc);
    for (const vol of asArray(spec.volumes)) {
      const v = asRecord(vol);
      const cm = asRecord(v.configMap);
      const cmName = typeof cm.name === "string" ? cm.name : undefined;
      if (cmName !== undefined && !configMaps.has(`${w.namespace}/${cmName}`)) {
        findings.push({
          check: "volume-configmap-missing",
          file: w.doc.file,
          message:
            `${describe(w.doc)} mounts ConfigMap '${cmName}' which no document in the apply set creates in ` +
            `namespace '${w.namespace}'. The pod hangs in ContainerCreating.`,
        });
      }
      const sec = asRecord(v.secret);
      const secName = typeof sec.secretName === "string" ? sec.secretName : undefined;
      if (secName !== undefined && v.optional !== true && !secrets.has(`${w.namespace}/${secName}`)) {
        findings.push({
          check: "volume-secret-missing",
          file: w.doc.file,
          message: `${describe(w.doc)} mounts Secret '${secName}', absent from the apply set and not marked optional.`,
        });
      }
    }

    // subPath keys must exist in the named ConfigMap.
    const volConfigMap = new Map<string, string>();
    for (const vol of asArray(spec.volumes)) {
      const v = asRecord(vol);
      const cm = asRecord(v.configMap);
      if (typeof v.name === "string" && typeof cm.name === "string") volConfigMap.set(v.name, cm.name);
    }
    for (const cRaw of asArray(spec.containers)) {
      const c = asRecord(cRaw);
      for (const mRaw of asArray(c.volumeMounts)) {
        const m = asRecord(mRaw);
        if (typeof m.subPath !== "string" || typeof m.name !== "string") continue;
        const cmName = volConfigMap.get(m.name);
        if (cmName === undefined) continue;
        const keys = configMaps.get(`${w.namespace}/${cmName}`);
        if (keys !== undefined && !keys.has(m.subPath)) {
          findings.push({
            check: "volumemount-subpath-key-missing",
            file: w.doc.file,
            message:
              `${describe(w.doc)} mounts subPath '${m.subPath}' from ConfigMap '${cmName}', whose data keys are ` +
              `[${[...keys].join(", ") || "<none>"}]. The mount silently produces an empty directory.`,
          });
        }
      }

      // envFrom: a NON-optional ref must be satisfied by the apply set.
      for (const efRaw of asArray(c.envFrom)) {
        const ef = asRecord(efRaw);
        const sr = asRecord(ef.secretRef);
        if (typeof sr.name === "string" && sr.optional !== true && !secrets.has(`${w.namespace}/${sr.name}`)) {
          findings.push({
            check: "envfrom-secret-missing",
            file: w.doc.file,
            message:
              `${describe(w.doc)} has envFrom secretRef '${sr.name}' with optional unset/false, and no Secret of ` +
              `that name is in the apply set. Every pod stays in CreateContainerConfigError.`,
          });
        }
        const cr = asRecord(ef.configMapRef);
        if (typeof cr.name === "string" && cr.optional !== true && !configMaps.has(`${w.namespace}/${cr.name}`)) {
          findings.push({
            check: "envfrom-configmap-missing",
            file: w.doc.file,
            message: `${describe(w.doc)} has envFrom configMapRef '${cr.name}' with optional unset/false, absent from the apply set.`,
          });
        }
      }
    }
  }

  // ── CHECK G: images must be tag-pinned and pullable on a fresh node ───────
  const usedExceptions = new Set<string>();
  const noLimits: string[] = [];
  for (const w of workloads) {
    for (const c of w.containers) {
      const tag = imageTag(c.image);
      const raise = (check: string, message: string): void => {
        const exception = exceptionFor(c.image, check);
        if (exception !== undefined) {
          usedExceptions.add(`${exception.image}|${exception.check}`);
          return;
        }
        findings.push({ check, file: w.doc.file, message });
      };

      if (tag === undefined) {
        raise(
          "image-unpinned",
          `${describe(w.doc)} container '${c.name}' image '${c.image}' has no tag, so it resolves to ':latest' and is not reproducible across a reboot.`,
        );
      } else if (tag === "latest") {
        raise(
          "image-unpinned",
          `${describe(w.doc)} container '${c.name}' image '${c.image}' is pinned to ':latest'. Two nodes booted a week apart run different code.`,
        );
      }

      if (isLocallyBuiltImage(c.image)) {
        raise(
          "image-local-only",
          `${describe(w.doc)} container '${c.name}' image '${c.image}' is built by this repository and published to ` +
            `no registry, so on a node where it was not side-loaded by hand the pod sits in ImagePullBackOff.`,
        );
      }

      // ── CHECK H: requests ────────────────────────────────────────────────
      // GATED. Absence of requests means BestEffort QoS, and the kubelet evicts
      // BestEffort pods FIRST under node memory pressure. On a single USB-booted
      // node that ordering decides which service dies, so it must be deliberate.
      if (!c.hasRequests) {
        findings.push({
          check: "container-without-requests",
          file: w.doc.file,
          message:
            `${describe(w.doc)} container '${c.name}' declares no resources.requests, giving it BestEffort QoS. ` +
            `On a single node under memory pressure the kubelet evicts BestEffort pods FIRST -- so this is the ` +
            `first thing to die, and the manifest nowhere says so.`,
        });
      }
      // REPORTED, NOT GATED. A memory limit chosen without a measured working set
      // is an invented number, and a limit that is too low causes OOMKills that
      // NO limit does not -- so gating this would push authors into guessing, and
      // the guess is the more dangerous artifact. Named in the report instead.
      if (!c.hasLimits) noLimits.push(`${w.doc.file}:${metaName(w.doc)}/${c.name}`);
    }
  }

  // ── CHECK I: no stale exception ───────────────────────────────────────────
  // A reasoned exclusion whose subject no longer exists is a false sentence with
  // every mechanical property of a true one. Refuse it.
  for (const e of IMAGE_EXCEPTIONS) {
    if (!usedExceptions.has(`${e.image}|${e.check}`)) {
      findings.push({
        check: "stale-image-exception",
        file: "src/Core.TypeScript/cluster/audit-agentic-org-manifests.ts",
        message:
          `IMAGE_EXCEPTIONS carries an entry for '${e.image}' (${e.check}) that matches no container in the ` +
          `apply set. The exception is stale -- delete it rather than leave a false excuse standing.`,
      });
    }
  }

  return {
    findings,
    applySet,
    containersWithoutLimits: noLimits,
    totals: sumResources(docs.filter((d) => WORKLOAD_KINDS.has(kindOf(d)))),
    documentCount: docs.length,
  };
}

// ── the apply set ───────────────────────────────────────────────────────────

export function kubectlApplySet(dir: string): readonly string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((n) => KUBECTL_EXTENSIONS.some((ext) => n.toLowerCase().endsWith(ext)))
    .sort();
}

function loadDocuments(dir: string, files: readonly string[], findings: Finding[]): Doc[] {
  const out: Doc[] = [];
  for (const file of files) {
    const text = readFileSync(join(dir, file), "utf8");
    const parsed = parseAllDocuments(text);
    parsed.forEach((doc, index) => {
      if (doc.errors.length > 0) {
        findings.push({
          check: "yaml-parse-error",
          file,
          message: `document ${index} failed to parse: ${doc.errors[0]?.message ?? "unknown"}`,
        });
        return;
      }
      const value: unknown = doc.toJS();
      if (value === null || typeof value !== "object" || Array.isArray(value)) return;
      out.push({ file, index, value: value as Record<string, unknown> });
    });
  }
  return out;
}

// ── projections ─────────────────────────────────────────────────────────────

function kindOf(d: Doc): string {
  return typeof d.value.kind === "string" ? d.value.kind : "";
}

function metaName(d: Doc): string {
  const m = asRecord(d.value.metadata);
  return typeof m.name === "string" ? m.name : "<unnamed>";
}

function metaNamespace(d: Doc): string {
  const m = asRecord(d.value.metadata);
  return typeof m.namespace === "string" ? m.namespace : "default";
}

function describe(d: Doc): string {
  return `${kindOf(d) || "<no kind>"} ${metaNamespace(d)}/${metaName(d)}`;
}

function podSpec(d: Doc): Record<string, unknown> {
  return asRecord(asRecord(asRecord(asRecord(d.value.spec).template).spec));
}

function toWorkload(doc: Doc): Workload {
  const template = asRecord(asRecord(doc.value.spec).template);
  const labels = asRecord(asRecord(template.metadata).labels);
  const podLabels: Record<string, string> = {};
  for (const [k, v] of Object.entries(labels)) if (typeof v === "string") podLabels[k] = v;

  const containers = asArray(podSpec(doc).containers).map((cRaw): Container => {
    const c = asRecord(cRaw);
    const ports = asArray(c.ports).map(asRecord);
    const resources = asRecord(c.resources);
    return {
      name: typeof c.name === "string" ? c.name : "<unnamed>",
      image: typeof c.image === "string" ? c.image : "",
      portNames: ports.map((p) => p.name).filter((n): n is string => typeof n === "string"),
      portNumbers: ports.map((p) => p.containerPort).filter((n): n is number => typeof n === "number"),
      hasRequests: Object.keys(asRecord(resources.requests)).length > 0,
      hasLimits: Object.keys(asRecord(resources.limits)).length > 0,
    };
  });

  return { doc, namespace: metaNamespace(doc), podLabels, containers };
}

function toService(doc: Doc): ServiceDoc {
  const spec = asRecord(doc.value.spec);
  const sel = asRecord(spec.selector);
  const selector: Record<string, string> = {};
  for (const [k, v] of Object.entries(sel)) if (typeof v === "string") selector[k] = v;

  const ports = asArray(spec.ports).map((pRaw): ServicePort => {
    const p = asRecord(pRaw);
    const tp = p.targetPort;
    return {
      port: typeof p.port === "number" ? p.port : Number.NaN,
      targetPort: typeof tp === "string" || typeof tp === "number" ? tp : undefined,
    };
  });

  return { doc, name: metaName(doc), namespace: metaNamespace(doc), selector, ports };
}

// ── URL references ──────────────────────────────────────────────────────────

type UrlRef = { readonly raw: string; readonly host: string; readonly port: number | undefined };

function extractUrlRefs(d: Doc): readonly UrlRef[] {
  const texts: string[] = [];
  collectStrings(d.value, texts);
  const out: UrlRef[] = [];
  const seen = new Set<string>();
  for (const t of texts) {
    for (const m of t.matchAll(URL_RE)) {
      const raw = m[0];
      const host = m[1];
      if (host === undefined || seen.has(raw)) continue;
      seen.add(raw);
      out.push({ raw, host, port: m[2] === undefined ? undefined : Number(m[2]) });
    }
  }
  return out;
}

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, out);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) collectStrings(v, out);
  }
}

// ── resources ───────────────────────────────────────────────────────────────

export function parseCpuMilli(raw: unknown): number {
  if (typeof raw === "number") return Math.round(raw * 1000);
  if (typeof raw !== "string") return 0;
  return raw.endsWith("m") ? Number(raw.slice(0, -1)) : Math.round(Number(raw) * 1000);
}

export function parseMemoryMi(raw: unknown): number {
  if (typeof raw === "number") return Math.round(raw / (1024 * 1024));
  if (typeof raw !== "string") return 0;
  const units: readonly (readonly [string, number])[] = [
    ["Gi", 1024],
    ["Mi", 1],
    ["Ki", 1 / 1024],
    ["G", (1000 * 1000 * 1000) / (1024 * 1024)],
    ["M", (1000 * 1000) / (1024 * 1024)],
  ];
  for (const [suffix, factor] of units) {
    if (raw.endsWith(suffix)) return Math.round(Number(raw.slice(0, -suffix.length)) * factor);
  }
  return Math.round(Number(raw) / (1024 * 1024));
}

function sumResources(workloadDocs: readonly Doc[]): ResourceTotals {
  let requestCpuMilli = 0;
  let requestMemoryMi = 0;
  let limitCpuMilli = 0;
  let limitMemoryMi = 0;
  for (const d of workloadDocs) {
    const replicas =
      typeof asRecord(d.value.spec).replicas === "number" ? (asRecord(d.value.spec).replicas as number) : 1;
    for (const cRaw of asArray(podSpec(d).containers)) {
      const r = asRecord(asRecord(cRaw).resources);
      const req = asRecord(r.requests);
      const lim = asRecord(r.limits);
      requestCpuMilli += parseCpuMilli(req.cpu) * replicas;
      requestMemoryMi += parseMemoryMi(req.memory) * replicas;
      limitCpuMilli += parseCpuMilli(lim.cpu) * replicas;
      limitMemoryMi += parseMemoryMi(lim.memory) * replicas;
    }
  }
  return { requestCpuMilli, requestMemoryMi, limitCpuMilli, limitMemoryMi };
}

// ── small helpers ───────────────────────────────────────────────────────────

function imageTag(image: string): string | undefined {
  if (image.startsWith("sha256:") || image.includes("@sha256:")) return "digest";
  const lastSlash = image.lastIndexOf("/");
  const colon = image.lastIndexOf(":");
  if (colon <= lastSlash) return undefined;
  return image.slice(colon + 1);
}

function isSuperset(labels: Readonly<Record<string, string>>, selector: Readonly<Record<string, string>>): boolean {
  return Object.entries(selector).every(([k, v]) => labels[k] === v);
}

function fmtLabels(labels: Readonly<Record<string, string>>): string {
  return Object.entries(labels)
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

// ── CLI ─────────────────────────────────────────────────────────────────────

export function render(result: AuditResult, dir: string): string {
  const lines: string[] = [];
  lines.push(`apply set (${result.applySet.length} files kubectl would apply from ${dir}/):`);
  for (const f of result.applySet) lines.push(`  ${f}`);
  lines.push(`Kubernetes documents parsed: ${result.documentCount}`);
  const t = result.totals;
  // STATED, NOT GATED. No USB-node hardware spec is written down anywhere in this
  // repo, so there is no honest ceiling to compare these against. They are printed
  // so the operator can compare them against the node actually in their hand.
  lines.push(
    `pod resource totals (REPORTED, not gated -- no node budget is on file): ` +
      `requests ${t.requestCpuMilli}m CPU / ${t.requestMemoryMi}Mi memory; ` +
      `limits ${t.limitCpuMilli}m CPU / ${t.limitMemoryMi}Mi memory`,
  );
  lines.push(
    result.containersWithoutLimits.length === 0
      ? "containers with no resources.limits (REPORTED, not gated): none"
      : `containers with no resources.limits (REPORTED, not gated -- a guessed limit OOMKills where no limit ` +
          `does not): ${result.containersWithoutLimits.join(", ")}`,
  );
  if (IMAGE_EXCEPTIONS.length > 0) {
    lines.push(`reasoned image exceptions in force (${IMAGE_EXCEPTIONS.length}), each a real bring-up step:`);
    for (const e of IMAGE_EXCEPTIONS) lines.push(`  [${e.check}] ${e.image} -- LIFTS WHEN: ${e.liftsWhen}`);
  }
  if (result.findings.length === 0) {
    lines.push("Results: 0 findings.");
    return lines.join("\n");
  }
  lines.push("");
  for (const f of result.findings) lines.push(`FAIL [${f.check}] ${f.file}: ${f.message}`);
  lines.push("");
  lines.push(`Results: ${result.findings.length} findings.`);
  return lines.join("\n");
}

function main(): void {
  const argv = process.argv.slice(2);
  const dirFlag = argv.indexOf("--dir");
  const dir = dirFlag >= 0 ? (argv[dirFlag + 1] ?? DEFAULT_DIR) : DEFAULT_DIR;

  let result: AuditResult;
  try {
    result = auditDirectory(dir);
  } catch (error) {
    console.error(`audit-agentic-org-manifests: cannot read ${dir}: ${String(error)}`);
    process.exit(1);
  }

  // A run that discovered no manifests is NOT a clean run -- it is a check that
  // did not run, and reporting it as success is the vacuity class.
  if (result.applySet.length === 0) {
    console.error(`audit-agentic-org-manifests: no kubectl-visible files under ${dir}/ -- refusing to report success.`);
    process.exit(1);
  }
  if (result.documentCount === 0) {
    console.error(
      `audit-agentic-org-manifests: parsed 0 Kubernetes documents under ${dir}/ -- refusing to report success.`,
    );
    process.exit(1);
  }

  console.log(render(result, dir));
  process.exit(result.findings.length === 0 ? 0 : 1);
}

if (import.meta.main) main();
