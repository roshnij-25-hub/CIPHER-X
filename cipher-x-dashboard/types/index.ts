export interface AOI {
  id: number;
  rank?: number;
  pixels: number;
  area_pixels?: number;
  relative_area_percent?: number;
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
  center_x: number;
  center_y: number;
  center?: string;
  center_coords?: [number, number];
  bbox: [number, number, number, number];
  confidence?: number | null;
}

export interface DetectionResult {
  status?: string;
  change_status?: "Change Detected" | "No Significant Change" | string;
  changed_area_percent: number;
  changed_pixels: number;
  total_pixels?: number;
  threshold: number;
  threshold_percentile?: number;
  aoi_count: number;
  confidence_status?: string;
  georeferencing_status?: string;
  dates: [string, string] | string[];
  scene_name?: string;
  result_image: string;
  result_image_url?: string;
  aois: AOI[];
  image_size?: [number, number];
  panel_images?: {
    before?: string;
    after?: string;
    cva_heatmap?: string;
    aoi_overlay?: string;
    composite?: string;
  };
}

export interface SampleScene {
  id: string;
  name: string;
  date_1: string;
  date_2: string;
  before_dir: string;
  after_dir: string;
}

export interface SamplePreview {
  scene_id: string;
  date_1: string;
  date_2: string;
  bands: string[];
  dimensions: [number, number];
  before_preview: string;
  after_preview: string;
  before_files: string[];
  after_files: string[];
}

export interface HighResStatus {
  status: string;
  message: string;
  extended_stage: string;
  extended_status: string;
  description: string;
  supported_sensors: Array<{
    sensor: string;
    resolution: string;
    purpose: string;
  }>;
}


