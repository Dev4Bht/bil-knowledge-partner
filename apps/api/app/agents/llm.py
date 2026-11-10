"""Local LLM access through Ollama. Never a cloud API; if the model is unreachable we say so."""

import json
from typing import Protocol

import httpx


class LLMUnavailable(Exception):
    """The local model server is not reachable or the model is missing."""


class LLMBadOutput(Exception):
    """The model answered, but not in the requested structure."""


class LLM(Protocol):
    def json(self, *, system: str, user: str, schema: dict, max_tokens: int = 700) -> dict: ...
    def text(self, *, system: str, user: str, max_tokens: int = 500) -> str: ...


class OllamaLLM:
    def __init__(self, base_url: str, model: str, timeout: float = 240.0):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    def _chat(self, system: str, user: str, max_tokens: int, schema: dict | None) -> str:
        payload = {
            "model": self.model, "stream": False, "think": False, "keep_alive": "90s",  # free the memory soon after use  # no hidden reasoning: faster, and nothing to leak
            "options": {"temperature": 0, "num_predict": max_tokens, "num_ctx": 8192},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        }
        if schema is not None:
            payload["format"] = schema
        try:
            response = httpx.post(f"{self.base_url}/api/chat", json=payload, timeout=self.timeout)
        except httpx.HTTPError as exc:
            raise LLMUnavailable(f"The local model server is not reachable ({type(exc).__name__})") from exc
        if response.status_code == 404:
            raise LLMUnavailable(f"The local model '{self.model}' is not installed")
        if response.status_code >= 400:
            raise LLMUnavailable(f"The local model server returned an error ({response.status_code})")
        return response.json().get("message", {}).get("content", "")

    def json(self, *, system: str, user: str, schema: dict, max_tokens: int = 700) -> dict:
        content = self._chat(system, user, max_tokens, schema)
        try:
            value = json.loads(content)
        except json.JSONDecodeError as exc:
            raise LLMBadOutput("The model did not return valid JSON") from exc
        if not isinstance(value, dict):
            raise LLMBadOutput("The model did not return a JSON object")
        return value

    def text(self, *, system: str, user: str, max_tokens: int = 500) -> str:
        return self._chat(system, user, max_tokens, None).strip()
