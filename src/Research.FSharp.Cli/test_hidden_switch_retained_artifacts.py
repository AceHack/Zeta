import gzip
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from hidden_switch_retained_artifacts import (
    RetainedStore,
    inflate,
    regular_bytes,
    relative_name,
    sha,
    strict_json,
)


class RetainedArtifactTests(unittest.TestCase):
    def fixture(self, root, raw=b'{"value":1}', stored=None, records=None):
        directory = Path(root) / "fixture"; directory.mkdir()
        stored = gzip.compress(raw, mtime=0) if stored is None else stored
        (directory / "row.json.gz").write_bytes(stored)
        row = {"File": "row.json.gz", "Bytes": len(raw), "Sha256": sha(raw), "StoredBytes": len(stored),
               "StoredSha256": sha(stored), "Encoding": "gzip", "OriginalLocalFile": "/must/not/open"}
        manifest = json.dumps({"Records": [row] if records is None else records(row)}).encode()
        (directory / "manifest.json").write_bytes(manifest)
        return [{"File": "fixture/manifest.json", "Bytes": len(manifest), "Sha256": sha(manifest)}]

    def test_exact_record_cache_recheck_and_observed_prefix(self):
        with tempfile.TemporaryDirectory() as root:
            events = []; store = RetainedStore(root, self.fixture(root), events.append)
            self.assertEqual(store.json("fixture/manifest.json", "row.json.gz"), {"value": 1})
            store.raw("fixture/manifest.json", "row.json.gz"); store.recheck()
            self.assertEqual([e["Kind"] for e in events], ["manifest", "stored-record", "original-record"])
            self.assertEqual(len(store.cache), 1)
            (Path(root) / "fixture/row.json.gz").write_bytes(b"changed")
            with self.assertRaises(ValueError): store.recheck()

    def test_manifest_hash_precedes_parse(self):
        with tempfile.TemporaryDirectory() as root:
            pins = self.fixture(root); pins[0]["Sha256"] = "0" * 64
            with patch("hidden_switch_retained_artifacts.strict_json", side_effect=AssertionError("must not parse")), self.assertRaises(ValueError):
                RetainedStore(root, pins)

    def test_record_identity_precedes_inflate(self):
        with tempfile.TemporaryDirectory() as root:
            store = RetainedStore(root, self.fixture(root))
            (Path(root) / "fixture/row.json.gz").write_bytes(b"changed")
            with patch("hidden_switch_retained_artifacts.inflate", side_effect=AssertionError("must not inflate")), self.assertRaises(ValueError):
                store.raw("fixture/manifest.json", "row.json.gz")
            self.assertEqual(len(store.pins), 1)

    def test_compressed_identity_survives_original_refusal(self):
        with tempfile.TemporaryDirectory() as root:
            store = RetainedStore(root, self.fixture(root, records=lambda row: [{**row, "Sha256": "0" * 64}]))
            with self.assertRaises(ValueError): store.raw("fixture/manifest.json", "row.json.gz")
            self.assertEqual(store.pins[-1]["Kind"], "stored-record")
            self.assertEqual(store.cache, {})

    def test_gzip_bounds_members_truncation_and_bomb(self):
        raw = b"x" * 8192; stored = gzip.compress(raw, mtime=0)
        self.assertEqual(inflate(stored, len(raw)), raw)
        for data, count in [(stored, 8), (stored, 8193), (stored[:-1], 8192), (stored + b"x", 8192),
                            (stored + gzip.compress(b"y"), 8192), (stored, True), (stored, 2 * 1024**2 + 1)]:
            with self.subTest(count=count, length=len(data)), self.assertRaises(ValueError): inflate(data, count)

    def test_paths_missing_and_duplicate_record_refuse(self):
        for name in ["/a", "../a", "a/../b", "a//b", "a/./b", "a\\b", "a\x00b", ""]:
            with self.subTest(name=name), self.assertRaises(ValueError): relative_name(name)
        with tempfile.TemporaryDirectory() as root:
            store = RetainedStore(root, self.fixture(root))
            with self.assertRaises(ValueError): store.raw("fixture/manifest.json", "missing.json.gz")
        with tempfile.TemporaryDirectory() as root, self.assertRaises(ValueError):
            RetainedStore(root, self.fixture(root, records=lambda row: [row, row]))

    def test_strict_json_duplicate_nonfinite_and_utf8(self):
        for raw in [b'{"a":1,"a":2}', b'{"a":NaN}', b'{"a":Infinity}', b'"\xff"']:
            with self.subTest(raw=raw), self.assertRaises(ValueError): strict_json(raw)

    def test_strict_json_exponent_overflow_at_every_depth(self):
        for raw in [b'1e400', b'-1e400', b'{"a":[1e400]}', b'[[{"a":-1e400}]]']:
            with self.subTest(raw=raw), self.assertRaises(ValueError): strict_json(raw)
        self.assertEqual(strict_json(b'{"a":1e300}'), {"a": 1e300})

    def test_regular_file_limits_symlink_and_fifo_refuse(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "input"; path.write_bytes(b"value")
            self.assertEqual(regular_bytes(path, 5), b"value")
            with self.assertRaises(ValueError): regular_bytes(path, 4)
            link = Path(root) / "link"; link.symlink_to(path)
            with self.assertRaises(OSError): regular_bytes(link, 5)
            fifo = Path(root) / "fifo"; os.mkfifo(fifo)
            with self.assertRaises(ValueError): regular_bytes(fifo, 5)

    def test_budgets_and_bool_counts_refuse_before_record_read(self):
        for changed in [{"Bytes": True}, {"StoredBytes": True}, {"Bytes": 2 * 1024**2 + 1}]:
            with tempfile.TemporaryDirectory() as root:
                store = RetainedStore(root, self.fixture(root, records=lambda row, changed=changed: [{**row, **changed}]))
                with patch("hidden_switch_retained_artifacts.regular_bytes", side_effect=AssertionError("must not read")), self.assertRaises(ValueError):
                    store.raw("fixture/manifest.json", "row.json.gz")
        with tempfile.TemporaryDirectory() as root:
            store = RetainedStore(root, self.fixture(root)); store.original_bytes = 16 * 1024**2
            with self.assertRaises(ValueError): store.raw("fixture/manifest.json", "row.json.gz")

    def test_successful_original_pin_survives_checkpoint_failure(self):
        with tempfile.TemporaryDirectory() as root:
            def fail(pin):
                if pin["Kind"] == "original-record": raise OSError("checkpoint failed")
            store = RetainedStore(root, self.fixture(root), fail)
            with self.assertRaises(OSError): store.raw("fixture/manifest.json", "row.json.gz")
            self.assertEqual(store.pins[-1]["Kind"], "original-record")
            self.assertEqual(store.cache[("fixture/manifest.json", "row.json.gz")], b'{"value":1}')

    def test_finite_producing_stream_and_primary_close_failure(self):
        real_fdopen = os.fdopen
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "input"; path.write_bytes(b"value")
            for read_failure in [False, True]:
                calls = []

                def wrapped(fd, mode, calls=calls, read_failure=read_failure):
                    stream = real_fdopen(fd, mode)

                    class Stream:
                        def read(self, size):
                            calls.append(size)
                            if read_failure:
                                raise OSError("primary read")
                            return b"x" * size

                        def fileno(self): return stream.fileno()

                        def close(self):
                            calls.append("close"); stream.close()
                            raise OSError("secondary close")

                    return Stream()

                with patch("hidden_switch_retained_artifacts.os.fdopen", side_effect=wrapped), self.assertRaises((ValueError, OSError)) as result:
                    regular_bytes(path, 5)
                self.assertEqual(str(result.exception), "primary read" if read_failure else "retained input grew")
                self.assertEqual(calls, [5, "close"] if read_failure else [5, 1, "close"])
                self.assertIn("secondary close", result.exception.__notes__[0])

    def test_deadline_refuses_before_read(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "input"; path.write_bytes(b"value")
            with patch("hidden_switch_retained_artifacts.time.monotonic", side_effect=[0, 11]), self.assertRaises(TimeoutError):
                regular_bytes(path, 5)


if __name__ == "__main__":
    unittest.main()
