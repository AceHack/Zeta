"""Actual file-backed fixture imports and metadata-only -m entry admission.

Temporary clones contain copied collector/Result sources and tiny owned modules.
No task policy, guard, source stream, native probe or measurement is executed.
"""

import copy
import hashlib
import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path
from types import ModuleType

import pytest

SOURCE = Path(__file__).resolve().parents[1] / "zeta_interp"
COLLECTOR = "zeta_interp.hidden_switch_compiled_python_identity"
HELPER = "zeta_interp.hidden_switch_compiled_ieee"
FIXTURE = "zeta_interp.hidden_switch_identity_fixture"
DIRECT = "zeta_interp.reviewed_identity_helper"
ENTRY = "zeta_interp.hidden_switch_identity_entry"
PREFIX = Path("src/Interp.Python/zeta_interp")


def copy_clone(root):
    folder = root / PREFIX
    folder.mkdir(parents=True)
    (folder / "__init__.py").write_text('"""Owned empty identity fixture package."""\n')
    for name in (COLLECTOR, HELPER):
        leaf = name.rsplit(".", 1)[1] + ".py"
        (folder / leaf).write_bytes((SOURCE / leaf).read_bytes())
    (folder / "hidden_switch_identity_fixture.py").write_text("VALUE = 7\n")
    (folder / "reviewed_identity_helper.py").write_text("LABEL = 'owned'\n")
    return folder


def roster_for(root, names):
    result = {}
    for name in names:
        leaf = "__init__" if name == "zeta_interp" else name.rsplit(".", 1)[1]
        relative = PREFIX / (leaf + ".py")
        raw = (root / relative).read_bytes()
        result[name] = {
            "Path": relative.as_posix(),
            "Bytes": len(raw),
            "Sha256": hashlib.sha256(raw).hexdigest().upper(),
        }
    return result


def load(root, name, monkeypatch):
    leaf = "__init__" if name == "zeta_interp" else name.rsplit(".", 1)[1]
    path = root / PREFIX / (leaf + ".py")
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    monkeypatch.setitem(sys.modules, name, module)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def fixture(tmp_path, monkeypatch):
    first, second = (tmp_path / "first").resolve(), (tmp_path / "second").resolve()
    copy_clone(first)
    copy_clone(second)
    # Remove only the owned package namespace temporarily, then restore it.
    for name in list(sys.modules):
        if name == "zeta_interp" or name.startswith("zeta_interp."):
            monkeypatch.delitem(sys.modules, name)
    loaded = {
        name: load(first, name, monkeypatch)
        for name in ("zeta_interp", HELPER, COLLECTOR, FIXTURE, DIRECT)
    }
    roster = roster_for(first, loaded)
    return first, second, loaded, roster


def admit(fixture, **kwargs):
    root, _, loaded, roster = fixture
    return loaded[COLLECTOR].admit_python_identity(str(root), roster, **kwargs)


def success(result):
    assert type(result).__name__ == "Success", result
    return result.value


def refusal(result, code=None):
    assert type(result).__name__ == "Failure", result
    if code is not None:
        assert result.Code == code, result


def test_actual_module_objects_paths_bytes_and_interpreter_are_reported(fixture):
    root, _, loaded, roster = fixture
    evidence = success(admit(fixture))
    assert evidence["EntryAdmitted"] is False and evidence["EntryReason"]
    assert evidence["EntryModule"] is None
    assert evidence["CloneRoot"] == str(root)
    assert [row["Name"] for row in evidence["Modules"]] == sorted(roster)
    for row in evidence["Modules"]:
        module = loaded[row["Name"]]
        assert sys.modules[row["Name"]] is module
        assert row["File"] == module.__file__ == row["AbsolutePath"]
        assert row["SpecOrigin"] == module.__spec__.origin
        assert row["LoaderPath"] == module.__loader__.get_filename(row["Name"])
        assert row["Sha256"] == roster[row["Name"]]["Sha256"]
    interpreter = evidence["Interpreter"]
    actual = Path(sys.executable).resolve().read_bytes()
    assert interpreter["Executable"]["ReportedPath"] == sys.executable
    assert interpreter["Executable"]["Bytes"] == len(actual)
    assert (
        interpreter["Executable"]["Sha256"]
        == hashlib.sha256(actual).hexdigest().upper()
    )
    assert interpreter["Version"] == sys.version
    assert interpreter["VersionInfo"]["Major"] == sys.version_info.major
    assert interpreter["CacheTag"] == sys.implementation.cache_tag
    assert evidence["SnapshotAgreement"] is True
    assert "No source-to-bytecode" in evidence["Limitations"][1]


def test_identical_source_from_other_checkout_refuses(fixture, monkeypatch):
    first, second, _, roster = fixture
    assert roster_for(second, roster) == roster
    original = sys.modules[FIXTURE]
    replacement = load(second, FIXTURE, monkeypatch)
    assert replacement is not original and replacement.VALUE == original.VALUE
    assert (
        Path(replacement.__file__).read_bytes()
        == (first / roster[FIXTURE]["Path"]).read_bytes()
    )
    refusal(admit(fixture), "ModuleOrigin")


@pytest.mark.parametrize(
    "kind",
    [
        "missing",
        "unlisted",
        "none",
        "dynamic",
        "file",
        "origin",
        "loader-path",
        "loader-name",
        "loader-object",
        "loader-subclass",
        "spec-name",
        "module-name",
        "package-name",
        "package-path",
        "search-path",
        "cache",
        "bytes",
        "symlink",
        "collector-object",
        "result-object",
    ],
)
def test_loaded_module_mutations_refuse(fixture, monkeypatch, kind):
    _, second, loaded, roster = fixture
    module = loaded[FIXTURE]
    other = str(second / roster[FIXTURE]["Path"])
    if kind == "missing":
        monkeypatch.delitem(sys.modules, FIXTURE)
    elif kind == "unlisted":
        monkeypatch.setitem(
            sys.modules, "zeta_interp.hidden_switch_unlisted", ModuleType("unlisted")
        )
    elif kind == "none":
        monkeypatch.setitem(sys.modules, FIXTURE, None)
    elif kind == "dynamic":
        monkeypatch.setitem(sys.modules, FIXTURE, ModuleType(FIXTURE))
    elif kind == "file":
        monkeypatch.setattr(module, "__file__", other)
    elif kind == "origin":
        monkeypatch.setattr(module.__spec__, "origin", other)
    elif kind == "loader-path":
        monkeypatch.setattr(module.__loader__, "path", other)
    elif kind == "loader-name":
        monkeypatch.setattr(module.__loader__, "name", "other")
    elif kind == "loader-object":
        monkeypatch.setattr(module, "__loader__", object())
    elif kind == "loader-subclass":

        class Custom(type(module.__loader__)):
            pass

        custom = Custom(FIXTURE, module.__file__)
        monkeypatch.setattr(module, "__loader__", custom)
        monkeypatch.setattr(module.__spec__, "loader", custom)
    elif kind == "spec-name":
        monkeypatch.setattr(module.__spec__, "name", "other")
    elif kind == "module-name":
        monkeypatch.setattr(module, "__name__", "other")
    elif kind == "package-name":
        monkeypatch.setattr(module, "__package__", "other")
    elif kind == "package-path":
        monkeypatch.setattr(loaded["zeta_interp"], "__path__", [str(second / PREFIX)])
    elif kind == "search-path":
        monkeypatch.setattr(
            loaded["zeta_interp"].__spec__,
            "submodule_search_locations",
            [str(second / PREFIX)],
        )
    elif kind == "cache":
        monkeypatch.setattr(module, "__cached__", "other")
    elif kind == "bytes":
        Path(module.__file__).write_text("VALUE = 8\n")
    elif kind == "symlink":
        path = Path(module.__file__)
        path.unlink()
        path.symlink_to(other)
    elif kind in ("collector-object", "result-object"):
        name = COLLECTOR if kind == "collector-object" else HELPER
        clone = ModuleType(name)
        clone.__dict__.update(vars(loaded[name]))
        monkeypatch.setitem(sys.modules, name, clone)
    refusal(admit(fixture))


@pytest.mark.parametrize(
    "kind",
    [
        "bool-bytes",
        "extra-key",
        "hash",
        "lowercase-hash",
        "absolute",
        "traversal",
        "alias",
        "missing-helper",
        "missing-package",
        "duplicate-path",
    ],
)
def test_expected_roster_is_canonical_not_self_reported_admission(fixture, kind):
    _, _, _, roster = fixture
    row = roster[FIXTURE]
    if kind == "bool-bytes":
        row["Bytes"] = False
    elif kind == "extra-key":
        row["Trusted"] = True
    elif kind == "hash":
        row["Sha256"] = "0" * 64
    elif kind == "lowercase-hash":
        row["Sha256"] = row["Sha256"].lower()
    elif kind == "absolute":
        row["Path"] = "/" + row["Path"]
    elif kind == "traversal":
        row["Path"] = "../" + row["Path"]
    elif kind == "alias":
        row["Path"] = "./" + row["Path"]
    elif kind == "missing-helper":
        del roster[HELPER]
    elif kind == "missing-package":
        del roster["zeta_interp"]
    elif kind == "duplicate-path":
        roster[DIRECT] = copy.deepcopy(row)
    refusal(admit(fixture))


def test_metadata_change_between_snapshots_refuses(fixture, monkeypatch):
    _, _, loaded, _ = fixture
    collector = loaded[COLLECTOR]
    original = collector._interpreter
    calls = 0

    def changed():
        nonlocal calls
        result = original()
        calls += 1
        if calls == 1:
            loaded[FIXTURE].__name__ = "changed"
        return result

    monkeypatch.setattr(collector, "_interpreter", changed)
    refusal(admit(fixture), "ModuleIdentity")


@pytest.mark.parametrize("kind", ["object", "source", "unlisted", "interpreter"])
def test_observed_snapshot_changes_refuse(fixture, monkeypatch, kind):
    _, _, loaded, _ = fixture
    collector = loaded[COLLECTOR]
    original = collector._interpreter
    calls = 0

    def changed():
        nonlocal calls
        result = original()
        calls += 1
        if calls == 1:
            if kind == "object":
                replacement = ModuleType(FIXTURE)
                replacement.__dict__.update(vars(loaded[FIXTURE]))
                monkeypatch.setitem(sys.modules, FIXTURE, replacement)
            elif kind == "source":
                Path(loaded[FIXTURE].__file__).write_text("VALUE = 9\n")
            elif kind == "unlisted":
                monkeypatch.setitem(
                    sys.modules, "zeta_interp.hidden_switch_late", ModuleType("late")
                )
        if kind == "interpreter" and calls == 2:
            result["Version"] = "changed snapshot"
        return result

    monkeypatch.setattr(collector, "_interpreter", changed)
    refusal(admit(fixture), "SourceBytes" if kind == "source" else "SnapshotChanged")


@pytest.mark.parametrize("field", ["executable", "version", "implementation"])
def test_invalid_actual_interpreter_metadata_refuses(fixture, monkeypatch, field):
    replacement = {
        "executable": "relative-python",
        "version": "",
        "implementation": object(),
    }[field]
    if field == "implementation":
        # Test the real implementation cache-tag field without replacing import machinery.
        monkeypatch.setattr(sys.implementation, "cache_tag", None)
    else:
        monkeypatch.setattr(sys, field, replacement)
    refusal(admit(fixture))


ENTRY_SOURCE = """import json, os, sys
from pathlib import Path
from types import ModuleType
from . import hidden_switch_compiled_python_identity as identity
from . import hidden_switch_identity_fixture, reviewed_identity_helper
root = Path(os.environ["IDENTITY_FIXTURE_ROOT"])
roster = json.loads((root / "roster.json").read_text())
if os.environ.get("IDENTITY_FIXTURE_DUPLICATE") == "logical":
    sys.modules[__spec__.name] = sys.modules["__main__"]
if os.environ.get("IDENTITY_FIXTURE_DUPLICATE") == "alias":
    sys.modules["other_entry_alias"] = sys.modules["__main__"]
if os.environ.get("IDENTITY_FIXTURE_DUPLICATE") == "alternate":
    alternate = ModuleType("other_entry_load")
    alternate.__spec__ = __spec__
    sys.modules["other_entry_load"] = alternate
if os.environ.get("IDENTITY_FIXTURE_DUPLICATE") == "wrong-name":
    __spec__.name = "zeta_interp.hidden_switch_wrong_entry"
kwargs = {} if os.environ.get("IDENTITY_FIXTURE_DUPLICATE") == "omit" else {"entry_module": "zeta_interp.hidden_switch_identity_entry"}
result = identity.admit_python_identity(str(root), roster, **kwargs)
print(json.dumps({"Value": getattr(result, "value", None), "Code": getattr(result, "Code", None)}))
"""


@pytest.mark.parametrize(
    "mutation", ["", "logical", "alias", "alternate", "wrong-name", "omit"]
)
def test_real_module_entry_without_separate_logical_import(tmp_path, mutation):
    root = (tmp_path / "entry-clone").resolve()
    folder = copy_clone(root)
    (folder / "hidden_switch_identity_entry.py").write_text(ENTRY_SOURCE)
    roster = roster_for(
        root, ("zeta_interp", HELPER, COLLECTOR, FIXTURE, DIRECT, ENTRY)
    )
    (root / "roster.json").write_text(json.dumps(roster))
    env = dict(os.environ)
    env.update(
        PYTHONPATH=str(root / "src/Interp.Python"),
        PYTHONDONTWRITEBYTECODE="1",
        IDENTITY_FIXTURE_ROOT=str(root),
        IDENTITY_FIXTURE_DUPLICATE=mutation,
    )
    completed = subprocess.run(
        [sys.executable, "-m", ENTRY],
        cwd=root,
        env=env,
        text=True,
        capture_output=True,
        check=False,
        timeout=20,
    )
    assert completed.returncode == 0, completed.stderr
    record = json.loads(completed.stdout)
    if mutation:
        assert record["Value"] is None
        assert record["Code"] in ("EntryIdentity", "ModuleIdentity")
    else:
        evidence = record["Value"]
        assert evidence["EntryAdmitted"] is True
        assert evidence["EntryModule"] == ENTRY
        assert evidence["EntryReason"] is None
        row = next(row for row in evidence["Modules"] if row["Name"] == ENTRY)
        assert row["RuntimeName"] == "__main__"
        assert row["LoaderName"] == ENTRY


def test_owned_descriptor_closes_when_stream_creation_refuses(fixture, monkeypatch):
    descriptors = []

    def refuse_stream(descriptor, *args, **kwargs):
        assert kwargs["closefd"] is False
        descriptors.append(descriptor)
        raise OSError("owned fixture stream creation failure")

    monkeypatch.setattr(os, "fdopen", refuse_stream)
    refusal(admit(fixture), "IdentityRead")
    assert len(descriptors) == 1
    with pytest.raises(OSError):
        os.fstat(descriptors[0])


@pytest.mark.parametrize("body_refuses", [True, False])
def test_close_then_error_is_not_retried_and_preserves_first_failure(
    fixture, monkeypatch, body_refuses
):
    original_close = os.close
    descriptors = []

    def close_then_error(descriptor):
        descriptors.append(descriptor)
        original_close(descriptor)
        raise OSError("injected error after actual close")

    def body_failure(*args, **kwargs):
        raise OSError("original stream refusal")

    monkeypatch.setattr(os, "close", close_then_error)
    if body_refuses:
        monkeypatch.setattr(os, "fdopen", body_failure)
    result = admit(fixture)
    refusal(result, "IdentityRead" if body_refuses else "IdentityCleanup")
    assert "injected error after actual close" in result.Message
    if body_refuses:
        assert "original stream refusal" in result.Message
    assert len(descriptors) == 1
    with pytest.raises(OSError):
        os.fstat(descriptors[0])


def test_invalid_public_arguments_refuse(fixture):
    root, _, loaded, roster = fixture
    function = loaded[COLLECTOR].admit_python_identity
    for value in (
        None,
        1,
        [],
        {},
        "relative",
        str(root / "absent"),
        str(root) + "\0suffix",
    ):
        refusal(function(value, roster))
    for value in (None, 1, [], {}, {False: {}}):
        refusal(function(str(root), value))
    for entry in (True, "absent", [], 1):
        refusal(function(str(root), roster, entry_module=entry))
