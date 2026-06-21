# MCP server: statefulness, transports, and the two-faces split (external MCP vs cell↔cell bus) (Aaron, 2026-06-07)

Aaron's thread: *"for our MCP server let's make an ASP.NET generic host and use my GitHub multiplewebsocket
for the connection — can MCP be stateful like that or not? If not let's do gRPC. Or let our MCP server do
both: be a cell, be callable by remote cells, and the MCP can call remote cells."* Grounded against the
MCP spec (2025-11-25) and the C# SDK; faithful capture; recommendation. Hype off.

## The facts that settle it

1. **MCP *is* stateful.** Streamable HTTP supports optional sessions: the server assigns an `Mcp-Session-Id`
   header on the `InitializeResult`, the client echoes it on every later request; streams are **resumable**
   (`Last-Event-Id`). So you do **not** need to leave MCP to get statefulness.
2. **Two official transports only: stdio and Streamable HTTP.** Streamable HTTP = one endpoint, `POST`
   (client→server JSON-RPC) + optional `GET` SSE (server→client stream), session + resumability. (It
   replaced the old HTTP+SSE.)
3. **WebSocket is NOT an official transport.** MCP is transport-agnostic (JSON-RPC 2.0) and the spec
   *permits* custom transports — **but a custom WebSocket transport only works with a custom client.**
   Standard MCP clients (Claude, Cursor, …) speak **only stdio + Streamable HTTP**; they will not connect to
   a WebSocket server. So the `multiplewebsocket` lib cannot be the transport for the *standard-client-facing*
   MCP surface.
4. **gRPC is NOT (yet) an official transport** — Google is contributing a pluggable gRPC transport, but it's
   experimental and **same custom-client caveat**. Switching to gRPC does **not** buy statefulness you don't
   already have: Streamable HTTP is already stateful with standard clients. So gRPC-for-statefulness is the
   wrong reason.
5. **C# SDK + ASP.NET generic host: yes.** `ModelContextProtocol.AspNetCore` (official, v1.4.0 / 2026-06-04)
   integrates with the ASP.NET Core generic host + DI for Streamable HTTP, with session support. (Our current
   `tools/zeta-mcp` is a hand-rolled minimal **stdio** JSON-RPC server with no SDK dep.)
6. **One process can be both MCP server and MCP client** (call other MCP servers). MCP is bidirectional but
   **client-server, NOT peer-to-peer.**

## The resolution: two faces, not one (Aaron's "do both" is right — but split the transports)

The tension dissolves once you separate the **external-tool face** from the **cell↔cell face**:

| face | who talks | transport | statefulness | where `multiplewebsocket` fits |
|---|---|---|---|---|
| **External MCP** (our tools callable by Claude/others; we call other MCP servers) | standard MCP clients/servers | **Streamable HTTP** (+ stdio for local) on the ASP.NET generic host via `ModelContextProtocol.AspNetCore` | yes — `Mcp-Session-Id` sessions | ✗ — standard clients won't speak it |
| **Cell ↔ cell** ("be a cell, callable by remote cells, call remote cells") | Zeta cells (peers) | the **Zeta bus** — git-native (081KSXN940008QG0R00171YAZW) / Reticulum / a **custom WebSocket** | yes — bidirectional, **peer-to-peer**, durable | ✓ — this is exactly its role |

So: **MCP is the outward tool API; the cell mesh is our own protocol.** Don't model cell↔cell as MCP — MCP is
client-server (not P2P), so a cell *mesh* is a poor fit for it. Use Streamable HTTP for the MCP face (stateful,
standard-client-compatible) and the cell bus (your `multiplewebsocket`, or the git-native bus, or gRPC) for
the peer mesh. **The bridge:** the MCP server's tool handlers can dispatch onto the cell bus — *"the MCP can
call remote cells"* = an MCP tool call → handler → cell-bus message → remote cell (which need not speak MCP).
And the same process can be a cell on the bus *and* an MCP server *and* an MCP client — three faces, one host.

## Recommendation

1. **MCP face → ASP.NET generic host + `ModelContextProtocol.AspNetCore`, Streamable HTTP** (keep stdio for
   local). This gives stateful sessions with standard clients. Migrate the hand-rolled `zeta-mcp` to the SDK.
   **Do not** put MCP on WebSocket/gRPC — you'd lose standard-client interop for no statefulness gain.
2. **Cell↔cell face → the Zeta bus, NOT MCP.** `multiplewebsocket` is a legitimate **custom transport for
   the cell mesh** (bidirectional, P2P, stateful) — pair it with / compare it to the git-native bus (081KSXN940008QG0R00171YAZW)
   and the Orleans-cursor/SerializedSaga + CommutativeView lanes. gRPC is also a fine cell-bus option.
3. **Bridge them:** MCP tool handlers invoke the cell bus → "MCP can call remote cells"; remote cells reply
   over the bus. One host, three faces (cell / MCP-server / MCP-client).

## Honest scope / open questions

- Need to inspect the `multiplewebsocket` lib's actual shape (multiplexing? framing? auth?) before adopting
  it as the cell-bus transport — flagged, not assumed.
- Migrating `zeta-mcp` to the SDK + Streamable HTTP is a real build (DI, hosting, session store, tool
  re-registration) — backlog, not a drive-by.
- Whether the cell bus is git-native (081KSXN940008QG0R00171YAZW) vs WebSocket vs gRPC is a separate decision (the bus already
  has design weight on the git-native side); this doc only says *cell↔cell ≠ MCP*.

## Beacon anchors

- **MCP spec 2025-11-25** — Transports (stdio, Streamable HTTP, `Mcp-Session-Id`, resumability, custom-
  transport clause). · **`ModelContextProtocol` / `ModelContextProtocol.AspNetCore`** (official C# SDK). ·
  **JSON-RPC 2.0** (the substrate that makes custom transports possible). · **gRPC-for-MCP** (Google Cloud,
  in-dev pluggable transport). · Ties (ours): 081KSXN940008QG0R00171YAZW git-native agent bus, the Orleans-cursor / SerializedSaga
  + CommutativeView coordination lanes, Reticulum routing, `tools/zeta-mcp`. Honest novelty: none in MCP; the
  contribution is the **two-faces split** — MCP (client-server, Streamable HTTP, external tools) over the
  **cell bus** (P2P, custom transport, internal mesh), bridged in one host.
