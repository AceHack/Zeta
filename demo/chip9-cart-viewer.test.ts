/**
 * Falsifier for demo/chip9-cart-viewer.html.
 *
 * The viewer is a standalone page with no build step, so it has never had a test. It also
 * takes a JSON cart from a textarea — untrusted input — and used to put fields of it into
 * `innerHTML`. CodeQL js/xss-through-dom (alert 466) named one of those flows. MEASURED
 * 2026-09-09 with the stub DOM below, there were five defects, and the two worst were not
 * the XSS:
 *
 *   cart                            behaviour BEFORE the fix
 *   ------------------------------  ---------------------------------------------------
 *   name = "<img src=x onerror=..>" rendered as LIVE MARKUP        (the named alert)
 *   steps = "<img src=y onerror=..>" rendered as LIVE MARKUP       (a SECOND flow, same line)
 *   height 0, goldenRows []         displayed VERIFIED after ZERO comparisons
 *   goldenRows longer than height   displayed VERIFIED, extra rows never compared
 *   romHex / goldenRows absent      uncaught TypeError; page froze on the PREVIOUS render
 *
 * VERIFIED is an integrity claim shown to a person. A loop that ran zero times has verified
 * nothing, and a refusal that leaves the previous render on screen is indistinguishable
 * from an acceptance.
 *
 * The page stays buildless: this file PARSES it (HTMLRewriter, not a regex — the sibling
 * lesson from phase7-csp-proof.ts), evaluates its scripts against a stub DOM, and asserts
 * on what a user would see.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const VIEWER = "demo/chip9-cart-viewer.html";

interface StubEl {
  tag: string;
  innerHTML: string;
  textContent: string;
  value: string;
  className: string;
  children: StubEl[];
  appendChild(c: StubEl): StubEl;
  replaceChildren(...c: StubEl[]): void;
  addEventListener(type: string, fn: () => void): void;
}

function makeEl(tag: string): StubEl {
  return {
    tag, innerHTML: "", textContent: "", value: "", className: "", children: [],
    appendChild(c) { this.children.push(c); return c; },
    replaceChildren(...c) { this.children = c; },
    addEventListener() {},
  };
}

/** Every <script> body in document order, established by a spec-compliant parse. */
async function viewerScript(): Promise<string> {
  const parts: string[] = [];
  let open = -1;
  const rw = new HTMLRewriter().on("script", {
    element() { open = parts.push("") - 1; },
    text(t) { if (open >= 0) parts[open] += t.text; },
  });
  await rw.transform(new Response(readFileSync(VIEWER, "utf8"))).text();
  return parts.join("\n");
}
interface Viewer { meta: StubEl; screen: StubEl; render(json: string): void }

function instantiate(script: string): Viewer {
  const els: Record<string, StubEl> = {
    meta: makeEl("div"), screen: makeEl("div"), cart: makeEl("textarea"), run: makeEl("button"),
  };
  const document = {
    getElementById: (id: string) => els[id] ?? makeEl("div"),
    createElement: (tag: string) => makeEl(tag),
    createDocumentFragment: () => makeEl("#fragment"),
    createTextNode: (t: string) => { const n = makeEl("#text"); n.textContent = t; return n; },
  };
  const api = new Function("document", script + "\nreturn { render };")(document) as { render: () => void };
  return {
    meta: els["meta"]!,
    screen: els["screen"]!,
    render(json: string) {
      for (const key of ["meta", "screen"]) {
        const e = els[key]!;
        e.innerHTML = ""; e.textContent = ""; e.children = [];
      }
      els["cart"]!.value = json;
      api.render();
    },
  };
}

/** Everything a user would SEE, text and markup alike. */
function shown(el: StubEl): string {
  return el.innerHTML + el.textContent + el.children.map(shown).join("");
}

/** ONLY the parts that a browser would parse as HTML. Empty means nothing was injectable. */
function markup(el: StubEl): string {
  return el.innerHTML + el.children.map(markup).join("");
}

const WELL_FORMED = {
  format: "chip9-cart-capture/v1",
  name: "ok",
  width: 64,
  height: 32,
  romHex: "",
  steps: 0,
  goldenRows: Array.from({ length: 32 }, () => "0".repeat(64)),
};

const script = await viewerScript();
const viewer = instantiate(script);

function renderCart(cart: unknown): { seen: string; injected: string } {
  viewer.render(JSON.stringify(cart));
  return { seen: shown(viewer.meta), injected: markup(viewer.meta) + markup(viewer.screen) };
}
describe("the sample cart still works (a stricter viewer that broke the demo is not a fix)", () => {
  test("the page as shipped renders its own sample cart as VERIFIED", () => {
    const { seen, injected } = renderCart(JSON.parse(script.match(/const SAMPLE_CART = (\{[\s\S]*?\});/)![1]!));
    expect(seen).toContain("VERIFIED");
    expect(seen).not.toContain("DRIFT");
    expect(injected).toBe("");
  });
  test("a well-formed all-black cart verifies", () => {
    expect(renderCart(WELL_FORMED).seen).toContain("VERIFIED");
  });
});

describe("js/xss-through-dom (alert 466): cart fields are DATA, never markup", () => {
  const PAYLOAD = "<img src=x onerror=alert(1)>";
  test("a name carrying markup is displayed as inert TEXT", () => {
    const { seen, injected } = renderCart({ ...WELL_FORMED, name: PAYLOAD });
    expect(seen).toContain(PAYLOAD);
    expect(injected).toBe("");
  });
  test("the payload lands in a TEXT node, not an element", () => {
    renderCart({ ...WELL_FORMED, name: PAYLOAD });
    const carriers = viewer.meta.children.filter((c) => c.textContent.includes(PAYLOAD));
    expect(carriers.length).toBeGreaterThan(0);
    for (const c of carriers) expect(c.tag).toBe("#text");
  });
  test("the SECOND flow on the same line — steps — is refused, not rendered", () => {
    const { seen, injected } = renderCart({ ...WELL_FORMED, steps: "<img src=y onerror=alert(2)>" });
    expect(seen).toContain("steps is not an integer");
    expect(injected).toBe("");
  });
  test("a name carrying markup NEVER produces VERIFIED-looking markup", () => {
    for (const p of ["<script>alert(1)</script >", "<svg onload=alert(1)>", "</span><b>x</b>"]) {
      expect(renderCart({ ...WELL_FORMED, name: p }).injected).toBe("");
    }
  });
});
describe("VERIFIED is an integrity claim: it must rest on comparisons that HAPPENED", () => {
  test("height 0 with no golden rows is refused, not VERIFIED", () => {
    const { seen } = renderCart({ ...WELL_FORMED, height: 0, goldenRows: [] });
    expect(seen).not.toContain("VERIFIED");
    expect(seen).toContain("the treaty VM display is 64x32");
  });
  test("goldenRows longer than height is refused, not VERIFIED", () => {
    const { seen } = renderCart({ ...WELL_FORMED, height: 1 });
    expect(seen).not.toContain("VERIFIED");
  });
  test("goldenRows count disagreeing with height is refused by name", () => {
    const { seen } = renderCart({ ...WELL_FORMED, goldenRows: WELL_FORMED.goldenRows.slice(0, 31) });
    expect(seen).toContain("goldenRows must carry exactly 32 rows");
    expect(seen).not.toContain("VERIFIED");
  });
  test("a golden row of the wrong width is refused by index", () => {
    const rows = [...WELL_FORMED.goldenRows];
    rows[7] = "0";
    const { seen } = renderCart({ ...WELL_FORMED, goldenRows: rows });
    expect(seen).toContain("goldenRows[7]");
    expect(seen).not.toContain("VERIFIED");
  });
  test("a cart whose golden rows disagree with the render reports DRIFT", () => {
    const rows = [...WELL_FORMED.goldenRows];
    rows[3] = "7".repeat(64);
    const { seen } = renderCart({ ...WELL_FORMED, goldenRows: rows });
    expect(seen).toContain("DRIFT");
    expect(seen).not.toContain("VERIFIED");
  });
});

describe("a malformed cart is REFUSED BY NAME, never a silent crash", () => {
  const CASES: Array<[string, unknown, string]> = [
    ["romHex absent", { format: "chip9-cart-capture/v1", name: "x", width: 64, height: 32, steps: 0, goldenRows: [] }, "romHex"],
    ["romHex odd length", { ...WELL_FORMED, romHex: "abc" }, "romHex"],
    ["romHex non-hex", { ...WELL_FORMED, romHex: "zz" }, "romHex"],
    ["goldenRows absent", { format: "chip9-cart-capture/v1", name: "x", width: 64, height: 32, romHex: "", steps: 0 }, "goldenRows"],
    ["name not a string", { ...WELL_FORMED, name: 7 }, "name is not a string"],
    ["steps negative", { ...WELL_FORMED, steps: -1 }, "steps"],
    ["steps absurd", { ...WELL_FORMED, steps: 1e9 }, "steps"],
    ["wrong format tag", { ...WELL_FORMED, format: "other/v1" }, "not a chip9-cart-capture/v1"],
    ["an array, not an object", [1, 2, 3], "not a JSON object"],
    ["null", null, "not a JSON object"],
  ];
  for (const [name, cart, expected] of CASES) {
    test(name + " is refused with a message naming the field", () => {
      const { seen, injected } = renderCart(cart);
      expect(seen).toContain(expected);
      expect(seen).not.toContain("VERIFIED");
      expect(injected).toBe("");
    });
  }
  test("invalid JSON is refused", () => {
    viewer.render("{not json");
    expect(shown(viewer.meta)).toContain("not valid JSON");
  });
  test("a refusal CLEARS the previous render rather than leaving it on screen", () => {
    renderCart(WELL_FORMED);
    expect(shown(viewer.meta)).toContain("VERIFIED");
    viewer.render("{not json");
    expect(shown(viewer.meta)).not.toContain("VERIFIED");
  });
});
/**
 * Strip comments so a NEGATIVE source assertion cannot be satisfied by the prose that
 * describes the thing it forbids — this file and the viewer both write the word
 * "innerHTML" in comments explaining why it is gone. Line comments are removed only when
 * the line STARTS with the marker, so a `//` inside a string or regex literal is safe.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join("\n");
}

describe("the HTML-sink class is closed at the source, not per call site", () => {
  test("no HTML sink is assigned anywhere in the viewer scripts", () => {
    const stripped = stripComments(script);
    for (const sink of ["innerHTML", "outerHTML", "insertAdjacentHTML", "document.write"]) {
      expect(stripped).not.toContain(sink);
    }
  });
  test("CONTROL: the stripper is doing work — the raw source DOES name the sink", () => {
    expect(script).toContain("innerHTML");
    expect(stripComments(script)).not.toContain("innerHTML");
  });
  test("no inline style attribute is built from data either", () => {
    expect(stripComments(script)).not.toContain("style=");
  });
});
