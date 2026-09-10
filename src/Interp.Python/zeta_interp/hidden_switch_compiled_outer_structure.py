"""Outer schema and independent input identities, without reads or replay.

The caller supplies expectations from separate source/identity admission, never
from the checked envelope. An admitted read plan is not evidence that its files
exist or that any named operation executed. No producer label is dispatched.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from typing import Any

from . import hidden_switch_compiled_admission as a
from . import hidden_switch_compiled_conformance as c
from . import hidden_switch_compiled_sources as sources

SCHEMA = "zeta.hidden-switch.compiled.outer-negatives.v1"
SCOPE = "untimed-coordinator-negative-conformance"
PREREQUISITES = (
    "certificate",
    "certificate-bindings",
    "native-certificate-calls",
    "hand-slices",
    "semantic-witnesses",
    "selector-witness",
    "candidate-native-record",
    "byte-binding-mutant-audit",
)
OBLIGATIONS = ("native-runtime-body-closure", "final-actual-envelope-chain")
_KEYS = frozenset(
    (
        "Schema",
        "AttemptId",
        "StartedAtUtc",
        "FinishedAtUtc",
        "Complete",
        "Failure",
        "SourceCommit",
        "SourceFiles",
        "CertificateBindings",
        "NumericCertificateSha256",
        "Producer",
        "Prerequisites",
        "Cases",
        "Completed",
        "SeparateObligations",
        "Scope",
    )
)
_COMMIT = re.compile(r"[0-9a-f]{40}\Z")
_ZETA_ID = re.compile(r"[0-7][0-9A-HJKMNP-TV-Z]{25}\Z")


@dataclass(frozen=True, slots=True)
class ByteIdentity:
    Bytes: int
    Sha256: str


@dataclass(frozen=True, slots=True)
class ExpectedSource:
    File: str
    Bytes: int
    Sha256: str


@dataclass(frozen=True, slots=True)
class ExpectedOuter:
    SourceCommit: str
    SourceFiles: tuple[ExpectedSource, ...]
    CertificateBindings: tuple[tuple[str, str], ...]
    NumericCertificateSha256: str
    EntryModule: str
    Arguments: tuple[str, ...]
    PythonIdentity: ByteIdentity
    Prerequisites: tuple[tuple[str, ByteIdentity], ...]


@dataclass(frozen=True, slots=True)
class ArtifactReference:
    At: str
    Role: str
    File: str
    Bytes: int
    Sha256: str
    Encoding: str
    StoredBytes: int
    StoredSha256: str


@dataclass(frozen=True, slots=True)
class OuterStructure:
    Envelope: ByteIdentity
    AttemptId: str
    Complete: bool
    Prefix: c.CasePrefix
    References: tuple[ArtifactReference, ...]
    Scope: str = "outer-structure-and-independent-input-identities-only"
    ArtifactReads: str = "not-performed"
    OutcomeReplay: str = "not-performed"
    SourceAndRuntimeAdmission: str = "caller-prerequisite-not-performed"


@dataclass(frozen=True, slots=True)
class StructureFailure:
    Problem: a.Refused | c.CasePrefixRefused
    References: tuple[ArtifactReference, ...]
    CheckedCaseRows: int
    CheckedCalls: int
    Scope: str = "incomplete-outer-envelope-structure"


class _Stop(Exception):
    def __init__(self, problem: a.Refused | c.CasePrefixRefused):
        super().__init__()
        self.problem = problem


def _need[T](result: a.Admission[T]) -> T:
    if isinstance(result, a.Refused):
        raise _Stop(result)
    return result.value


def _require(condition: bool, code: str, path: str, detail: str) -> None:
    if not condition:
        raise _Stop(a.Refused(code, path, detail))


def _text(value: object, path: str) -> None:
    _require(
        type(value) is str and bool(value), "outer-text", path, "requires nonempty text"
    )


def _identity(value: object, path: str) -> None:
    _require(
        type(value) is ByteIdentity,
        "outer-expected",
        path,
        "requires independent byte identity",
    )
    assert isinstance(value, ByteIdentity)
    _need(a.integer(value.Bytes, 0, a.INT64_MAX, path + ".Bytes"))
    _need(a.sha256(value.Sha256, path + ".Sha256"))


def _expected(value: object) -> ExpectedOuter:
    _require(
        type(value) is ExpectedOuter,
        "outer-expected",
        "Expected",
        "requires independently supplied expectations",
    )
    assert isinstance(value, ExpectedOuter)
    _require(
        type(value.SourceCommit) is str
        and _COMMIT.fullmatch(value.SourceCommit) is not None,
        "outer-commit",
        "Expected.SourceCommit",
        "requires full lowercase commit",
    )
    rows = value.SourceFiles
    _require(
        type(rows) is tuple and 1 <= len(rows) <= sources.MAXIMUM_SOURCE_FILES,
        "outer-sources",
        "Expected.SourceFiles",
        "requires finite nonempty source roster",
    )
    names: set[str] = set()
    for index, row in enumerate(rows):
        at = f"Expected.SourceFiles[{index}]"
        _require(
            type(row) is ExpectedSource,
            "outer-sources",
            at,
            "requires expected source identity",
        )
        _need(a.relative_artifact_path(row.File, at + ".File"))
        _need(a.integer(row.Bytes, 0, sources.MAXIMUM_SOURCE_BYTES, at + ".Bytes"))
        _need(a.sha256(row.Sha256, at + ".Sha256"))
        _require(
            row.File not in names, "outer-sources", at, "duplicate expected source"
        )
        names.add(row.File)
    bindings = value.CertificateBindings
    _require(
        type(bindings) is tuple
        and 1 <= len(bindings) <= sources.MAXIMUM_SOURCE_FILES + 1,
        "outer-bindings",
        "Expected.CertificateBindings",
        "requires finite binding map",
    )
    seen: set[str] = set()
    for index, pair in enumerate(bindings):
        at = f"Expected.CertificateBindings[{index}]"
        _require(
            type(pair) is tuple and len(pair) == 2,
            "outer-bindings",
            at,
            "requires name and hash",
        )
        name, digest = pair
        _text(name, at)
        if name != "ProtocolSha256":
            _need(a.relative_artifact_path(name, at))
        _need(a.sha256(digest, at))
        _require(name not in seen, "outer-bindings", at, "duplicate binding")
        seen.add(name)
    _require(
        "ProtocolSha256" in seen,
        "outer-bindings",
        "Expected.CertificateBindings",
        "protocol binding is required",
    )
    _need(a.sha256(value.NumericCertificateSha256, "Expected.NumericCertificateSha256"))
    _text(value.EntryModule, "Expected.EntryModule")
    _require(
        type(value.Arguments) is tuple
        and all(type(item) is str for item in value.Arguments),
        "outer-arguments",
        "Expected.Arguments",
        "requires exact argument tuple",
    )
    _identity(value.PythonIdentity, "Expected.PythonIdentity")
    prerequisites = value.Prerequisites
    _require(
        type(prerequisites) is tuple and len(prerequisites) == len(PREREQUISITES),
        "outer-prerequisites",
        "Expected.Prerequisites",
        "requires eight independent identities",
    )
    for index, name in enumerate(PREREQUISITES):
        prerequisite_pair = prerequisites[index]
        _require(
            type(prerequisite_pair) is tuple
            and len(prerequisite_pair) == 2
            and type(prerequisite_pair[0]) is str
            and prerequisite_pair[0] == name,
            "outer-prerequisites",
            f"Expected.Prerequisites[{index}]",
            "requires fixed input identity order",
        )
        _identity(prerequisite_pair[1], f"Expected.Prerequisites[{index}]")
    return value


def _failure(
    value: Any, complete: bool, prefix: c.CasePrefix, records: list[Any]
) -> None:
    if complete:
        _require(
            value is None,
            "outer-failure",
            "Failure",
            "complete record requires null failure",
        )
        return
    row = _need(
        a.exact_keys(
            value,
            frozenset(("Stage", "CaseId", "Call", "Code", "Path", "Detail")),
            "Failure",
        )
    )
    for name in ("Stage", "Code", "Path", "Detail"):
        _text(row[name], "Failure." + name)
    case_id, call = row["CaseId"], row["Call"]
    if case_id is None:
        _require(
            call is None, "outer-failure", "Failure.Call", "call is null outside a case"
        )
        _require(
            len(records) == prefix.Cases,
            "outer-failure",
            "Failure.CaseId",
            "retained failed case requires its ID",
        )
        return
    _require(
        prefix.Cases < 92
        and type(case_id) is str
        and case_id == c.case_specs()[prefix.Cases].CaseId,
        "outer-failure",
        "Failure.CaseId",
        "requires the next unaccepted case",
    )
    if call is not None:
        maximum = len(c.case_specs()[prefix.Cases].Calls) - 1
        index = _need(a.integer(call, 0, maximum, "Failure.Call"))
        returned = len(records[-1]["Calls"]) if len(records) > prefix.Cases else 0
        _require(
            index == returned or (returned > 0 and index == returned - 1),
            "outer-failure",
            "Failure.Call",
            "requires pending call or last retained return",
        )


def admit_outer_structure(
    raw: object, expected: object
) -> a.Admitted[OuterStructure] | StructureFailure:
    """Validate exact structure and prepare reads; perform none of those reads."""
    references: list[ArtifactReference] = []
    checked_rows = checked_calls = 0
    paths: dict[str, tuple[object, ...]] = {}

    def reference(
        value: Any, at: str, role: str, identity: ByteIdentity | None = None
    ) -> None:
        row = _need(a.artifact_descriptor(value, at))
        if identity is not None:
            _require(
                (row["Bytes"], row["Sha256"]) == (identity.Bytes, identity.Sha256),
                "outer-input-identity",
                at,
                "differs from independently expected complete bytes",
            )
        signature = tuple(
            row[name]
            for name in ("Bytes", "Sha256", "Encoding", "StoredBytes", "StoredSha256")
        )
        prior = paths.get(row["File"])
        _require(
            prior is None or prior == signature,
            "outer-artifact-alias",
            at + ".File",
            "one file cannot denote conflicting descriptors",
        )
        paths[row["File"]] = signature
        references.append(
            ArtifactReference(
                at,
                role,
                row["File"],
                row["Bytes"],
                row["Sha256"],
                row["Encoding"],
                row["StoredBytes"],
                row["StoredSha256"],
            )
        )

    try:
        want = _expected(expected)
        _require(type(raw) is bytes, "outer-bytes", "Outer", "requires original bytes")
        assert isinstance(raw, bytes)
        row = _need(a.exact_keys(_need(a.strict_json(raw)), _KEYS, "Outer"))
        for name, value in (
            ("Schema", SCHEMA),
            ("Scope", SCOPE),
            ("SourceCommit", want.SourceCommit),
            ("NumericCertificateSha256", want.NumericCertificateSha256),
        ):
            _require(
                type(row[name]) is str and row[name] == value,
                "outer-context",
                name,
                "differs from exact expected context",
            )
        attempt = row["AttemptId"]
        _require(
            type(attempt) is str and _ZETA_ID.fullmatch(attempt) is not None,
            "outer-attempt",
            "AttemptId",
            "requires canonical 26-character ZetaId",
        )
        _need(a.interval(row["StartedAtUtc"], row["FinishedAtUtc"], "Outer"))
        actual_sources = row["SourceFiles"]
        _require(
            type(actual_sources) is list
            and len(actual_sources) == len(want.SourceFiles),
            "outer-sources",
            "SourceFiles",
            "requires independently expected roster",
        )
        for index, source in enumerate(want.SourceFiles):
            at = f"SourceFiles[{index}]"
            item = _need(
                a.exact_keys(
                    actual_sources[index], frozenset(("File", "Bytes", "Sha256")), at
                )
            )
            _need(
                a.integer(item["Bytes"], 0, sources.MAXIMUM_SOURCE_BYTES, at + ".Bytes")
            )
            _require(
                item
                == {
                    "File": source.File,
                    "Bytes": source.Bytes,
                    "Sha256": source.Sha256,
                },
                "outer-sources",
                at,
                "source identity/order differs",
            )
        bindings = _need(
            a.exact_keys(
                row["CertificateBindings"],
                frozenset(name for name, _ in want.CertificateBindings),
                "CertificateBindings",
            )
        )
        _require(
            bindings == dict(want.CertificateBindings),
            "outer-bindings",
            "CertificateBindings",
            "bindings differ from independent expectation",
        )
        _require(
            type(row["SeparateObligations"]) is list
            and row["SeparateObligations"] == list(OBLIGATIONS),
            "outer-obligations",
            "SeparateObligations",
            "requires both separate obligations",
        )
        producer = _need(
            a.exact_keys(
                row["Producer"],
                frozenset(("EntryModule", "Arguments", "PythonIdentity")),
                "Producer",
            )
        )
        _require(
            type(producer["EntryModule"]) is str
            and producer["EntryModule"] == want.EntryModule,
            "outer-producer",
            "Producer.EntryModule",
            "differs from expected actual entry",
        )
        _require(
            type(producer["Arguments"]) is list
            and all(type(arg) is str for arg in producer["Arguments"])
            and producer["Arguments"] == list(want.Arguments),
            "outer-producer",
            "Producer.Arguments",
            "differs from exact argument vector",
        )
        reference(
            producer["PythonIdentity"],
            "Producer.PythonIdentity",
            "producer-python-identity",
            want.PythonIdentity,
        )
        prerequisites = row["Prerequisites"]
        _require(
            type(prerequisites) is list and len(prerequisites) == len(PREREQUISITES),
            "outer-prerequisites",
            "Prerequisites",
            "requires all fixed prerequisites",
        )
        for index, (name, identity) in enumerate(want.Prerequisites):
            at = f"Prerequisites[{index}]"
            item = _need(
                a.exact_keys(prerequisites[index], frozenset(("Id", "Artifact")), at)
            )
            _require(
                type(item["Id"]) is str and item["Id"] == name,
                "outer-prerequisites",
                at + ".Id",
                "requires exact prerequisite order",
            )
            reference(item["Artifact"], at + ".Artifact", name, identity)

        def case_references(index: int, case: Any, limit: int | None = None) -> None:
            for ordinal, item in enumerate(case["Inputs"]):
                reference(
                    item["Artifact"],
                    f"Cases[{index}].Inputs[{ordinal}].Artifact",
                    item["Role"],
                )
            calls = (
                ()
                if limit == 0
                else case["Calls"]
                if limit is None
                else case["Calls"][:limit]
            )
            for ordinal, call in enumerate(calls):
                reference(
                    call["ResultArtifact"],
                    f"Cases[{index}].Calls[{ordinal}].ResultArtifact",
                    "actual-result",
                )

        prefix = c.admit_case_prefix(
            row["Cases"], row["Completed"], complete=row["Complete"]
        )
        if isinstance(prefix, c.CasePrefixRefused):
            checked_rows, checked_calls = prefix.CheckedRows, prefix.CheckedCalls
            prior_calls = 0
            for index in range(checked_rows):
                case_references(index, row["Cases"][index])
                prior_calls += len(row["Cases"][index]["Calls"])
            # A Calls-stage refusal occurs only after this row's entire input
            # roster was validated. Retain those inputs and each checked call.
            if prefix.path.startswith(f"Cases[{checked_rows}].Calls"):
                case_references(
                    checked_rows,
                    row["Cases"][checked_rows],
                    checked_calls - prior_calls,
                )
            raise _Stop(prefix)
        checked_rows, checked_calls = prefix.value.RetainedCaseRows, prefix.value.Calls
        for index, case in enumerate(row["Cases"]):
            case_references(index, case)
        _failure(row["Failure"], row["Complete"], prefix.value, row["Cases"])
        assert type(raw) is bytes
        return a.Admitted(
            OuterStructure(
                ByteIdentity(len(raw), hashlib.sha256(raw).hexdigest().upper()),
                attempt,
                row["Complete"],
                prefix.value,
                tuple(references),
            )
        )
    except _Stop as stop:
        return StructureFailure(
            stop.problem, tuple(references), checked_rows, checked_calls
        )
