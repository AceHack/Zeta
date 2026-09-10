"""Source/attachment identity observations only; no content republishing."""
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path('/Users/acehack/.zeta/agents/codex/Zeta-rendered-catch-reference-20260906')
PUB = Path('/Users/acehack/.zeta/agents/codex/Zeta-compiled-evidence-publication-20260907')
INITIAL = '85ebb64ed45af7576d58870eeb7173933c4dbd47'
CORRECTED = 'e2503d3b3fcbfc1359c64486d02782140009f7e0'
INSPECTED = '5a5b909e04a4d543bc93e7f8f7213ae1b67fb294'
PUBLICATION = '8cb522b2dab2fb50792a3d7ff6ef7f3af21f5e64'
RECORD = 'docs/ip-questionable/2026-09-08-voyager-yang-mills-mass-gap-talk.md'
ATTACHMENT = Path('/Users/acehack/.codex/attachments/1047813f-bb05-4492-87a1-bbf660f94d53/pasted-text.txt')
SOURCES = [
    'src/Core/TemporalCoordinationDetection.fs', 'src/Core/Graph.fs',
    'tests/Tests.FSharp/Simulation/CartelToy.Tests.fs',
    'tests/Tests.FSharp/Formal/CoordRiskSpectralCrossVerify.Tests.fs',
    'src/Core.TLA/specs/BftSybilConsensus.tla', 'src/Core/ForgerRace.fs',
    'tests/Tests.FSharp/Formal/Z3.Laws.Tests.fs',
    'docs/research/2026-08-17-path-independence-is-four-properties-refuting-the-monoid-bell-holonomy-calm-identification.md',
]

def git(*args, repo=ROOT):
    return subprocess.check_output(['git', *args], cwd=repo)

def blob(commit, path, repo=ROOT):
    return git('show', commit + ':' + path, repo=repo)

def identity(raw):
    return {'Bytes': len(raw), 'Sha256': hashlib.sha256(raw).hexdigest()}

original = ATTACHMENT.read_bytes()
assert identity(original) == {'Bytes': 41873, 'Sha256': '11c4c4d7c0b6343cd1fec36fcd62caa4bad59a18455cf03a3f3a202698abc6cf'}
assert original.count(b'\n') == 273 and original.count(b'\r') == 0
assert len(original.splitlines()) == 274 and not original.endswith(b'\n')
initial, corrected = blob(INITIAL, RECORD), blob(CORRECTED, RECORD)
assert initial.replace(b'41,873 bytes, 273 lines, SHA-256', b'41,873 bytes, 273 LF separators, 274 logical lines, no final newline; SHA-256') == corrected
assert blob(PUBLICATION, RECORD, PUB) == corrected
assert git('diff', '--name-only', INITIAL, CORRECTED).decode().splitlines() == [RECORD]
source_rows = []
for path in SOURCES:
    raw = blob(INSPECTED, path)
    assert raw == blob(INITIAL, path) == blob(CORRECTED, path)
    source_rows.append({'Path': path, **identity(raw)})
print(json.dumps({
    'InitialRecordCommit': INITIAL, 'CorrectedRecordCommit': CORRECTED,
    'PublicationCopyCommit': PUBLICATION, 'InitialRecord': identity(initial),
    'CorrectedRecord': identity(corrected), 'Attachment': identity(original),
    'LFSeparators': 273, 'CRSeparators': 0, 'LogicalLines': 274, 'FinalNewline': False,
    'OriginalAttachmentRepublished': False, 'SourceInspectionCommit': INSPECTED,
    'SourceFilesUnchangedAcrossAllThreeRootCuts': source_rows,
    'ScientificOrDetectorExecutions': 0, 'VideoChannelIndependentlyVerified': False,
}, indent=2))
