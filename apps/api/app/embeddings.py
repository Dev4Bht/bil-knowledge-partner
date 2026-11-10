"""Local embeddings through Ollama (BGE-M3, 1024 dimensions). Never a cloud API."""

from typing import Protocol

import httpx

DIMENSION = 1024


class EmbeddingUnavailable(Exception):
    """The embedding model could not be reached or returned something unusable."""


class Embedder(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]: ...


class OllamaEmbedder:
    def __init__(self, base_url: str, model: str = "bge-m3", timeout: float = 120.0):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        try:
            response = httpx.post(f"{self.base_url}/api/embed", timeout=self.timeout,
                                  json={"model": self.model, "input": texts, "truncate": True, "keep_alive": "90s"})
            response.raise_for_status()
            vectors = response.json()["embeddings"]
        except Exception as exc:
            raise EmbeddingUnavailable(f"{type(exc).__name__}: {exc}") from exc
        if len(vectors) != len(texts) or any(len(v) != DIMENSION for v in vectors):
            raise EmbeddingUnavailable(f"Unexpected embedding shape from model '{self.model}'")
        return vectors
