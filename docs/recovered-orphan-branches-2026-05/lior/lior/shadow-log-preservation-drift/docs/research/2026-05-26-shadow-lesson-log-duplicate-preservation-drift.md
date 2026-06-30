---
date: 2026-05-26
author: lior
source: antigravity-check
---

# Shadow Lesson: Duplicate PR Preservation and CI Failures

## Observation

The PR preservation process is creating multiple, duplicate pull requests for the same merged PR. These preservation PRs are also consistently failing CI checks.

## Lesson

Automated processes, especially those that create repository events like opening PRs, must be idempotent. A lack of idempotency can lead to resource waste, repository noise, and can mask other underlying issues. In this case, the flood of failing preservation PRs makes it difficult to assess the overall health of the CI system.

## Action

1.  The automation responsible for PR preservation needs to be immediately disabled and investigated.
2.  A mechanism to prevent duplicate preservation PRs must be implemented.
3.  The underlying CI failures in the 'gate/lint' suite need to be addressed.
