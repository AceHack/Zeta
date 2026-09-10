/**
 * Falsifier for phase7-csp-proof.ts.
 *
 * EVERY case below is a payload that the previous regex implementation reported as CLEAN
 * (measured 2026-09-09; the table is reproduced in the proof header). A test here going
 * green while the corresponding barrier is removed is the failure this file exists to
 * prevent, so each case asserts the NAME of the check that must fail — not merely that
 * something failed.
 */
import { describe, expect, test } from "bun:test";
import {
  auditHtml,
  isSameOrigin,
  localPathOf,
  parseCsp,
  parseHtmlFacts,
} from "./phase7-csp-proof.js";

const LOCKED_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; " +
  "connect-src 'self'; base-uri 'none'; object-src 'none'; form-action 'none'";

/** A document that passes every check. Payloads are injected into its body. */
function documentWith(bodyExtra: string, csp: string = LOCKED_CSP): string {
  return [
    "<!doctype html><html><head>",
    '<meta http-equiv="Content-Security-Policy" content="' + csp + '">',
    '<link rel="stylesheet" href="inventory.css">',
    "</head><body>",
    bodyExtra,
    '<script src="lib/inventory-viewer.js"></script>',
    "</body></html>",
  ].join("");
}

async function failingLabels(html: string): Promise<string[]> {
  const report = await auditHtml(html, { assetDir: "/nowhere", exists: () => true });
  return report.filter((r) => !r.ok).map((r) => r.label);
}
test("baseline document passes every check", async () => {
  expect(await failingLabels(documentWith(""))).toEqual([]);
});

describe("end-tag holes CodeQL js/bad-tag-filter named (all PASSED the regex gate)", () => {
  const END_TAG_PAYLOADS: Array<[string, string]> = [
    ["trailing space", "<script>alert(1)</script >"],
    ["trailing newline", "<script>alert(1)</script\n>"],
    ["trailing tab", "<script>alert(1)</script\t>"],
    ["trailing solidus", "<script>alert(1)</script/>"],
    ["uppercase end tag", "<script>alert(1)</SCRIPT >"],
    ["mixed case both tags", "<ScRiPt>alert(1)</ScRiPt >"],
  ];
  for (const [name, payload] of END_TAG_PAYLOADS) {
    test(name + " is reported as an inline script body", async () => {
      expect(await failingLabels(documentWith(payload))).toContain("no inline <script> bodies");
    });
  }
});

describe("quote holes: an unquoted attribute value is still an attribute", () => {
  test("unquoted on*= handler is reported", async () => {
    expect(await failingLabels(documentWith("<div onclick=alert(1)>x</div>"))).toContain(
      "no inline on*= handlers",
    );
  });
  test("unquoted style= attribute is reported", async () => {
    expect(await failingLabels(documentWith("<div style=color:red>x</div>"))).toContain(
      "no style= attributes",
    );
  });
  test("uppercase ONCLICK is reported", async () => {
    expect(await failingLabels(documentWith('<div ONCLICK="alert(1)">x</div>'))).toContain(
      "no inline on*= handlers",
    );
  });
});
describe("the hole CodeQL did NOT name: a loop with zero subjects is not a passing check", () => {
  test("unquoted off-origin script src is FOUND and reported off-origin", async () => {
    const labels = await failingLabels(documentWith("<script src=//evil.example/x.js></script>"));
    expect(labels).toContain("script src same-origin: //evil.example/x.js");
  });

  test("a document with no <script src> fails the non-vacuity guard", async () => {
    const html =
      "<!doctype html><html><head>" +
      '<meta http-equiv="Content-Security-Policy" content="' + LOCKED_CSP + '">' +
      '<link rel="stylesheet" href="inventory.css">' +
      "</head><body></body></html>";
    expect(await failingLabels(html)).toContain(
      "script-src loop non-vacuous (at least one <script src>)",
    );
  });

  test("a document with no stylesheet link fails the non-vacuity guard", async () => {
    const html =
      "<!doctype html><html><head>" +
      '<meta http-equiv="Content-Security-Policy" content="' + LOCKED_CSP + '">' +
      '</head><body><script src="lib/inventory-viewer.js"></script></body></html>';
    expect(await failingLabels(html)).toContain(
      "stylesheet loop non-vacuous (at least one <link rel=stylesheet>)",
    );
  });

  test("off-origin stylesheet href is reported", async () => {
    const html =
      "<!doctype html><html><head>" +
      '<meta http-equiv="Content-Security-Policy" content="' + LOCKED_CSP + '">' +
      '<link rel=stylesheet href=https://evil.example/a.css>' +
      '</head><body><script src="lib/inventory-viewer.js"></script></body></html>';
    expect(await failingLabels(html)).toContain(
      "stylesheet same-origin: https://evil.example/a.css",
    );
  });
});
describe("no false positives — a stricter gate that cries wolf gets turned off", () => {
  test("a script inside an HTML comment is inert and NOT flagged", async () => {
    expect(await failingLabels(documentWith("<!-- <script>alert(1)</script> -->"))).toEqual([]);
  });
  test("a <script src> with an empty body is not an inline script", async () => {
    expect(await failingLabels(documentWith('<script src="lib/b.js"></script>'))).toEqual([]);
  });
  test("whitespace-only script body is not an inline script", async () => {
    expect(await failingLabels(documentWith("<script>   \n  </script>"))).toEqual([]);
  });
});

describe("CSP directive parsing models the browser", () => {
  test("the LAST directive needs no trailing semicolon", () => {
    const { directives } = parseCsp(LOCKED_CSP);
    expect(directives.get("form-action")).toEqual(["'none'"]);
  });

  test("a duplicate directive is ignored by the browser and reported here", async () => {
    const csp = LOCKED_CSP + "; script-src *";
    const { directives, duplicates } = parseCsp(csp);
    expect(directives.get("script-src")).toEqual(["'self'"]);
    expect(duplicates).toEqual(["script-src"]);
    expect(await failingLabels(documentWith("", csp))).toContain("no duplicate CSP directives");
  });

  test("unsafe-inline in script-src is reported", async () => {
    const csp = LOCKED_CSP.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'");
    expect(await failingLabels(documentWith("", csp))).toContain(
      "script-src is 'self'-only (no off-origin, no unsafe-*)",
    );
  });

  test("a missing CSP meta tag is reported once, not swallowed", async () => {
    const labels = await failingLabels(
      '<!doctype html><html><head><link rel="stylesheet" href="a.css"></head>' +
        '<body><script src="b.js"></script></body></html>',
    );
    expect(labels).toContain("CSP meta tag present");
  });
});
describe("same-origin resolution uses the URL parser, not a prefix test", () => {
  const OFF_ORIGIN = [
    "//evil.example/x.js",
    " //evil.example/x.js",
    "https://evil.example/x.js",
    "http://evil.example/x.js",
    "HTTPS://evil.example/x.js",
    "\\\\evil.example\\x.js",
    "data:text/javascript,alert(1)",
    "javascript:alert(1)",
  ];
  for (const ref of OFF_ORIGIN) {
    test("off-origin: " + JSON.stringify(ref), () => {
      expect(isSameOrigin(ref)).toBe(false);
    });
  }
  for (const ref of ["lib/a.js", "./lib/a.js", "/lib/a.js", "a.css?v=2", "a.css#frag"]) {
    test("same-origin: " + JSON.stringify(ref), () => {
      expect(isSameOrigin(ref)).toBe(true);
    });
  }
  test("query and fragment are dropped from the on-disk path", () => {
    expect(localPathOf("inventory.css?v=2")).toBe("inventory.css");
    expect(localPathOf("lib/a.js#top")).toBe("lib/a.js");
  });
});

describe("parseHtmlFacts reports what the browser would see", () => {
  test("script body survives a malformed end tag", async () => {
    const facts = await parseHtmlFacts("<script>alert(1)</script >");
    expect(facts.inlineScriptBodies).toEqual(["alert(1)"]);
  });
  test("bodies are attributed to the right script element", async () => {
    const facts = await parseHtmlFacts(
      '<script src="a.js"></script><script>one()</script><script>two()</script>',
    );
    expect(facts.scriptSrcs).toEqual(["a.js"]);
    expect(facts.inlineScriptBodies).toEqual(["one()", "two()"]);
  });
  test("<style> blocks are counted", async () => {
    const facts = await parseHtmlFacts("<style>a{}</style><STYLE >b{}</STYLE>");
    expect(facts.styleBlockCount).toBe(2);
  });
  test("event-handler attributes carry their element and name", async () => {
    const facts = await parseHtmlFacts("<a onmouseover=x()>y</a>");
    expect(facts.eventHandlerSites).toEqual(["a[onmouseover]"]);
  });
  test("an attribute merely starting with on- is still a handler name shape", async () => {
    const facts = await parseHtmlFacts("<div onfocusin=x()></div>");
    expect(facts.eventHandlerSites).toEqual(["div[onfocusin]"]);
  });
});
