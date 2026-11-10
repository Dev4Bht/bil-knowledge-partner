"""Cross-role leakage: every way of reading a document must enforce the same rules."""

from tests.conftest import add_version, upload


def _make_doc(admin, folders, **fields):
    response = upload(admin, folders["general_insurance/Handbooks"], **fields)
    assert response.status_code == 201, response.text
    return response.json()


def _approve(admin, doc):
    version_id = doc["versions"][0]["id"]
    assert admin.post(f"/documents/{doc['id']}/versions/{version_id}/approve").status_code == 200
    return version_id


def test_staff_cannot_upload_approve_or_create_folders(client_for, folders):
    staff = client_for("staff")
    assert upload(staff, folders["general_insurance/Handbooks"]).status_code == 403
    admin = client_for("admin")
    doc = _make_doc(admin, folders)
    vid = doc["versions"][0]["id"]
    assert staff.post(f"/documents/{doc['id']}/versions/{vid}/approve").status_code == 403
    assert staff.post("/folders", json={"name": "X", "business_line": "credit"}).status_code == 403
    assert staff.get("/audit").status_code == 403


def test_drafts_are_invisible_to_staff_everywhere(client_for, folders):
    admin, staff = client_for("admin"), client_for("staff")
    doc = _make_doc(admin, folders, title="Draft only")
    vid = doc["versions"][0]["id"]
    assert doc["versions"][0]["status"] == "draft"
    assert staff.get("/documents").json()["total"] == 0
    assert staff.get(f"/documents/{doc['id']}").status_code == 404
    assert staff.get(f"/documents/{doc['id']}/versions/{vid}/file").status_code == 404
    assert admin.get("/documents").json()["total"] == 1


def test_staff_see_approved_documents_but_not_a_later_draft_version(client_for, folders):
    admin, staff = client_for("admin"), client_for("staff")
    doc = _make_doc(admin, folders)
    _approve(admin, doc)
    draft = add_version(admin, doc["id"], content=b"Claims must be reported within 3 days.\n").json()
    detail = staff.get(f"/documents/{doc['id']}").json()
    assert [v["status"] for v in detail["versions"]] == ["approved_current"]
    assert staff.get(f"/documents/{doc['id']}/versions/{draft['id']}/file").status_code == 404
    assert len(admin.get(f"/documents/{doc['id']}").json()["versions"]) == 2


def test_restricted_documents_are_limited_to_listed_roles(client_for, folders):
    admin, manager, staff = client_for("admin"), client_for("manager"), client_for("staff")
    doc = _make_doc(admin, folders, title="Managers only", access_classification="restricted", access_roles="manager")
    _approve(admin, doc)
    vid = doc["versions"][0]["id"]
    assert manager.get(f"/documents/{doc['id']}").status_code == 200
    assert staff.get(f"/documents/{doc['id']}").status_code == 404
    assert staff.get(f"/documents/{doc['id']}/versions/{vid}/file").status_code == 404
    assert staff.get(f"/documents/{doc['id']}/compare", params={"from": vid, "to": vid}).status_code == 404
    assert staff.get("/documents", params={"q": "Managers"}).json()["total"] == 0
    assert manager.get("/documents", params={"q": "Managers"}).json()["total"] == 1


def test_folder_required_role_hides_the_folder_and_its_documents(client_for, folders):
    admin, staff, manager = client_for("admin"), client_for("staff"), client_for("manager")
    created = admin.post("/folders", json={"name": "Board", "business_line": "corporate", "required_role": "manager"})
    assert created.status_code == 201
    board = created.json()["id"]
    doc = upload(admin, board, title="Board pack", business_line="corporate").json()
    _approve(admin, doc)
    assert "Board" not in [f["name"] for f in staff.get("/folders").json()]
    assert "Board" in [f["name"] for f in manager.get("/folders").json()]
    assert staff.get(f"/documents/{doc['id']}").status_code == 404
    assert manager.get(f"/documents/{doc['id']}").status_code == 200


def test_denied_reads_return_404_and_are_audited(client_for, folders):
    admin, staff = client_for("admin"), client_for("staff")
    doc = _make_doc(admin, folders, access_classification="restricted", access_roles="manager")
    assert staff.get(f"/documents/{doc['id']}").status_code == 404
    assert staff.get("/documents/00000000-0000-0000-0000-000000000000").status_code == 404
    events = admin.get("/audit", params={"result": "denied"}).json()["items"]
    assert any(e["event"] == "document.view" and e["resource_id"] == doc["id"] for e in events)


def test_unauthenticated_requests_are_refused(app):
    from fastapi.testclient import TestClient

    anon = TestClient(app)
    for path in ("/documents", "/folders", "/business-lines", "/capabilities", "/audit"):
        assert anon.get(path).status_code == 401, path
