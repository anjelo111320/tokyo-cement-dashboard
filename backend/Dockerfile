# Build context must be the PROJECT ROOT (see docker-compose.yml) so that
# `backend` is a real importable package inside the image — the app uses
# absolute imports rooted at `backend` (e.g. `from backend.core.config ...`).
FROM python:3.12-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
