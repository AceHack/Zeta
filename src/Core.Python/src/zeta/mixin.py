import weakref
from typing import TypeVar, Generic, Optional

TKey = TypeVar('TKey')
TValue = TypeVar('TValue')

class WeakMap(Generic[TKey, TValue]):
    """
    GC-safe weak-keyed identity table for attaching state to objects.
    """
    def __init__(self) -> None:
        self._dict = weakref.WeakKeyDictionary()

    def set(self, key: TKey, value: TValue) -> None:
        """
        Attach a state value to the key. Overwrites if it already exists.
        """
        self._dict[key] = value

    def get(self, key: TKey) -> Optional[TValue]:
        """
        Try to get the state value associated with the key. Returns None if absent.
        """
        return self._dict.get(key)

    def delete(self, key: TKey) -> bool:
        """
        Delete the entry associated with the key. Returns True if removed, False otherwise.
        """
        if key in self._dict:
            del self._dict[key]
            return True
        return False
