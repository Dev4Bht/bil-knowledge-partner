import hashlib

import pytest

from bil.dms.pii import scan_text
from bil.dms.storage import FileStorage


def test_save_is_content_addressed_and_deduplicated(tmp_path):
    storage = FileStorage(tmp_path / "files")
    rel1, sha1 = storage.save(b"hello")
    rel2, sha2 = storage.save(b"hello")
    assert sha1 == hashlib.sha256(b"hello").hexdigest()
    assert rel1 == rel2 == f"{sha1[:2]}/{sha1}"
    assert storage.path(rel1).read_bytes() == b"hello"


def test_path_rejects_escape(tmp_path):
    storage = FileStorage(tmp_path / "files")
    with pytest.raises(ValueError):
        storage.path("../../etc/passwd")


def test_scan_text_finds_cid_like_numbers_only():
    findings = scan_text("Customer CID 10501234576 filed a claim. Policy 123456 and 123456789012 are fine.")
    assert findings == [{"kind": "cid_number", "masked": "1050***76"}]


def test_scan_text_clean_document():
    assert scan_text("Claims must be reported within 7 days. Call 2011.") == []
