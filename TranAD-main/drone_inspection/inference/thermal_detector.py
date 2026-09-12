"""
Thermal hotspot detector for false-color thermal images.

Uses simple color-thresholding on false-color thermal imagery to find
hot regions. NOT a learned model — this is basic image processing that
identifies bright/warm-colored areas in standard thermal palettes
(iron, rainbow, white-hot).

This does NOT extract temperature values — it identifies visually
apparent hotspots from already-rendered false-color images.
"""

import os
from typing import Optional
import cv2
import numpy as np

from .detection import Detection, BBox


_MIN_HOTSPOT_AREA = 200
_BRIGHTNESS_THRESHOLD = 200
_WARM_HUE_RANGES = [(0, 25), (160, 180)]


def _find_hotspots_brightness(image: np.ndarray, threshold: int = _BRIGHTNESS_THRESHOLD) -> list[np.ndarray]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, mask = cv2.threshold(gray, threshold, 255, cv2.THRESH_BINARY)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return [c for c in contours if cv2.contourArea(c) >= _MIN_HOTSPOT_AREA]


def _find_hotspots_warm_color(image: np.ndarray) -> list[np.ndarray]:
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    mask = np.zeros(hsv.shape[:2], dtype=np.uint8)
    for lo, hi in _WARM_HUE_RANGES:
        in_range = cv2.inRange(hsv, (lo, 80, 180), (hi, 255, 255))
        mask = cv2.bitwise_or(mask, in_range)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return [c for c in contours if cv2.contourArea(c) >= _MIN_HOTSPOT_AREA]


def run_thermal_detection(image_path: str) -> list[Detection]:
    image = cv2.imread(image_path)
    if image is None:
        return []

    contours_bright = _find_hotspots_brightness(image)
    contours_warm = _find_hotspots_warm_color(image)

    seen_centers = set()
    detections = []

    for contours, method in [(contours_bright, "brightness"), (contours_warm, "warm_color")]:
        for cnt in contours:
            x, y, w, h = cv2.boundingRect(cnt)
            cx, cy = x + w // 2, y + h // 2
            grid_key = (cx // 30, cy // 30)
            if grid_key in seen_centers:
                continue
            seen_centers.add(grid_key)

            area = cv2.contourArea(cnt)
            img_area = image.shape[0] * image.shape[1]
            relative_size = area / max(img_area, 1)

            if relative_size > 0.4:
                continue

            severity = "severe" if relative_size > 0.05 else "moderate" if relative_size > 0.01 else "minor"

            detections.append(Detection(
                class_name=f"hotspot_{severity}",
                confidence=min(0.95, 0.5 + relative_size * 10),
                bbox=BBox(x1=float(x), y1=float(y), x2=float(x + w), y2=float(y + h)),
                model_source=f"thermal_{method}",
            ))

    return detections


def annotate_thermal(image_path: str, detections: list[Detection], output_path: str) -> str:
    image = cv2.imread(image_path)
    if image is None:
        return image_path

    for det in detections:
        x1, y1 = int(det.bbox.x1), int(det.bbox.y1)
        x2, y2 = int(det.bbox.x2), int(det.bbox.y2)

        if "severe" in det.class_name:
            color = (0, 0, 255)
        elif "moderate" in det.class_name:
            color = (0, 140, 255)
        else:
            color = (0, 220, 255)

        cv2.rectangle(image, (x1, y1), (x2, y2), color, 2)
        label = f"{det.class_name} {det.confidence:.0%}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
        cv2.rectangle(image, (x1, y1 - th - 6), (x1 + tw + 4, y1), color, -1)
        cv2.putText(image, label, (x1 + 2, y1 - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)

    cv2.imwrite(output_path, image)
    return output_path
