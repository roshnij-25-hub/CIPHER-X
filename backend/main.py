import os
import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.routes import router

app = FastAPI(
    title="CIPHER-X API",
    description="Satellite-Based Human Change Detection & CVA Inference Backend",
    version="1.0.0"
)

# Enable CORS for Next.js frontend (local dev and production/Vercel)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve outputs directory statically for direct asset fetching
outputs_dir = PROJECT_ROOT / "outputs"
outputs_dir.mkdir(parents=True, exist_ok=True)
app.mount("/outputs", StaticFiles(directory=str(outputs_dir)), name="outputs")

# Include CVA detection endpoints
app.include_router(router)

@app.get("/")
def root_endpoint():
    return {
        "status": "online",
        "service": "CIPHER-X Satellite Change Detection Backend",
        "endpoints": {
            "detect": "POST /detect (multipart/form-data with before_image, after_image)",
            "samples": "GET /samples",
            "detect_sample": "POST /detect/sample/{scene_id}",
            "outputs": "GET /outputs/{filename}"
        }
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "model": "CVA Human Change Detection"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
