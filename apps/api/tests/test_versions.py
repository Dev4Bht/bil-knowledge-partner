import hashlib
import threading

from tests.conftest import add_version, upload


def _doc(admin, folders, **fields):
    return upload(admin, folders["general_insurance/Handbooks"], **fields).json()


def _statuses(admin, doc_id):
    versions = admin.get(f"/documents/{doc_id}").json()["versions"]
    return {v["version_label"]: v["status"] for v in versions}


def test_approving_a_new_version_supersedes_the_old_one_atomically(client_for, folders):
    admin = client_for("admin")
    doc = _doc(admin, folders, version_label="v1", effective_from="2022-01-01")
    v1 = doc["versions"][0]["id"]
    assert admin.post(f"/documents/{doc['id']}/versions/{v1}/approve").json()["status"] == "approved_current"
    v2 = add_version(admin, doc["id"], content=b"Claims must be reported within 3 days.\n",
                     version_label="v2", effective_from="2024-01-01").json()
    approved = admin.post(f"/documents/{doc['id']}/versions/{v2['id']}/approve").json()
    assert approved["status"] == "approved_current" and approved["supersedes_version_id"] == v1
    detail = admin.get(f"/documents/{doc['id']}").json()
    by_label = {v["version_label"]: v for v in detail["versions"]}
    assert by_label["v1"]["status"] == "superseded" and by_label["v1"]["effective_to"] == "2023-12-31"
    assert by_label["v2"]["approved_by"] == "Admin"
    assert detail["current_version"]["version_label"] == "v2"


def test_only_a_draft_can_be_approved(client_for, folders):
    admin = client_for("admin")
    doc = _doc(admin, folders)
    vid = doc["versions"][0]["id"]
    admin.post(f"/documents/{doc['id']}/versions/{vid}/approve")
    again = admin.post(f"/documents/{doc['id']}/versions/{vid}/approve")
    assert again.status_code == 409 and again.json()["code"] == "not_draft"


def test_archiving_a_current_version_leaves_no_current_version(client_for, folders):
    admin = client_for("admin")
    doc = _doc(admin, folders)
    vid = doc["versions"][0]["id"]
    admin.post(f"/documents/{doc['id']}/versions/{vid}/approve")
    assert admin.post(f"/documents/{doc['id']}/versions/{vid}/archive").json()["status"] == "archived"
    assert admin.get(f"/documents/{doc['id']}").json()["current_version"] is None
    assert admin.post(f"/documents/{doc['id']}/versions/{vid}/archive").status_code == 409


def test_concurrent_approvals_never_leave_two_current_versions(client_for, folders):
    admin = client_for("admin")
    doc = _doc(admin, folders, version_label="v1")
    v1 = doc["versions"][0]["id"]
    admin.post(f"/documents/{doc['id']}/versions/{v1}/approve")
    drafts = [add_version(admin, doc["id"], content=f"Revision {n}\n".encode(), version_label=f"r{n}").json()["id"]
              for n in (2, 3, 4)]
    codes: list[int] = []

    def approve(version_id):
        codes.append(admin.post(f"/documents/{doc['id']}/versions/{version_id}/approve").status_code)

    threads = [threading.Thread(target=approve, args=(d,)) for d in drafts]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert codes == [200, 200, 200] or sorted(codes) == [200, 200, 200]
    assert list(_statuses(admin, doc["id"]).values()).count("approved_current") == 1


def test_stored_files_are_immutable_and_hash_matches(client_for, folders):
    admin = client_for("admin")
    content = b"Exact original bytes.\n"
    doc = _doc(admin, folders, content=content)
    vid = doc["versions"][0]["id"]
    assert doc["versions"][0]["sha256"] == hashlib.sha256(content).hexdigest()
    admin.post(f"/documents/{doc['id']}/versions/{vid}/approve")
    download = admin.get(f"/documents/{doc['id']}/versions/{vid}/file")
    assert download.content == content


def test_duplicate_version_labels_are_refused(client_for, folders):
    admin = client_for("admin")
    doc = _doc(admin, folders, version_label="2024")
    dup = add_version(admin, doc["id"], content=b"Another text\n", version_label="2024")
    assert dup.status_code == 409 and dup.json()["code"] == "duplicate_label"


def test_listing_filters_and_pagination(client_for, folders):
    admin = client_for("admin")
    for n in range(5):
        r = upload(admin, folders["credit/Policy and Manuals"], title=f"Credit doc {n}", business_line="credit")
        admin.post(f"/documents/{r.json()['id']}/versions/{r.json()['versions'][0]['id']}/approve")
    upload(admin, folders["general_insurance/Handbooks"], title="Motor note")
    page = admin.get("/documents", params={"business_line": "credit", "page_size": 2, "page": 2}).json()
    assert page["total"] == 5 and len(page["items"]) == 2 and page["page"] == 2
    assert admin.get("/documents", params={"status": "draft"}).json()["total"] == 1
    assert admin.get("/documents", params={"q": "motor"}).json()["total"] == 1
    assert admin.get("/documents", params={"q": "%"}).json()["total"] == 0  # wildcards are escaped, not interpreted
    folder_id = folders["credit/Policy and Manuals"]
    assert admin.get("/documents", params={"folder_id": folder_id}).json()["total"] == 5
