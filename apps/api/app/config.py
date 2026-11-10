from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEV_SECRET = "dev-only-change-me"


class Settings(BaseSettings):
    """All configuration comes from the environment (see .env.example). Nothing here is a real secret."""

    model_config = SettingsConfigDict(env_file=("../../.env", ".env"), extra="ignore")

    app_env: str = "dev"
    database_url: str = "postgresql+psycopg://bil:bil_dev_password@localhost:5432/bil"
    web_origin: str = "http://localhost:3000"
    jwt_secret: str = _DEV_SECRET

    # Original documents: local filesystem by default, or any S3-compatible server.
    object_store_backend: Literal["filesystem", "s3"] = "filesystem"
    object_store_path: str = "data/objects"
    s3_endpoint: str = "localhost:9000"
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_bucket: str = "bil-documents"
    s3_secure: bool = False

    @model_validator(mode="after")
    def _refuse_dev_secret_in_production(self) -> "Settings":
        if self.app_env == "production" and self.jwt_secret == _DEV_SECRET:
            raise ValueError("JWT_SECRET must be set when APP_ENV=production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
