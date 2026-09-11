"""
Revenue and energy-loss estimation for UTAU predictive maintenance.

Tracks per-asset energy deficits during anomalous periods and converts
them to estimated revenue loss using a configurable electricity price.
"""

import time
from typing import Any, Optional


_SOLAR_POWER_INDEX = 2       # ac_power_output in solar_schema.json
_SOLAR_RESIDUAL_INDEX = 8    # power_residual in solar_schema.json
_WIND_POWER_INDEX = 6        # power_output in wind_schema.json
_WIND_RESIDUAL_INDEX = 11    # power_residual in wind_schema.json

_DOMAIN_POWER_INDICES: dict[str, tuple[int, int]] = {
    "solar_synthetic": (_SOLAR_POWER_INDEX, _SOLAR_RESIDUAL_INDEX),
    "wind_synthetic": (_WIND_POWER_INDEX, _WIND_RESIDUAL_INDEX),
}


class _AssetState:
    __slots__ = (
        "asset_id", "cumulative_energy_loss_kwh", "cumulative_revenue_loss",
        "current_deficit_rate_kw", "anomaly_active", "anomaly_start_tick",
        "anomaly_duration_ticks", "last_update_tick",
    )

    def __init__(self, asset_id: str):
        self.asset_id = asset_id
        self.cumulative_energy_loss_kwh = 0.0
        self.cumulative_revenue_loss = 0.0
        self.current_deficit_rate_kw = 0.0
        self.anomaly_active = False
        self.anomaly_start_tick = -1
        self.anomaly_duration_ticks = 0
        self.last_update_tick = -1


class RevenueLossTracker:
    def __init__(
        self,
        price_per_kwh: float = 0.12,
        sampling_interval_hours: float = 1.0 / 3600.0,
    ):
        self.price_per_kwh = price_per_kwh
        self.sampling_interval_hours = sampling_interval_hours
        self._assets: dict[str, _AssetState] = {}

    def _get_or_create(self, asset_id: str) -> _AssetState:
        if asset_id not in self._assets:
            self._assets[asset_id] = _AssetState(asset_id)
        return self._assets[asset_id]

    @staticmethod
    def extract_power_fields(
        dataset: str, sensors: list[float]
    ) -> tuple[Optional[float], Optional[float]]:
        indices = _DOMAIN_POWER_INDICES.get(dataset)
        if indices is None:
            return None, None
        power_idx, residual_idx = indices
        if power_idx >= len(sensors) or residual_idx >= len(sensors):
            return None, None
        actual_power = sensors[power_idx]
        residual = sensors[residual_idx]
        expected_power = actual_power - residual
        return actual_power, expected_power

    def update(
        self,
        dataset: str,
        asset_id: str,
        tick: int,
        is_anomalous: bool,
        actual_power_kw: Optional[float],
        expected_power_kw: Optional[float],
    ) -> dict[str, Any]:
        state = self._get_or_create(asset_id)
        state.last_update_tick = tick

        if actual_power_kw is None or expected_power_kw is None:
            state.current_deficit_rate_kw = 0.0
            state.anomaly_active = False
            return self._state_to_dict(state)

        deficit = max(0.0, expected_power_kw - actual_power_kw)

        if is_anomalous:
            if not state.anomaly_active:
                state.anomaly_active = True
                state.anomaly_start_tick = tick
                state.anomaly_duration_ticks = 0
            state.anomaly_duration_ticks += 1
            state.current_deficit_rate_kw = deficit
            energy_loss = deficit * self.sampling_interval_hours
            state.cumulative_energy_loss_kwh += energy_loss
            state.cumulative_revenue_loss = (
                state.cumulative_energy_loss_kwh * self.price_per_kwh
            )
        else:
            state.anomaly_active = False
            state.current_deficit_rate_kw = 0.0

        return self._state_to_dict(state)

    def get_asset_summary(self, asset_id: str) -> dict[str, Any]:
        state = self._assets.get(asset_id)
        if state is None:
            return {
                "asset_id": asset_id,
                "found": False,
                "cumulative_energy_loss_kwh": 0.0,
                "cumulative_revenue_loss_usd": 0.0,
                "current_deficit_rate_kw": 0.0,
                "anomaly_active": False,
                "anomaly_duration_ticks": 0,
            }
        return self._state_to_dict(state)

    def get_all_summaries(self) -> dict[str, Any]:
        assets = [self._state_to_dict(s) for s in self._assets.values()]
        total_energy = sum(a["cumulative_energy_loss_kwh"] for a in assets)
        total_revenue = sum(a["cumulative_revenue_loss_usd"] for a in assets)
        return {
            "price_per_kwh": self.price_per_kwh,
            "total_energy_loss_kwh": round(total_energy, 6),
            "total_revenue_loss_usd": round(total_revenue, 4),
            "assets": assets,
        }

    def get_aggregate(self) -> dict[str, Any]:
        total_energy = 0.0
        total_revenue = 0.0
        active_anomalies = 0
        for s in self._assets.values():
            total_energy += s.cumulative_energy_loss_kwh
            total_revenue += s.cumulative_revenue_loss
            if s.anomaly_active:
                active_anomalies += 1
        return {
            "tracked_assets": len(self._assets),
            "active_anomalies": active_anomalies,
            "total_energy_loss_kwh": round(total_energy, 6),
            "total_revenue_loss_usd": round(total_revenue, 4),
            "price_per_kwh": self.price_per_kwh,
        }

    def reset(self):
        self._assets.clear()

    @staticmethod
    def _state_to_dict(state: _AssetState) -> dict[str, Any]:
        return {
            "asset_id": state.asset_id,
            "cumulative_energy_loss_kwh": round(state.cumulative_energy_loss_kwh, 6),
            "cumulative_revenue_loss_usd": round(state.cumulative_revenue_loss, 4),
            "current_deficit_rate_kw": round(state.current_deficit_rate_kw, 4),
            "anomaly_active": state.anomaly_active,
            "anomaly_duration_ticks": state.anomaly_duration_ticks,
            "last_update_tick": state.last_update_tick,
        }
