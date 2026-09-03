FROM python:3.12-slim

# numpy/scikit-learn puxam libgomp1 em runtime (OpenMP) — sem isso o
# import falha silenciosamente em imagens slim.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml .
# Instala só as dependências primeiro — camada cacheada entre builds
# enquanto o código muda mas o pyproject.toml não.
RUN pip install --no-cache-dir -e . || true

COPY . .
RUN pip install --no-cache-dir -e .

# Render injeta $PORT em runtime; 8000 é o default local (docker run -p).
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
