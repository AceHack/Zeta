"""Check named coordinator documents and attachment bytes, without experiments."""

import hashlib
import json
import subprocess
from pathlib import Path

REPO = Path("/Users/acehack/.zeta/agents/codex/Zeta-rendered-catch-reference-20260906")
FINAL = "b4a77fcad2c4a65485b06486a65ef83b1e5c26d6"
INITIAL = "03e2de315d0eb3591bed4f3dc5f6234b5b77a2bb"
SOURCE = "docs/ip-questionable/2026-09-08-magnet-paradox-memory-history-transcript.md"
ANALYSIS = "docs/research/2026-09-08-history-generators-and-hidden-evolution-under-repetition.md"
ATTACHMENTS = Path("/Users/acehack/.codex/attachments")


def blob(commit: str, name: str) -> bytes:
    return subprocess.run(
        ["git", "show", f"{commit}:{name}"], cwd=REPO, check=True, capture_output=True
    ).stdout


def identity(raw: bytes) -> dict[str, str | int]:
    return {"Bytes": len(raw), "Sha256": hashlib.sha256(raw).hexdigest()}


def main() -> None:
    source = blob(FINAL, SOURCE)
    analysis = blob(FINAL, ANALYSIS)
    if (
        source != (REPO / SOURCE).read_bytes()
        or analysis != (REPO / ANALYSIS).read_bytes()
    ):
        raise ValueError("Current coordinator docs differ from final Git blobs")
    if source != blob(INITIAL, SOURCE):
        raise ValueError("Transcript envelope changed during correction")
    a = (
        ATTACHMENTS / "8a484dca-8024-4796-af57-afdf9ff4e355/pasted-text.txt"
    ).read_bytes()
    b = (
        ATTACHMENTS / "531c8ec6-6416-46ef-9668-5bde87a24a15/pasted-text.txt"
    ).read_bytes()
    begin = b"<!-- BEGIN USER-SUPPLIED TRANSCRIPT -->\n````text\n"
    end = b"````\n<!-- END USER-SUPPLIED TRANSCRIPT -->"
    if source.count(begin) != 1 or source.count(end) != 1:
        raise ValueError("Unexpected transcript delimiters")
    payload = source.split(begin)[1].split(end)[0]
    if payload != b or b != b"0:00\n" + a:
        raise ValueError("Transcript does not match exact attachment relation")
    print(
        json.dumps(
            {
                "SourceCommit": FINAL,
                "InitialCommit": INITIAL,
                "SourceEnvelope": identity(source),
                "InitialAnalysis": identity(blob(INITIAL, ANALYSIS)),
                "CorrectedAnalysis": identity(analysis),
                "FirstAttachment": identity(a),
                "PrefixedAttachment": identity(b),
                "PreservedPayload": identity(payload),
                "CurrentEqualsGit": True,
                "SourceEnvelopeUnchanged": True,
                "PayloadExactlyEqualsPrefixedAttachment": True,
                "AttachmentRelationExactlyFiveBytePrefix": True,
                "Scope": "Byte checks; reception chronology not independently authenticated",
            },
            indent=2,
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
