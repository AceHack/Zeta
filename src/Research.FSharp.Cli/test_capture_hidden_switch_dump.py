"""Finite actual-file custody fixtures; never create a study target or dump."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from capture_hidden_switch_dump import custody_copy, target_custody


class CustodyTests(unittest.TestCase):
    def test_copy_uses_exclusive_destination_and_actual_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, copied = root / "source.dll", root / "copy.dll"
            source.write_bytes(b"owned original bytes")
            row = custody_copy(source, copied)
            self.assertEqual(copied.read_bytes(), source.read_bytes())
            self.assertEqual(row["Original"]["Sha256"], row["Copy"]["Sha256"])
            with self.assertRaises(FileExistsError):
                custody_copy(source, copied)
            self.assertEqual(copied.read_bytes(), b"owned original bytes")

    def test_finite_roster_prefix_survives_later_copy_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, attempt = root / "source", root / "attempt"
            source.mkdir(); attempt.mkdir()
            dll = source / "app.dll"
            dll.write_bytes(b"first module")
            dll.with_suffix(".runtimeconfig.json").write_bytes(b"{}")
            # The final required deps file is absent: earlier exact copies and rows remain.
            with self.assertRaises(FileNotFoundError):
                target_custody(dll, attempt)
            self.assertEqual(json.loads((attempt / "target-custody-00.json").read_text())["Original"]["File"], str(dll))
            self.assertEqual((attempt / "target-files/app.dll").read_bytes(), b"first module")
            self.assertFalse((attempt / "target-custody.json").exists())

    def test_zero_size_and_checked_copy_deadline_refuse(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.dll"
            source.write_bytes(b"")
            with self.assertRaises(ValueError):
                custody_copy(source, root / "empty.dll")
            source.write_bytes(b"finite")
            with patch("capture_hidden_switch_dump.time.monotonic", side_effect=[0, 11]), self.assertRaises(TimeoutError):
                custody_copy(source, root / "deadline.dll")
            self.assertTrue((root / "deadline.dll").exists())

    def test_real_close_errors_do_not_replace_prior_fsync_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, destination = root / "source.dll", root / "copy.dll"
            source.write_bytes(b"owned source")
            original_open = Path.open
            closes = []

            class CloseError:
                def __init__(self, stream, label):
                    self.stream, self.label = stream, label

                def __getattr__(self, name):
                    return getattr(self.stream, name)

                def close(self):
                    self.stream.close()
                    closes.append(self.label)
                    raise OSError("owned real-close-then-error")

            def open_fixture(path, mode="r", *args, **kwargs):
                stream = original_open(path, mode, *args, **kwargs)
                return CloseError(stream, str(path)) if (path == source and mode == "rb") or mode == "xb" else stream

            primary = OSError("owned fsync failure")
            with patch.object(Path, "open", open_fixture), patch("capture_hidden_switch_dump.os.fsync", side_effect=primary), self.assertRaises(OSError) as caught:
                custody_copy(source, destination)
            self.assertIs(caught.exception, primary)
            self.assertEqual(len(caught.exception.custody_cleanup), 2)
            self.assertEqual(closes, [str(destination), str(source)])
            self.assertEqual(destination.read_bytes(), b"owned source")
            closes.clear()
            other = root / "other.dll"
            with patch.object(Path, "open", open_fixture), self.assertRaisesRegex(OSError, "cleanup failed") as caught:
                custody_copy(source, other)
            self.assertEqual(len(caught.exception.custody_cleanup), 2)
            self.assertEqual(closes, [str(other), str(source)])
            self.assertEqual(other.read_bytes(), b"owned source")


if __name__ == "__main__":
    unittest.main()
