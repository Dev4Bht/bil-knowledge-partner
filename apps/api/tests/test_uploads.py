import pytest

from tests.conftest import add_version, upload


@pytest.fixture
def admin(client_for):
    return client_for("admin")


def _gi(folders):
    return folders["general_insurance/Handbooks"]


@pytest.mark.parametrize("filename", ["run.exe", "script.sh", "page.html", "macro.docm", "archive.zip", "noext"])
def test_dangerous_or_unknown_types_are_rejected(admin, folders, filename):
    response = upload(admin, _gi(folders), filename=filename)
    assert response.status_code == 422 and response.json()["code"] == "unsupported_type"


def test_content_must_match_the_extension(admin, folders):
    assert upload(admin, _gi(folders), filename="fake.pdf", content=b"MZ not a pdf").json()["code"] == "bad_content"
    assert upload(admin, _gi(folders), filename="fake.docx", content=b"plain text").json()["code"] == "bad_content"
    assert upload(admin, _gi(folders), filename="bin.txt", content=b"abc\x00def").json()["code"] == "bad_content"
    assert upload(admin, _gi(folders), filename="latin.txt", content="caf\xe9".encode("latin-1")).json()["code"] == "bad_content"


def test_valid_pdf_and_docx_signatures_are_accepted(admin, folders):
    assert upload(admin, _gi(folders), title="A", filename="a.pdf", content=b"%PDF-1.4\n...").status_code == 201
    assert upload(admin, _gi(folders), title="B", filename="b.docx", content=b"PK\x03\x04...").status_code == 201


def test_empty_and_oversized_files_are_rejected(admin, folders, monkeypatch):
    assert upload(admin, _gi(folders), content=b"").json()["code"] == "empty_file"
    from app.config import get_settings

    monkeypatch.setenv("MAX_UPLOAD_MB", "1")
    get_settings.cache_clear()
    try:
        big = upload(admin, _gi(folders), content=b"a" * (1024 * 1024 + 1))
    finally:
        get_settings.cache_clear()
    assert big.status_code == 413 and big.json()["code"] == "too_large"


def test_filenames_are_sanitised_and_never_used_in_storage_paths(admin, folders, settings_object_path):
    response = upload(admin, _gi(folders), filename="../../etc/evil name.txt")
    assert response.status_code == 201
    version = response.json()["versions"][0]
    assert version["original_filename"] == "evil name.txt"
    stored = [str(p.relative_to(settings_object_path)) for p in settings_object_path.rglob("*") if p.is_file()]
    assert stored and all("evil" not in s and ".." not in s for s in stored)


def test_personal_data_in_text_files_is_rejected(admin, folders):
    response = upload(admin, _gi(folders), content=b"Customer CID 10501234576 asked about claims.\n")
    assert response.status_code == 422 and response.json()["code"] == "personal_data"
    assert "10501234576" not in response.text  # the number is never echoed back


def test_metadata_validation(admin, folders):
    assert upload(admin, _gi(folders), title="   ").status_code == 422
    assert upload(admin, _gi(folders), access_classification="restricted").json()["code"] == "no_roles"
    assert upload(admin, _gi(folders), access_classification="restricted", access_roles="ghost").json()["code"] == "unknown_role"
    assert upload(admin, _gi(folders), effective_from="2024-05-01", effective_to="2024-01-01").json()["code"] == "bad_dates"
    assert upload(admin, _gi(folders), language="fr").json()["code"] == "bad_language"
    wrong_line = upload(admin, folders["credit/Recovery SOPs"], business_line="general_insurance")
    assert wrong_line.json()["code"] == "bad_folder"


def test_new_version_validates_the_same_way(admin, folders):
    doc = upload(admin, _gi(folders)).json()
    bad = admin.post(f"/documents/{doc['id']}/versions", files={"file": ("x.exe", b"MZ", "application/octet-stream")})
    assert bad.status_code == 422
    assert add_version(admin, doc["id"], content=b"fine\n").status_code == 201
