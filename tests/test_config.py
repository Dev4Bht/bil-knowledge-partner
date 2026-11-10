from pathlib import Path

from bil.config import Settings, load_settings


def test_database_url_and_files_dir_live_under_data_dir(tmp_path):
    s = Settings(data_dir=tmp_path, secret_key="k")
    assert s.database_url == f"sqlite:///{tmp_path / 'dms.sqlite3'}"
    assert s.files_dir == tmp_path / "files"


def test_load_settings_reads_environment(monkeypatch, tmp_path):
    monkeypatch.setenv("BIL_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("BIL_SECRET_KEY", "abc")
    s = load_settings()
    assert s.data_dir == Path(tmp_path)
    assert s.secret_key == "abc"
