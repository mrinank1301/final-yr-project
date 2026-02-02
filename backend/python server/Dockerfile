FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
# Pin websockets to 10.x so uvicorn's WebSocket code can import websockets.datastructures (removed in 11+)
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir "websockets>=10.4,<11" --force-reinstall

COPY . .
RUN rm -f .env .env.local 2>/dev/null || true

EXPOSE 5000

ENV PORT=5000
ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "5000"]
