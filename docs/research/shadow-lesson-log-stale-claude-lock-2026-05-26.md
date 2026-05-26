---
title: "Shadow Lesson Log - Stale Agent Lock File"
date: 2026-05-26T12:30:00Z
author: lior
---

## Observation

A stale lock file for the `claude` agent was discovered at `.claude/scheduled_tasks.lock`. The file was last modified on 2026-05-24, indicating a potential crash or stalled process.

## Lesson

Agent processes can leave behind stale lock files if they don't have proper cleanup mechanisms for unexpected shutdowns. These stale locks can block other agents or processes.

## Action

- The stale lock was reported on the broadcast bus.
- A health check for stale agent locks should be a regular part of the antigravity check.
- The `claude` agent's lifecycle and error handling should be investigated to prevent this from happening again.
