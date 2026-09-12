"""
Shared detection data types for drone inspection models.
Both solar and wind wrappers normalize their outputs to this format.
"""

from dataclasses import dataclass, field, asdict
from typing import Any


@dataclass
class BBox:
    x1: float
    y1: float
    x2: float
    y2: float

    def to_dict(self) -> dict:
        return {"x1": self.x1, "y1": self.y1, "x2": self.x2, "y2": self.y2}


@dataclass
class Detection:
    class_name: str
    confidence: float
    bbox: BBox
    model_source: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "class_name": self.class_name,
            "confidence": round(self.confidence, 4),
            "bbox": self.bbox.to_dict(),
            "model_source": self.model_source,
        }
