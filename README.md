# CIPHER-X 🛰️

**Satellite-Based Human Change Detection Prototype**

Detect construction, demolition and human-induced land change using multi-temporal Sentinel-2 imagery powered by Change Vector Analysis (CVA).

---

## Quick Start

### Double-click to run (Windows)

```
start.bat
```

Opens two terminal windows:
- **Backend** → `http://localhost:8000`
- **Frontend** → `http://localhost:3000`

---

## Manual Start

### 1. FastAPI Backend

```powershell
# From project root
.\.venv\Scripts\uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

- API docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

### 2. Next.js Frontend

```powershell
cd cipher-x-dashboard
npm run dev
```

Open `http://localhost:3000`

---

## Project Structure

```
CIPHER-X-PTT/
│
├── src/
│   ├── cva.py              ← CVA algorithm (read-only, reused by backend)
│   └── oscd_mvp.py         ← Existing working OSCD pipeline
│
├── backend/
│   ├── __init__.py
│   ├── main.py             ← FastAPI app with CORS & static file serving
│   └── routes.py           ← POST /detect, GET /samples, POST /detect/sample/{id}
│
├── cipher-x-dashboard/     ← Next.js 16 App Router frontend
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx        ← Main SPA: Landing → Detection → Results
│   │   └── globals.css     ← Dark cyber theme + Leaflet overrides
│   ├── components/
│   │   ├── HeroBackground.tsx   ← Canvas satellite/grid animation
│   │   ├── LeafletMap.tsx        ← Interactive Leaflet map (SSR disabled)
│   │   ├── UploadCard.tsx        ← Drag & drop upload cards
│   │   ├── MetricCard.tsx        ← Animated count-up metric cards
│   │   ├── ResultPanel.tsx       ← 4-panel image display
│   │   ├── AOITable.tsx          ← Scrollable AOI results table
│   │   └── PipelineDiagram.tsx   ← Architecture pipeline with "Coming Soon"
│   ├── types/
│   │   └── index.ts              ← TypeScript interfaces
│   └── .env.local                ← NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
│
├── data/sentinel2/OSCD/    ← Sentinel-2 OSCD dataset
├── outputs/                ← CVA results saved here (PNG, NPY, JSON)
├── models/
├── ChangeFormer/
└── start.bat               ← One-click launcher
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/samples` | List available OSCD scenes |
| `POST` | `/detect` | Detect changes from uploaded images |
| `POST` | `/detect/sample/{scene_id}` | Run on built-in OSCD scene |
| `GET` | `/outputs/{filename}` | Static output files |

### POST /detect

```bash
curl -X POST http://localhost:8000/detect \
  -F "before_image=@before.tif" \
  -F "after_image=@after.tif"
```

**Response:**
```json
{
  "changed_area_percent": 4.15,
  "changed_pixels": 2721,
  "threshold": 0.6493,
  "aoi_count": 25,
  "dates": ["Before", "After"],
  "result_image": "outputs/latest.png",
  "aois": [...],
  "panel_images": {
    "before": "data:image/png;base64,...",
    "after": "data:image/png;base64,...",
    "cva_heatmap": "data:image/png;base64,...",
    "aoi_overlay": "data:image/png;base64,...",
    "composite": "data:image/png;base64,..."
  }
}
```

---

## Accepted Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| GeoTIFF | `.tif`, `.tiff` | Multi-band or single-band |
| JPEG2000 | `.jp2` | Sentinel-2 native |
| PNG | `.png` | RGB visual |
| JPEG | `.jpg`, `.jpeg` | RGB visual |

---

## CVA Algorithm

1. **Read** B02, B03, B04, B08 bands from before/after rasters
2. **Normalize** using combined 2–98th percentile clipping
3. **Change Vector Analysis** — Euclidean distance between spectral vectors: `CVA = √(Σ(after - before)²)`
4. **Gaussian smoothing** (σ=1)
5. **Automatic threshold** — 95th percentile of CVA distribution
6. **Morphological cleanup** — opening, closing, fill holes, min-size filter
7. **Connected component labeling** — extract AOI bounding boxes
8. **Visualization** — 4-panel composite PNG + individual base64 images

---

## Deploying to Vercel

The Next.js frontend is fully deployable to Vercel:

1. Push `cipher-x-dashboard/` to a GitHub repo
2. Import into Vercel
3. Set environment variable: `NEXT_PUBLIC_BACKEND_URL=https://your-backend.railway.app`
4. Deploy FastAPI backend on Railway, Render, or similar

> The FastAPI backend runs locally in the prototype; for production deploy it separately and update `NEXT_PUBLIC_BACKEND_URL`.

---

## Pipeline Architecture

```
Sentinel-2 Before → Preprocessing → CVA Change Detection → AOI Extraction
                                                                    ↓
                                    SpaceNet-7 [Coming Soon] → Building Classification [Coming Soon]
```
