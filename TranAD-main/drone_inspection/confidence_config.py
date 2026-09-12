"""
Confidence thresholds and power-derating assumptions for drone inspection.

Thresholds chosen conservatively — only detections above these values
are treated as confirmed defects for revenue-loss and fleet-priority
integration.  Values below the threshold are still shown in the UI
gallery but are NOT propagated to downstream systems.

Power-derating percentages are rough engineering estimates, not
calibrated physical models.  They are clearly labelled as estimates
in every downstream consumer (revenue-loss, Copilot, UI).
"""

SOLAR_CONFIDENCE_THRESHOLD = 0.45
WIND_CONFIDENCE_THRESHOLD = 0.40

CONFIDENCE_THRESHOLDS = {
    "solar": SOLAR_CONFIDENCE_THRESHOLD,
    "wind": WIND_CONFIDENCE_THRESHOLD,
}

SOLAR_DERATING_PCT: dict[str, float] = {
    "physical_damage": 0.15,
    "dust_partical": 0.08,
    "bird_drop": 0.05,
    "bird_feather": 0.03,
    "leaf": 0.04,
    "snow": 0.20,
}

WIND_DERATING_PCT: dict[str, float] = {
    "crack": 0.20,
    "erosion": 0.10,
    "damage": 0.15,
    "defect": 0.12,
}

DERATING_PCT = {
    "solar": SOLAR_DERATING_PCT,
    "wind": WIND_DERATING_PCT,
}

DEFAULT_DERATING_PCT = 0.05


def get_derating(asset_type: str, defect_class: str) -> float:
    table = DERATING_PCT.get(asset_type, {})
    if defect_class in table:
        return table[defect_class]
    for key, val in table.items():
        if key in defect_class.lower() or defect_class.lower() in key:
            return val
    return DEFAULT_DERATING_PCT


def get_confidence_threshold(asset_type: str) -> float:
    return CONFIDENCE_THRESHOLDS.get(asset_type, 0.40)
