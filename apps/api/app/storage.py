from minio import Minio

from .config import Settings


class ObjectStore:
    """Thin wrapper over the S3-compatible store (MinIO). Originals live here and are never modified."""

    def __init__(self, settings: Settings):
        self.bucket = settings.minio_bucket
        self.client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )

    def ensure_bucket(self) -> None:
        if not self.client.bucket_exists(self.bucket):
            self.client.make_bucket(self.bucket)

    def check(self) -> dict:
        try:
            self.ensure_bucket()
            return {"ok": True}
        except Exception as exc:  # reachability problems of any kind
            return {"ok": False, "detail": f"{type(exc).__name__}: {exc}"}
