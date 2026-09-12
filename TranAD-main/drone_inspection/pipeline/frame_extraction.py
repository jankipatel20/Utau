"""
Video frame extraction and filtering for drone inspection pipeline.
Supports direct video file upload or YouTube URL download via yt-dlp.
"""

import os
import json
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

import cv2
import numpy as np


_DEFAULT_FPS = 1.0
_LAPLACIAN_BLUR_THRESHOLD = 50.0


def download_youtube_video(url: str, output_dir: str) -> str:
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "%(title).50s.%(ext)s")
    cmd = [
        "yt-dlp",
        "--no-playlist",
        "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--merge-output-format", "mp4",
        "-o", output_path,
        "--print", "after_move:filepath",
        url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        raise RuntimeError(f"yt-dlp failed: {result.stderr.strip()}")
    filepath = result.stdout.strip().split("\n")[-1]
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"yt-dlp output file not found: {filepath}")
    return filepath


def _is_blurry(frame: np.ndarray, threshold: float = _LAPLACIAN_BLUR_THRESHOLD) -> bool:
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    return cv2.Laplacian(gray, cv2.CV_64F).var() < threshold


def extract_frames(
    video_path: str,
    output_dir: str,
    fps: float = _DEFAULT_FPS,
    blur_threshold: float = _LAPLACIAN_BLUR_THRESHOLD,
    max_frames: int = 300,
) -> list[dict]:
    os.makedirs(output_dir, exist_ok=True)
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")

    video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames_video = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    sample_interval = max(1, int(video_fps / fps))

    extracted = []
    frame_idx = 0
    kept = 0
    discarded_blur = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % sample_interval == 0:
            if _is_blurry(frame, blur_threshold):
                discarded_blur += 1
            else:
                timestamp_sec = frame_idx / video_fps
                fname = f"frame_{kept:05d}.jpg"
                fpath = os.path.join(output_dir, fname)
                cv2.imwrite(fpath, frame)
                extracted.append({
                    "frame_index": kept,
                    "video_frame_index": frame_idx,
                    "timestamp_sec": round(timestamp_sec, 2),
                    "file": fname,
                    "path": fpath,
                })
                kept += 1
                if kept >= max_frames:
                    break
        frame_idx += 1

    cap.release()
    return extracted


def run_detection_on_frames(
    frames: list[dict],
    asset_type: str,
    confidence_threshold: float = 0.25,
    on_progress: Optional[callable] = None,
) -> list[dict]:
    if asset_type == "solar":
        from drone_inspection.inference.solar_detector import run_solar_inference
        detect_fn = run_solar_inference
    elif asset_type == "wind":
        from drone_inspection.inference.wind_detector import run_wind_inference
        detect_fn = run_wind_inference
    else:
        raise ValueError(f"Unknown asset type for detection: {asset_type}")

    results = []
    total = len(frames)
    for i, frame_info in enumerate(frames):
        detections = detect_fn(frame_info["path"], confidence_threshold=confidence_threshold)
        results.append({
            **frame_info,
            "detections": [d.to_dict() for d in detections],
            "detection_count": len(detections),
        })
        if on_progress and (i + 1) % 5 == 0:
            on_progress(i + 1, total)
    return results


def annotate_frame(frame_path: str, detections: list[dict], output_path: str) -> str:
    frame = cv2.imread(frame_path)
    if frame is None:
        return frame_path

    for det in detections:
        bbox = det.get("bbox", {})
        x1, y1 = int(bbox.get("x1", 0)), int(bbox.get("y1", 0))
        x2, y2 = int(bbox.get("x2", 0)), int(bbox.get("y2", 0))
        label = f"{det['class_name']} {det['confidence']:.0%}"
        color = (0, 0, 220) if det["confidence"] > 0.5 else (0, 165, 255)
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(frame, (x1, y1 - th - 6), (x1 + tw + 4, y1), color, -1)
        cv2.putText(frame, label, (x1 + 2, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

    cv2.imwrite(output_path, frame)
    return output_path
