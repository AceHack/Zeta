import { equal, deepEqual } from "node:assert/strict";
import { test } from "node:test";
import type { FrontmatterValue } from "../src/schema.ts";
import {
  type ParsedDocument,
  parseFrontmatterDocument,
  serializeFrontmatterDocument,
  rowToDocument,
  documentToRow,
} from "../src/frontmatter-codec.ts";

/** Parse helper that asserts success and returns the document. */
const parseOk = (text: string): ParsedDocument => {
  const result = parseFrontmatterDocument(text);
  if (result.outcome !== "ok") {
    throw new Error(
      `expected ok, got feedback: ${result.feedback.reason} ${result.feedback.message}`,
    );
  }
  return result.document;
};

/** Assert that parse(serialize(doc)) deep-equals doc. */
const roundTrip = (doc: ParsedDocument): void => {
  const text = serializeFrontmatterDocument(doc);
  const reparsed = parseOk(text);
  deepEqual(reparsed.frontmatter, doc.frontmatter);
  equal(reparsed.body, doc.body);
};

test("round-trips strings, numbers, booleans", () => {
  const doc: ParsedDocument = {
    frontmatter: {
      title: "Hello World",
      count: 42,
      ratio: 3.14,
      active: true,
      archived: false,
    },
    body: "Some body text.",
  };
  roundTrip(doc);
});

test("round-trips inline string arrays", () => {
  const doc: ParsedDocument = {
    frontmatter: {
      tags: ["alpha", "beta", "gamma"],
      empty: [],
      single: ["solo"],
    },
    body: "Body with arrays.",
  };
  roundTrip(doc);
});

test("round-trips a string that looks like a number", () => {
  const doc: ParsedDocument = {
    frontmatter: {
      zip: "01234",
      versionString: "42",
      floaty: "3.14",
      negativeLike: "-7",
    },
    body: "",
  };
  roundTrip(doc);
  // Confirm the values come back as strings, not numbers.
  const reparsed = parseOk(serializeFrontmatterDocument(doc));
  equal(typeof reparsed.frontmatter["zip"], "string");
  equal(typeof reparsed.frontmatter["versionString"], "string");
  equal(typeof reparsed.frontmatter["floaty"], "string");
  equal(typeof reparsed.frontmatter["negativeLike"], "string");
});

test("round-trips strings that look like booleans or arrays", () => {
  const doc: ParsedDocument = {
    frontmatter: {
      truthy: "true",
      falsy: "false",
      arrayish: "[not, an, array]",
    },
    body: "",
  };
  roundTrip(doc);
  const reparsed = parseOk(serializeFrontmatterDocument(doc));
  equal(reparsed.frontmatter["truthy"], "true");
  equal(typeof reparsed.frontmatter["truthy"], "string");
  equal(reparsed.frontmatter["falsy"], "false");
  equal(typeof reparsed.frontmatter["falsy"], "string");
  equal(reparsed.frontmatter["arrayish"], "[not, an, array]");
  equal(typeof reparsed.frontmatter["arrayish"], "string");
});

test("round-trips strings needing quoting (colon, hash, whitespace, empty)", () => {
  const doc: ParsedDocument = {
    frontmatter: {
      withColon: "key: value",
      withHash: "a # comment-ish",
      leadingSpace: "  padded",
      trailingSpace: "padded  ",
      emptyString: "",
      withQuote: 'he said "hi"',
      withBackslash: "path\\to\\thing",
    },
    body: "",
  };
  roundTrip(doc);
});

test("round-trips a body with blank lines", () => {
  const doc: ParsedDocument = {
    frontmatter: { title: "Doc" },
    body: "Line one.\n\nLine three after blank.\n\n\nEnd.",
  };
  roundTrip(doc);
});

test("round-trips arrays with elements containing commas and special chars", () => {
  const doc: ParsedDocument = {
    frontmatter: {
      messy: ["a, b", "c: d", "[bracket]", 'quote"d', "plain"],
    },
    body: "Body.",
  };
  roundTrip(doc);
  const reparsed = parseOk(serializeFrontmatterDocument(doc));
  deepEqual(reparsed.frontmatter["messy"], ["a, b", "c: d", "[bracket]", 'quote"d', "plain"]);
});

test("parses a hand-written document", () => {
  const text = ["---", "name: Widget", "qty: 7", "ready: true", "tags: [x, y]", "---", "Hello body."].join("\n");
  const doc = parseOk(text);
  equal(doc.frontmatter["name"], "Widget");
  equal(doc.frontmatter["qty"], 7);
  equal(doc.frontmatter["ready"], true);
  deepEqual(doc.frontmatter["tags"], ["x", "y"]);
  equal(doc.body, "Hello body.");
});

test("feedback: missing_frontmatter", () => {
  const result = parseFrontmatterDocument("no fence here\njust text");
  equal(result.outcome, "feedback");
  if (result.outcome === "feedback") {
    equal(result.feedback.reason, "missing_frontmatter");
  }
});

test("feedback: unterminated_frontmatter", () => {
  const result = parseFrontmatterDocument(["---", "key: value", "still open"].join("\n"));
  equal(result.outcome, "feedback");
  if (result.outcome === "feedback") {
    equal(result.feedback.reason, "unterminated_frontmatter");
  }
});

test("feedback: malformed_line", () => {
  const result = parseFrontmatterDocument(["---", "this line has no colon", "---", "body"].join("\n"));
  equal(result.outcome, "feedback");
  if (result.outcome === "feedback") {
    equal(result.feedback.reason, "malformed_line");
  }
});

test("rowToDocument / documentToRow round-trip through values", () => {
  const values: Record<string, FrontmatterValue> = {
    id: "abc-123",
    weight: 9,
    flagged: false,
    labels: ["one", "two"],
  };
  const doc = rowToDocument({ table: "things", values }, "the body");
  deepEqual(doc.frontmatter, values);
  equal(doc.body, "the body");

  const row = documentToRow(doc, "things");
  equal(row.table, "things");
  deepEqual(row.values, values);
});

test("full pipeline: row -> document -> serialize -> parse -> row", () => {
  const values: Record<string, FrontmatterValue> = {
    title: "Mix",
    n: 100,
    b: true,
    arr: ["p", "q"],
    numericString: "007",
  };
  const doc = rowToDocument({ table: "t", values }, "Body paragraph.\n\nSecond.");
  const text = serializeFrontmatterDocument(doc);
  const reparsed = parseOk(text);
  const row = documentToRow(reparsed, "t");
  deepEqual(row.values, values);
  equal(reparsed.body, "Body paragraph.\n\nSecond.");
});
