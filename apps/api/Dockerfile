FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project --extra translation
COPY . .
RUN uv sync --frozen --no-dev --extra translation
ENV PATH="/app/.venv/bin:$PATH" HF_HOME=/root/.cache/huggingface
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && python -m app.seed && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
