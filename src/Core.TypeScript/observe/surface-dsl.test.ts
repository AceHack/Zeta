import { test, expect } from "bun:test";
import { parseSurface, compile, toChoosePrompt } from "./surface-dsl";
import { measureText } from "../byte-cost/byte-cost";

// 081KT7YW00008QG0R002T1XNWT refinement C — carved-sentence surfaces compile to a DSL; the model reads
// only the compact carved sentences at the choose-point, deterministic legs read 0B.

const RULE = `# No directives — only observations

Carved sentence:

> The only directive is that there are no directives — only observations.
> Use "observation / input"; never "directive / order".

## Why

Long prose detail here that the model does NOT need at the choose-point.

## Pointers

- [\`dont-ask-permission.md\`](dont-ask-permission.md) — the gate
- \`mechanical-authorization-check.md\` — another
`;

test("parseSurface extracts id, title, carved sentence, pointers", () => {
  const d = parseSurface(".claude/rules/no-directives.md", RULE);
  expect(d.id).toBe("no-directives");
  expect(d.title).toBe("No directives — only observations");
  expect(d.carved).toContain("there are no directives — only observations");
  expect(d.carved).toContain('never "directive / order"'); // multi-line blockquote joined
  expect(d.carved).not.toContain("Why"); // stops at blockquote end
  expect(d.pointers).toContain("dont-ask-permission.md");
  expect(d.pointers).toContain("mechanical-authorization-check.md");
});

test("parseSurface falls back to first blockquote / filename when unlabeled", () => {
  const d = parseSurface("x/foo.md", "# Foo\n\n> just a quote\n\nbody");
  expect(d.id).toBe("foo");
  expect(d.carved).toBe("just a quote");
});

test("compile sorts directives by id", () => {
  const ds = compile([
    { path: "a/zeta.md", text: "# Z\n> z" },
    { path: "a/alpha.md", text: "# A\n> a" },
  ]);
  expect(ds.map((d) => d.id)).toEqual(["alpha", "zeta"]);
});

test("toChoosePrompt emits one carved line per directive, no pointers/prose", () => {
  const prompt = toChoosePrompt(compile([{ path: "a/no-directives.md", text: RULE }]));
  expect(prompt).toContain("no-directives:");
  expect(prompt).toContain("there are no directives");
  expect(prompt).not.toContain("Pointers");
  expect(prompt).not.toContain("dont-ask-permission.md");
});

test("the choose-point DSL is strictly smaller than the raw surface (refinement C)", () => {
  const dslBytes = measureText(toChoosePrompt(compile([{ path: "a/no-directives.md", text: RULE }]))).bytes;
  const rawBytes = measureText(RULE).bytes;
  expect(dslBytes).toBeLessThan(rawBytes);
});
