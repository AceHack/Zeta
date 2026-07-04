// zeta-tools.ts — the CLOSED tool surface: fs (DagFs) + db (zetadb) only, as data (shadow*).
//
// Aaron 2026-07-04: "our tools are only our file system and database … not random bash/CLI access,
// it's zetadb/gitv2/dagfs that results in code changes loaded via type providers and Roslyn
// generators." So the model's `tools` declaration is a CLOSED vocabulary — two objects, not an open
// registry. A model that can only touch fs+db cannot escape to the shell: the surface IS the sandbox
// (object-capability model). This is slice 1 (design doc:
// 2026-07-04-tool-calls-the-zeta-way-...): the surface as typed data + the closed-surface invariant.
// The parse-from-stream + execution slices follow (parse gated on a live probe of the codex/responses
// tool-call event shape — the same "docs were wrong" risk the text-delta path hit).

/// A Responses-API function-tool declaration (the stable, well-understood request side).
export interface ResponsesToolDecl {
  readonly type: "function";
  readonly name: string;
  readonly description: string;
  readonly parameters: {
    readonly type: "object";
    readonly properties: Readonly<Record<string, { readonly type: string; readonly description: string }>>;
    readonly required: readonly string[];
    readonly additionalProperties: false;
  };
}

/// The two capability domains — nothing else is a tool. Every ZetaTool name is `fs.*` or `db.*`.
export type ZetaDomain = "fs" | "db";

const str = (description: string) => ({ type: "string", description }) as const;
const obj = (description: string) => ({ type: "object", description }) as const;

function tool(name: string, description: string, props: Record<string, { type: string; description: string }>, required: string[]): ResponsesToolDecl {
  return { type: "function", name, description, parameters: { type: "object", properties: props, required, additionalProperties: false } };
}

/// **fs — DagFs** (content-addressed multi-parent tree). resolve/link/editLocal/editEverywhere/unlink.
// Tool names are `<domain>_<op>` with an UNDERSCORE, NOT a dot: the Responses API validates names
// against `^[a-zA-Z0-9_-]+$` (confirmed live — a dotted name 400s `tools[0].name: does not match
// pattern`). The domain prefix (`fs_` / `db_`) is what keeps the surface closed + classifiable.
const FS_TOOLS: readonly ResponsesToolDecl[] = [
  tool("fs_resolve", "Read the content linked at a path (DagFs.resolve). Paths map to content addresses.", { path: str("the path to resolve") }, ["path"]),
  tool("fs_link", "Link a path to content (DagFs.link); identical content dedups to one node.", { path: str("the path"), content: str("the content to store") }, ["path", "content"]),
  tool("fs_editLocal", "Edit just this path — copy-on-write fork (DagFs.editLocal, the DEFAULT). Only this path sees the change.", { path: str("the path"), content: str("the new content") }, ["path", "content"]),
  tool("fs_editEverywhere", "Shared-object edit (DagFs.editEverywhere): every path referencing the old content follows the new content.", { path: str("the path"), content: str("the new content") }, ["path", "content"]),
  tool("fs_unlink", "Remove the link at a path (DagFs.unlink); the node stays in the store (GC is separate).", { path: str("the path to unlink") }, ["path"]),
];

/// **db — zetadb** (append-only Z-set event log; views are folds). append/query. Retraction first-class.
const DB_TOOLS: readonly ResponsesToolDecl[] = [
  tool("db_append", "Append an event to the zetadb log (the IR). The event becomes an IR node; downstream views re-fold incrementally.", { event: obj("the event to append") }, ["event"]),
  tool("db_query", "Read a materialized view (a named fold over the log — DBSP IVM). No full recompute.", { view: str("the view/fold name"), args: obj("optional fold arguments") }, ["view"]),
];

/// **The complete closed tool surface** — fs + db, nothing else. This is what the harness declares to
/// the model in the `tools` field; there is no bash, exec, http, or open registry.
export const ZETA_TOOLS: readonly ResponsesToolDecl[] = [...FS_TOOLS, ...DB_TOOLS];

/// The domain of a tool name (`fs_*` / `db_*`), or null if the name is outside the closed surface.
export function domainOf(name: string): ZetaDomain | null {
  if (name.startsWith("fs_")) return "fs";
  if (name.startsWith("db_")) return "db";
  return null;
}

/// **The closed-surface invariant.** True iff every tool is `fs_*` or `db_*` — no escape to shell/http/
/// arbitrary functions. The harness asserts this before declaring tools to any model.
export function isClosedSurface(tools: readonly ResponsesToolDecl[]): boolean {
  return tools.every((t) => domainOf(t.name) !== null);
}
