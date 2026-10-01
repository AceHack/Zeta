#!/usr/bin/env bun
// lint-rendered-manifest-placeholders.ts - no placeholder survives into a manifest the
// cluster applies. docs/ops/INSTALL-TIME-CONFIG.md, "the fail-closed check".
//
// THE FAILURE CLASS. A generic installer edits no file. So any value in the tree that
// says "change me" (`you@example.com # <- CHANGE`, `portal.example.com`, a `:placeholder`
// image tag, `change-me`) is not documentation on a real install - it is applied. The one
// measured instance (#17712) was `email: you@example.com` in a ClusterIssuer: Let's
// Encrypt refused the account, ArgoCD waited on the issuer's health forever, and nothing
// after it was applied. The fix moved two values to install time; THIS is what stops the
// next one arriving by a different door.
//
// WHAT IS SCANNED - the set the cluster actually applies, never a hand-written list:
//   - every Application manifest under k8s/applications (the app-of-apps root reaches them);
//   - every manifest a git-directory Application source reconciles (app-of-apps-discovery's
//     own `sourceReconciles`, so a file nothing applies - `platform/examples/` - is not a
//     finding, and a file something DOES apply cannot hide);
//   - every k8s/bootstrap manifest (the k3s auto-deploy roster);
//   - the install-time TEMPLATES, RENDERED with real-shaped fixture values: the public-TLS
//     Application and the LoadBalancer pool Application, each through its own TypeScript
//     mirror. A template that leaves a token behind, or whose patch writes a placeholder,
//     is caught here and not on a node.
//
// WHAT COUNTS - string VALUES only. Comments are not manifests, and neither are the
// `description` fields of a CRD (the Gateway API CRDs are full of `example.com` as
// documentation). Multi-line string values (a ConfigMap carrying a config file) have their
// comment lines and trailing `# ...` stripped first, for the same reason.
//
// A baseline, not a mute button: every known placeholder is listed WITH an owner and a
// reason, a finding not listed fails, and a listed entry that no longer matches ALSO
// fails (STALE) - a baseline that silently outlives its defect is how a check stops
// checking.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { parseAllDocuments } from "yaml";
import { discoverGitDirectorySources, sourceReconciles } from "../cluster/app-of-apps-discovery.ts";
import { publicTlsObjects, renderPublicTlsApplicationText, yamlDocs } from "../cluster/public-tls.ts";
import { lbPoolObjects, renderLbPoolApplicationText } from "../cluster/lb-ipam-pool.ts";

export interface PlaceholderPattern {
  readonly name: string;
  readonly re: RegExp;
}

/**
 * What "a value somebody forgot to set" looks like. Deliberately narrow: each entry is a
 * string the repo has actually shipped, or the shape of one. A broad pattern ("TODO",
 * "placeholder") makes the baseline the whole tree and the check a mute button.
 */
export const PLACEHOLDER_PATTERNS: readonly PlaceholderPattern[] = [
  { name: "RFC 2606 example domain", re: /\bexample\.(com|org|net)\b/i },
  { name: "RFC 2606 reserved TLD", re: /\.(example|invalid|test)\b/i },
  { name: "you@ / your-<thing> placeholder", re: /\byou@|\byour[-_.](name|email|domain|org|host)\b|<your[-_ ]/i },
  // Word-bounded: an unbounded /replace-?me/ matches "replacement" (Cilium's, Alloy's).
  { name: "change-me value", re: /\bchange-?me\b|\breplace-?me\b/i },
  { name: "image tag :placeholder", re: /:placeholder\b/i },
  { name: "unrendered install-time token", re: /@ZETA_[A-Z0-9_]+@/ },
];

export interface Finding {
  readonly origin: string;
  /** Dotted path to the offending scalar. */
  readonly path: string;
  readonly pattern: string;
  readonly excerpt: string;
}

/** Strip `# ...` and `// ...` comments from a multi-line string value. Single-line values are untouched. */
export function stripEmbeddedComments(value: string): string {
  if (!value.includes("\n")) return value;
  return value
    .split("\n")
    .filter((l) => !/^\s*(#|\/\/)/.test(l))
    .map((l) => l.replace(/\s#\s.*$/, "").replace(/\s\/\/\s.*$/, ""))
    .join("\n");
}

function visit(v: unknown, path: string, origin: string, out: Finding[]): void {
  if (typeof v === "string") {
    const text = stripEmbeddedComments(v);
    for (const p of PLACEHOLDER_PATTERNS) {
      const m = p.re.exec(text);
      if (m !== null) {
        out.push({ origin, path, pattern: p.name, excerpt: text.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30).replace(/\n/g, "\\n") });
      }
    }
  } else if (Array.isArray(v)) {
    v.forEach((x, i) => visit(x, `${path}[${i}]`, origin, out));
  } else if (v !== null && typeof v === "object") {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      // CRD/OpenAPI documentation is prose, and the Gateway API CRDs are full of example.com.
      if (k === "description") continue;
      visit(x, `${path}.${k}`, origin, out);
    }
  }
}

/** Scan parsed documents. Pure: the unit tests drive this over synthetic input. */
export function scanDocs(docs: readonly unknown[], origin: string): Finding[] {
  const out: Finding[] = [];
  for (const d of docs) visit(d, "", origin, out);
  return out;
}

function listYaml(dir: string): string[] {
  const out: string[] = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return out;
    throw error;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...listYaml(p));
    else if (/\.ya?ml$/.test(e.name)) out.push(p);
  }
  return out;
}

const toPosix = (p: string) => p.replaceAll("\\", "/");

/** Real-shaped install-time values: reserved names would trip the scan, these must not. */
export const FIXTURE_PUBLIC_ENDPOINT = { acmeEmail: "ops@zeta-cluster-fixture.net", publicDomain: "zeta-cluster-fixture.net" } as const;
export const FIXTURE_LB_POOL = { start: "10.20.30.200", stop: "10.20.30.210" } as const;

/** The manifests the cluster applies from git, plus the install-time templates rendered. */
export function appliedCorpus(repoRoot: string): ReadonlyArray<{ readonly origin: string; readonly docs: readonly unknown[] }> {
  const corpus: Array<{ origin: string; docs: unknown[] }> = [];
  const sources = discoverGitDirectorySources(repoRoot);
  const k8s = join(repoRoot, "full-ai-cluster/k8s");

  for (const abs of listYaml(join(k8s, "applications"))) {
    const rel = toPosix(relative(repoRoot, abs));
    const docs = parseAllDocuments(readFileSync(abs, "utf8")).map((d) => d.toJS() as unknown);
    const isApplication = docs.some(
      (d) => typeof d === "object" && d !== null && (d as Record<string, unknown>)["kind"] === "Application",
    );
    if (isApplication || sources.some((s) => sourceReconciles(s, rel))) corpus.push({ origin: rel, docs });
  }
  for (const abs of listYaml(join(k8s, "bootstrap"))) {
    const rel = toPosix(relative(repoRoot, abs));
    corpus.push({ origin: rel, docs: parseAllDocuments(readFileSync(abs, "utf8")).map((d) => d.toJS() as unknown) });
  }

  // The install-time templates, rendered.
  corpus.push({
    origin: "(rendered) k8s/public-tls/argocd-application.yaml.in + kustomize base + patches",
    docs: [
      ...yamlDocs(renderPublicTlsApplicationText(FIXTURE_PUBLIC_ENDPOINT, repoRoot)),
      ...publicTlsObjects(FIXTURE_PUBLIC_ENDPOINT, repoRoot),
    ],
  });
  corpus.push({
    origin: "(rendered) k8s/lb-ipam/argocd-application.yaml.in + kustomize base + patch",
    docs: [
      ...yamlDocs(renderLbPoolApplicationText(FIXTURE_LB_POOL.start, FIXTURE_LB_POOL.stop, repoRoot)),
      ...lbPoolObjects(FIXTURE_LB_POOL.start, FIXTURE_LB_POOL.stop, repoRoot),
    ],
  });
  return corpus;
}

export interface KnownPlaceholder {
  readonly origin: string;
  readonly path: string;
  readonly pattern: string;
  /** Whose lane the fix is in. */
  readonly owner: string;
  readonly reason: string;
}

/**
 * Placeholders that ship today, with the lane that owns the fix. Listing one is a
 * DECLARATION that it is a defect someone owns, not a blessing: remove the entry when
 * the value moves to install time or to a real value, and the STALE check holds you to it.
 */
export const KNOWN_PLACEHOLDERS: readonly KnownPlaceholder[] = [
  {
    origin: "full-ai-cluster/k8s/applications/gitlab/Application.yaml",
    path: ".spec.source.helm.valuesObject.global.hosts.domain",
    pattern: "RFC 2606 reserved TLD",
    owner: "gitlab lane",
    reason:
      "`gitlab.invalid` is a DELIBERATE never-resolves sentinel for chart-assembled names this install neither runs nor exposes (pages, smartcard, minio, mail sender); the value that matters is global.hosts.gitlab.name. Tracked in docs/ops/INSTALL-TIME-CONFIG.md; it is the one entry here that is a documented sentinel rather than a forgotten value.",
  },
  {
    origin: "full-ai-cluster/k8s/applications/hat-system/deployment.yaml",
    path: ".spec.template.spec.containers[0].image",
    pattern: "image tag :placeholder",
    owner: "workloads lane (hat-system)",
    reason:
      "`ghcr.io/lucent-financial-group/hat-system-operator:placeholder` - the operator image tag is a placeholder, so the Deployment cannot pull on a fresh install (ImagePullBackOff). Needs a real published tag or a build-time pin.",
  },
  {
    origin: "full-ai-cluster/k8s/applications/platform/blueprints.yaml",
    path: ".spec.variables[2].default",
    pattern: "change-me value",
    owner: "workloads lane (Blueprint postgres)",
    reason:
      "the `postgres` Blueprint's PASSWORD variable defaults to `change-me`: every Deployable of it that does not set one runs with a known password. Needs a generated-per-instance default.",
  },
];

const keyOf = (f: { origin: string; path: string; pattern: string }) => `${f.origin}\t${f.path}\t${f.pattern}`;

export interface Audit {
  readonly unexpected: readonly Finding[];
  readonly stale: readonly KnownPlaceholder[];
  readonly reasonless: readonly KnownPlaceholder[];
  readonly scanned: number;
}

export function auditPlaceholders(repoRoot: string, known: readonly KnownPlaceholder[] = KNOWN_PLACEHOLDERS): Audit {
  const corpus = appliedCorpus(repoRoot);
  const findings = corpus.flatMap((c) => scanDocs(c.docs, c.origin));
  const knownKeys = new Set(known.map(keyOf));
  const seen = new Set(findings.map(keyOf));
  return {
    unexpected: findings.filter((f) => !knownKeys.has(keyOf(f))),
    stale: known.filter((k) => !seen.has(keyOf(k))),
    reasonless: known.filter((k) => k.reason.trim().length < 20 || k.owner.trim().length === 0),
    scanned: corpus.length,
  };
}

function main(): number {
  const repoRoot = resolve(process.cwd());
  const audit = auditPlaceholders(repoRoot);
  if (audit.scanned === 0) {
    console.error("lint-rendered-manifest-placeholders: scanned NOTHING - run from the repo root. A check that did not run is not a pass.");
    return 2;
  }
  let bad = 0;
  for (const f of audit.unexpected) {
    bad++;
    console.error(`PLACEHOLDER  ${f.origin} ${f.path}  [${f.pattern}]  ...${f.excerpt}...`);
  }
  for (const k of audit.stale) {
    bad++;
    console.error(`STALE        ${k.origin} ${k.path} [${k.pattern}] is in KNOWN_PLACEHOLDERS but no longer matches - remove the entry`);
  }
  for (const k of audit.reasonless) {
    bad++;
    console.error(`NO REASON    ${k.origin} ${k.path}: a baseline entry needs an owner and a reason`);
  }
  if (bad === 0) {
    console.log(`rendered-manifest placeholders: OK - ${audit.scanned} manifest sets scanned, ${KNOWN_PLACEHOLDERS.length} owned finding(s) baselined.`);
    return 0;
  }
  console.error(`rendered-manifest placeholders: ${bad} problem(s). A placeholder in an applied manifest ships on every install - move the value to install time (docs/ops/INSTALL-TIME-CONFIG.md).`);
  return 1;
}

if (import.meta.main) process.exit(main());
