import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    secret_key: str
    token_max_age_seconds: int = 8 * 3600

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.data_dir / 'dms.sqlite3'}"

    @property
    def files_dir(self) -> Path:
        return self.data_dir / "files"


def load_settings() -> Settings:
    return Settings(
        data_dir=Path(os.environ.get("BIL_DATA_DIR", "data/dms")),
        secret_key=os.environ.get("BIL_SECRET_KEY", "dev-only-change-me"),
    )
