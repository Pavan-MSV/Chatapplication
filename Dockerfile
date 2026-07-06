# Multi-stage build to package both frontend and backend
# Stage 1: Build the React frontend
FROM node:18 AS frontend-builder
WORKDIR /app/frontend

# Copy package files and install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy frontend source code
COPY frontend/ ./

# Set the Vite build-time environment variable to /api
# Since the frontend will be served from the same domain, /api will route to the FastAPI backend.
ENV VITE_API_BASE_URL=/api

# Build the frontend production assets
RUN npm run build

# Stage 2: Serve the backend FastAPI and static frontend files
FROM python:3.10
WORKDIR /app

# Upgrade pip and install python dependencies
RUN pip install --no-cache-dir --upgrade pip
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt psycopg2-binary

# Copy backend files
COPY backend/ ./backend/

# Copy built frontend assets from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy the Hugging Face entrypoint runner
COPY run_hf.py ./

# Expose the default Hugging Face Spaces port (7860)
EXPOSE 7860

# Run FastAPI app via uvicorn on port 7860
CMD ["uvicorn", "run_hf:app", "--host", "0.0.0.0", "--port", "7860"]
