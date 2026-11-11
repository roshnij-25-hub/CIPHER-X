import io
import json
import os
import shutil
import sys
import base64
from pathlib import Path
from typing import List, Optional

import numpy as np
import rasterio
from PIL import Image
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from scipy import ndimage
from fastapi import APIRouter, File, UploadFile, HTTPException, Query
from fastapi.responses import JSONResponse, FileResponse

# Project paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.cva import calculate_cva, normalize_image

router = APIRouter()

OUT_DIR = PROJECT_ROOT / "outputs"
OUT_DIR.mkdir(parents=True, exist_ok=True)
TEMP_DIR = OUT_DIR / "temp"
TEMP_DIR.mkdir(parents=True, exist_ok=True)
OSCD_DIR = PROJECT_ROOT / "data" / "sentinel2" / "OSCD" / "Onera Satellite Change Detection dataset - Images"


def robust_normalize(x: np.ndarray, lo: float = 2.0, hi: float = 98.0) -> np.ndarray:
    """Normalize array values to [0, 1] using percentile clipping."""
    if x.size == 0:
        return x
    a, b = np.percentile(x, [lo, hi])
    if b > a:
        return np.clip((x - a) / (b - a + 1e-8), 0.0, 1.0)
    return np.zeros_like(x, dtype=np.float32)


def read_uploaded_raster(file_path: Path) -> tuple[np.ndarray, np.ndarray]:
    """
    Read raster data from file (GeoTIFF, JP2, PNG, JPEG).
    Returns:
        spectral_bands: (C, H, W) float32 in [0, 1]
        rgb_image: (H, W, 3) float32 in [0, 1] for visualization
    """
    # Attempt 1: Try rasterio (works for GeoTIFF, JP2, multi-band rasters)
    try:
        with rasterio.open(file_path) as src:
            data = src.read().astype(np.float32)  # shape: (bands, H, W)
            
            if data.ndim == 2:
                data = data[np.newaxis, :, :]
            
            # Normalize bands
            bands_norm = []
            for b in range(data.shape[0]):
                bands_norm.append(robust_normalize(data[b]))
            spectral = np.stack(bands_norm)
            
            # Prepare RGB preview
            if spectral.shape[0] >= 3:
                if spectral.shape[0] == 4:
                    # OSCD ordering: B02 (Blue), B03 (Green), B04 (Red), B08 (NIR)
                    rgb = np.stack([spectral[2], spectral[1], spectral[0]], axis=-1)
                else:
                    rgb = np.stack([spectral[0], spectral[1], spectral[2]], axis=-1)
            elif spectral.shape[0] == 1:
                rgb = np.repeat(spectral[0, :, :, np.newaxis], 3, axis=-1)
            else:
                rgb = np.repeat(spectral[0, :, :, np.newaxis], 3, axis=-1)
            
            return spectral, np.clip(rgb, 0.0, 1.0)
    except Exception:
        pass

    # Attempt 2: Try PIL for regular image files (PNG, JPG, etc.)
    try:
        with Image.open(file_path) as img:
            img = img.convert("RGB")
            arr = np.array(img).astype(np.float32) / 255.0  # (H, W, 3)
            spectral = np.transpose(arr, (2, 0, 1))
            return spectral, arr
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to read image raster '{file_path.name}': {str(e)}"
        )


def array_to_base64_png(arr: np.ndarray, is_cmap: bool = False, cmap_name: str = "inferno") -> str:
    """Convert numpy array (RGB or 2D) to base64 encoded PNG data URI."""
    buf = io.BytesIO()
    if is_cmap:
        cm = plt.get_cmap(cmap_name)
        norm_arr = robust_normalize(arr)
        colored = (cm(norm_arr)[:, :, :3] * 255).astype(np.uint8)
        img = Image.fromarray(colored)
    else:
        if arr.dtype != np.uint8:
            arr = np.clip(arr * 255, 0, 255).astype(np.uint8)
        img = Image.fromarray(arr)
    img.save(buf, format="PNG")
    b64_str = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64_str}"


def run_cva_detection(
    before_spectral: np.ndarray,
    after_spectral: np.ndarray,
    rgb_before: np.ndarray,
    rgb_after: np.ndarray,
    percentile: float = 95.0,
    date_1: str = "Before",
    date_2: str = "After"
) -> dict:
    """
    Executes the CVA algorithm from src/cva.py and morphological post-processing from src/oscd_mvp.py.
    """
    min_h = min(before_spectral.shape[1], after_spectral.shape[1])
    min_w = min(before_spectral.shape[2], after_spectral.shape[2])
    
    before_spectral = before_spectral[:, :min_h, :min_w]
    after_spectral = after_spectral[:, :min_h, :min_w]
    rgb_before = rgb_before[:min_h, :min_w, :]
    rgb_after = rgb_after[:min_h, :min_w, :]
    
    # 1. Run CVA magnitude computation (from src/cva.py)
    cva_mag = calculate_cva(before_spectral, after_spectral)
    
    # 2. Smooth tiny pixel noise (from src/oscd_mvp.py)
    cva_smooth = ndimage.gaussian_filter(cva_mag, sigma=1.0)
    
    # 3. Automatically choose strong-change threshold
    threshold = float(np.percentile(cva_smooth, percentile))
    raw_mask = cva_smooth >= threshold
    
    # 4. Morphological cleanup (from src/oscd_mvp.py)
    mask = ndimage.binary_opening(raw_mask, structure=np.ones((3, 3)))
    mask = ndimage.binary_closing(mask, structure=np.ones((5, 5)))
    mask = ndimage.binary_fill_holes(mask)
    
    # 5. Remove tiny components (< 10 pixels)
    labels, n = ndimage.label(mask)
    sizes = np.bincount(labels.ravel())
    clean_mask = np.zeros_like(mask, dtype=bool)
    for i in range(1, len(sizes)):
        if sizes[i] >= 10:
            clean_mask[labels == i] = True
    mask = clean_mask
    
    # 6. Connected components / AOI extraction
    labels, n = ndimage.label(mask)
    objects = []
    
    for i in range(1, n + 1):
        ys, xs = np.where(labels == i)
        if len(xs) == 0:
            continue
        
        pixels_count = int(len(xs))
        x_min, x_max = int(xs.min()), int(xs.max())
        y_min, y_max = int(ys.min()), int(ys.max())
        center_x = float(xs.mean())
        center_y = float(ys.mean())
        
        objects.append({
            "id": int(i),
            "pixels": pixels_count,
            "area_pixels": pixels_count,
            "relative_area_percent": round(float((pixels_count / (before_spectral.shape[1] * before_spectral.shape[2])) * 100.0), 3),
            "x_min": x_min,
            "y_min": y_min,
            "x_max": x_max,
            "y_max": y_max,
            "center_x": round(center_x, 1),
            "center_y": round(center_y, 1),
            "center": f"({round(center_x, 1)}, {round(center_y, 1)})",
            "center_coords": [round(center_x, 1), round(center_y, 1)],
            "bbox": [x_min, y_min, x_max, y_max],
            "confidence": None
        })
    
    # Sort AOIs by pixel count descending
    objects.sort(key=lambda x: x["pixels"], reverse=True)
    for idx, obj in enumerate(objects):
        obj["rank"] = idx + 1
    
    changed_pixels = int(mask.sum())
    total_pixels = int(mask.size)
    changed_area_percent = round(float((changed_pixels / total_pixels) * 100.0), 2)
    change_status = "Change Detected" if changed_pixels > 0 else "No Significant Change"
    
    # Save arrays into outputs/
    np.save(OUT_DIR / "latest_cva.npy", cva_smooth)
    np.save(OUT_DIR / "latest_change_mask.npy", mask.astype(np.uint8))
    
    # 7. Generate 4-panel composite visualization PNG (matches oscd_train000_MVP.png style)
    fig, ax = plt.subplots(1, 4, figsize=(18, 4.5), facecolor="#070B14")
    
    for a in ax:
        a.tick_params(colors="white")
        for spine in a.spines.values():
            spine.set_color("#22d3ee")
            spine.set_linewidth(0.8)
    
    # Panel 1: Before
    ax[0].imshow(rgb_before)
    ax[0].set_title(f"Sentinel-2 Before\n{date_1}", color="#38bdf8", fontsize=11, fontweight="bold", pad=8)
    ax[0].axis("off")
    
    # Panel 2: After
    ax[1].imshow(rgb_after)
    ax[1].set_title(f"Sentinel-2 After\n{date_2}", color="#38bdf8", fontsize=11, fontweight="bold", pad=8)
    ax[1].axis("off")
    
    # Panel 3: CVA Heatmap
    im = ax[2].imshow(cva_smooth, cmap="inferno")
    ax[2].set_title("CVA Change Magnitude\n(Spectral Distance)", color="#a855f7", fontsize=11, fontweight="bold", pad=8)
    ax[2].axis("off")
    cbar = fig.colorbar(im, ax=ax[2], fraction=0.046, pad=0.04)
    cbar.ax.yaxis.set_tick_params(color="white", labelcolor="white")
    
    # Panel 4: AOI Overlay
    ax[3].imshow(rgb_after)
    ax[3].imshow(mask, cmap="Reds", alpha=0.48)
    for obj in objects[:15]:
        rect = patches.Rectangle(
            (obj["x_min"], obj["y_min"]),
            obj["x_max"] - obj["x_min"],
            obj["y_max"] - obj["y_min"],
            linewidth=1.2,
            edgecolor="#00f2fe",
            facecolor="none",
            linestyle="--"
        )
        ax[3].add_patch(rect)
    
    ax[3].set_title(f"Detected Human AOIs\n{changed_pixels} px ({changed_area_percent}%)", color="#22c55e", fontsize=11, fontweight="bold", pad=8)
    ax[3].axis("off")
    
    plt.tight_layout()
    composite_png_path = OUT_DIR / "latest.png"
    plt.savefig(composite_png_path, dpi=180, bbox_inches="tight", facecolor=fig.get_facecolor(), edgecolor="none")
    plt.close()
    
    # Generate individual panel images and base64 strings
    fig_aoi, ax_aoi = plt.subplots(figsize=(6, 6), facecolor="#070B14")
    ax_aoi.imshow(rgb_after)
    ax_aoi.imshow(mask, cmap="Reds", alpha=0.48)
    for obj in objects[:20]:
        rect = patches.Rectangle(
            (obj["x_min"], obj["y_min"]),
            obj["x_max"] - obj["x_min"],
            obj["y_max"] - obj["y_min"],
            linewidth=1.5,
            edgecolor="#22d3ee",
            facecolor="none",
            linestyle="-"
        )
        ax_aoi.add_patch(rect)
        ax_aoi.text(
            obj["x_min"], max(0, obj["y_min"] - 3),
            f"AOI-{obj['rank']}",
            color="#22d3ee",
            fontsize=7,
            fontweight="bold",
            bbox=dict(boxstyle="square,pad=0.1", fc="#070B14", ec="#22d3ee", lw=0.5, alpha=0.8)
        )
    ax_aoi.axis("off")
    plt.tight_layout(pad=0)
    aoi_overlay_path = OUT_DIR / "latest_aoi_overlay.png"
    plt.savefig(aoi_overlay_path, dpi=180, bbox_inches="tight", facecolor="#070B14", pad_inches=0)
    plt.close()
    
    before_b64 = array_to_base64_png(rgb_before)
    after_b64 = array_to_base64_png(rgb_after)
    heatmap_b64 = array_to_base64_png(cva_smooth, is_cmap=True, cmap_name="inferno")
    
    with open(aoi_overlay_path, "rb") as f:
        aoi_overlay_b64 = f"data:image/png;base64,{base64.b64encode(f.read()).decode('utf-8')}"
    
    with open(composite_png_path, "rb") as f:
        composite_b64 = f"data:image/png;base64,{base64.b64encode(f.read()).decode('utf-8')}"

    result_payload = {
        "status": "success",
        "change_status": change_status,
        "changed_area_percent": changed_area_percent,
        "changed_pixels": changed_pixels,
        "total_pixels": total_pixels,
        "threshold": round(float(threshold), 4),
        "threshold_percentile": percentile,
        "aoi_count": len(objects),
        "confidence_status": "Not estimated (Direct CVA magnitude)",
        "georeferencing_status": "Scene coordinates unavailable in current OSCD raster metadata",
        "dates": [date_1, date_2],
        "result_image": "outputs/latest.png",
        "result_image_url": "/outputs/latest.png",
        "aois": objects,
        "image_size": [min_h, min_w],
        "panel_images": {
            "before": before_b64,
            "after": after_b64,
            "cva_heatmap": heatmap_b64,
            "aoi_overlay": aoi_overlay_b64,
            "composite": composite_b64
        }
    }
    
    # Save JSON summary into outputs
    with open(OUT_DIR / "latest_result.json", "w") as f:
        json.dump(result_payload, f, indent=2)
        
    return result_payload


@router.post("/detect")
async def detect_changes_endpoint(
    before_image: UploadFile = File(...),
    after_image: UploadFile = File(...),
    percentile: float = 95.0
):
    """
    POST /detect
    Input: multipart/form-data with before_image and after_image.
    Executes CVA change detection algorithm, extracts AOIs, and returns comprehensive metrics.
    """
    try:
        # Save uploads temporarily
        before_temp = TEMP_DIR / f"upload_before_{before_image.filename}"
        after_temp = TEMP_DIR / f"upload_after_{after_image.filename}"
        
        with open(before_temp, "wb") as f:
            shutil.copyfileobj(before_image.file, f)
            
        with open(after_temp, "wb") as f:
            shutil.copyfileobj(after_image.file, f)
            
        # Read raster bands
        before_spectral, rgb_before = read_uploaded_raster(before_temp)
        after_spectral, rgb_after = read_uploaded_raster(after_temp)
        
        # Clean temporary uploads
        try:
            os.remove(before_temp)
            os.remove(after_temp)
        except Exception:
            pass
        
        # Run CVA
        result = run_cva_detection(
            before_spectral=before_spectral,
            after_spectral=after_spectral,
            rgb_before=rgb_before,
            rgb_after=rgb_after,
            percentile=percentile,
            date_1=before_image.filename or "Before",
            date_2=after_image.filename or "After"
        )
        
        return JSONResponse(content=result)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CVA Detection Pipeline Error: {str(e)}")


@router.get("/samples")
async def get_sample_scenes():
    """
    List available sample OSCD Sentinel-2 scenes for quick demonstration.
    """
    if not OSCD_DIR.exists():
        return {"samples": []}
    
    scenes = []
    for p in sorted(OSCD_DIR.iterdir()):
        if p.is_dir() and (p / "imgs_1_rect").exists() and (p / "imgs_2_rect").exists():
            date_1, date_2 = "20150801", "20170801"
            dates_file = p / "dates.txt"
            if dates_file.exists():
                try:
                    for line in dates_file.read_text().strip().splitlines():
                        if line.startswith("date_1:"):
                            date_1 = line.split(":", 1)[1].strip()
                        elif line.startswith("date_2:"):
                            date_2 = line.split(":", 1)[1].strip()
                except Exception:
                    pass
            scenes.append({
                "id": p.name,
                "name": f"{p.name} ({date_1} -> {date_2})",
                "date_1": date_1,
                "date_2": date_2,
                "before_dir": f"{p.name}/imgs_1_rect",
                "after_dir": f"{p.name}/imgs_2_rect"
            })
    return {"samples": scenes}


@router.post("/detect/sample/{scene_id}")
async def detect_sample_scene(scene_id: str, percentile: float = 95.0):
    """
    Run CVA detection on a built-in OSCD dataset scene.
    """
    scene_path = OSCD_DIR / scene_id
    if not scene_path.exists():
        raise HTTPException(status_code=404, detail=f"Scene '{scene_id}' not found in dataset.")
    
    bands = ["B02", "B03", "B04", "B08"]
    before_bands = []
    after_bands = []
    
    for b in bands:
        b1_file = scene_path / "imgs_1_rect" / f"{b}.tif"
        b2_file = scene_path / "imgs_2_rect" / f"{b}.tif"
        
        if not b1_file.exists() or not b2_file.exists():
            raise HTTPException(status_code=400, detail=f"Missing band {b} for scene {scene_id}")
            
        with rasterio.open(b1_file) as src1, rasterio.open(b2_file) as src2:
            d1 = src1.read(1).astype(np.float32)
            d2 = src2.read(1).astype(np.float32)
            
            combined = np.concatenate([d1.ravel(), d2.ravel()])
            lo, hi = np.percentile(combined, [2, 98])
            
            before_bands.append(np.clip((d1 - lo) / (hi - lo + 1e-8), 0, 1))
            after_bands.append(np.clip((d2 - lo) / (hi - lo + 1e-8), 0, 1))
            
    before_spectral = np.stack(before_bands)
    after_spectral = np.stack(after_bands)
    
    rgb_before = np.stack([
        robust_normalize(before_spectral[2]),
        robust_normalize(before_spectral[1]),
        robust_normalize(before_spectral[0])
    ], axis=-1)
    
    rgb_after = np.stack([
        robust_normalize(after_spectral[2]),
        robust_normalize(after_spectral[1]),
        robust_normalize(after_spectral[0])
    ], axis=-1)
    
    # Read dates.txt if available
    date_1, date_2 = "20150801", "20170801"
    dates_file = scene_path / "dates.txt"
    if dates_file.exists():
        try:
            for line in dates_file.read_text().strip().splitlines():
                if line.startswith("date_1:"):
                    date_1 = line.split(":", 1)[1].strip()
                elif line.startswith("date_2:"):
                    date_2 = line.split(":", 1)[1].strip()
        except Exception:
            pass

    result = run_cva_detection(
        before_spectral=before_spectral,
        after_spectral=after_spectral,
        rgb_before=rgb_before,
        rgb_after=rgb_after,
        percentile=percentile,
        date_1=f"{scene_id} ({date_1})",
        date_2=f"{scene_id} ({date_2})"
    )
    return JSONResponse(content=result)


@router.get("/sample/{scene_id}/preview")
async def preview_sample_scene(scene_id: str):
    """
    Get quick RGB previews and band information for a sample scene before running CVA.
    """
    scene_path = OSCD_DIR / scene_id
    if not scene_path.exists():
        raise HTTPException(status_code=404, detail=f"Scene '{scene_id}' not found.")

    bands = ["B02", "B03", "B04", "B08"]
    before_bands = []
    after_bands = []

    for b in bands:
        b1_file = scene_path / "imgs_1_rect" / f"{b}.tif"
        b2_file = scene_path / "imgs_2_rect" / f"{b}.tif"
        if not b1_file.exists() or not b2_file.exists():
            raise HTTPException(status_code=400, detail=f"Missing band {b} for scene {scene_id}")

        with rasterio.open(b1_file) as src1, rasterio.open(b2_file) as src2:
            d1 = src1.read(1).astype(np.float32)
            d2 = src2.read(1).astype(np.float32)
            combined = np.concatenate([d1.ravel(), d2.ravel()])
            lo, hi = np.percentile(combined, [2, 98])
            before_bands.append(np.clip((d1 - lo) / (hi - lo + 1e-8), 0, 1))
            after_bands.append(np.clip((d2 - lo) / (hi - lo + 1e-8), 0, 1))

    before_spectral = np.stack(before_bands)
    after_spectral = np.stack(after_bands)

    rgb_before = np.stack([
        robust_normalize(before_spectral[2]),
        robust_normalize(before_spectral[1]),
        robust_normalize(before_spectral[0])
    ], axis=-1)

    rgb_after = np.stack([
        robust_normalize(after_spectral[2]),
        robust_normalize(after_spectral[1]),
        robust_normalize(after_spectral[0])
    ], axis=-1)

    date_1, date_2 = "20150801", "20170801"
    dates_file = scene_path / "dates.txt"
    if dates_file.exists():
        try:
            for line in dates_file.read_text().strip().splitlines():
                if line.startswith("date_1:"):
                    date_1 = line.split(":", 1)[1].strip()
                elif line.startswith("date_2:"):
                    date_2 = line.split(":", 1)[1].strip()
        except Exception:
            pass

    return {
        "scene_id": scene_id,
        "date_1": date_1,
        "date_2": date_2,
        "bands": bands,
        "dimensions": [int(before_spectral.shape[1]), int(before_spectral.shape[2])],
        "before_preview": array_to_base64_png(rgb_before),
        "after_preview": array_to_base64_png(rgb_after),
        "before_files": [f"imgs_1_rect/{b}.tif" for b in bands],
        "after_files": [f"imgs_2_rect/{b}.tif" for b in bands]
    }


@router.get("/highres/status")
async def get_highres_status():
    """
    Status of the Fine-Resolution Investigation Stage.
    SpaceNet dataset is currently not populated in data/spacenet, so this endpoint
    honestly returns the pipeline readiness status.
    """
    return {
        "status": "Awaiting high-resolution imagery",
        "message": "Fine-resolution analysis — dataset/model unavailable in current demo",
        "extended_stage": "SpaceNet / high-resolution building analysis",
        "extended_status": "Available in extended pipeline",
        "description": "Candidate change regions identified by Sentinel-2 coarse CVA can be investigated using higher-resolution multi-temporal optical imagery (SpaceNet-7 / LISS-4 / Cartosat-3) and deep learning building segmentation models in production.",
        "supported_sensors": [
            {"sensor": "SpaceNet-7", "resolution": "0.5m GSD", "purpose": "Multi-temporal building footprint tracking"},
            {"sensor": "LISS-4", "resolution": "5.8m Multi-spectral", "purpose": "Regional infrastructure verification"},
            {"sensor": "Cartosat-3", "resolution": "0.28m Panchromatic", "purpose": "Sub-meter structural verification"}
        ]
    }


LEVIR_DIR = PROJECT_ROOT / "ChangeFormer" / "samples_LEVIR"


@router.get("/highres/samples")
async def get_highres_samples():
    """
    List available high-resolution building-change samples (LEVIR-CD proxy dataset).
    """
    if not LEVIR_DIR.exists():
        return {"samples": []}
    
    samples = []
    a_dir = LEVIR_DIR / "A"
    pred_dir = LEVIR_DIR / "predict_CD_ChangeFormerV6"
    lbl_dir = LEVIR_DIR / "label"
    
    if a_dir.exists():
        for p in sorted(a_dir.glob("*.png")):
            stem = p.stem
            filename = p.name
            
            if (pred_dir / filename).exists():
                source_tag = "ChangeFormer V6 Model"
                source_type = "model_prediction"
            elif (lbl_dir / filename).exists():
                lbl_arr = np.array(Image.open(lbl_dir / filename).convert("L")) > 128
                if lbl_arr.sum() > 0:
                    source_tag = "Reference Ground-Truth"
                    source_type = "reference_label"
                else:
                    source_tag = "Stable / No Change"
                    source_type = "stable_scene"
            else:
                source_tag = "Stable Scene"
                source_type = "stable_scene"
                
            samples.append({
                "id": stem,
                "name": f"{stem} [{source_tag}]",
                "filename": filename,
                "source_tag": source_tag,
                "source_type": source_type,
                "dataset": "LEVIR-CD (0.5m GSD)"
            })
    return {"samples": samples}


@router.post("/highres/investigate/{sample_id}")
async def investigate_highres_scene(sample_id: str):
    """
    Run high-resolution building footprint change detection analysis.
    Uses actual LEVIR-CD optical image pairs and ChangeFormer V6 predictions / Reference labels.
    All displayed metrics are computed directly from the raster arrays.
    """
    filename = f"{sample_id}.png" if not sample_id.endswith(".png") else sample_id
    sample_stem = sample_id.replace(".png", "")
    
    a_path = LEVIR_DIR / "A" / filename
    b_path = LEVIR_DIR / "B" / filename
    lbl_path = LEVIR_DIR / "label" / filename
    pred_path = LEVIR_DIR / "predict_CD_ChangeFormerV6" / filename
    
    if not a_path.exists() or not b_path.exists():
        filename = "test_2_0000_0000.png"
        sample_stem = "test_2_0000_0000"
        a_path = LEVIR_DIR / "A" / filename
        b_path = LEVIR_DIR / "B" / filename
        lbl_path = LEVIR_DIR / "label" / filename
        pred_path = LEVIR_DIR / "predict_CD_ChangeFormerV6" / filename
    
    a_img = Image.open(a_path).convert("RGB")
    b_img = Image.open(b_path).convert("RGB")
    
    arr_a = np.array(a_img)
    arr_b = np.array(b_img)
    
    if pred_path.exists():
        mask_arr = np.array(Image.open(pred_path).convert("L")) > 128
        mask_source = "Model Prediction (ChangeFormer V6)"
        model_name = "ChangeFormer V6 (Pretrained Transformer)"
        is_model_prediction = True
    elif lbl_path.exists():
        mask_arr = np.array(Image.open(lbl_path).convert("L")) > 128
        mask_source = "Reference Building Footprints (Ground Truth)"
        model_name = "LEVIR-CD Ground-Truth Reference Annotation"
        is_model_prediction = False
    else:
        mask_arr = np.zeros((arr_a.shape[0], arr_a.shape[1]), dtype=bool)
        mask_source = "Reference Annotation (Zero Change Detected)"
        model_name = "None"
        is_model_prediction = False

    # Extract connected components (structures) with minimum 8 px filter (2 m²)
    labeled_mask, num_buildings = ndimage.label(mask_arr)
    changed_pixels = int(mask_arr.sum())
    total_pixels = int(mask_arr.size)
    changed_area_percent = round(float((changed_pixels / total_pixels) * 100.0), 3)
    estimated_sq_meters = round(float(changed_pixels * 0.25), 1)
    
    building_aois = []
    for i in range(1, num_buildings + 1):
        ys, xs = np.where(labeled_mask == i)
        if len(xs) < 8:
            continue
        building_aois.append({
            "id": int(i),
            "pixels": int(len(xs)),
            "area_sq_m": round(float(len(xs) * 0.25), 1),
            "bbox": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())],
            "center": f"({round(float(xs.mean()), 1)}, {round(float(ys.mean()), 1)})"
        })
    building_aois.sort(key=lambda x: x["pixels"], reverse=True)
    
    # Truthful classification based on actual detected changed structures
    if changed_pixels >= 20 and len(building_aois) > 0:
        classification = "NEW BUILDING DETECTED"
        change_type = "Human-Induced Building Construction"
    else:
        classification = "NO SIGNIFICANT BUILDING CHANGE"
        change_type = "Stable Urban / Natural Surface (No Construction Detected)"

    # Generate 4-panel composite visualization PNG
    fig, ax = plt.subplots(1, 4, figsize=(18, 4.5), facecolor="#070B14")
    for a in ax:
        a.tick_params(colors="white")
        for spine in a.spines.values():
            spine.set_color("#22d3ee")
            spine.set_linewidth(0.8)

    ax[0].imshow(arr_a)
    ax[0].set_title(f"High-Res Optical Before\nLEVIR-CD · {sample_stem}", color="#38bdf8", fontsize=10, fontweight="bold", pad=8)
    ax[0].axis("off")

    ax[1].imshow(arr_b)
    ax[1].set_title(f"High-Res Optical After\nLEVIR-CD · {sample_stem}", color="#38bdf8", fontsize=10, fontweight="bold", pad=8)
    ax[1].axis("off")

    mask_rgb = np.zeros_like(arr_b)
    mask_rgb[mask_arr] = [34, 211, 238]
    ax[2].imshow(mask_rgb)
    ax[2].set_title(f"Building Footprint Change Mask\n[{mask_source}]", color="#a855f7", fontsize=9, fontweight="bold", pad=8)
    ax[2].axis("off")

    ax[3].imshow(arr_b)
    if changed_pixels > 0:
        ax[3].imshow(mask_arr, cmap="Reds", alpha=0.55)
        for b in building_aois[:15]:
            bx, by, bx2, by2 = b["bbox"]
            rect = patches.Rectangle(
                (bx, by), bx2 - bx, by2 - by,
                linewidth=1.4, edgecolor="#00f2fe", facecolor="none", linestyle="--"
            )
            ax[3].add_patch(rect)

    status_color = "#22c55e" if classification == "NEW BUILDING DETECTED" else "#94a3b8"
    ax[3].set_title(f"{classification}\n{len(building_aois)} Structures · {estimated_sq_meters} m²", color=status_color, fontsize=10, fontweight="bold", pad=8)
    ax[3].axis("off")

    plt.tight_layout()
    highres_png_path = OUT_DIR / f"highres_{sample_stem}.png"
    plt.savefig(highres_png_path, dpi=180, bbox_inches="tight", facecolor=fig.get_facecolor(), edgecolor="none")
    plt.close()

    before_b64 = array_to_base64_png(arr_a / 255.0)
    after_b64 = array_to_base64_png(arr_b / 255.0)
    mask_b64 = array_to_base64_png(mask_rgb / 255.0)
    
    with open(highres_png_path, "rb") as f:
        overlay_b64 = f"data:image/png;base64,{base64.b64encode(f.read()).decode('utf-8')}"

    provenance = {
        "dataset": "LEVIR-CD Building Change Detection Benchmark",
        "dataset_description": "Google Earth High-Resolution Optical Satellite Imagery",
        "scene_id": sample_stem,
        "before_file": f"samples_LEVIR/A/{filename}",
        "after_file": f"samples_LEVIR/B/{filename}",
        "mask_source": mask_source,
        "model_name": model_name,
        "is_model_prediction": is_model_prediction,
        "gsd": "0.5 meters / pixel",
        "pixel_area": "0.25 m² / pixel",
        "image_dimensions": f"{arr_a.shape[1]} × {arr_a.shape[0]} px",
        "analysis_method": "Bitemporal Footprint Difference & 2D Connected Component Region Extraction"
    }

    return JSONResponse(content={
        "sample_id": sample_stem,
        "classification": classification,
        "change_type": change_type,
        "changed_buildings_count": len(building_aois),
        "changed_pixels": changed_pixels,
        "changed_area_percent": changed_area_percent,
        "estimated_sq_meters": estimated_sq_meters,
        "model_source": mask_source,
        "confidence": None,
        "confidence_text": "Not available from model",
        "analysis_status": "Analysis Complete",
        "building_aois": building_aois,
        "provenance": provenance,
        "proxy_note": "LEVIR-CD high-resolution dataset (0.5m GSD) is used as a proxy for the fine-resolution stage in this prototype. Production deployment can replace this stage with LISS-4 imagery and corresponding models.",
        "panel_images": {
            "before": before_b64,
            "after": after_b64,
            "footprint_mask": mask_b64,
            "difference_overlay": overlay_b64
        }
    })

