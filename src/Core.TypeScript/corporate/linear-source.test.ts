/**
 * linear-source.test.ts — falsifiers for reading Linear, and for the mapping a Linear hook uses.
 *
 * The two tests that earn their place here are regressions for defects a real delivery found and
 * 3000 passing unit tests did not:
 *
 *   - `body=description` was INERT. `trackerMapper` reads `reproduction`, never `body`, so a
 *     delivery carrying a full description arrived with an empty one. A mapping that maps nothing
 *     is worse than one that refuses: the item still arrives, and merely says less.
 *   - `priority: 2` was DROPPED, because the mapper read only strings. A P2 defect entered the
 *     organization as Low and would have been prioritised, staffed and scheduled as Low.
 *
 * Both are asserted end-to-end here — the constants fed through the real mapper — because asserting
 * the constants' own contents would have passed in both cases.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  documentOfIssue,
  linearSource,
  readLinearCredentials,
  severityOfPriority,
  LINEAR_API_URL,
  LINEAR_SEVERITY_MAP,
  LINEAR_WEBHOOK_MAP,
} from "./linear-source";
import { trackerMapper } from "./intake";
import { Fidelity, Port } from "./providers";

const tmp = (): string => mkdtempSync(join(tmpdir(), "linear-"));

const credsAt = (dir: string, value: unknown): string => {
  const path = join(dir, "linear.json");
  writeFileSync(path, typeof value === "string" ? value : JSON.stringify(value), "utf-8");
  return path;
};

/** A delivery shaped the way Linear actually sends one. */
const DELIVERY = {
  identifier: "ENG-4821",
  title: "checkout returns 500 when a coupon is applied twice",
  description: "Applying the same coupon twice returns HTTP 500 instead of a validation error.",
  priority: 2,
  state: { name: "Triage" },
  team: { key: "ENG" },
};

describe("THE LINEAR PRESET IS A MAPPING THAT ACTUALLY MAPS", () => {
  const map = trackerMapper("hook:linear-eng", LINEAR_WEBHOOK_MAP, LINEAR_SEVERITY_MAP);

  test("the description reaches the item as REPRODUCTION, not into a field nobody reads", () => {
    // THE FALSIFIER FOR THE INERT PAIR. `body=description` looked right, read right, and did
    // nothing — `trackerMapper` has no `body` field. Asserting `LINEAR_WEBHOOK_MAP` contains a pair
    // mentioning `description` would have passed while the defect was live.
    const event = map(DELIVERY);
    expect(event.reproduction).toBe(DELIVERY.description);
    expect(event.reproduction ?? "").not.toBe("");
  });

  test("Linear's NUMERIC priority becomes a severity — 2 is high, not low", () => {
    // THE FALSIFIER FOR THE DROPPED NUMBER. The mapper read only strings, so `2` was invisible and
    // every unmapped severity falls to Low: a P2 defect entering as Low, and being staffed as Low.
    expect(map(DELIVERY).severity).toBe("high");
    expect(map({ ...DELIVERY, priority: 1 }).severity).toBe("critical");
    expect(map({ ...DELIVERY, priority: 3 }).severity).toBe("medium");
    expect(map({ ...DELIVERY, priority: 4 }).severity).toBe("low");
  });

  test("`0` — Linear's 'no priority' — is low, and urgency is never invented upward", () => {
    expect(map({ ...DELIVERY, priority: 0 }).severity).toBe("low");
  });

  test("the identifier people actually type is the external id", () => {
    // `ENG-4821`, not the UUID: it is what a branch is named after and what a citation quotes.
    expect(map(DELIVERY).externalId).toBe("ENG-4821");
    expect(map(DELIVERY).title).toBe(DELIVERY.title);
  });

  test("every pair in the preset names a field the mapper reads", () => {
    // The general form of the inert-pair defect: a pair whose LEFT side is a field name nothing
    // consumes is silently discarded. Checked against the fields an `ExternalEvent` actually has.
    const known = new Set(["externalId", "title", "body", "severity", "reproduction", "kind", "evidenceRefs"]);
    for (const pair of LINEAR_WEBHOOK_MAP) {
      const field = pair.slice(0, pair.indexOf("="));
      expect(known.has(field)).toBe(true);
    }
    // And `body` specifically is NOT among the ones this preset uses, because the mapper's own
    // reader is `reproduction` — which is the whole lesson.
    expect(LINEAR_WEBHOOK_MAP.some((p) => p.startsWith("body="))).toBe(false);
  });

  test("the severity table covers every priority Linear can send", () => {
    for (const priority of [0, 1, 2, 3, 4]) {
      expect(LINEAR_SEVERITY_MAP.some((p) => p.startsWith(`${String(priority)}=`))).toBe(true);
    }
  });
});

describe("PRIORITY IS TRANSLATED, NEVER GUESSED", () => {
  const TABLE: readonly (readonly [number, ReturnType<typeof severityOfPriority>])[] = [
    [1, "critical"],
    [2, "high"],
    [3, "medium"],
    [4, "low"],
    [0, "low"],
  ];
  for (const [priority, severity] of TABLE) {
    test(`priority ${String(priority)} is ${severity}`, () => {
      expect(severityOfPriority(priority)).toBe(severity);
    });
  }

  test("an absent or null priority is low — an unprioritised issue is not urgent", () => {
    expect(severityOfPriority(undefined)).toBe("low");
    expect(severityOfPriority(null)).toBe("low");
    expect(severityOfPriority(99)).toBe("low");
  });
});

describe("THE KEY IS A PATH, READ AT CALL TIME", () => {
  test("`apiKey` is accepted", () => {
    const dir = tmp();
    const out = readLinearCredentials(credsAt(dir, { apiKey: "lin_api_x" }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.credentials.apiKey).toBe("lin_api_x");
  });

  test("`token` is accepted too — the Jira file copied and edited must not read as empty", () => {
    const dir = tmp();
    const out = readLinearCredentials(credsAt(dir, { token: "lin_api_y" }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.credentials.apiKey).toBe("lin_api_y");
  });

  test("a missing key refuses and NAMES the field", () => {
    const dir = tmp();
    const out = readLinearCredentials(credsAt(dir, { note: "nothing useful here" }));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toContain("apiKey");
  });

  test("a whitespace-only key is missing, not present", () => {
    const dir = tmp();
    const out = readLinearCredentials(credsAt(dir, { apiKey: "   " }));
    expect(out.ok).toBe(false);
  });

  test("a file that is not JSON, or not an object, refuses by name", () => {
    const dir = tmp();
    expect(readLinearCredentials(credsAt(dir, "not json at all")).ok).toBe(false);
    expect(readLinearCredentials(credsAt(dir, ["a", "list"])).ok).toBe(false);
    expect(readLinearCredentials(join(dir, "nope.json")).ok).toBe(false);
  });

  test("the API url defaults to Linear's and is overridable for a proxy", () => {
    const dir = tmp();
    const plain = readLinearCredentials(credsAt(dir, { apiKey: "k" }));
    expect(plain.ok && plain.credentials.apiUrl).toBe(LINEAR_API_URL);
    const proxied = readLinearCredentials(credsAt(dir, { apiKey: "k", apiUrl: "https://proxy.internal/graphql" }));
    expect(proxied.ok && proxied.credentials.apiUrl).toBe("https://proxy.internal/graphql");
  });
});

/** Replace `fetch` for one call and hand back what the source asked for. */
async function withFetch<T>(
  answer: (url: string, init: RequestInit) => { status?: number; body: unknown },
  run: (seen: { url?: string; variables?: Record<string, unknown> }) => Promise<T>,
): Promise<T> {
  const seen: { url?: string; variables?: Record<string, unknown> } = {};
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    seen.url = String(url);
    seen.variables = (JSON.parse(String(init.body)) as { variables: Record<string, unknown> }).variables;
    const { status = 200, body } = answer(String(url), init);
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: "",
      json: async () => body,
    } as unknown as Response;
  }) as unknown as typeof fetch;
  try {
    return await run(seen);
  } finally {
    globalThis.fetch = original;
  }
}

const issue = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "uuid-1",
  identifier: "ENG-1",
  title: "a thing",
  description: "the body",
  updatedAt: "2026-09-01T10:00:00Z",
  url: "https://linear.app/x/issue/ENG-1",
  state: { name: "Todo" },
  ...over,
});

describe("A REJECTED QUERY IS NOT AN EMPTY WORKSPACE", () => {
  test("GraphQL errors arriving with HTTP 200 refuse, and say what Linear said", () => {
    // THE ONE THAT MATTERS. GraphQL answers 200 on failure, so checking only the HTTP status reads
    // "this key is not authorised for this team" as "this team has no issues" — and the second is
    // indistinguishable from a healthy, empty organization. Grooming would then report that nobody
    // has ever written about anything.
    const dir = tmp();
    return withFetch(
      () => ({ status: 200, body: { errors: [{ message: "Entity not found: Team" }] } }),
      async () => {
        const out = await linearSource({ credentialsPath: credsAt(dir, { apiKey: "k" }) }).read();
        expect(out.ok).toBe(false);
        if (!out.ok) expect(out.reason).toContain("Entity not found");
      },
    );
  });

  test("an HTTP failure refuses too", () => {
    const dir = tmp();
    return withFetch(
      () => ({ status: 401, body: {} }),
      async () => {
        const out = await linearSource({ credentialsPath: credsAt(dir, { apiKey: "k" }) }).read();
        expect(out.ok).toBe(false);
      },
    );
  });

  test("an unreadable credentials file refuses BEFORE any request is sent", async () => {
    let called = false;
    await withFetch(
      () => { called = true; return { body: {} }; },
      async () => {
        const out = await linearSource({ credentialsPath: join(tmp(), "absent.json") }).read();
        expect(out.ok).toBe(false);
      },
    );
    expect(called).toBe(false);
  });

  test("the key is read at CALL time, so a rotated key needs no restart", async () => {
    // The source is constructed while the file does not exist and reads it only when asked. A key
    // captured at construction would make rotation a redeploy.
    const dir = tmp();
    const path = join(dir, "linear.json");
    const source = linearSource({ credentialsPath: path });
    expect((await source.read()).ok).toBe(false);
    writeFileSync(path, JSON.stringify({ apiKey: "arrived-later" }), "utf-8");
    await withFetch(
      () => ({ body: { data: { issues: { nodes: [issue()] } } } }),
      async () => {
        expect((await source.read()).ok).toBe(true);
      },
    );
  });
});

describe("ISSUES BECOME DOCUMENTS A CITATION CAN POINT AT", () => {
  test("the path is the identifier and the revision pins the version read", () => {
    const doc = documentOfIssue({ id: "u", identifier: "ENG-7", title: "t", updatedAt: "2026-09-01T10:00:00Z" });
    expect(doc.path).toBe("ENG-7");
    expect(doc.revision).toBe("2026-09-01T10:00:00Z");
    expect(doc.ref).toBe("linear:2026-09-01T10:00:00Z:ENG-7");
  });

  test("an issue with no updatedAt still produces a stable ref", () => {
    const doc = documentOfIssue({ id: "u", identifier: "ENG-8", title: "t" });
    expect(doc.revision).toBe("0");
    expect(doc.ref).toContain("ENG-8");
  });

  test("the content carries the title and the description", () => {
    const doc = documentOfIssue({ id: "u", identifier: "ENG-9", title: "the headline", description: "the detail", state: { name: "Todo" } });
    expect(doc.content).toContain("the headline");
    expect(doc.content).toContain("the detail");
    expect(doc.content).toContain("Todo");
  });

  test("a read reports its documents as evidence, one ref per document", () => {
    const dir = tmp();
    return withFetch(
      () => ({ body: { data: { issues: { nodes: [issue(), issue({ identifier: "ENG-2" })] } } } }),
      async () => {
        const out = await linearSource({ credentialsPath: credsAt(dir, { apiKey: "k" }) }).read();
        expect(out.ok).toBe(true);
        if (out.ok) {
          expect(out.value).toHaveLength(2);
          expect(out.evidence?.map((e) => e.ref)).toEqual(out.value.map((d) => d.ref));
        }
      },
    );
  });
});

describe("A QUERY SEARCHES THE BODY, NOT ONLY THE TITLE", () => {
  test("the filter looks in title OR description", () => {
    // A title-only search reports "this organization has never written about X" while X sits in the
    // description of the very ticket that asked for it — which is exactly what grooming is looking
    // for, and the failure is silent.
    const dir = tmp();
    return withFetch(
      () => ({ body: { data: { issues: { nodes: [] } } } }),
      async (seen) => {
        await linearSource({ credentialsPath: credsAt(dir, { apiKey: "k" }) }).query("coupon");
        const filter = seen.variables?.["filter"] as { or?: readonly Record<string, unknown>[] };
        expect(filter.or).toHaveLength(2);
        expect(JSON.stringify(filter.or)).toContain("description");
        expect(JSON.stringify(filter.or)).toContain("title");
      },
    );
  });

  test("an empty term sends NO request and returns nothing", async () => {
    let called = false;
    const dir = tmp();
    await withFetch(
      () => { called = true; return { body: {} }; },
      async () => {
        const out = await linearSource({ credentialsPath: credsAt(dir, { apiKey: "k" }) }).query("   ");
        expect(out.ok).toBe(true);
        if (out.ok) expect(out.value).toHaveLength(0);
      },
    );
    expect(called).toBe(false);
  });

  test("configured teams narrow the query; no teams reads everything the key can see", () => {
    const dir = tmp();
    const path = credsAt(dir, { apiKey: "k" });
    return withFetch(
      () => ({ body: { data: { issues: { nodes: [] } } } }),
      async (seen) => {
        await linearSource({ credentialsPath: path, teamKeys: ["ENG", "OPS"] }).read();
        expect(JSON.stringify(seen.variables?.["filter"])).toContain("ENG");
        await linearSource({ credentialsPath: path }).read();
        expect(seen.variables?.["filter"]).toEqual({});
      },
    );
  });

  test("the limit is bounded — a workspace is unbounded and a context window is not", () => {
    const dir = tmp();
    return withFetch(
      () => ({ body: { data: { issues: { nodes: [] } } } }),
      async (seen) => {
        await linearSource({ credentialsPath: credsAt(dir, { apiKey: "k" }), limit: 7 }).read();
        expect(seen.variables?.["first"]).toBe(7);
      },
    );
  });
});

describe("IT IS A READ-ONLY SOURCE, AND SAYS SO", () => {
  test("the port declares itself a real data source that only reads", () => {
    const source = linearSource({ credentialsPath: "/nowhere" });
    expect(source.meta.port).toBe(Port.DataSource);
    expect(source.meta.fidelity).toBe(Fidelity.Real);
    expect(source.meta.describes).toContain("read-only");
  });

  test("there is no write path on the port at all", () => {
    // Structural, not a promise: an agent that could edit Linear could close the ticket it is being
    // judged against. The absence is the guarantee.
    const source = linearSource({ credentialsPath: "/nowhere" }) as unknown as Record<string, unknown>;
    for (const verb of ["write", "create", "update", "mutate", "close", "comment"]) {
      expect(source[verb]).toBeUndefined();
    }
  });

  test("only a query is ever sent — the request body carries no mutation", () => {
    const dir = tmp();
    let sent = "";
    return withFetch(
      (_url, init) => { sent = String(init.body); return { body: { data: { issues: { nodes: [] } } } }; },
      async () => {
        await linearSource({ credentialsPath: credsAt(dir, { apiKey: "k" }) }).read();
        expect(sent).toContain("query Issues");
        expect(sent.toLowerCase()).not.toContain("mutation");
      },
    );
  });
});
