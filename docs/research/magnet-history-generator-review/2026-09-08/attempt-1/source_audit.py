"""Pin inspected source bytes; no model, ARC, solver, or physics execution."""

import hashlib
import json
from pathlib import Path
import subprocess


REPO = Path("/Users/acehack/.zeta/agents/codex/Zeta-rendered-catch-reference-20260906")
COMMIT = "e6fdbe676a87750fc3ba2f4f79a55b043d6b3ba1"
ATTACHMENT = Path(
    "/Users/acehack/.codex/attachments/8a484dca-8024-4796-af57-afdf9ff4e355/pasted-text.txt"
)
FILES = (
    "src/Core/WSet.fs",
    "src/Core/Orbit.fs",
    "src/Core/HierarchicalPlanning.fs",
    "src/Core.TypeScript/ferry-throttler/four-corner-feedback.ts",
    "src/Core.TypeScript/protocol/error-envelope.ts",
    ".claude/rules/dual-use-detection-is-neutral-oracle-decides.md",
    ".claude/skills/code-review-and-quality/blueprints/reducer.md",
    "docs/GLOSSARY.md",
    "src/Arc.Python/zeta_arc/layered.py",
    "src/Arc.Python/zeta_arc/agent.py",
    "src/Arc.Python/zeta_arc/scene_priors.py",
    "src/Arc.Python/zeta_arc/scene_feedback.py",
    "src/Arc.Python/README.md",
    "src/Arc.Python/tests/test_scene_feedback.py",
    "src/Arc.Python/tests/test_scene_priors.py",
    "src/Bayesian/FactorGraph.fs",
    "src/Bayesian/MultilayerBnn.fs",
    "src/Bayesian/ReferenceFrameFactorHeterarchy.fs",
    "tests/Tests.FSharp/Formal/WSet.FourCornerTrace.Laws.Tests.fs",
    "tests/Tests.FSharp/WSetFourCornerTraceTreaty.Tests.fs",
    "docs/research/2026-09-08-arc-agi-3-readiness-and-no-cheating-boundary.md",
)


def digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def main() -> None:
    rows = []
    for name in FILES:
        raw = subprocess.run(
            ["git", "show", f"{COMMIT}:{name}"],
            cwd=REPO,
            check=True,
            capture_output=True,
        ).stdout
        current = (REPO / name).read_bytes()
        if current != raw:
            raise ValueError(f"Current source differs from pinned blob: {name}")
        rows.append(
            {"Path": name, "Bytes": len(raw), "Sha256": digest(raw), "CurrentEqualsGit": True}
        )
    raw = ATTACHMENT.read_bytes()
    if len(raw) != 28282 or digest(raw) != (
        "d5bb0ce914152bc439fbc683f59522443b5904b2e685a24973603cd63865c148"
    ):
        raise ValueError("Transcript identity changed")
    print(json.dumps({
        "SourceCommit": COMMIT,
        "Scope": "Named source-byte bookkeeping; targeted reading is described in the report",
        "Sources": rows,
        "Attachment": {"Path": str(ATTACHMENT), "Bytes": len(raw), "Sha256": digest(raw)},
        "StudyOrModelProcessesLaunched": 0,
        "GitProcessesLaunched": len(FILES),
    }, indent=2), flush=True)


if __name__ == "__main__":
    main()
