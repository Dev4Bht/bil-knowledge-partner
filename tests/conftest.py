import pytest

from bil.config import Settings
from bil.dms.db import init_db, make_engine, make_session_factory
from bil.dms.models import Role, User
from bil.dms.services.folders import get_or_create_group


@pytest.fixture
def settings(tmp_path):
    return Settings(data_dir=tmp_path, secret_key="test-secret")


@pytest.fixture
def session(settings):
    settings.files_dir.mkdir(parents=True, exist_ok=True)
    engine = make_engine(settings.database_url)
    init_db(engine)
    with make_session_factory(engine)() as s:
        yield s
    engine.dispose()


@pytest.fixture
def make_user(session):
    def _make(username, role=Role.staff, groups=()):
        group_objs = [get_or_create_group(session, name) for name in groups]
        user = User(username=username, full_name=username.title(), password_hash="x", role=role, groups=group_objs)
        session.add(user)
        session.commit()
        return user

    return _make


@pytest.fixture
def admin(make_user):
    return make_user("admin", Role.admin)
