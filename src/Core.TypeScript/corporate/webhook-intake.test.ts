/**
 * webhook-intake.test.ts — falsifiers for the door work arrives through.
 *
 * A webhook endpoint is the one surface of this register that an unauthenticated stranger can
 * reach. Everything else is a file somebody put in a directory or a query this organization chose
 * to send. So the tests that matter here are the ones that fail when verification stops verifying,
 * and they are written to fail for the RIGHT reason: a forged signature is the same LENGTH as a
 * real one, so it exercises the comparison rather than the length check standing in front of it.
 */

import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import {
  acceptDelivery,
  fileDelivery,
  isSignatureScheme,
  SignatureScheme,
  verifyDelivery,
  type WebhookConfig,
} from "./webhook-intake";
import { trackerMapper } from "./intake";
import type { ExternalEvent } from "./intake";

const SECRET = "the-shared-secret";

const tmp = (): string => mkdtempSync(join(tmpdir(), "hook-"));

const secretAt = (dir: string, value: string = SECRET): string => {
  const path = join(dir, "secret.txt");
  writeFileSync(path, `${value}\n`, "utf-8");
  return path;
};

const hex = (secret: string, body: string): string =>
  createHmac("sha256", secret).update(body, "utf8").digest("hex");

const config = (over: Partial<WebhookConfig> = {}): WebhookConfig => ({
  sourceId: "linear-eng",
  scheme: SignatureScheme.HmacSha256Hex,
  signatureHeader: "linear-signature",
  secretFile: "/nonexistent",
  map: ["externalId=identifier", "title=title"],
  ...over,
});

const mapper = trackerMapper("hook:linear-eng", ["externalId=identifier", "title=title"]);

const BODY = JSON.stringify({ action: "create", data: { identifier: "ENG-1", title: "a thing" } });

describe("A FORGED SIGNATURE IS REFUSED — and the forgery is the right shape", () => {
  test("a digest computed with the WRONG KEY, of equal length, does not verify", () => {
    const dir = tmp();
    const forged = hex("not-the-secret", BODY);
    const real = hex(SECRET, BODY);
    // The falsifier is only load-bearing if the two are the same length: otherwise a length check
    // in front of the comparison would pass this test while the comparison itself was `a === b[0]`.
    expect(forged.length).toBe(real.length);
    expect(forged).not.toBe(real);

    const out = verifyDelivery({
      config: config({ secretFile: secretAt(dir) }),
      rawBody: BODY,
      headers: { "linear-signature": forged },
      readSecret: (p) => readFileSync(p, "utf-8"),
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toContain("does not match");
  });

  test("the genuine digest verifies", () => {
    const dir = tmp();
    const out = verifyDelivery({
      config: config({ secretFile: secretAt(dir) }),
      rawBody: BODY,
      headers: { "linear-signature": hex(SECRET, BODY) },
      readSecret: (p) => readFileSync(p, "utf-8"),
    });
    expect(out.ok).toBe(true);
  });

  test("a truncated digest is refused rather than throwing", () => {
    // `timingSafeEqual` THROWS on a length mismatch. Without the length check in front of it this
    // is an unhandled 500 for what is simply a wrong signature — and a 500 tells an attacker their
    // guess had an interesting shape.
    const dir = tmp();
    const out = verifyDelivery({
      config: config({ secretFile: secretAt(dir) }),
      rawBody: BODY,
      headers: { "linear-signature": hex(SECRET, BODY).slice(0, 10) },
      readSecret: (p) => readFileSync(p, "utf-8"),
    });
    expect(out.ok).toBe(false);
  });

  test("the signature covers the RAW BYTES, not a re-serialisation of the parsed object", () => {
    // `JSON.parse` then `JSON.stringify` reorders nothing here but DOES drop whitespace, so a body
    // a provider pretty-printed would fail against a digest taken over the round-trip. Verifying
    // the raw body is what makes a perfectly valid delivery verifiable.
    const dir = tmp();
    const spaced = JSON.stringify({ action: "create", data: { identifier: "ENG-1" } }, null, 2);
    const roundTripped = JSON.stringify(JSON.parse(spaced));
    expect(roundTripped).not.toBe(spaced);

    const path = secretAt(dir);
    const read = (p: string): string => readFileSync(p, "utf-8");
    expect(
      verifyDelivery({ config: config({ secretFile: path }), rawBody: spaced, headers: { "linear-signature": hex(SECRET, spaced) }, readSecret: read }).ok,
    ).toBe(true);
    expect(
      verifyDelivery({ config: config({ secretFile: path }), rawBody: spaced, headers: { "linear-signature": hex(SECRET, roundTripped) }, readSecret: read }).ok,
    ).toBe(false);
  });
});

describe("THE PREFIXED SCHEME IS A DIFFERENT SCHEME, NOT A LENIENCY", () => {
  test("GitHub's `sha256=<hex>` verifies under the prefixed scheme", () => {
    const dir = tmp();
    const out = verifyDelivery({
      config: config({ scheme: SignatureScheme.HmacSha256Prefixed, secretFile: secretAt(dir), signatureHeader: "x-hub-signature-256" }),
      rawBody: BODY,
      headers: { "x-hub-signature-256": `sha256=${hex(SECRET, BODY)}` },
      readSecret: (p) => readFileSync(p, "utf-8"),
    });
    expect(out.ok).toBe(true);
  });

  test("a BARE hex digest does NOT verify under the prefixed scheme", () => {
    // The two schemes are not interchangeable in either direction. A verifier that stripped an
    // optional prefix would accept both, which sounds helpful and means the operator's stated
    // scheme is decorative.
    const dir = tmp();
    const out = verifyDelivery({
      config: config({ scheme: SignatureScheme.HmacSha256Prefixed, secretFile: secretAt(dir), signatureHeader: "x-hub-signature-256" }),
      rawBody: BODY,
      headers: { "x-hub-signature-256": hex(SECRET, BODY) },
      readSecret: (p) => readFileSync(p, "utf-8"),
    });
    expect(out.ok).toBe(false);
  });

  test("a PREFIXED digest does not verify under the bare scheme", () => {
    const dir = tmp();
    const out = verifyDelivery({
      config: config({ secretFile: secretAt(dir) }),
      rawBody: BODY,
      headers: { "linear-signature": `sha256=${hex(SECRET, BODY)}` },
      readSecret: (p) => readFileSync(p, "utf-8"),
    });
    expect(out.ok).toBe(false);
  });
});

describe("A HOOK THAT CANNOT VERIFY REFUSES — it never falls through to accepting", () => {
  test("a signing scheme with no secret file refuses every delivery", () => {
    const out = verifyDelivery({
      config: { sourceId: "s", scheme: SignatureScheme.HmacSha256Hex, signatureHeader: "sig", map: [] },
      rawBody: BODY,
      headers: { sig: hex(SECRET, BODY) },
      readSecret: () => SECRET,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toContain("no secret file");
  });

  test("an unreadable or empty secret file refuses, naming the file", () => {
    const out = verifyDelivery({
      config: config({ secretFile: "/no/such/secret" }),
      rawBody: BODY,
      headers: { "linear-signature": hex(SECRET, BODY) },
      readSecret: () => undefined,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toContain("/no/such/secret");
  });

  test("a signing scheme with no signature header configured refuses", () => {
    const dir = tmp();
    const out = verifyDelivery({
      config: { sourceId: "s", scheme: SignatureScheme.HmacSha256Hex, secretFile: secretAt(dir), map: [] },
      rawBody: BODY,
      headers: { "linear-signature": hex(SECRET, BODY) },
      readSecret: (p) => readFileSync(p, "utf-8"),
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toContain("header");
  });

  test("a delivery that carries no signature header at all refuses", () => {
    const dir = tmp();
    const out = verifyDelivery({
      config: config({ secretFile: secretAt(dir) }),
      rawBody: BODY,
      headers: {},
      readSecret: (p) => readFileSync(p, "utf-8"),
    });
    expect(out.ok).toBe(false);
  });

  test("`none` verifies anything — which is exactly why it has to be typed out", () => {
    // Recorded as a test rather than only as a comment: this IS the behaviour, and a reader who
    // expected `none` to be refused somewhere should find out here rather than in production.
    const out = verifyDelivery({
      config: { sourceId: "s", scheme: SignatureScheme.None, map: [] },
      rawBody: BODY,
      headers: {},
      readSecret: () => undefined,
    });
    expect(out.ok).toBe(true);
    expect(isSignatureScheme("sha265")).toBe(false);
    expect(isSignatureScheme("none")).toBe(true);
  });
});

describe("ACCEPTANCE STATUS CODES ARE A RETRY CONTRACT, NOT DECORATION", () => {
  const accept = (over: Partial<WebhookConfig>, body: string, headers: Record<string, string>): ReturnType<typeof acceptDelivery> =>
    acceptDelivery({
      config: config({ scheme: SignatureScheme.None, ...over }),
      rawBody: body,
      headers,
      readSecret: () => undefined,
      toEvent: mapper,
      deliveryId: "d1",
    });

  test("a bad signature is 401", () => {
    const dir = tmp();
    const out = acceptDelivery({
      config: config({ secretFile: secretAt(dir) }),
      rawBody: BODY,
      headers: { "linear-signature": hex("wrong", BODY) },
      readSecret: (p) => readFileSync(p, "utf-8"),
      toEvent: mapper,
      deliveryId: "d1",
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(401);
  });

  test("a body that is not JSON is 400", () => {
    const out = accept({}, "not json at all", {});
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(400);
  });

  test("a delivery type the operator did not ask for is 200, NOT an error", () => {
    // THE FALSIFIER FOR THE RETRY STORM. Providers retry on 4xx/5xx. Refusing an unwanted event
    // type with an error code makes every ignored event arrive again every few minutes, forever,
    // and the inbox looks fine the whole time because nothing is ever written.
    const out = accept(
      { acceptTypes: ["create"], typePath: "action" },
      JSON.stringify({ action: "remove", data: { identifier: "ENG-1", title: "x" } }),
      {},
    );
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.status).toBe(200);
      expect(out.status).toBeLessThan(300);
    }
  });

  test("an accepted delivery type passes the filter", () => {
    const out = accept(
      { acceptTypes: ["create", "update"], typePath: "action", itemPath: "data" },
      JSON.stringify({ action: "update", data: { identifier: "ENG-1", title: "x" } }),
      {},
    );
    expect(out.ok).toBe(true);
  });

  test("NO acceptTypes means every type — an operator who said nothing wants to see it", () => {
    const out = accept(
      { itemPath: "data" },
      JSON.stringify({ action: "anything-at-all", data: { identifier: "ENG-1", title: "x" } }),
      {},
    );
    expect(out.ok).toBe(true);
  });

  test("acceptTypes with no typePath matches nothing — it does not silently accept everything", () => {
    // A filter that cannot read the value it filters on must refuse, not pass. The opposite is the
    // vacuity class: a check that cannot fail.
    const out = accept(
      { acceptTypes: ["create"], itemPath: "data" },
      JSON.stringify({ action: "create", data: { identifier: "ENG-1", title: "x" } }),
      {},
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(200);
  });
});

describe("WHERE THE ITEM SITS IS CONFIGURATION, AND AN ABSENT PATH MEANS THE WHOLE BODY", () => {
  const accept = (over: Partial<WebhookConfig>, body: string): ReturnType<typeof acceptDelivery> =>
    acceptDelivery({
      config: config({ scheme: SignatureScheme.None, ...over }),
      rawBody: body,
      headers: {},
      readSecret: () => undefined,
      toEvent: mapper,
      deliveryId: "d1",
    });

  test("an absent itemPath reads the delivery ITSELF as the item", () => {
    // `atPath(body, "")` splits to `[""]` and looks up a key named "", which is undefined — so an
    // absent path handled by `atPath` alone would refuse every unwrapped provider's delivery.
    const out = accept({}, JSON.stringify({ identifier: "ENG-9", title: "unwrapped" }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.event.title).toBe("unwrapped");
  });

  test("an empty-string itemPath means the same thing as an absent one", () => {
    const out = accept({ itemPath: "   " }, JSON.stringify({ identifier: "ENG-9", title: "unwrapped" }));
    expect(out.ok).toBe(true);
  });

  test("a nested itemPath reads through it", () => {
    const out = accept(
      { itemPath: "payload.issue" },
      JSON.stringify({ payload: { issue: { identifier: "ENG-3", title: "nested" } } }),
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.event.externalId).toBe("ENG-3");
  });

  test("an itemPath pointing at nothing is 400 and NAMES the path", () => {
    const out = accept({ itemPath: "data.issue" }, JSON.stringify({ data: {} }));
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.status).toBe(400);
      expect(out.reason).toContain("data.issue");
    }
  });

  test("a mapping that produces no title is refused, not filed as a blank row", () => {
    const out = acceptDelivery({
      config: config({ scheme: SignatureScheme.None, itemPath: "data" }),
      rawBody: JSON.stringify({ data: { identifier: "ENG-4", headline: "wrong field name" } }),
      headers: {},
      readSecret: () => undefined,
      toEvent: trackerMapper("hook:x", ["externalId=identifier", "title=title"]),
      deliveryId: "d1",
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toContain("title");
  });
});

describe("A RETRY IS ONE EVENT — the delivery id is the filename", () => {
  const event: ExternalEvent = { source: "hook:linear-eng", externalId: "ENG-1", title: "a thing" };

  test("the same delivery filed twice leaves ONE file", () => {
    const dir = tmp();
    const a = fileDelivery(dir, "linear-eng", "delivery-77", event);
    const b = fileDelivery(dir, "linear-eng", "delivery-77", event);
    expect(a).toBe(b);
    expect(readdirSync(dir).filter((f) => f.endsWith(".json"))).toHaveLength(1);
  });

  test("two different deliveries are two files", () => {
    const dir = tmp();
    fileDelivery(dir, "linear-eng", "delivery-77", event);
    fileDelivery(dir, "linear-eng", "delivery-78", event);
    expect(readdirSync(dir).filter((f) => f.endsWith(".json"))).toHaveLength(2);
  });

  test("two SOURCES with the same delivery id do not collide", () => {
    // Providers number their own deliveries; two of them will reach `1` on the same afternoon.
    const dir = tmp();
    const a = fileDelivery(dir, "linear-eng", "1", event);
    const b = fileDelivery(dir, "github-ops", "1", event);
    expect(a).not.toBe(b);
  });

  test("what is written round-trips as the event", () => {
    const dir = tmp();
    const full: ExternalEvent = { ...event, severity: "high", reproduction: "do it twice", evidenceRefs: ["hook:linear-eng/ENG-1"] };
    const at = fileDelivery(dir, "linear-eng", "d1", full);
    expect(JSON.parse(readFileSync(at, "utf-8")) as ExternalEvent).toEqual(full);
  });

  test("a delivery id made of path segments stays INSIDE the inbox", () => {
    // Asserted by containment of the RESOLVED path, never by looking for dots: a delivery id is
    // attacker-influenced in the sense that whoever can post to the endpoint sets the header.
    const dir = tmp();
    for (const nasty of ["../../evil", "..", "a/b/c", "\\\\server\\share", "....//....//x"]) {
      const at = resolve(fileDelivery(dir, "linear-eng", nasty, event));
      expect(at.startsWith(resolve(dir) + sep)).toBe(true);
    }
  });

  test("a very long delivery id does not produce an unwritable filename", () => {
    const dir = tmp();
    const at = fileDelivery(dir, "linear-eng", "x".repeat(5000), event);
    expect(readFileSync(at, "utf-8").length).toBeGreaterThan(0);
  });
});
