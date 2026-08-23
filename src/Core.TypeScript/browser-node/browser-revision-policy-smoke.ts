import { resolve } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type {
  BrowserRevisionPolicyFixtureApi,
  BrowserRevisionPolicyFixtureRecord,
  BrowserRevisionPolicyFixtureResult,
} from "./browser-revision-policy-fixture";
import type { RevisionPolicyId } from "../persistence/revision-policy";

export const BROWSER_REVISION_POLICY_SMOKE_SCHEMA = "zeta.browser-revision-policy-smoke.v1" as const;

export interface BrowserRevisionPolicyOperationReadout {
  readonly outcome: "accepted" | "refused";
  readonly revision: number | null;
  readonly code: string | null;
}

export interface BrowserRevisionPolicyTranscript {
  readonly policyId: RevisionPolicyId;
  readonly injection: "default" | "explicit";
  readonly reportedPolicyId: RevisionPolicyId;
  readonly initial: BrowserRevisionPolicyOperationReadout;
  readonly concurrentFork: {
    readonly accepted: number;
    readonly refused: number;
    readonly refusalCodes: readonly string[];
    readonly durableRevision: number | null;
    readonly replicasAgree: boolean;
  };
  readonly idempotent: BrowserRevisionPolicyOperationReadout;
  readonly stale: BrowserRevisionPolicyOperationReadout;
  readonly leapfrog: BrowserRevisionPolicyOperationReadout;
  readonly removedThroughFour: boolean;
  readonly recreateAtSeven: BrowserRevisionPolicyOperationReadout;
  readonly revisionOneAfterRecreate: BrowserRevisionPolicyOperationReadout;
  readonly finalRevision: number | null;
  readonly finalReplicasAgree: boolean;
  readonly closedPorts: number;
}

export interface BrowserRevisionPolicySmokeTranscript {
  readonly schema: typeof BROWSER_REVISION_POLICY_SMOKE_SCHEMA;
  readonly policies: readonly BrowserRevisionPolicyTranscript[];
}

export interface BrowserRevisionPolicySmokeFeedback {
  readonly severity: "heat";
  readonly code: "bundle-failed" | "browser-launch-failed" | "smoke-failed" | "assertion-failed";
  readonly detail: string;
}

export type BrowserRevisionPolicySmokeResult =
  | { readonly ok: true; readonly value: BrowserRevisionPolicySmokeTranscript }
  | { readonly ok: false; readonly feedback: BrowserRevisionPolicySmokeFeedback };

type BrowserRevisionPolicySmokeFailure = Extract<BrowserRevisionPolicySmokeResult, { readonly ok: false }>;

interface BrowserRevisionPolicyGlobal {
  readonly __zetaBrowserRevisionPolicy?: BrowserRevisionPolicyFixtureApi;
}

const fixturePath = resolve(import.meta.dir, "browser-revision-policy-fixture.ts");
const timeoutMs = 10_000;
const policyIds: readonly RevisionPolicyId[] = ["compare-and-swap", "monotone-last-writer-wins"];

function failed(code: BrowserRevisionPolicySmokeFeedback["code"], detail: string): BrowserRevisionPolicySmokeFailure {
  return { ok: false, feedback: { severity: "heat", code, detail } };
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function response(body: string, contentType: string): Response {
  return new Response(body, {
    headers: { "cache-control": "no-store", "content-type": contentType },
  });
}

function htmlDocument(): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Zeta browser revision policy</title></head>
<body><script type="module" src="/browser-revision-policy-fixture.js"></script></body>
</html>`;
}

async function buildFixture(): Promise<
  { readonly ok: true; readonly source: string } | BrowserRevisionPolicySmokeFailure
> {
  const built = await Bun.build({ entrypoints: [fixturePath], target: "browser", format: "esm" });
  const output = built.outputs.at(0);
  if (!built.success || output === undefined) {
    return failed(
      "bundle-failed",
      built.logs.map((entry) => entry.message).join(" | ") || "The browser fixture produced no output.",
    );
  }
  return { ok: true, source: await output.text() };
}

async function fixtureApi(page: Page): Promise<true> {
  await page.waitForFunction(
    () => Boolean((globalThis as unknown as BrowserRevisionPolicyGlobal).__zetaBrowserRevisionPolicy),
    undefined,
    { timeout: timeoutMs },
  );
  return true;
}

async function ready(page: Page): Promise<BrowserRevisionPolicyFixtureResult<{ readonly policyId: RevisionPolicyId }>> {
  return page.evaluate(async () => {
    const api = (globalThis as unknown as BrowserRevisionPolicyGlobal).__zetaBrowserRevisionPolicy;
    if (api === undefined) throw new Error("The browser revision-policy fixture is unavailable.");
    return api.ready();
  });
}

async function save(
  page: Page,
  revision: number,
  payload: string,
): Promise<BrowserRevisionPolicyFixtureResult<BrowserRevisionPolicyFixtureRecord>> {
  return page.evaluate(
    async ({ revision: candidateRevision, payload: candidatePayload }) => {
      const api = (globalThis as unknown as BrowserRevisionPolicyGlobal).__zetaBrowserRevisionPolicy;
      if (api === undefined) throw new Error("The browser revision-policy fixture is unavailable.");
      return api.save(candidateRevision, candidatePayload);
    },
    { revision, payload },
  );
}

async function load(
  page: Page,
): Promise<BrowserRevisionPolicyFixtureResult<BrowserRevisionPolicyFixtureRecord | null>> {
  return page.evaluate(async () => {
    const api = (globalThis as unknown as BrowserRevisionPolicyGlobal).__zetaBrowserRevisionPolicy;
    if (api === undefined) throw new Error("The browser revision-policy fixture is unavailable.");
    return api.load();
  });
}

async function remove(page: Page, throughRevision: number): Promise<BrowserRevisionPolicyFixtureResult<boolean>> {
  return page.evaluate(async (revision) => {
    const api = (globalThis as unknown as BrowserRevisionPolicyGlobal).__zetaBrowserRevisionPolicy;
    if (api === undefined) throw new Error("The browser revision-policy fixture is unavailable.");
    return api.remove(revision);
  }, throughRevision);
}

async function close(page: Page): Promise<BrowserRevisionPolicyFixtureResult<null>> {
  return page.evaluate(async () => {
    const api = (globalThis as unknown as BrowserRevisionPolicyGlobal).__zetaBrowserRevisionPolicy;
    if (api === undefined) throw new Error("The browser revision-policy fixture is unavailable.");
    return api.close();
  });
}

function operation(
  result: BrowserRevisionPolicyFixtureResult<BrowserRevisionPolicyFixtureRecord>,
): BrowserRevisionPolicyOperationReadout {
  return result.ok
    ? { outcome: "accepted", revision: result.value.revision, code: null }
    : { outcome: "refused", revision: null, code: result.feedback.code };
}

function sameRecord(
  left: BrowserRevisionPolicyFixtureResult<BrowserRevisionPolicyFixtureRecord | null>,
  right: BrowserRevisionPolicyFixtureResult<BrowserRevisionPolicyFixtureRecord | null>,
): boolean {
  if (!left.ok || !right.ok) return false;
  if (left.value === null || right.value === null) return left.value === right.value;
  return left.value.revision === right.value.revision && left.value.payload === right.value.payload;
}

async function runPolicy(
  context: BrowserContext,
  baseUrl: string,
  policyId: RevisionPolicyId,
): Promise<BrowserRevisionPolicyTranscript> {
  const injection = policyId === "compare-and-swap" ? "explicit" : "default";
  const databaseName = `zeta-browser-revision-policy-${policyId}`;
  const queryParameters: Record<string, string> = { database: databaseName, node: "shared-node" };
  if (injection === "explicit") queryParameters.policy = policyId;
  const query = new URLSearchParams(queryParameters).toString();
  const pageA = await context.newPage();
  const pageB = await context.newPage();
  try {
    await pageA.goto(`${baseUrl}?${query}&tab=a`);
    await fixtureApi(pageA);
    const readyA = await ready(pageA);
    await pageB.goto(`${baseUrl}?${query}&tab=b`);
    await fixtureApi(pageB);
    const readyB = await ready(pageB);
    if (!readyA.ok || !readyB.ok) {
      throw new Error(`IndexedDB fixture failed to open: ${JSON.stringify({ readyA, readyB })}`);
    }

    const initial = await save(pageA, 1, "initial");
    const forkResults = await Promise.all([save(pageA, 2, "fork-a"), save(pageB, 2, "fork-b")]);
    const afterForkA = await load(pageA);
    const afterForkB = await load(pageB);
    const winner = afterForkA.ok && afterForkA.value !== null ? afterForkA.value : { revision: 2, payload: "missing" };
    const idempotent = await save(pageB, winner.revision, winner.payload);
    const stale = await save(pageA, 1, "stale");
    const leapfrog = await save(pageB, 4, "leapfrog");
    const removed = await remove(pageA, 4);
    const recreateAtSeven = await save(pageB, 7, "recreate-seven");
    const revisionOneAfterRecreate = await save(pageA, 1, "restart-one");
    const finalA = await load(pageA);
    const finalB = await load(pageB);
    const closeResults = await Promise.all([close(pageA), close(pageB)]);

    return {
      policyId,
      injection,
      reportedPolicyId: readyA.value.policyId,
      initial: operation(initial),
      concurrentFork: {
        accepted: forkResults.filter((result) => result.ok).length,
        refused: forkResults.filter((result) => !result.ok).length,
        refusalCodes: forkResults
          .filter((result) => !result.ok)
          .map((result) => (result.ok ? "" : result.feedback.code))
          .sort(),
        durableRevision: afterForkA.ok ? (afterForkA.value?.revision ?? null) : null,
        replicasAgree: sameRecord(afterForkA, afterForkB),
      },
      idempotent: operation(idempotent),
      stale: operation(stale),
      leapfrog: operation(leapfrog),
      removedThroughFour: removed.ok && removed.value,
      recreateAtSeven: operation(recreateAtSeven),
      revisionOneAfterRecreate: operation(revisionOneAfterRecreate),
      finalRevision: finalA.ok ? (finalA.value?.revision ?? null) : null,
      finalReplicasAgree: sameRecord(finalA, finalB),
      closedPorts: closeResults.filter((result) => result.ok).length,
    };
  } finally {
    await Promise.all([pageA.close().catch(() => undefined), pageB.close().catch(() => undefined)]);
  }
}

function expectOperation(
  transcript: BrowserRevisionPolicyTranscript,
  name: keyof Pick<
    BrowserRevisionPolicyTranscript,
    "initial" | "idempotent" | "stale" | "leapfrog" | "recreateAtSeven" | "revisionOneAfterRecreate"
  >,
  outcome: BrowserRevisionPolicyOperationReadout["outcome"],
  revision: number | null,
  failures: string[],
): void {
  const value = transcript[name];
  if (value.outcome !== outcome || value.revision !== revision) {
    failures.push(
      `${transcript.policyId}.${name} was ${JSON.stringify(value)}, expected ${outcome} at ${String(revision)}.`,
    );
  }
}

export function validateBrowserRevisionPolicyTranscript(
  transcript: BrowserRevisionPolicySmokeTranscript,
): readonly string[] {
  const failures: string[] = [];
  if (transcript.schema !== BROWSER_REVISION_POLICY_SMOKE_SCHEMA)
    failures.push("The transcript schema is not current.");
  const byPolicy = new Map(transcript.policies.map((policy) => [policy.policyId, policy]));
  for (const policyId of policyIds) {
    const policy = byPolicy.get(policyId);
    if (policy === undefined) {
      failures.push(`The ${policyId} policy is absent from the matrix.`);
      continue;
    }
    if (policy.reportedPolicyId !== policy.policyId) failures.push(`${policyId} did not report its injected policy.`);
    const expectedInjection = policyId === "compare-and-swap" ? "explicit" : "default";
    if (policy.injection !== expectedInjection) {
      failures.push(`${policyId} used ${policy.injection} configuration instead of ${expectedInjection}.`);
    }
    expectOperation(policy, "initial", "accepted", 1, failures);
    if (
      policy.concurrentFork.accepted !== 1 ||
      policy.concurrentFork.refused !== 1 ||
      policy.concurrentFork.refusalCodes.join(",") !== "checkpoint-revision-conflict" ||
      policy.concurrentFork.durableRevision !== 2 ||
      !policy.concurrentFork.replicasAgree
    ) {
      failures.push(
        `${policyId} did not serialize the two-tab revision fork: ${JSON.stringify(policy.concurrentFork)}.`,
      );
    }
    expectOperation(policy, "idempotent", "accepted", 2, failures);
    if (policy.stale.outcome !== "refused" || policy.stale.code !== "checkpoint-revision-conflict") {
      failures.push(`${policyId} did not refuse the stale write.`);
    }
    if (!policy.removedThroughFour) failures.push(`${policyId} did not remove its durable row through revision 4.`);
    if (!policy.finalReplicasAgree) failures.push(`${policyId} tabs disagree on the final durable record.`);
    if (policy.closedPorts !== 2) failures.push(`${policyId} did not close both IndexedDB ports.`);
  }

  const compareAndSwap = byPolicy.get("compare-and-swap");
  if (compareAndSwap !== undefined) {
    if (
      compareAndSwap.leapfrog.outcome !== "refused" ||
      compareAndSwap.leapfrog.code !== "checkpoint-revision-conflict"
    )
      failures.push("Compare-and-swap admitted revision 4 after revision 2.");
    if (
      compareAndSwap.recreateAtSeven.outcome !== "refused" ||
      compareAndSwap.recreateAtSeven.code !== "checkpoint-revision-conflict"
    )
      failures.push("Compare-and-swap admitted revision 7 into an empty store.");
    expectOperation(compareAndSwap, "revisionOneAfterRecreate", "accepted", 1, failures);
    if (compareAndSwap.finalRevision !== 1) failures.push("Compare-and-swap did not finish at revision 1.");
  }

  const monotone = byPolicy.get("monotone-last-writer-wins");
  if (monotone !== undefined) {
    expectOperation(monotone, "leapfrog", "accepted", 4, failures);
    expectOperation(monotone, "recreateAtSeven", "accepted", 7, failures);
    if (
      monotone.revisionOneAfterRecreate.outcome !== "refused" ||
      monotone.revisionOneAfterRecreate.code !== "checkpoint-revision-conflict"
    )
      failures.push("Monotone LWW admitted revision 1 after revision 7.");
    if (monotone.finalRevision !== 7) failures.push("Monotone LWW did not finish at revision 7.");
  }
  return failures;
}

export async function runBrowserRevisionPolicySmoke(): Promise<BrowserRevisionPolicySmokeResult> {
  const fixture = await buildFixture();
  if (!fixture.ok) return fixture;
  let browser: Browser | null = null;
  let server: ReturnType<typeof Bun.serve> | null = null;
  let stage = "startup";
  try {
    const html = htmlDocument();
    server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        const pathname = new URL(request.url).pathname;
        if (pathname === "/") return response(html, "text/html; charset=utf-8");
        if (pathname === "/browser-revision-policy-fixture.js")
          return response(fixture.source, "text/javascript; charset=utf-8");
        return new Response("Not found", { status: 404 });
      },
    });
    try {
      browser = await chromium.launch({ headless: true });
    } catch (error) {
      return failed(
        "browser-launch-failed",
        `${errorDetail(error)} Install the pinned browser with: bun run install:browser-smoke`,
      );
    }
    const context = await browser.newContext();
    const baseUrl = `http://127.0.0.1:${String(server.port)}/`;
    const policies: BrowserRevisionPolicyTranscript[] = [];
    for (const policyId of policyIds) {
      stage = `run ${policyId}`;
      policies.push(await runPolicy(context, baseUrl, policyId));
    }
    stage = "validate transcript";
    const transcript: BrowserRevisionPolicySmokeTranscript = {
      schema: BROWSER_REVISION_POLICY_SMOKE_SCHEMA,
      policies,
    };
    const failures = validateBrowserRevisionPolicyTranscript(transcript);
    return failures.length === 0 ? { ok: true, value: transcript } : failed("assertion-failed", failures.join("; "));
  } catch (error) {
    return failed("smoke-failed", `${stage}: ${errorDetail(error)}`);
  } finally {
    if (browser !== null) await browser.close().catch(() => undefined);
    if (server !== null) await server.stop(true);
  }
}

if (import.meta.main) {
  const result = await runBrowserRevisionPolicySmoke();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
