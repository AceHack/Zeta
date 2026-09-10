# Fixed experiment observation helpers: failures retained before execution

Date: 2026-09-08 UTC
Author: Vera, OpenAI Codex using GPT-6 Astra, coordinator
Independent source reviewer: existing protocol_review session
Operational status: research-grade invocation preparation
Lifecycle: active
Work item: 081M1Z63YMC087G0R003N5FH9X
Status: bounded helper repairs checked; assembled capsule admission pending

## Original static findings

These finite helpers freeze selected source/direct-runtime bytes and capture
one invocation of the [fixed launcher](mixed-message-epoch-implementation/2026-09-08/registered-source/README.md).
They add no numerical route, optimizer, transport or general result serializer.
The first drafts had three independently identified observation/admission gaps:
observed freeze prefixes stayed only in memory until final archival; capture
could lose launch/after-read failures and exit successfully after child failure;
and the expected manifest hash came from the same mutable directory as the
manifest. These were source-review findings, not executed registered failures.

The first freeze was 6,213 bytes, SHA256
`E77ED4272FC1D23803A5F92777B1E2346AC22CCDDC3AC9FF6323D0C1592DD918`;
the first capture was 3,168 bytes, SHA256
`D7981095EDD315E15CD376F217D39518E7C78AF31846815066611CF9EAAC17DA`.
Their exact bytes and findings remain in the
[original review capsule](mixed-message-epoch-implementation/2026-09-08/observation-helper-review-1/manifest.json).
That capsule also retains the first repaired freeze D6C6B6BF and capture FBD0DF78
with six isolated development fixtures. It contains 533 originals,
18,536,114 raw bytes, in a 7,964,196-byte archive with SHA256
`3FAE2D5591BEDE100A3DB9F91D7462705CC3282AF71DE7CA5AD5DA83277B0143`.

## Bounded repairs and actual local discriminators

Freeze writes each observed raw prefix and its descriptor before proceeding,
uses the existing exact descriptor-relative reader after a regular-file/size
check, and retains metadata argv/returns and later ordinary failure separately.
A failed freeze makes no completed capsule claim. Capture requires caller-
supplied independently accepted manifest and archive hashes. It checks archive
bytes and the exact archived helper/manifest members before any child entry.
It retains actual child exit separately from later source/inventory errors and
returns a failure exit when the child or capture fails. Per-file observations
remain available if a later observation refuses. Filesystem or console failure
can still prevent publication; this is not a guarantee against process death.

Four isolated capture fixtures replace subprocess.run with synthetic outcomes.
A child exit 7 remains independently recorded while capture exits 2; a launch
OSError retains an attempted invocation without inventing a child exit; an
after-read error retains child exit 0 and the later artifact inventory; a wrong
independently supplied manifest hash enters no child. All four pass at unchanged
capture SHA256 `FBD0DF785D5AECAE47591D73EA3062050825F33241880B67668B462ADDAC2462`
(6,936 bytes). They invoke no real peer, learner, native or interval reference.

Two isolated freeze fixtures use fake Git/source records, injected passive
manifest acceptance and synthetic metadata subprocess outcomes. A late metadata
exit 9 retains prior observations; a FIFO refuses before subprocess entry.
At intermediate D6C6, the late case has 178 persisted raw/descriptor pairs
but 176 unique logical names, because source/direct scripts are observed twice.
The FIFO has two pairs. Both repeated observations remain in the archive.

The coordinator then found an additional prefix edge: a second direct-script
read could fail correspondence before its bytes were retained. Final freeze
records that read before judging it and retains raw direct-after observations
before their identity checks. Its source is 8,553 bytes, SHA256
`0DBFF44E506F9EF175318F10018C340A0CDEB2B2F70602518DCFE47B92DD2970`.
The two original fixture types pass again: 185 persisted observations/183 unique
names in the late case and two/two for the FIFO. One additional injected direct
read mismatch retains the changed bytes before refusal, with 171 observations.
Its copied Scope string incorrectly says Two; the original result has exactly
one actual Case. That string remains unchanged and is qualified here.

The [final follow-through capsule](mixed-message-epoch-implementation/2026-09-08/observation-helper-followthrough-1/manifest.json)
retains 868 originals, 73,275,373 original bytes, through 334 distinct byte
objects, in 7,941,999 stored bytes, SHA256
`F76AE0B06734E6BA9FA548821AD711870F82CB9D792A0D5E9A8FC29825F6AA15`.
Every original is recoverable from its named object; all were reopened.
Special FIFO entries are metadata only. These are synthetic observer controls,
not actual source admission, scientific service success or numerical results.

The independent reviewer reports no further blocking finding within these
bounded repaired edges. Final accepted source/runtime capsule identities must
still be supplied explicitly to the real capture helper. The launcher itself
remains CC7FBF89 at reviewed `50610f191`. Actual M4, four-session M5 and separate
frozen-query execution remain unentered; no helper exit supplies their verdict.
