"""Verify the character archives and extract into a new directory.

Usage: python restore_archives.py ARCHIVE_DIRECTORY NEW_OUTPUT_DIRECTORY [MANIFEST]
Download release assets first using the README command. No network or overwrite.
"""

import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import stat
import sys
import zipfile


def digest(stream):
    """Stream a SHA256 digest without loading large files into memory."""
    result = hashlib.sha256()
    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
        result.update(chunk)
    return result.hexdigest()


def restore(archive_dir, destination, manifest_path):
    """Validate every byte and path before creating the destination."""
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if destination.exists():
        raise ValueError("Destination already exists; choose a new directory")
    validated = []
    global_names = set()
    for archive in manifest["archives"]:
        path = archive_dir / archive["name"]
        with path.open("rb") as stream:
            if path.stat().st_size != archive["bytes"] or digest(stream) != archive["sha256"]:
                raise ValueError(f"Archive checksum/length mismatch: {path.name}")
        entries = [item for item in manifest["files"] if item["archive"] == path.name]
        expected = {item["path"]: item for item in entries}
        if len(expected) != len(entries):
            raise ValueError("Duplicate manifest paths")
        with zipfile.ZipFile(path) as bundle:
            names = bundle.namelist()
            if len(names) != len(set(names)) or set(names) != set(expected):
                raise ValueError("Archive entries differ from manifest")
            for member in bundle.infolist():
                relative = PurePosixPath(member.filename)
                if (relative.is_absolute() or ".." in relative.parts
                        or "\\" in member.filename or member.is_dir()
                        or stat.S_ISLNK(member.external_attr >> 16)
                        or member.filename in global_names):
                    raise ValueError(f"Unsafe or duplicate member: {member.filename}")
                item = expected[member.filename]
                with bundle.open(member) as stream:
                    if member.file_size != item["bytes"] or digest(stream) != item["sha256"]:
                        raise ValueError(f"File checksum/length mismatch: {member.filename}")
                global_names.add(member.filename)
        validated.append(path)
    destination.mkdir(parents=True, exist_ok=False)
    for path in validated:
        with zipfile.ZipFile(path) as bundle:
            for member in bundle.infolist():
                target = destination / member.filename
                target.parent.mkdir(parents=True, exist_ok=True)
                with bundle.open(member) as source, target.open("xb") as output:
                    shutil.copyfileobj(source, output)
    return len(global_names)


if __name__ == "__main__":
    if len(sys.argv) not in (3, 4):
        sys.exit(__doc__)
    manifest = Path(sys.argv[3]) if len(sys.argv) == 4 else Path(__file__).with_name("inventory.json")
    count = restore(Path(sys.argv[1]), Path(sys.argv[2]), manifest)
    print(f"Verified and restored {count} files")
