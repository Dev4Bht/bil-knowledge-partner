FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir uv
# The Dzongkha translation extra pulls PyTorch (several GB with CUDA wheels on Linux). It is off by default because
# translation is parked (TRANSLATION_ENABLED=false). Build with WITH_TRANSLATION=true to include it.
ARG WITH_TRANSLATION=false
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project $([ "$WITH_TRANSLATION" = "true" ] && echo "--extra translation")
COPY . .
RUN uv sync --frozen --no-dev $([ "$WITH_TRANSLATION" = "true" ] && echo "--extra translation")
ENV PATH="/app/.venv/bin:$PATH" HF_HOME=/root/.cache/huggingface
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && python -m app.seed && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
