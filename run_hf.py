import os
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

# Import the main FastAPI app from the backend module
from backend.app.main import app

# Custom SPA (Single Page Application) routing fallback handler
@app.exception_handler(StarletteHTTPException)
async def spa_routing_handler(request, exc):
    # For API routes, return the standard 404 response
    if request.url.path.startswith("/api"):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    
    # For any other route (e.g. /login, /dashboard) that is not found,
    # serve the React frontend index.html to allow client-side routing.
    index_path = os.path.join("frontend", "dist", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return JSONResponse(status_code=404, content={"detail": "React index.html not found"})

# Mount the static frontend build folder to serve static files
dist_dir = os.path.join("frontend", "dist")
if os.path.exists(dist_dir):
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="frontend")
else:
    print(f"Warning: Frontend build directory '{dist_dir}' not found. Static files will not be served.")
