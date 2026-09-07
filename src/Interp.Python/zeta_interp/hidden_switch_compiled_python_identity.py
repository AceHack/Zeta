"""Finite loaded-Python module/path admission, not a bytecode derivation proof.

The caller supplies the reviewed finite source roster. This checks actual
sys.modules objects, ordinary SourceFileLoader metadata and current file bytes,
including this collector and its Result helper. It observes interpreter identity
for separate outer admission. The standard library, loader, interpreter and OS
are trusted; generated framework code and an unspecified transitive dependency
closure are not certified. Two matching snapshots do not prevent later mutation
or establish what bytecode a loader executed, nor protect against hostile Python.
"""

from __future__ import annotations

import hashlib
import os
import stat
import sys
from dataclasses import dataclass
from importlib.machinery import ModuleSpec, SourceFileLoader
from pathlib import Path, PurePosixPath
from types import ModuleType
from typing import NoReturn, cast

from . import hidden_switch_compiled_ieee as s

type Json = None | bool | int | str | list[Json] | dict[str, Json]

_COLLECTOR = "zeta_interp.hidden_switch_compiled_python_identity"
_RESULT = "zeta_interp.hidden_switch_compiled_ieee"
_SELF = sys.modules[__name__]
_PREFIX = "zeta_interp.hidden_switch"


def _refuse(code: str, message: str) -> NoReturn:
    raise s._Refusal(code, message)


def _text(value: object, label: str) -> str:
    if type(value) is not str or not value or "\0" in value:
        _refuse("InvalidMetadata", f"{label}: nonempty string required")
    return cast(str, value)


def _root(value: object) -> Path:
    path = Path(_text(value, "clone root"))
    if not path.is_absolute() or not path.is_dir() or path.resolve() != path:
        _refuse("InvalidRoot", "existing canonical absolute clone root required")
    return path


def _roster(value: object) -> dict[str, dict[str, Json]]:
    if type(value) is not dict or not value:
        _refuse("InvalidRoster", "nonempty exact module source map required")
    result: dict[str, dict[str, Json]] = {}
    paths: set[str] = set()
    for name, raw in cast(dict[object, object], value).items():
        if (
            type(name) is not str
            or not name.isascii()
            or not all(part.isidentifier() for part in name.split("."))
        ):
            _refuse("InvalidRoster", "canonical logical module name required")
        if type(raw) is not dict or raw.keys() != {"Path", "Bytes", "Sha256"}:
            _refuse("InvalidRoster", f"{name}: exact Path/Bytes/Sha256 required")
        row = cast(dict[str, Json], raw)
        relative, length, digest = row["Path"], row["Bytes"], row["Sha256"]
        if (
            type(relative) is not str
            or not relative
            or "\\" in relative
            or "\0" in relative
            or PurePosixPath(relative).is_absolute()
            or str(PurePosixPath(relative)) != relative
            or ".." in PurePosixPath(relative).parts
            or not relative.endswith(".py")
            or relative in paths
            or type(length) is not int
            or length < 0
            or type(digest) is not str
            or len(digest) != 64
            or any(ch not in "0123456789ABCDEF" for ch in digest)
        ):
            _refuse("InvalidRoster", f"{name}: canonical source identity required")
        result[cast(str, name)] = dict(row)
        paths.add(cast(str, relative))
    if not {"zeta_interp", _COLLECTOR, _RESULT}.issubset(result):
        _refuse("InvalidRoster", "package, actual collector and Result helper required")
    return result


def _file(path: Path) -> dict[str, Json]:
    if not path.is_absolute() or path.resolve(strict=True) != path:
        _refuse("FileIdentity", f"canonical regular file required: {path}")
    # O_NOFOLLOW plus descriptor/path identities bound this individual read.
    # Parent-component and cross-file atomicity still rely on the declared OS.
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    first_error: BaseException | None = None
    try:
        # The descriptor remains owned here even if stream creation refuses.
        with os.fdopen(descriptor, "rb", closefd=False) as stream:
            before = os.fstat(stream.fileno())
            if not stat.S_ISREG(before.st_mode):
                _refuse("FileIdentity", f"regular file required: {path}")
            digest = hashlib.sha256()
            length = 0
            while chunk := stream.read(1024 * 1024):
                length += len(chunk)
                digest.update(chunk)
            after = os.fstat(stream.fileno())
            named = path.stat(follow_symlinks=False)
    except BaseException as error:
        first_error = error
        raise
    finally:
        # Exactly one close attempt, including close-then-error injection.
        try:
            os.close(descriptor)
        except OSError as cleanup:
            if first_error is None:
                _refuse("IdentityCleanup", f"descriptor cleanup refused: {cleanup}")
            first_error.add_note(f"Descriptor cleanup also refused: {cleanup}")
    fields = lambda item: (
        item.st_dev,
        item.st_ino,
        item.st_mode,
        item.st_size,
        item.st_mtime_ns,
        item.st_ctime_ns,
    )
    if fields(before) != fields(after) or fields(after) != fields(named):
        _refuse("SnapshotChanged", f"file changed during read: {path}")
    if length != after.st_size:
        _refuse("SnapshotChanged", f"file length changed during read: {path}")
    return {"Bytes": length, "Sha256": digest.hexdigest().upper()}


def _task_names() -> tuple[str, ...]:
    return tuple(
        sorted(
            name
            for name in sys.modules.copy()
            if type(name) is str and name.startswith(_PREFIX)
        )
    )


@dataclass(frozen=True, slots=True)
class _Module:
    module: ModuleType
    spec: ModuleSpec
    loader: SourceFileLoader
    row: dict[str, Json]


def _module(
    root: Path, name: str, expected: dict[str, Json], entry: str | None
) -> _Module:
    runtime_name = "__main__" if name == entry else name
    module = sys.modules.get(runtime_name)
    if type(module) is not ModuleType:
        _refuse("ModuleMissing", f"actual loaded module required: {runtime_name}")
    module = cast(ModuleType, module)
    if name == _COLLECTOR and module is not _SELF:
        _refuse("ModuleIdentity", "collector object differs from executing collector")
    if name == _RESULT and module is not s:
        _refuse("ModuleIdentity", "Result module differs from executing helper")
    values = vars(module)
    spec = values.get("__spec__")
    if type(spec) is not ModuleSpec or values.get("__name__") != runtime_name:
        _refuse("ModuleIdentity", f"ordinary named ModuleSpec required: {name}")
    spec = cast(ModuleSpec, spec)
    loader = spec.loader
    if (
        type(loader) is not SourceFileLoader
        or values.get("__loader__") is not loader
        or spec.name != name
        or not spec.has_location
    ):
        _refuse("ModuleIdentity", f"ordinary matching source loader required: {name}")
    loader = cast(SourceFileLoader, loader)
    relative = cast(str, expected["Path"])
    absolute = root / relative
    if absolute.resolve(strict=True) != absolute or not absolute.is_relative_to(root):
        _refuse("ModuleOrigin", f"source path escapes or aliases clone: {name}")
    location = str(absolute)
    if (
        values.get("__file__") != location
        or spec.origin != location
        or loader.name != name
        or loader.path != location
        or loader.get_filename(name) != location
    ):
        _refuse("ModuleOrigin", f"actual file/spec/loader paths differ: {name}")
    package = absolute.name == "__init__.py"
    expected_package = name if package else name.rpartition(".")[0]
    if values.get("__package__") != expected_package:
        _refuse("ModuleIdentity", f"package name differs: {name}")
    locations = spec.submodule_search_locations
    if package:
        directory = [str(absolute.parent)]
        if type(locations) is not list or locations != directory:
            _refuse("ModuleOrigin", f"package search location differs: {name}")
        if type(values.get("__path__")) is not list or values["__path__"] != directory:
            _refuse("ModuleOrigin", f"package path differs: {name}")
    elif locations is not None or "__path__" in values:
        _refuse("ModuleIdentity", f"unexpected package metadata: {name}")
    cached = values.get("__cached__")
    if cached is not None and type(cached) is not str:
        _refuse("ModuleIdentity", f"invalid cache metadata: {name}")
    if cached != spec.cached:
        _refuse("ModuleIdentity", f"cache metadata differs: {name}")
    actual = _file(absolute)
    if actual["Bytes"] != expected["Bytes"] or actual["Sha256"] != expected["Sha256"]:
        _refuse("SourceBytes", f"actual source bytes differ: {name}")
    row: dict[str, Json] = {
        "Name": name,
        "RuntimeName": runtime_name,
        "Path": relative,
        "AbsolutePath": location,
        **actual,
        "File": cast(str, values["__file__"]),
        "SpecOrigin": spec.origin,
        "LoaderName": loader.name,
        "LoaderPath": loader.path,
        "LoaderType": "importlib.machinery.SourceFileLoader",
        "IsPackage": package,
        "CachedPath": cached,
    }
    return _Module(module, spec, loader, row)


def _version(value: object) -> dict[str, Json]:
    fields = ("major", "minor", "micro", "releaselevel", "serial")
    raw = [getattr(value, name, None) for name in fields]
    for index in (0, 1, 2, 4):
        item = raw[index]
        if type(item) is not int or item < 0:
            _refuse("InterpreterIdentity", "invalid interpreter version components")
    if type(raw[3]) is not str or raw[3] not in ("alpha", "beta", "candidate", "final"):
        _refuse("InterpreterIdentity", "invalid interpreter release level")
    return dict(zip(("Major", "Minor", "Micro", "ReleaseLevel", "Serial"), raw))


def _interpreter() -> dict[str, Json]:
    reported = _text(sys.executable, "sys.executable")
    executable = Path(reported)
    if not executable.is_absolute():
        _refuse("InterpreterIdentity", "absolute interpreter executable required")
    resolved = executable.resolve(strict=True)
    cache_tag = _text(sys.implementation.cache_tag, "implementation cache tag")
    if sys.byteorder not in ("little", "big"):
        _refuse("InterpreterIdentity", "unknown byte order")
    return {
        "Executable": {
            "ReportedPath": reported,
            "ResolvedPath": str(resolved),
            **_file(resolved),
        },
        "Version": _text(sys.version, "sys.version"),
        "VersionInfo": _version(sys.version_info),
        "Implementation": _text(sys.implementation.name, "implementation name"),
        "ImplementationVersion": _version(sys.implementation.version),
        "CacheTag": cache_tag,
        "ByteOrder": sys.byteorder,
        "Platform": _text(sys.platform, "sys.platform"),
        "Prefix": _text(sys.prefix, "sys.prefix"),
        "BasePrefix": _text(sys.base_prefix, "sys.base_prefix"),
    }


def _entry(entry: object, roster: dict[str, dict[str, Json]]) -> str | None:
    if entry is not None and (type(entry) is not str or entry not in roster):
        _refuse("EntryIdentity", "entry must name a required logical roster module")
    name = cast(str | None, entry)
    main = sys.modules.get("__main__")
    if name is not None:
        if name in sys.modules:
            _refuse("EntryIdentity", "separately imported logical entry copy refused")
        if type(main) is not ModuleType:
            _refuse("EntryIdentity", "actual __main__ module required")
        aliases = [key for key, obj in sys.modules.copy().items() if obj is main]
        if aliases != ["__main__"]:
            _refuse("EntryIdentity", "additional entry module alias refused")
        for key, obj in sys.modules.copy().items():
            if key == "__main__" or type(obj) is not ModuleType:
                continue
            other_spec = vars(obj).get("__spec__")
            if type(other_spec) is ModuleSpec and other_spec.name == name:
                _refuse("EntryIdentity", "alternate logical entry load refused")
    elif type(main) is ModuleType:
        spec = vars(main).get("__spec__")
        if type(spec) is ModuleSpec:
            if type(spec.name) is not str:
                _refuse("EntryIdentity", "invalid current entry name")
            if spec.name.startswith(_PREFIX):
                _refuse(
                    "EntryIdentity", "loaded task entry requires explicit admission"
                )
    return name


def admit_python_identity(
    clone_root: object, modules: object, *, entry_module: object = None
) -> s.Result[dict[str, Json]]:
    """Check finite source roster and actual loaded modules; observe interpreter."""
    try:
        root, roster = _root(clone_root), _roster(modules)
        original_modules = sys.modules
        entry = _entry(entry_module, roster)
        names = _task_names()
        if any(name not in roster for name in names):
            _refuse("UnlistedModule", "loaded hidden-switch module is outside roster")
        first = [_module(root, name, roster[name], entry) for name in sorted(roster)]
        interpreter = _interpreter()
        second = [_module(root, name, roster[name], entry) for name in sorted(roster)]
        final_interpreter = _interpreter()
        if (
            sys.modules is not original_modules
            or names != _task_names()
            or entry != _entry(entry_module, roster)
            or interpreter != final_interpreter
            or any(
                left.module is not right.module
                or left.spec is not right.spec
                or left.loader is not right.loader
                or left.row != right.row
                for left, right in zip(first, second)
            )
        ):
            _refuse("SnapshotChanged", "module/interpreter snapshots differ")
        return s.Success(
            {
                "Schema": "zeta.hidden-switch.compiled.python-identity.v1",
                "CloneRoot": str(root),
                "Modules": [item.row for item in first],
                "EntryAdmitted": entry is not None,
                "EntryModule": entry,
                "EntryReason": None
                if entry
                else "entry point not requested or admitted",
                "Interpreter": interpreter,
                "SnapshotAgreement": True,
                "Scope": "finite loaded-module metadata and current file bytes",
                "Limitations": [
                    "Interpreter, standard library, ordinary loader and OS are trusted.",
                    "No source-to-bytecode or executing-function derivation theorem.",
                    "No unspecified transitive dependency or generated-code closure.",
                    "CachedPath is metadata; actual executed cache use is not established.",
                    "Executable file identity does not enumerate loaded native libraries.",
                    "Two snapshots are observations, not atomic or future immutability.",
                    "No protection against hostile Python or forged interpreter state.",
                ],
            }
        )
    except s._Refusal as refusal:
        notes = " ".join(getattr(refusal, "__notes__", ()))
        return s.Failure(refusal.code, f"{refusal.message} {notes}".rstrip())
    except (OSError, ValueError, RuntimeError, AttributeError, TypeError) as error:
        notes = " ".join(getattr(error, "__notes__", ()))
        return s.Failure(
            "IdentityRead", f"identity read refused: {error} {notes}".rstrip()
        )
