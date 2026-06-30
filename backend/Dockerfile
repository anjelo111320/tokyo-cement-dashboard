# Build context = backend/ (Render sets Root Directory to backend)
# So paths here are relative to backend/, not the project root.
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source into /app/backend/ so `backend` is an importable package
COPY . ./backend/

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
