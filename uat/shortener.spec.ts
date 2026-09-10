/**
 * shortener.spec.ts — acceptance for a delivered service, from outside its process.
 *
 * ── WHY THIS IS NOT MORE UNIT TESTING ────────────────────────────────────────
 * The unit suite calls `createApp()` and asserts what the handlers return. That proves the code does
 * what its author meant. It cannot prove the SERVICE does what the requester asked for, because it
 * never starts one — it shares a process, a module registry and a working directory with the thing
 * under test.
 *
 * This starts the app as a real server and drives it the way a client does: over HTTP, refusing to
 * follow redirects so that the redirect itself is what gets asserted. "GET /:code redirects" is only
 * a checkable claim at this level; one rung down it is a description of a function.
 *
 * ── WHICH APP ────────────────────────────────────────────────────────────────
 * `APP_DIR`, so the same acceptance suite runs against whichever checkout the organization points it
 * at — the change's own worktree during `runtime_validation`, or the merged base afterwards. A spec
 * that hard-coded a path could only ever test one of those, and the interesting one is the branch.
 */
import { test, expect, request } from "playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { join } from "node:path";

const APP_DIR = process.env["APP_DIR"];
if (APP_DIR === undefined || APP_DIR === "") {
  throw new Error("APP_DIR is not set: acceptance has no service to run against, which is not a pass");
}

/** Booted out-of-process on an ephemeral port, so two runs never collide over one. */
const BOOT = [
  `const { createApp } = require(${JSON.stringify(join(APP_DIR, "src", "app"))});`,
  "const a = createApp();",
  "a.server.listen(0, '127.0.0.1', () => process.stdout.write('http://127.0.0.1:' + a.server.address().port));",
].join("\n");

let server: ChildProcess;
let base = "";

test.beforeAll(async () => {
  server = spawn(process.execPath, ["-e", BOOT], { cwd: APP_DIR, stdio: ["ignore", "pipe", "inherit"] });
  const [chunk] = (await once(server.stdout!, "data")) as [Buffer];
  base = String(chunk).trim();
  expect(base).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
});

test.afterAll(() => {
  server?.kill();
});

test("a support agent shortens a link and following it reaches the original", async () => {
  const api = await request.newContext({ baseURL: base });
  const made = await api.post("/shorten", { data: { url: "https://toshibacommerce.com/elera/promotions" } });
  expect(made.status()).toBe(201);
  const { code } = (await made.json()) as { code: string };
  expect(code).toBeTruthy();

  // `maxRedirects: 0` so THE REDIRECT is what is asserted. Following it would assert that the
  // destination is reachable, which is a fact about somebody else's website.
  const followed = await api.get(`/${code}`, { maxRedirects: 0 });
  expect(followed.status()).toBe(302);
  expect(followed.headers()["location"]).toBe("https://toshibacommerce.com/elera/promotions");
  await api.dispose();
});

test("the same link twice is one link", async () => {
  const api = await request.newContext({ baseURL: base });
  const one = await api.post("/shorten", { data: { url: "https://example.com/same" } });
  const two = await api.post("/shorten", { data: { url: "https://example.com/same" } });
  expect(((await one.json()) as { code: string }).code).toBe(((await two.json()) as { code: string }).code);
  await api.dispose();
});

test("a code that was never issued is 404, never a redirect to nowhere", async () => {
  const api = await request.newContext({ baseURL: base });
  expect((await api.get("/definitely-not-a-code", { maxRedirects: 0 })).status()).toBe(404);
  await api.dispose();
});

test("anything that is not an absolute http(s) URL is refused", async () => {
  const api = await request.newContext({ baseURL: base });
  for (const url of ["javascript:alert(1)", "not a url", ""]) {
    expect((await api.post("/shorten", { data: { url } })).status()).toBe(400);
  }
  await api.dispose();
});
