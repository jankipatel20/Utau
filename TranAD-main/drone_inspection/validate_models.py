"""
Sub-Phase 10.4 — Qualitative validation script for drone inspection models.

Usage:
    python -m drone_inspection.validate_models --asset-type solar --source <path_or_youtube_url>
    python -m drone_inspection.validate_models --asset-type wind  --source <path_or_youtube_url>
    python -m drone_inspection.validate_models --asset-type solar --image <single_image_path>

Extracts frames (or uses a single image), runs the appropriate detector,
and writes an HTML report with annotated thumbnails + detection stats
to drone_inspection/validation_reports/.
"""

import argparse
import json
import os
import sys
import time
from collections import Counter
from pathlib import Path

import cv2
import numpy as np

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_REPORT_DIR = os.path.join(_SCRIPT_DIR, "validation_reports")


def _run_on_image(image_path: str, asset_type: str, threshold: float):
    if asset_type == "solar":
        from drone_inspection.inference.solar_detector import run_solar_inference
        return run_solar_inference(image_path, confidence_threshold=threshold)
    else:
        from drone_inspection.inference.wind_detector import run_wind_inference
        return run_wind_inference(image_path, confidence_threshold=threshold)


def _annotate_and_save(image_path: str, detections: list, output_path: str):
    frame = cv2.imread(image_path)
    if frame is None:
        return
    for det in detections:
        bbox = det.bbox
        x1, y1 = int(bbox.x1), int(bbox.y1)
        x2, y2 = int(bbox.x2), int(bbox.y2)
        label = f"{det.class_name} {det.confidence:.0%}"
        color = (0, 0, 220) if det.confidence > 0.5 else (0, 165, 255)
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(frame, (x1, y1 - th - 6), (x1 + tw + 4, y1), color, -1)
        cv2.putText(frame, label, (x1 + 2, y1 - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    cv2.imwrite(output_path, frame)


def _build_html_report(
    asset_type: str,
    threshold: float,
    frame_results: list[dict],
    report_dir: str,
) -> str:
    total_frames = len(frame_results)
    frames_with_dets = sum(1 for r in frame_results if r["count"] > 0)
    total_dets = sum(r["count"] for r in frame_results)
    class_counts: Counter = Counter()
    conf_values: list[float] = []
    for r in frame_results:
        for d in r["detections"]:
            class_counts[d["class_name"]] += 1
            conf_values.append(d["confidence"])

    avg_conf = sum(conf_values) / len(conf_values) if conf_values else 0.0
    min_conf = min(conf_values) if conf_values else 0.0
    max_conf = max(conf_values) if conf_values else 0.0

    rows = ""
    for r in frame_results:
        if r["count"] == 0:
            continue
        ann_rel = os.path.relpath(r["annotated_path"], report_dir) if r.get("annotated_path") else ""
        det_str = ", ".join(f'{d["class_name"]} ({d["confidence"]:.0%})' for d in r["detections"])
        img_tag = f'<img src="{ann_rel}" style="max-width:400px;border:1px solid #ccc;">' if ann_rel else ""
        rows += f"""<tr>
            <td>{r.get('frame_index', '?')}</td>
            <td>{r['count']}</td>
            <td>{det_str}</td>
            <td>{img_tag}</td>
        </tr>\n"""

    class_table = ""
    for cls, cnt in class_counts.most_common():
        class_table += f"<tr><td>{cls}</td><td>{cnt}</td></tr>\n"

    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Validation Report — {asset_type}</title>
<style>
body {{ font-family: 'Segoe UI', sans-serif; margin: 20px; background: #faf8f0; }}
h1 {{ color: #333; }}
table {{ border-collapse: collapse; margin: 12px 0; }}
th, td {{ border: 1px solid #ccc; padding: 6px 12px; text-align: left; }}
th {{ background: #e8e0c8; }}
.summary {{ background: #fff; padding: 16px; border: 1px solid #ddd; margin: 12px 0; }}
.warn {{ color: #a83240; }}
</style></head><body>
<h1>Drone Inspection — Model Validation Report</h1>
<div class="summary">
    <b>Asset type:</b> {asset_type}<br>
    <b>Confidence threshold:</b> {threshold}<br>
    <b>Frames analyzed:</b> {total_frames}<br>
    <b>Frames with detections:</b> {frames_with_dets} ({frames_with_dets/max(total_frames,1)*100:.0f}%)<br>
    <b>Total detections:</b> {total_dets}<br>
    <b>Confidence range:</b> {min_conf:.2f} – {max_conf:.2f} (avg {avg_conf:.2f})<br>
</div>
<h2>Detections by Class</h2>
<table><tr><th>Class</th><th>Count</th></tr>
{class_table}</table>
<p class="warn">⚠ Detection is based on visible-light (RGB) imagery — not thermal analysis.
Results should be reviewed manually before use in maintenance decisions.</p>
<h2>Frames with Detections</h2>
<table><tr><th>Frame</th><th>#Dets</th><th>Classes</th><th>Annotated</th></tr>
{rows}</table>
<h2>Limitations</h2>
<ul>
<li>Solar model (4keles/solar-panel-od): trained on a specific dataset — may miss subtle defects or produce false positives on unusual panel types, angles, or lighting.</li>
<li>Wind model (Roboflow wind-turbine-blade): API-based, empirically discovered classes — accuracy depends on image quality and blade orientation.</li>
<li>Neither model performs thermal analysis. Uploaded thermal footage is processed as RGB and results may be unreliable.</li>
<li>Confidence thresholds are chosen from manual review, not formal validation metrics (no ground-truth labels for this footage).</li>
</ul>
</body></html>"""
    return html


def run_validation(
    asset_type: str,
    source: str = "",
    image: str = "",
    threshold: float = 0.0,
    fps: float = 1.0,
    max_frames: int = 40,
):
    from drone_inspection.confidence_config import get_confidence_threshold

    if threshold <= 0:
        threshold = get_confidence_threshold(asset_type)

    os.makedirs(_REPORT_DIR, exist_ok=True)
    ts = time.strftime("%Y%m%d_%H%M%S")
    run_dir = os.path.join(_REPORT_DIR, f"{asset_type}_{ts}")
    os.makedirs(run_dir, exist_ok=True)
    ann_dir = os.path.join(run_dir, "annotated")
    os.makedirs(ann_dir, exist_ok=True)

    frames_to_process: list[dict] = []

    if image:
        if not os.path.exists(image):
            print(f"Image not found: {image}")
            return
        frames_to_process.append({
            "frame_index": 0,
            "path": image,
            "file": os.path.basename(image),
        })
    elif source:
        from drone_inspection.pipeline.frame_extraction import (
            extract_frames, download_youtube_video,
        )
        video_path = source
        if source.startswith("http"):
            print(f"Downloading from YouTube: {source}")
            video_path = download_youtube_video(source, run_dir)
            print(f"Downloaded: {video_path}")

        print(f"Extracting frames (fps={fps}, max={max_frames})...")
        frames_dir = os.path.join(run_dir, "frames")
        frames_to_process = extract_frames(
            video_path, frames_dir, fps=fps, max_frames=max_frames,
        )
        print(f"Extracted {len(frames_to_process)} frames.")
    else:
        print("Provide --source (video/URL) or --image (single image)")
        return

    print(f"Running {asset_type} detector (threshold={threshold})...")
    frame_results = []
    for i, fr in enumerate(frames_to_process):
        detections = _run_on_image(fr["path"], asset_type, threshold)
        det_dicts = [d.to_dict() for d in detections]
        ann_path = None
        if detections:
            ann_path = os.path.join(ann_dir, f"ann_{fr['file']}")
            _annotate_and_save(fr["path"], detections, ann_path)
        frame_results.append({
            "frame_index": fr.get("frame_index", i),
            "path": fr["path"],
            "count": len(detections),
            "detections": det_dicts,
            "annotated_path": ann_path,
        })
        if (i + 1) % 5 == 0 or i == len(frames_to_process) - 1:
            print(f"  Processed {i+1}/{len(frames_to_process)} frames")

    html = _build_html_report(asset_type, threshold, frame_results, run_dir)
    report_path = os.path.join(run_dir, "report.html")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(html)

    results_json = os.path.join(run_dir, "results.json")
    with open(results_json, "w", encoding="utf-8") as f:
        json.dump({
            "asset_type": asset_type,
            "threshold": threshold,
            "total_frames": len(frame_results),
            "frames_with_detections": sum(1 for r in frame_results if r["count"] > 0),
            "total_detections": sum(r["count"] for r in frame_results),
            "frame_results": [{
                "frame_index": r["frame_index"],
                "count": r["count"],
                "detections": r["detections"],
            } for r in frame_results],
        }, f, indent=2)

    total_d = sum(r["count"] for r in frame_results)
    print(f"\nDone — {total_d} detection(s) across {len(frame_results)} frames.")
    print(f"Report: {report_path}")
    print(f"JSON:   {results_json}")
    return report_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Validate drone inspection models")
    parser.add_argument("--asset-type", required=True, choices=["solar", "wind"])
    parser.add_argument("--source", default="", help="Video file or YouTube URL")
    parser.add_argument("--image", default="", help="Single image path")
    parser.add_argument("--threshold", type=float, default=0.0,
                        help="Override confidence threshold (0 = use default from config)")
    parser.add_argument("--fps", type=float, default=1.0, help="Frame sampling rate")
    parser.add_argument("--max-frames", type=int, default=40, help="Max frames to extract")
    args = parser.parse_args()
    run_validation(
        asset_type=args.asset_type,
        source=args.source,
        image=args.image,
        threshold=args.threshold,
        fps=args.fps,
        max_frames=args.max_frames,
    )
