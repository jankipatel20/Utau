"""
Solar panel defect detector using 4keles/solar-panel-od (YOLO ONNX).
Local inference — no network dependency at predict time.

Classes: bird_drop, bird_feather, physical_damage, dust_partical, leaf, snow
(RGB-visible defects only — not thermal analysis)
"""

import os
from typing import Optional

from .detection import Detection, BBox

_model = None
_MODEL_REPO = "4keles/solar-panel-od"
_MODEL_FILE = "v1.2.1/best.onnx"


def _fix_ssl_cert():
    cert = os.environ.get("SSL_CERT_FILE", "")
    if cert and not os.path.exists(cert):
        alt = cert.replace("/ssl/", "/Library/ssl/")
        if os.path.exists(alt):
            os.environ["SSL_CERT_FILE"] = alt


def _load_model():
    global _model
    if _model is not None:
        return _model
    _fix_ssl_cert()
    from huggingface_hub import hf_hub_download
    from ultralytics import YOLO

    cache_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models")
    os.makedirs(cache_dir, exist_ok=True)
    model_path = hf_hub_download(
        repo_id=_MODEL_REPO,
        filename=_MODEL_FILE,
        cache_dir=cache_dir,
    )
    _model = YOLO(model_path, task="detect")
    return _model


def run_solar_inference(
    image_path_or_array,
    confidence_threshold: float = 0.25,
) -> list[Detection]:
    try:
        model = _load_model()
    except Exception as e:
        print(f"[SOLAR DETECTOR] Model load failed: {e}")
        return []

    try:
        results = model(image_path_or_array, conf=confidence_threshold, verbose=False)
    except Exception as e:
        print(f"[SOLAR DETECTOR] Inference failed: {e}")
        return []

    detections = []
    for result in results:
        if result.boxes is None:
            continue
        for box in result.boxes:
            cls_id = int(box.cls[0])
            cls_name = result.names.get(cls_id, f"class_{cls_id}")
            conf = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            detections.append(Detection(
                class_name=cls_name,
                confidence=conf,
                bbox=BBox(x1=x1, y1=y1, x2=x2, y2=y2),
                model_source="4keles/solar-panel-od",
            ))
    return detections


def get_solar_classes() -> list[str]:
    return ["bird_drop", "bird_feather", "physical_damage", "dust_partical", "leaf", "snow"]
