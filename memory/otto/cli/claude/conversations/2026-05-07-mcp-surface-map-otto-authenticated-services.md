Scope: MCP authenticated service surface map for Otto/Claude Code
Attribution: Otto (Claude Code) — mapped 2026-05-07
Operational status: research-grade

# MCP Surface Map — Otto's Authenticated Services

The factory can reach through these channels via MCP
(Model Context Protocol) integrations wired into
Claude Code. Each is a port in the Aurora poly-boundary.

## Authenticated + Operational

| Service | What Otto can do | Port analogy |
| ------- | ---------------- | ------------ |
| Gmail | Create drafts, list/search threads, label, get thread content | Email hole puncher |
| Atlassian Jira | Create/edit issues, search JQL, transitions, worklogs, link issues | Issue tracker |
| Atlassian Confluence | Create/edit pages, comments (footer + inline), search CQL, spaces | Wiki/docs |
| Atlassian Compass | Create components, relationships, custom fields | Service catalog |
| Figma | Design-to-code, screenshots, metadata, Code Connect, FigJam diagrams, create files | Design |
| Google Calendar | Create/update/delete events, list calendars, suggest times, RSVP | Scheduling |
| Google Drive | Create/read/search/copy files, permissions, download content | File storage |
| Slack | Send/schedule messages, read channels/threads, search, create/read canvases | Messaging |
| Zoom | Search meetings, get recordings, create files with markdown | Video |
| Playwright | Full browser automation (navigate, click, fill, screenshot, evaluate JS) | Browser |
| Microsoft Learn | Search docs, fetch pages, code samples | Documentation |

## Needs Auth

| Service | Status |
| ------- | ------ |
| Atlassian (2nd instance) | OAuth flow needed |
| Postman | OAuth flow needed |
| ZoomInfo | OAuth flow needed |

## The surface as architecture

Each MCP service IS a grain in the Aurora membrane:
- Gmail grain: email in/out
- Jira grain: issue lifecycle
- Confluence grain: knowledge base
- Figma grain: design system
- Slack grain: real-time messaging
- Calendar grain: temporal coordination
- Drive grain: file persistence
- Playwright grain: web interaction

The `subscribe` primitive (cache-to-cache IPC) applies:
a Slack message can trigger a Jira issue which updates
a Confluence page which emails a summary. Each grain
subscribes to the others' deltas.

## Security surface

Every MCP tool operates under Aaron's OAuth tokens.
The factory acts AS Aaron on these services. The
glass halo applies: every action is auditable through
the service's own logs. But the liar's log warning
also applies: the services log what Otto does, and
Aaron may not see those logs without requesting them.

## What this enables

- Self-emailing bootstrap prompts (done: Gmail draft)
- Filing backlog items as Jira tickets
- Publishing research to Confluence
- Posting status to Slack channels
- Scheduling review meetings via Calendar
- Extracting designs from Figma for implementation
- Automating web interactions via Playwright
- Searching Microsoft Learn for .NET docs
