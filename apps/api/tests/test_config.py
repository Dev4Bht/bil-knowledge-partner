import pytest
from pydantic import ValidationError

from app.config import Settings


def test_production_refuses_the_dev_secret():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, app_env="production")


def test_production_accepts_a_real_secret():
    assert Settings(_env_file=None, app_env="production", jwt_secret="x" * 40).app_env == "production"


def test_dev_defaults_use_filesystem_storage():
    settings = Settings(_env_file=None)
    assert settings.object_store_backend == "filesystem"
