# Build context = project ROOT (set Root Directory to blank in Render)
# This allows copying both backend/ and sample-data/ into the image.
FROM python:3.12-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend as an importable package
COPY backend/ ./backend/

# Copy CSV data files
COPY sample-data/ ./sample-data/

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
