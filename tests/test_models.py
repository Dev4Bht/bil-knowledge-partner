from datetime import date

from bil.dms.models import (
    BusinessLine, Document, DocumentVersion, DocType, Folder, Group, Role, User, VersionStatus,
)


def test_user_group_and_folder_relations(session):
    group = Group(name="credit")
    user = User(username="a", full_name="A", password_hash="x", role=Role.staff, groups=[group])
    folder = Folder(name="Credit", read_groups=[group])
    session.add_all([user, folder])
    session.commit()
    assert [g.name for g in session.get(User, user.id).groups] == ["credit"]
    assert [g.name for g in session.get(Folder, folder.id).read_groups] == ["credit"]


def test_document_versions_are_ordered_and_unique(session):
    folder = Folder(name="Handbooks")
    doc = Document(folder=folder, title="T", business_line=BusinessLine.credit, doc_type=DocType.sop, owner="")
    for n in (2, 1):
        DocumentVersion(
            document=doc, version_number=n, filename="f.txt", content_type="text/plain", size_bytes=1,
            sha256="0" * 64, storage_path="00/x", effective_date=date(2024, 1, 1),
            status=VersionStatus.draft, uploaded_by="a",
        )
    session.add(doc)
    session.commit()
    session.expire_all()
    assert [v.version_number for v in session.get(Document, doc.id).versions] == [1, 2]
