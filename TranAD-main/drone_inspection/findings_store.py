"""
In-memory store of inspection findings per asset.

When a drone inspection job completes, its results are aggregated here
so that revenue-loss, fleet priority, and Copilot can query them.
"""

import time
from typing import Any, Optional

from drone_inspection.confidence_config import get_confidence_threshold, get_derating


_findings: dict[str, dict[str, Any]] = {}


def record_inspection(
    asset_id: str,
    asset_type: str,
    job_id: str,
    results: list[dict],
):
    threshold = get_confidence_threshold(asset_type)

    confirmed = []
    for frame in results:
        for det in frame.get("detections", []):
            if det.get("confidence", 0) >= threshold:
                confirmed.append(det)

    class_counts: dict[str, int] = {}
    total_derating = 0.0
    for det in confirmed:
        cls = det["class_name"]
        class_counts[cls] = class_counts.get(cls, 0) + 1
        total_derating += get_derating(asset_type, cls)

    max_derating = min(total_derating, 0.50)

    _findings[asset_id] = {
        "asset_id": asset_id,
        "asset_type": asset_type,
        "job_id": job_id,
        "timestamp": time.time(),
        "total_confirmed_defects": len(confirmed),
        "class_counts": class_counts,
        "estimated_derating_pct": round(max_derating, 4),
        "confirmed_detections": confirmed,
        "confidence_threshold_used": threshold,
    }


def get_findings(asset_id: str) -> Optional[dict]:
    return _findings.get(asset_id)


def get_all_findings() -> dict[str, dict]:
    return dict(_findings)


def has_visual_defects(asset_id: str) -> bool:
    f = _findings.get(asset_id)
    return f is not None and f["total_confirmed_defects"] > 0


def get_derating_for_asset(asset_id: str) -> float:
    f = _findings.get(asset_id)
    if f is None:
        return 0.0
    return f["estimated_derating_pct"]


def get_defect_summary_text(asset_id: str) -> str:
    f = _findings.get(asset_id)
    if f is None:
        return ""
    if f["total_confirmed_defects"] == 0:
        return "No confirmed visual defects from latest drone inspection."
    parts = [f"{cnt}x {cls}" for cls, cnt in f["class_counts"].items()]
    return (
        f"Latest drone inspection (job {f['job_id']}): "
        f"{f['total_confirmed_defects']} confirmed defect(s) — {', '.join(parts)}. "
        f"Estimated power derating: {f['estimated_derating_pct']:.0%}. "
        f"(Confidence threshold: {f['confidence_threshold_used']:.0%}, "
        f"RGB-visible defects only — not thermal analysis.)"
    )


def clear():
    _findings.clear()
