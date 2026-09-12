"""
Wind turbine blade defect detector using Roboflow-hosted model.
Remote API inference — requires network access and ROBOFLOW_API_KEY.

Model: wind-turbine-blade-1djka/7 on Roboflow serverless.
Class list is discovered empirically at first inference (not hardcoded).
"""

import os
import time
from typing import Optional

from .detection import Detection, BBox


def _fix_ssl_cert():
    cert = os.environ.get("SSL_CERT_FILE", "")
    if cert and not os.path.exists(cert):
        alt = cert.replace("/ssl/", "/Library/ssl/")
        if os.path.exists(alt):
            os.environ["SSL_CERT_FILE"] = alt

_ROBOFLOW_API_URL = "https://serverless.roboflow.com"
_ROBOFLOW_MODEL_ID = "wind-turbine-blade-1djka/7"
_MAX_RETRIES = 2
_RETRY_BACKOFF_SEC = 1.5

_discovered_classes: list[str] = []


def _get_api_key() -> str:
    key = os.getenv("ROBOFLOW_API_KEY", "").strip()
    if not key:
        raise RuntimeError(
            "ROBOFLOW_API_KEY not set. Get a free key at https://roboflow.com"
        )
    return key


def run_wind_inference(
    image_path: str,
    confidence_threshold: float = 0.25,
) -> list[Detection]:
    global _discovered_classes
    try:
        api_key = _get_api_key()
    except RuntimeError as e:
        print(f"[WIND DETECTOR] {e}")
        return []

    _fix_ssl_cert()
    try:
        from inference_sdk import InferenceHTTPClient, InferenceConfiguration
    except ImportError:
        print("[WIND DETECTOR] inference-sdk not installed")
        return []

    client = InferenceHTTPClient(
        api_url=_ROBOFLOW_API_URL,
        api_key=api_key,
    ).configure(InferenceConfiguration(api_key_transport="header"))

    last_error = None
    for attempt in range(_MAX_RETRIES + 1):
        try:
            result = client.infer(image_path, model_id=_ROBOFLOW_MODEL_ID)
            break
        except Exception as e:
            last_error = e
            if attempt < _MAX_RETRIES:
                time.sleep(_RETRY_BACKOFF_SEC * (attempt + 1))
    else:
        print(f"[WIND DETECTOR] Inference failed after {_MAX_RETRIES + 1} attempts: {last_error}")
        return []

    detections = []
    predictions = result.get("predictions", [])
    for pred in predictions:
        conf = float(pred.get("confidence", 0))
        if conf < confidence_threshold:
            continue

        cls_name = str(pred.get("class", "unknown"))
        if cls_name not in _discovered_classes:
            _discovered_classes.append(cls_name)

        x_center = float(pred.get("x", 0))
        y_center = float(pred.get("y", 0))
        width = float(pred.get("width", 0))
        height = float(pred.get("height", 0))
        x1 = x_center - width / 2
        y1 = y_center - height / 2
        x2 = x_center + width / 2
        y2 = y_center + height / 2

        detections.append(Detection(
            class_name=cls_name,
            confidence=conf,
            bbox=BBox(x1=x1, y1=y1, x2=x2, y2=y2),
            model_source=f"roboflow:{_ROBOFLOW_MODEL_ID}",
        ))
    return detections


def get_wind_discovered_classes() -> list[str]:
    return list(_discovered_classes)
