import hashlib


def hash_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def hash_string(data: str) -> str:
    return hash_bytes(data.encode("utf-8"))
