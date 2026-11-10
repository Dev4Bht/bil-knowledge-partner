import pytest

from app.storage import LocalFileStore, validate_key


def test_put_get_exists_roundtrip(tmp_path):
    store = LocalFileStore(tmp_path)
    assert not store.exists("docs/abc/v1.pdf")
    store.put("docs/abc/v1.pdf", b"original bytes", "application/pdf")
    assert store.exists("docs/abc/v1.pdf")
    assert store.get("docs/abc/v1.pdf") == b"original bytes"


def test_originals_are_write_once(tmp_path):
    store = LocalFileStore(tmp_path)
    store.put("k/v1", b"one")
    store.put("k/v1", b"one")  # identical bytes: idempotent
    with pytest.raises(FileExistsError):
        store.put("k/v1", b"different")
    assert store.get("k/v1") == b"one"


@pytest.mark.parametrize("key", ["", "/etc/passwd", "../outside", "a/../../b", "a//b", "a\\b", "a/./b", "a\x00b"])
def test_dangerous_keys_are_rejected(tmp_path, key):
    store = LocalFileStore(tmp_path)
    with pytest.raises(ValueError):
        validate_key(key)
    with pytest.raises(ValueError):
        store.put(key, b"x")


def test_check_reports_ok_for_a_writable_root(tmp_path):
    assert LocalFileStore(tmp_path).check() == {"ok": True, "backend": "filesystem"}
