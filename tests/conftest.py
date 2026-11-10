import pytest

from bil.config import Settings
from bil.dms.db import init_db, make_engine, make_session_factory


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
