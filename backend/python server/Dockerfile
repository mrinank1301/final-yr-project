FROM python:3.11-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Prevent pip cache + version bleed
ENV PIP_NO_CACHE_DIR=1
ENV PYTHONUNBUFFERED=1

# Copy requirements first (for better caching control)
COPY requirements.txt .

# 🔥 HARD RESET websockets + install pinned deps
RUN pip uninstall -y websockets || true \
    && pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir "websockets>=10.4,<11" --force-reinstall

# Copy application code
COPY . .

# Remove env files (safety)
RUN rm -f .env .env.local 2>/dev/null || true

EXPOSE 5000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "5000"]
