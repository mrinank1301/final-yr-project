FROM python:3.11-slim

WORKDIR /app

# Install system deps for aiohttp and other packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create non-root user
RUN groupadd --system appgroup && useradd --system --gid appgroup appuser
USER appuser

EXPOSE 5000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "5000", "--ws", "wsproto", "--log-level", "info"]
