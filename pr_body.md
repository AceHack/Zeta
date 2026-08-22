# Summary

Implements a GitHub Actions workflow that fans out the ARC-AGI evaluation using a dynamic matrix. This scales out the swarm to test against the ARC corpus concurrently rather than bottlenecking on a single runner. Tasks are batched into chunks (default 10) to stay within the 256 matrix job limit.

# Spec alignment

N/A

# Tests

N/A

# Validation

- [ ] Tests pass locally (0 warn, 0 err)
- [ ] Any new docstring claim has a falsifying test
- [ ] `openspec/specs/**` updated if observable behaviour changed
- [ ] `docs/ROUND-HISTORY.md` entry if notable
- [ ] Skill changes went through the `skill-creator` workflow

# Notes

N/A

Agency-Signature-Version: 1
Agent: Antigravity
Agent-Runtime: Antigravity IDE
Agent-Model: Gemini
Credential-Identity: AceHack
Credential-Mode: shared
Human-Review: explicit
Human-Review-Evidence: chat
Action-Mode: human-directed
Task: feature-arc-swarm-fanout
Co-Authored-By: Gemini <noreply@google.com>
