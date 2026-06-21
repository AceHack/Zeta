# 081KRHWGX0008QG0R000E8BHQ9 — Cloud Routines API, Auth, and Registration Surface Research

## 1. Is Cloud Routines GA or still research-preview?
Cloud Routines is an active feature as of May 2026, operating with production-ready endpoints for automated coding workflows running on Anthropic's managed cloud infrastructure. While previously in research-preview, it is currently widely available to Pro, Max, Team, and Enterprise users.

## 2. Authentication Mechanism
Routines require a **per-routine bearer token**. This is explicitly distinct from a general Anthropic API key or Claude.ai OAuth token.
The bearer token is scoped specifically to the individual routine and provides no read access to the general account or other routines. 
*Beta Header Requirement:* API requests must include the header `anthropic-beta: experimental-cc-routine-2026-04-01`.

## 3. Registration Surface
Registration and configuration are performed via the Web UI at **claude.ai/code/routines**.
- There is no direct CLI command for initial routine registration.
- Once created in the web UI, you can generate a token by adding an "API" trigger.
- The execution endpoint is: `POST https://api.anthropic.com/v1/claude_code/routines/[routine-id]/fire`

## 4. Does `scheduled-tasks` MCP wrap Cloud Routines?
No. `scheduled-tasks` is a local MCP for running things via the local OS scheduling. Cloud Routines run persistently on Anthropic's managed cloud infrastructure, independent of the local machine state.

## 5. Trigger types available
- **API**: HTTP POST requests with a routine-specific Bearer token.
- **GitHub Events**: Webhook-based integration (requires the Claude GitHub App).
- **Scheduled**: Cron-style triggers native to the Anthropic cloud infrastructure.

## 6. Daily Quota
Cloud Routines use a dual-layer usage framework tied to the main account subscription:
- A rolling 5-hour window.
- A 7-day weekly cap.
Routine execution draws from this shared pool (along with Claude Desktop and claude.ai usage). Complex tasks use more active compute quota.

## 7. Which plan is the Zeta factory running on?
The CLI `claude` instance indicates `Claude Enterprise` in its interactive header. This implies the Zeta factory is running on the Enterprise plan, which benefits from the highest rolling window limits.

## 8. Do GitHub event triggers require a GitHub App installation?
Yes. It explicitly requires installing the **Claude GitHub App** on the repository to listen for webhook events (e.g., `pull_request.opened`). Running `/web-setup` locally is not sufficient for triggering Cloud Routines via GitHub events, as that only grants local clone access.

## Next Steps for Slices 2–5
- **Schema Impact (081KRHWGX0008QG0R002S107P7):** `cloud-schedule.json` schema needs to model:
  - `trigger: "api" | "github" | "scheduled"`
  - For API triggers: Needs a mechanism to securely inject the Bearer token (e.g., via environment variable reference).
  - For GitHub triggers: Needs to define the event type and filters.
- **Registration Flow (081KRHWGX0008QG0R0013DSSZZ):** The installer cannot automatically register Cloud Routines completely autonomously via CLI. It must guide the human/agent to `claude.ai/code/routines` to manually create the routine and configure the GitHub App or generate the API token.
