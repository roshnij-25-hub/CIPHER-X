import numpy as np
import rasterio
from skimage.morphology import remove_small_objects, binary_opening, disk
from skimage.measure import label, regionprops


def read_bands(path, band_numbers):
    """
    Read selected bands from a multiband GeoTIFF.
    Returns:
        array: shape (bands, height, width)
        profile: raster metadata
    """
    with rasterio.open(path) as src:
        data = src.read(band_numbers).astype(np.float32)
        profile = src.profile.copy()

    return data, profile


def normalize_image(image):
    """
    Simple percentile normalization.
    """
    output = np.zeros_like(image, dtype=np.float32)

    for i in range(image.shape[0]):
        band = image[i]

        low = np.percentile(band, 2)
        high = np.percentile(band, 98)

        if high > low:
            output[i] = np.clip(
                (band - low) / (high - low),
                0,
                1
            )

    return output


def calculate_cva(before, after):
    """
    Change Vector Analysis.

    CVA magnitude = Euclidean distance between
    spectral vectors before and after.
    """

    difference = after - before

    magnitude = np.sqrt(
        np.sum(difference ** 2, axis=0)
    )

    return magnitude


def detect_changes(cva, percentile=90):
    """
    Automatically determine a threshold
    from the CVA distribution.
    """

    threshold = np.percentile(cva, percentile)

    mask = cva > threshold

    # Remove tiny noisy regions
    mask = remove_small_objects(
        mask,
        min_size=20
    )

    # Smooth the binary regions
    mask = binary_opening(
        mask,
        footprint=disk(1)
    )

    return mask, threshold


def extract_regions(mask, transform):
    """
    Convert connected change regions into
    simple geographic bounding boxes.
    """

    labeled = label(mask)

    regions = []

    for region in regionprops(labeled):

        if region.area < 20:
            continue

        min_row, min_col, max_row, max_col = region.bbox

        x1, y1 = rasterio.transform.xy(
            transform,
            min_row,
            min_col
        )

        x2, y2 = rasterio.transform.xy(
            transform,
            max_row,
            max_col
        )

        regions.append({
            "area_pixels": int(region.area),
            "bbox": [x1, y1, x2, y2]
        })

    return regions


if __name__ == "__main__":

    print("CIPHER-X CVA module loaded successfully.")
    