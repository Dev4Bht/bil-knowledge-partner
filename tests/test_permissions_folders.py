import pytest

from bil.dms.errors import ConflictError, NotFoundError, ValidationFailed
from bil.dms.models import Role
from bil.dms.permissions import can_read_folder, effective_read_groups
from bil.dms.services.folders import (
    create_folder, folder_path, get_folder_by_path, list_readable_folders,
)


def test_nested_folder_path_and_lookup(session):
    gi = create_folder(session, name="General Insurance")
    handbooks = create_folder(session, name="Handbooks", parent_id=gi.id)
    assert folder_path(handbooks) == "General Insurance/Handbooks"
    assert get_folder_by_path(session, "General Insurance/Handbooks").id == handbooks.id
    assert get_folder_by_path(session, "Nope/Handbooks") is None


def test_duplicate_sibling_missing_parent_and_bad_name(session):
    create_folder(session, name="Credit")
    with pytest.raises(ConflictError):
        create_folder(session, name="Credit")
    with pytest.raises(NotFoundError):
        create_folder(session, name="X", parent_id=999)
    with pytest.raises(ValidationFailed):
        create_folder(session, name="a/b")
    with pytest.raises(ValidationFailed):
        create_folder(session, name="  ")


def test_same_name_allowed_under_different_parents(session):
    a = create_folder(session, name="A")
    b = create_folder(session, name="B")
    create_folder(session, name="Forms", parent_id=a.id)
    create_folder(session, name="Forms", parent_id=b.id)


def test_effective_read_groups_inherit_and_override(session):
    gi = create_folder(session, name="General Insurance", read_groups=["uw_claims"])
    handbooks = create_folder(session, name="Handbooks", parent_id=gi.id)
    special = create_folder(session, name="Special", parent_id=gi.id, read_groups=["management"])
    corporate = create_folder(session, name="Corporate")
    assert effective_read_groups(handbooks) == ["uw_claims"]
    assert effective_read_groups(special) == ["management"]
    assert effective_read_groups(corporate) == []


def test_can_read_folder_rules(session, make_user):
    gi = create_folder(session, name="General Insurance", read_groups=["uw_claims"])
    corporate = create_folder(session, name="Corporate")
    claims = make_user("claims", groups=["uw_claims"])
    credit = make_user("credit", groups=["credit"])
    admin = make_user("admin", Role.admin)
    service = make_user("svc", Role.service)
    assert can_read_folder(claims, gi)
    assert not can_read_folder(credit, gi)
    assert can_read_folder(credit, corporate)
    assert can_read_folder(admin, gi)
    assert can_read_folder(service, gi)


def test_list_readable_folders_filters_by_group(session, make_user):
    create_folder(session, name="Credit", read_groups=["credit"])
    create_folder(session, name="Corporate")
    names = [folder_path(f) for f in list_readable_folders(session, make_user("pfgf", groups=["pfgf"]))]
    assert names == ["Corporate"]
    names = [folder_path(f) for f in list_readable_folders(session, make_user("c", groups=["credit"]))]
    assert names == ["Corporate", "Credit"]
