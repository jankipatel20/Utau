"""
Async inspection job manager. Tracks job state in memory with results
persisted to disk. Each job processes a video through the detection pipeline.
"""

import asyncio
import json
import os
import shutil
import time
import uuid
from pathlib import Path
from typing import Any, Optional

_JOBS: dict[str, dict[str, Any]] = {}
_JOBS_BASE_DIR = os.path.join(os.path.dirname(__file__), "jobs")
_ANNOTATED_DIR = os.path.join(os.path.dirname(__file__), "annotated_frames")


def _ensure_dirs():
    os.makedirs(_JOBS_BASE_DIR, exist_ok=True)
    os.makedirs(_ANNOTATED_DIR, exist_ok=True)


def create_job(asset_id: str, asset_type: str, source_type: str, source_value: str) -> str:
    _ensure_dirs()
    job_id = str(uuid.uuid4())[:12]
    job_dir = os.path.join(_JOBS_BASE_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)
    os.makedirs(os.path.join(job_dir, "frames"), exist_ok=True)
    os.makedirs(os.path.join(job_dir, "annotated"), exist_ok=True)

    _JOBS[job_id] = {
        "job_id": job_id,
        "asset_id": asset_id,
        "asset_type": asset_type,
        "source_type": source_type,
        "source_value": source_value,
        "status": "queued",
        "progress": 0.0,
        "progress_detail": "Job created",
        "created_at": time.time(),
        "started_at": None,
        "completed_at": None,
        "total_frames": 0,
        "processed_frames": 0,
        "total_detections": 0,
        "results": None,
        "error": None,
        "job_dir": job_dir,
    }
    return job_id


def get_job_status(job_id: str) -> Optional[dict]:
    job = _JOBS.get(job_id)
    if not job:
        return None
    return {
        "job_id": job["job_id"],
        "asset_id": job["asset_id"],
        "asset_type": job["asset_type"],
        "status": job["status"],
        "progress": round(job["progress"], 1),
        "progress_detail": job["progress_detail"],
        "total_frames": job["total_frames"],
        "processed_frames": job["processed_frames"],
        "total_detections": job["total_detections"],
        "created_at": job["created_at"],
        "completed_at": job["completed_at"],
        "error": job["error"],
    }


def get_job_results(job_id: str) -> Optional[dict]:
    job = _JOBS.get(job_id)
    if not job:
        return None
    if job["status"] != "done":
        return {"job_id": job_id, "status": job["status"], "results": None}
    return {
        "job_id": job_id,
        "status": "done",
        "asset_id": job["asset_id"],
        "asset_type": job["asset_type"],
        "total_frames": job["total_frames"],
        "total_detections": job["total_detections"],
        "results": job["results"],
    }


def list_jobs(limit: int = 20) -> list[dict]:
    jobs = sorted(_JOBS.values(), key=lambda j: j["created_at"], reverse=True)[:limit]
    return [get_job_status(j["job_id"]) for j in jobs]


async def run_inspection_job(job_id: str, confidence_threshold: float = 0.25):
    job = _JOBS.get(job_id)
    if not job:
        return

    try:
        job["status"] = "extracting_frames"
        job["started_at"] = time.time()
        job["progress_detail"] = "Preparing video source..."
        job["progress"] = 5.0

        from drone_inspection.pipeline.frame_extraction import (
            extract_frames, run_detection_on_frames, annotate_frame,
            download_youtube_video,
        )

        job_dir = job["job_dir"]
        frames_dir = os.path.join(job_dir, "frames")
        annotated_dir = os.path.join(job_dir, "annotated")

        if job["source_type"] == "youtube":
            job["progress_detail"] = "Downloading video from YouTube..."
            job["progress"] = 10.0
            video_path = await asyncio.to_thread(
                download_youtube_video, job["source_value"], job_dir
            )
        else:
            video_path = job["source_value"]
            if not os.path.exists(video_path):
                raise FileNotFoundError(f"Video file not found: {video_path}")

        job["progress_detail"] = "Extracting frames..."
        job["progress"] = 20.0
        frames = await asyncio.to_thread(
            extract_frames, video_path, frames_dir, fps=1.0
        )
        job["total_frames"] = len(frames)

        if not frames:
            job["status"] = "done"
            job["progress"] = 100.0
            job["progress_detail"] = "No usable frames extracted"
            job["results"] = []
            job["completed_at"] = time.time()
            return

        job["status"] = "running_detection"
        job["progress_detail"] = f"Running detection on {len(frames)} frames..."
        job["progress"] = 30.0

        def on_progress(done: int, total: int):
            pct = 30.0 + (done / max(total, 1)) * 55.0
            job["progress"] = pct
            job["processed_frames"] = done
            job["progress_detail"] = f"Detecting defects... ({done}/{total} frames)"

        results = await asyncio.to_thread(
            run_detection_on_frames, frames, job["asset_type"],
            confidence_threshold, on_progress,
        )

        job["status"] = "compiling_results"
        job["progress"] = 88.0
        job["progress_detail"] = "Annotating frames..."

        for r in results:
            if r["detection_count"] > 0:
                src_path = r["path"]
                ann_fname = f"ann_{r['file']}"
                ann_path = os.path.join(annotated_dir, ann_fname)
                await asyncio.to_thread(
                    annotate_frame, src_path, r["detections"], ann_path
                )
                r["annotated_file"] = ann_fname
                r["annotated_path"] = ann_path

        total_dets = sum(r["detection_count"] for r in results)
        job["total_detections"] = total_dets
        job["processed_frames"] = len(frames)

        clean_results = []
        for r in results:
            clean_results.append({
                "frame_index": r["frame_index"],
                "timestamp_sec": r["timestamp_sec"],
                "detection_count": r["detection_count"],
                "detections": r["detections"],
                "annotated_file": r.get("annotated_file"),
            })

        job["results"] = clean_results
        job["status"] = "done"
        job["progress"] = 100.0
        job["progress_detail"] = f"Complete — {total_dets} defect(s) found in {len(frames)} frames"
        job["completed_at"] = time.time()

    except Exception as e:
        job["status"] = "failed"
        job["error"] = str(e)
        job["progress_detail"] = f"Failed: {e}"
        print(f"[INSPECTION JOB {job_id}] Error: {e}")
