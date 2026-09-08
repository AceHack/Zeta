"""Execute the strict read plan for a source-bound outer envelope.

Each unique file is read once from the caller-admitted owned root. Repeated
references use those exact retained bytes; no future filesystem immutability
or operation replay is claimed. The budget charges the original envelope plus
both declared stored and original bytes of each unique file before its read.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path

from . import hidden_switch_compiled_admission as a
from . import hidden_switch_compiled_outer_structure as structure
from . import hidden_switch_compiled_storage as storage

MAXIMUM_READ_BYTES = 256 * 1024 * 1024


@dataclass(frozen=True, slots=True)
class ReadAttempt:
    Reference: structure.ArtifactReference
    ReservedBytes: int
    ActualResult: object
    Returned: bool
    RaisedType: str | None = None
    RaisedDetail: str | None = None


@dataclass(frozen=True, slots=True)
class BoundOuterArtifacts:
    Structure: structure.OuterStructure
    Reads: tuple[ReadAttempt, ...]
    ReferenceReads: tuple[int, ...]
    ReservedBytes: int
    Scope: str = "outer-structure-and-actual-strict-artifact-reads-only"
    OutcomeReplay: str = "not-performed"
    SourceAndRuntimeAdmission: str = "caller-prerequisite-not-performed"


@dataclass(frozen=True, slots=True)
class ReadFailure:
    Stage: str
    Problem: a.Refused | structure.StructureFailure
    StructureResult: (
        a.Admitted[structure.OuterStructure] | structure.StructureFailure | None
    )
    Reads: tuple[ReadAttempt, ...]
    ReferenceReads: tuple[int, ...]
    ReservedBytes: int
    FailedReference: structure.ArtifactReference | None
    Scope: str = "incomplete-outer-artifact-read-prefix"


def read_outer_artifacts(
    raw: object,
    expected: object,
    root: object,
    *,
    maximum_bytes: object = MAXIMUM_READ_BYTES,
) -> a.Admitted[BoundOuterArtifacts] | ReadFailure:
    """Bind complete original artifacts; return all actual read outcomes on failure.

    This is a finite sequential trusted-helper boundary, not an OS-level memory
    quota. Parser objects, Python overhead and the caller's input allocation are
    separate. The budget bounds declared retention/reads, including identity
    storage charged as both stored and original bytes. No artifact is retried.
    """
    reads: list[ReadAttempt] = []
    associations: list[int] = []
    reserved = 0
    checked: (
        a.Admitted[structure.OuterStructure] | structure.StructureFailure | None
    ) = None

    def failure(
        stage: str,
        problem: a.Refused | structure.StructureFailure,
        reference: structure.ArtifactReference | None = None,
    ) -> ReadFailure:
        return ReadFailure(
            stage,
            problem,
            checked,
            tuple(reads),
            tuple(associations),
            reserved,
            reference,
        )

    limit = a.integer(maximum_bytes, 1, MAXIMUM_READ_BYTES, "MaximumBytes")
    if isinstance(limit, a.Refused):
        return failure("budget", limit)
    if not isinstance(root, Path) or not root.is_absolute():
        return failure(
            "root",
            a.Refused(
                "outer-root", "Root", "requires absolute caller-admitted owned root"
            ),
        )
    if type(raw) is not bytes:
        return failure(
            "envelope",
            a.Refused("outer-bytes", "Outer", "requires original envelope bytes"),
        )
    if len(raw) > limit.value:
        return failure(
            "budget",
            a.Refused(
                "outer-read-budget", "Outer", "envelope exceeds aggregate read budget"
            ),
        )
    reserved = len(raw)
    checked = structure.admit_outer_structure(raw, expected)
    if isinstance(checked, structure.StructureFailure):
        return failure("structure", checked)
    by_file: dict[str, int] = {}
    for reference in checked.value.References:
        prior = by_file.get(reference.File)
        if prior is not None:
            associations.append(prior)
            continue
        cost = reference.Bytes + reference.StoredBytes
        if cost > limit.value - reserved:
            return failure(
                "budget",
                a.Refused(
                    "outer-read-budget",
                    reference.At,
                    "next unique artifact exceeds aggregate read budget",
                ),
                reference,
            )
        reserved += cost
        descriptor = {
            name: getattr(reference, name)
            for name in (
                "File",
                "Bytes",
                "Sha256",
                "Encoding",
                "StoredBytes",
                "StoredSha256",
            )
        }
        try:
            actual = storage.read_artifact(
                root,
                descriptor,
                maximum_stored_bytes=reference.StoredBytes,
                maximum_original_bytes=reference.Bytes,
            )
        except Exception as error:  # noqa: BLE001 - retain ordinary helper failures at this boundary
            # This records a helper contract violation separately from a returned
            # typed refusal. No missing return becomes successful negative evidence.
            detail = str(error)
            reads.append(
                ReadAttempt(
                    reference,
                    cost,
                    None,
                    False,
                    type(error).__module__ + "." + type(error).__qualname__,
                    detail,
                )
            )
            return failure(
                "reader-raised",
                a.Refused(
                    "outer-reader-raised",
                    reference.At,
                    detail or "reader raised before returning",
                ),
                reference,
            )
        reads.append(ReadAttempt(reference, cost, actual, True))
        if isinstance(actual, a.Refused):
            return failure("artifact-read", actual, reference)
        if not isinstance(actual, a.Admitted) or type(actual.value) is not bytes:
            return failure(
                "reader-contract",
                a.Refused(
                    "outer-reader-result",
                    reference.At,
                    "reader returned outside its byte-admission contract",
                ),
                reference,
            )
        if (
            len(actual.value) != reference.Bytes
            or hashlib.sha256(actual.value).hexdigest().upper() != reference.Sha256
        ):
            return failure(
                "reader-contract",
                a.Refused(
                    "outer-reader-result",
                    reference.At,
                    "admitted original bytes differ from the planned identity",
                ),
                reference,
            )
        ordinal = len(reads) - 1
        by_file[reference.File] = ordinal
        associations.append(ordinal)
    return a.Admitted(
        BoundOuterArtifacts(checked.value, tuple(reads), tuple(associations), reserved)
    )
