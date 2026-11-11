import json
from pathlib import Path

import numpy as np
import rasterio
import matplotlib.pyplot as plt
from scipy import ndimage

ROOT = Path(r"data\sentinel2\OSCD\Onera Satellite Change Detection dataset - Images")
SCENE = ROOT / "train_000"
OUT = Path("outputs")
OUT.mkdir(exist_ok=True)

BANDS = ["B02", "B03", "B04", "B08"]

def read_band(folder, band):
    with rasterio.open(SCENE / folder / f"{band}.tif") as src:
        return src.read(1).astype(np.float32)

def robust_normalize(x, lo=2, hi=98):
    a, b = np.percentile(x, [lo, hi])
    return np.clip((x - a) / (b - a + 1e-8), 0, 1)

before = []
after = []

for band in BANDS:
    b1 = read_band("imgs_1_rect", band)
    b2 = read_band("imgs_2_rect", band)

    # Normalize both dates using their combined distribution
    combined = np.concatenate([b1.ravel(), b2.ravel()])
    lo, hi = np.percentile(combined, [2, 98])

    before.append(np.clip((b1 - lo) / (hi - lo + 1e-8), 0, 1))
    after.append(np.clip((b2 - lo) / (hi - lo + 1e-8), 0, 1))

before = np.stack(before)
after = np.stack(after)

# Change Vector Analysis
diff = after - before
cva = np.sqrt(np.sum(diff ** 2, axis=0))

# Smooth tiny pixel noise
cva_smooth = ndimage.gaussian_filter(cva, sigma=1)

# Automatically choose strong-change threshold
threshold = np.percentile(cva_smooth, 95)
mask = cva_smooth >= threshold

# Morphological cleanup
mask = ndimage.binary_opening(mask, structure=np.ones((3,3)))
mask = ndimage.binary_closing(mask, structure=np.ones((5,5)))
mask = ndimage.binary_fill_holes(mask)

# Remove very tiny components
labels, n = ndimage.label(mask)
sizes = np.bincount(labels.ravel())

clean = np.zeros_like(mask, dtype=bool)
for i in range(1, len(sizes)):
    if sizes[i] >= 10:
        clean[labels == i] = True

mask = clean

# Connected components / AOIs
labels, n = ndimage.label(mask)
objects = []

for i in range(1, n + 1):
    ys, xs = np.where(labels == i)
    if len(xs) == 0:
        continue

    objects.append({
        "id": int(i),
        "pixels": int(len(xs)),
        "x_min": int(xs.min()),
        "y_min": int(ys.min()),
        "x_max": int(xs.max()),
        "y_max": int(ys.max()),
        "center_x": float(xs.mean()),
        "center_y": float(ys.mean())
    })

objects.sort(key=lambda x: x["pixels"], reverse=True)

# Save arrays
np.save(OUT / "oscd_train000_cva.npy", cva_smooth)
np.save(OUT / "oscd_train000_change_mask.npy", mask.astype(np.uint8))

# Save AOI information
result = {
    "scene": "train_000",
    "date_1": "20150801",
    "date_2": "20170801",
    "bands": BANDS,
    "image_size": [256, 256],
    "threshold_percentile": 95,
    "threshold": float(threshold),
    "changed_pixels": int(mask.sum()),
    "changed_percent": float(mask.mean() * 100),
    "num_AOIs": len(objects),
    "AOIs": objects[:20],
    "georeferencing": "Unavailable: OSCD TIFFs have no CRS/geotransform"
}

with open(OUT / "oscd_train000_result.json", "w") as f:
    json.dump(result, f, indent=2)

# RGB visualization
rgb_before = np.stack([
    robust_normalize(before[2]),
    robust_normalize(before[1]),
    robust_normalize(before[0])
], axis=-1)

rgb_after = np.stack([
    robust_normalize(after[2]),
    robust_normalize(after[1]),
    robust_normalize(after[0])
], axis=-1)

fig, ax = plt.subplots(1, 4, figsize=(16, 4))

ax[0].imshow(rgb_before)
ax[0].set_title("Sentinel-2 Before\n2015-08-01")
ax[0].axis("off")

ax[1].imshow(rgb_after)
ax[1].set_title("Sentinel-2 After\n2017-08-01")
ax[1].axis("off")

im = ax[2].imshow(cva_smooth, cmap="inferno")
ax[2].set_title("CVA Change Magnitude")
ax[2].axis("off")
fig.colorbar(im, ax=ax[2], fraction=0.046)

ax[3].imshow(rgb_after)
ax[3].imshow(mask, cmap="Reds", alpha=0.45)
ax[3].set_title(f"Detected Change AOI\n{mask.sum()} pixels")
ax[3].axis("off")

plt.tight_layout()
plt.savefig(OUT / "oscd_train000_MVP.png", dpi=180, bbox_inches="tight")
plt.close()

print()
print("========================================")
print(" OSCD COARSE CHANGE MVP COMPLETE")
print("========================================")
print("Scene:          train_000")
print("Dates:          20150801 -> 20170801")
print("Bands:          B02 B03 B04 B08")
print(f"CVA threshold:  {threshold:.4f}")
print(f"Changed pixels: {mask.sum()}")
print(f"Changed area:   {mask.mean()*100:.2f}%")
print(f"AOIs detected:  {len(objects)}")
print()
print("OUTPUT:")
print(OUT / "oscd_train000_MVP.png")
print(OUT / "oscd_train000_result.json")
print(OUT / "oscd_train000_change_mask.npy")
print(OUT / "oscd_train000_cva.npy")
print()
print("Top AOIs:")
for x in objects[:5]:
    print(x)
