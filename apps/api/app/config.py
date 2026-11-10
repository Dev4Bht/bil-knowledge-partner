from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEV_SECRET = "dev-only-change-me"


class Settings(BaseSettings):
    """All configuration comes from the environment (see .env.example). Nothing here is a real secret."""

    model_config = SettingsConfigDict(env_file=("../../.env", ".env"), extra="ignore")

    app_env: str = "dev"
    database_url: str = "postgresql+psycopg://bil:bil_dev_password@localhost:5432/bil"
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "bil_minio"
    minio_secret_key: str = "bil_minio_dev_secret"
    minio_bucket: str = "bil-documents"
    minio_secure: bool = False
    web_origin: str = "http://localhost:3000"
    jwt_secret: str = _DEV_SECRET

    @model_validator(mode="after")
    def _refuse_dev_secret_in_production(self) -> "Settings":
        if self.app_env == "production" and self.jwt_secret == _DEV_SECRET:
            raise ValueError("JWT_SECRET must be set when APP_ENV=production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
