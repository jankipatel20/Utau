"""
Synthetic solar & wind telemetry generator for UTAU predictive maintenance.

Generates physically plausible sensor data with injectable faults and
ground-truth labels.  Follows the same output conventions as
generate_synthetic_pipeline_dataset.py so the existing pipeline
(kafka_producer, server.py hot-swap, training) can consume it directly.

Usage:
    python generate_solar_wind_synthetic.py --domain solar --assets 3 --write-checkpoint
    python generate_solar_wind_synthetic.py --domain wind  --assets 3 --write-checkpoint
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Optional

import numpy as np


# ---------------------------------------------------------------------------
# Shared utilities
# ---------------------------------------------------------------------------

def _scale_with_train_stats(
    train: np.ndarray, test: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    d_min = train.min(axis=0, keepdims=True)
    d_max = train.max(axis=0, keepdims=True)
    denom = np.maximum(d_max - d_min, 1e-8)
    train_scaled = np.clip((train - d_min) / denom, 0.0, 1.0)
    test_scaled = np.clip((test - d_min) / denom, 0.0, 1.0)
    return train_scaled, test_scaled


def _write_compat_checkpoint(checkpoint_path: Path, n_dims: int) -> Optional[str]:
    try:
        import torch
        argv_backup = list(sys.argv)
        sys.argv = [sys.argv[0]]
        from src.models import STP_TranAD
        sys.argv = argv_backup
    except Exception as exc:
        try:
            sys.argv = argv_backup
        except Exception:
            pass
        return f"checkpoint skipped (torch/model unavailable): {exc}"

    model = STP_TranAD(n_dims).double()
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-5, weight_decay=1e-5)
    payload = {
        "epoch": 0,
        "accuracy_list": [],
        "model_state_dict": model.state_dict(),
        "optimizer_state_dict": optimizer.state_dict(),
    }
    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(payload, str(checkpoint_path))
    return None


# ---------------------------------------------------------------------------
# Solar simulator
# ---------------------------------------------------------------------------

_SOLAR_N_FEATURES = 10
_SOLAR_P_RATED = 5.0       # kW rated per string
_SOLAR_V_MPP = 600.0       # V nominal MPP voltage
_SOLAR_TEMP_COEFF = -0.004  # %/°C for crystalline silicon
_SOLAR_V_TEMP_COEFF = -0.003

# Timesteps per simulated day (1 Hz sampling → 86400, but we compress to 1440
# to keep dataset sizes manageable while preserving diurnal structure).
_STEPS_PER_DAY = 1440


def _solar_baseline(n_steps: int, rng: np.random.Generator) -> np.ndarray:
    """Generate normal-operation solar telemetry. Shape: (n_steps, 10)."""
    t = np.arange(n_steps, dtype=np.float64)
    hour = (t % _STEPS_PER_DAY) / _STEPS_PER_DAY * 24.0

    # Irradiance: diurnal bell curve, zero at night
    irr_ideal = np.maximum(0.0, 1000.0 * np.sin(np.pi * hour / 24.0))
    # Cloud noise: slow-varying multiplicative factor
    cloud_period = rng.uniform(80, 200)
    cloud = 0.7 + 0.3 * (0.5 + 0.5 * np.sin(2.0 * np.pi * t / cloud_period))
    cloud += rng.normal(0.0, 0.05, n_steps)
    cloud = np.clip(cloud, 0.3, 1.0)
    irradiance = irr_ideal * cloud

    # Ambient temperature: daily cycle ~18-32°C
    ambient_temp = 25.0 + 7.0 * np.sin(2.0 * np.pi * (hour - 6.0) / 24.0)
    ambient_temp += rng.normal(0.0, 0.5, n_steps)

    # Module temperature: ambient + irradiance heating
    module_temp = ambient_temp + irradiance * 0.030 + rng.normal(0.0, 0.3, n_steps)

    # Expected power (simplified single-diode model)
    temp_factor = 1.0 + _SOLAR_TEMP_COEFF * (module_temp - 25.0)
    p_expected = (irradiance / 1000.0) * _SOLAR_P_RATED * temp_factor
    p_expected = np.maximum(p_expected, 0.0)

    # Inverter efficiency: ~96-98% with slight load dependence
    inv_eff = 0.97 + 0.01 * (p_expected / (_SOLAR_P_RATED + 1e-8))
    inv_eff = np.clip(inv_eff + rng.normal(0.0, 0.002, n_steps), 0.90, 0.99)

    # AC power output
    ac_power = p_expected * inv_eff + rng.normal(0.0, 0.02, n_steps)
    ac_power = np.maximum(ac_power, 0.0)

    # DC voltage
    v_dc = _SOLAR_V_MPP * (1.0 + _SOLAR_V_TEMP_COEFF * (module_temp - 25.0))
    v_dc += rng.normal(0.0, 1.0, n_steps)

    # DC current: P_dc / V_dc
    p_dc = np.where(inv_eff > 0.01, ac_power / inv_eff, 0.0)
    i_dc = np.where(v_dc > 1.0, p_dc / v_dc * 1000.0, 0.0)  # in amps
    i_dc += rng.normal(0.0, 0.01, n_steps)
    i_dc = np.maximum(i_dc, 0.0)

    # Soiling index: clean panels = 1.0
    soiling = np.ones(n_steps, dtype=np.float64)

    # Derived: power residual and temperature delta
    power_residual = ac_power - p_expected
    temp_delta = module_temp - ambient_temp

    # Column order matches solar_schema.json indices 0-9
    data = np.column_stack([
        v_dc,            # 0: dc_voltage
        i_dc,            # 1: dc_current
        ac_power,        # 2: ac_power_output
        module_temp,     # 3: module_temperature
        ambient_temp,    # 4: ambient_temperature
        irradiance,      # 5: irradiance
        soiling,         # 6: soiling_index
        inv_eff,         # 7: inverter_efficiency
        power_residual,  # 8: power_residual
        temp_delta,      # 9: temperature_delta
    ])
    return data


def _solar_inject_faults(
    test_data: np.ndarray, rng: np.random.Generator
) -> tuple[np.ndarray, np.ndarray, list[dict]]:
    """Inject solar-specific faults into test data. Returns (modified, labels, windows)."""
    out = test_data.copy()
    n_steps = out.shape[0]
    labels = np.zeros_like(out, dtype=np.float64)
    windows = []

    # Fault 1: Soiling (gradual) — 18-33% of test
    s1_start = int(n_steps * 0.18)
    s1_end = int(n_steps * 0.33)
    ramp = np.linspace(0.0, 1.0, s1_end - s1_start)
    soiling_drop = 0.25 + rng.uniform(0.0, 0.10)
    out[s1_start:s1_end, 6] = 1.0 - ramp * soiling_drop  # soiling_index
    # Power drops proportionally to soiling
    power_scale = out[s1_start:s1_end, 6]
    out[s1_start:s1_end, 2] *= power_scale  # ac_power_output
    out[s1_start:s1_end, 1] *= power_scale  # dc_current
    # Update derived fields
    out[s1_start:s1_end, 8] = out[s1_start:s1_end, 2] - test_data[s1_start:s1_end, 2]  # power_residual
    labels[s1_start:s1_end, [2, 6, 8]] = 1.0
    windows.append({
        "name": "soiling", "start": s1_start, "end": s1_end,
        "channels": [2, 6, 8],
        "description": "Gradual soiling causing power decline",
    })

    # Fault 2: Hotspot (gradual) — 45-58% of test
    s2_start = int(n_steps * 0.45)
    s2_end = int(n_steps * 0.58)
    ramp2 = np.linspace(0.0, 1.0, s2_end - s2_start)
    temp_spike = 15.0 + rng.uniform(0.0, 10.0)
    out[s2_start:s2_end, 3] += ramp2 * temp_spike  # module_temperature
    out[s2_start:s2_end, 9] = out[s2_start:s2_end, 3] - out[s2_start:s2_end, 4]  # temp_delta
    power_loss = 1.0 - ramp2 * rng.uniform(0.10, 0.20)
    out[s2_start:s2_end, 2] *= power_loss  # ac_power_output
    out[s2_start:s2_end, 8] = out[s2_start:s2_end, 2] - test_data[s2_start:s2_end, 2]
    labels[s2_start:s2_end, [2, 3, 8, 9]] = 1.0
    windows.append({
        "name": "hotspot", "start": s2_start, "end": s2_end,
        "channels": [2, 3, 8, 9],
        "description": "Hotspot causing temperature spike and power loss",
    })

    # Fault 3: Inverter fault (sudden) — 72-78% of test
    s3_start = int(n_steps * 0.72)
    s3_end = int(n_steps * 0.78)
    out[s3_start:s3_end, 2] *= 0.02  # ac_power near zero
    out[s3_start:s3_end, 7] = rng.uniform(0.01, 0.05, s3_end - s3_start)  # inverter_efficiency
    out[s3_start:s3_end, 1] *= 0.05  # dc_current collapses
    out[s3_start:s3_end, 8] = out[s3_start:s3_end, 2] - test_data[s3_start:s3_end, 2]
    labels[s3_start:s3_end, [1, 2, 7, 8]] = 1.0
    windows.append({
        "name": "inverter_fault", "start": s3_start, "end": s3_end,
        "channels": [1, 2, 7, 8],
        "description": "Sudden inverter failure, power drops to near-zero",
    })

    return out, labels, windows


# ---------------------------------------------------------------------------
# Wind simulator
# ---------------------------------------------------------------------------

_WIND_N_FEATURES = 12
_WIND_P_RATED = 2000.0   # kW
_WIND_V_CUTIN = 3.0      # m/s
_WIND_V_RATED = 12.0     # m/s
_WIND_V_CUTOUT = 25.0    # m/s
_WIND_RPM_RATED = 15.0   # RPM at rated wind


def _wind_power_curve(wind_speed: np.ndarray) -> np.ndarray:
    """Simplified cubic power curve for a typical wind turbine."""
    p = np.zeros_like(wind_speed)
    mask_operating = (wind_speed >= _WIND_V_CUTIN) & (wind_speed < _WIND_V_CUTOUT)
    mask_below_rated = mask_operating & (wind_speed < _WIND_V_RATED)
    mask_above_rated = mask_operating & (wind_speed >= _WIND_V_RATED)

    v_norm = (wind_speed[mask_below_rated] - _WIND_V_CUTIN) / (_WIND_V_RATED - _WIND_V_CUTIN)
    p[mask_below_rated] = _WIND_P_RATED * np.power(v_norm, 3)
    p[mask_above_rated] = _WIND_P_RATED
    return p


def _wind_baseline(n_steps: int, rng: np.random.Generator) -> np.ndarray:
    """Generate normal-operation wind turbine telemetry. Shape: (n_steps, 12)."""
    t = np.arange(n_steps, dtype=np.float64)

    # Wind speed: Weibull-ish with slow mean variation + turbulence
    mean_wind = 8.0 + 3.0 * np.sin(2.0 * np.pi * t / rng.uniform(800, 1500))
    turbulence = rng.normal(0.0, 1.2, n_steps)
    wind_speed = np.maximum(0.0, mean_wind + turbulence)

    # Wind direction: slow random walk
    wind_dir = np.cumsum(rng.normal(0.0, 0.5, n_steps))
    wind_dir = wind_dir % 360.0

    # Ambient temperature: daily cycle
    hour = (t % _STEPS_PER_DAY) / _STEPS_PER_DAY * 24.0
    ambient_temp = 15.0 + 5.0 * np.sin(2.0 * np.pi * (hour - 6.0) / 24.0)
    ambient_temp += rng.normal(0.0, 0.3, n_steps)

    # Rotor RPM: proportional to wind speed, capped at rated
    rpm = np.minimum(_WIND_RPM_RATED, _WIND_RPM_RATED * wind_speed / _WIND_V_RATED)
    rpm = np.maximum(rpm, 0.0)
    rpm += rng.normal(0.0, 0.1, n_steps)

    # Power output from wind power curve
    p_expected = _wind_power_curve(wind_speed)
    power_output = p_expected + rng.normal(0.0, 15.0, n_steps)
    power_output = np.maximum(power_output, 0.0)

    # Gearbox oil temperature: ambient + load-dependent heating
    load_frac = power_output / (_WIND_P_RATED + 1e-8)
    gearbox_oil_temp = ambient_temp + 30.0 + 15.0 * load_frac
    gearbox_oil_temp += rng.normal(0.0, 0.5, n_steps)

    # Generator temperature
    gen_temp = ambient_temp + 40.0 + 20.0 * load_frac
    gen_temp += rng.normal(0.0, 0.6, n_steps)

    # Vibration: baseline proportional to RPM with noise
    vib_base = 0.02 + 0.03 * (rpm / _WIND_RPM_RATED)
    vib_x = vib_base + rng.normal(0.0, 0.005, n_steps)
    vib_y = vib_base + rng.normal(0.0, 0.005, n_steps)
    vib_z = vib_base * 0.8 + rng.normal(0.0, 0.004, n_steps)

    # Nacelle vibration RMS
    nacelle_vib_rms = np.sqrt(vib_x**2 + vib_y**2 + vib_z**2) * 1.1
    nacelle_vib_rms += rng.normal(0.0, 0.002, n_steps)

    # Power residual
    power_residual = power_output - p_expected

    # Column order matches wind_schema.json indices 0-11
    data = np.column_stack([
        vib_x,            # 0: vibration_x
        vib_y,            # 1: vibration_y
        vib_z,            # 2: vibration_z
        gearbox_oil_temp, # 3: gearbox_oil_temperature
        gen_temp,         # 4: generator_temperature
        rpm,              # 5: rotor_rpm
        power_output,     # 6: power_output
        wind_speed,       # 7: wind_speed
        wind_dir,         # 8: wind_direction
        ambient_temp,     # 9: ambient_temperature
        nacelle_vib_rms,  # 10: nacelle_vibration_rms
        power_residual,   # 11: power_residual
    ])
    return data


def _wind_inject_faults(
    test_data: np.ndarray, rng: np.random.Generator
) -> tuple[np.ndarray, np.ndarray, list[dict]]:
    """Inject wind-specific faults into test data."""
    out = test_data.copy()
    n_steps = out.shape[0]
    labels = np.zeros_like(out, dtype=np.float64)
    windows = []

    # Fault 1: Gearbox wear (gradual) — 15-30% of test
    w1_start = int(n_steps * 0.15)
    w1_end = int(n_steps * 0.30)
    ramp = np.linspace(0.0, 1.0, w1_end - w1_start)
    temp_drift = 10.0 + rng.uniform(0.0, 10.0)
    out[w1_start:w1_end, 3] += ramp * temp_drift  # gearbox_oil_temperature
    vib_increase = 1.0 + ramp * rng.uniform(0.4, 0.7)
    out[w1_start:w1_end, 0] *= vib_increase  # vibration_x
    out[w1_start:w1_end, 1] *= vib_increase  # vibration_y
    out[w1_start:w1_end, 2] *= vib_increase  # vibration_z
    out[w1_start:w1_end, 10] = np.sqrt(
        out[w1_start:w1_end, 0]**2 +
        out[w1_start:w1_end, 1]**2 +
        out[w1_start:w1_end, 2]**2
    ) * 1.1
    labels[w1_start:w1_end, [0, 1, 2, 3, 10]] = 1.0
    windows.append({
        "name": "gearbox_wear", "start": w1_start, "end": w1_end,
        "channels": [0, 1, 2, 3, 10],
        "description": "Gradual gearbox degradation with oil temp drift and vibration increase",
    })

    # Fault 2: Bearing fault (intermittent) — 42-55% of test
    w2_start = int(n_steps * 0.42)
    w2_end = int(n_steps * 0.55)
    burst_period = rng.integers(30, 60)
    for t_idx in range(w2_start, w2_end, burst_period):
        burst_len = min(rng.integers(5, 15), w2_end - t_idx)
        spike_mag = rng.uniform(3.0, 6.0) * np.std(test_data[:, 0])
        for ch in [0, 1, 2]:
            out[t_idx:t_idx + burst_len, ch] += rng.normal(spike_mag, spike_mag * 0.2, burst_len)
    out[w2_start:w2_end, 10] = np.sqrt(
        out[w2_start:w2_end, 0]**2 +
        out[w2_start:w2_end, 1]**2 +
        out[w2_start:w2_end, 2]**2
    ) * 1.1
    labels[w2_start:w2_end, [0, 1, 2, 10]] = 1.0
    windows.append({
        "name": "bearing_fault", "start": w2_start, "end": w2_end,
        "channels": [0, 1, 2, 10],
        "description": "Intermittent high-frequency vibration bursts from bearing defect",
    })

    # Fault 3: Yaw misalignment (gradual) — 65-80% of test
    w3_start = int(n_steps * 0.65)
    w3_end = int(n_steps * 0.80)
    ramp3 = np.linspace(0.0, 1.0, w3_end - w3_start)
    power_loss_frac = rng.uniform(0.15, 0.30)
    out[w3_start:w3_end, 6] *= (1.0 - ramp3 * power_loss_frac)  # power_output
    out[w3_start:w3_end, 8] += ramp3 * rng.uniform(8.0, 20.0)  # wind_direction offset
    # Recompute power residual
    expected_power = _wind_power_curve(out[w3_start:w3_end, 7])
    out[w3_start:w3_end, 11] = out[w3_start:w3_end, 6] - expected_power
    labels[w3_start:w3_end, [6, 8, 11]] = 1.0
    windows.append({
        "name": "yaw_misalignment", "start": w3_start, "end": w3_end,
        "channels": [6, 8, 11],
        "description": "Yaw misalignment causing power output below expected curve",
    })

    return out, labels, windows


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate synthetic solar/wind telemetry for UTAU predictive maintenance"
    )
    parser.add_argument("--domain", required=True, choices=["solar", "wind"])
    parser.add_argument("--assets", type=int, default=3, help="Number of simulated assets (default: 3)")
    parser.add_argument("--train-steps", type=int, default=12000)
    parser.add_argument("--test-steps", type=int, default=6000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--write-checkpoint", action="store_true")
    args = parser.parse_args()

    domain = args.domain
    n_assets = max(1, args.assets)
    train_steps = max(2000, args.train_steps)
    test_steps = max(2000, args.test_steps)
    base_seed = args.seed

    if domain == "solar":
        n_features = _SOLAR_N_FEATURES
        gen_fn = _solar_baseline
        fault_fn = _solar_inject_faults
    else:
        n_features = _WIND_N_FEATURES
        gen_fn = _wind_baseline
        fault_fn = _wind_inject_faults

    ds_name = f"{domain}_synthetic"

    all_train = []
    all_test = []
    all_labels = []
    all_fault_windows = []
    asset_ranges = []

    total_steps = train_steps + test_steps

    for asset_idx in range(n_assets):
        asset_id = f"{domain}_asset_{asset_idx:02d}"
        rng = np.random.default_rng(base_seed + asset_idx)
        print(f"  Generating {asset_id} ({total_steps} steps, {n_features} features)...")

        full_data = gen_fn(total_steps, rng)
        train_raw = full_data[:train_steps]
        test_nominal = full_data[train_steps:]

        rng_fault = np.random.default_rng(base_seed + asset_idx + 1000)
        test_faulted, labels, fault_windows = fault_fn(test_nominal, rng_fault)

        all_train.append(train_raw)
        all_test.append(test_faulted)
        all_labels.append(labels)

        train_offset = asset_idx * train_steps
        test_offset = asset_idx * test_steps
        asset_ranges.append({
            "asset_id": asset_id,
            "asset_index": asset_idx,
            "train_row_range": [train_offset, train_offset + train_steps],
            "test_row_range": [test_offset, test_offset + test_steps],
        })

        for w in fault_windows:
            w["asset_id"] = asset_id
            w["asset_index"] = asset_idx
            w["global_start"] = test_offset + w["start"]
            w["global_end"] = test_offset + w["end"]
        all_fault_windows.extend(fault_windows)

    # Concatenate all assets
    train_concat = np.concatenate(all_train, axis=0)
    test_concat = np.concatenate(all_test, axis=0)
    labels_concat = np.concatenate(all_labels, axis=0)

    # Normalize using train statistics
    train_scaled, test_scaled = _scale_with_train_stats(train_concat, test_concat)
    labels_scaled = labels_concat  # labels are 0/1, don't scale

    # Output paths
    proc_dir = Path(f"processed/{ds_name}")
    data_dir = Path(f"data/{ds_name}")
    ckpt_path = Path(f"checkpoints/STP_TranAD_{ds_name}/model.ckpt")

    proc_dir.mkdir(parents=True, exist_ok=True)
    data_dir.mkdir(parents=True, exist_ok=True)

    train_path = proc_dir / "train.npy"
    test_path = proc_dir / "test.npy"
    labels_path = proc_dir / "labels.npy"
    fault_labels_path = data_dir / "fault_labels.json"
    meta_path = data_dir / "meta.json"

    np.save(train_path, train_scaled.astype(np.float64))
    np.save(test_path, test_scaled.astype(np.float64))
    np.save(labels_path, labels_scaled.astype(np.float64))

    # Ground-truth fault labels
    fault_labels = {
        "domain": domain,
        "n_assets": n_assets,
        "n_features": n_features,
        "train_steps_per_asset": train_steps,
        "test_steps_per_asset": test_steps,
        "asset_ranges": asset_ranges,
        "fault_windows": all_fault_windows,
    }
    with open(fault_labels_path, "w", encoding="utf-8") as f:
        json.dump(fault_labels, f, indent=2)

    # Checkpoint
    checkpoint_message = None
    if args.write_checkpoint:
        checkpoint_message = _write_compat_checkpoint(ckpt_path, n_features)

    # Metadata
    anomalous_points = int(np.sum(labels_scaled.max(axis=1) > 0))
    total_test_points = labels_scaled.shape[0]

    meta = {
        "description": f"Synthetic {domain} telemetry for UTAU predictive maintenance",
        "domain": domain,
        "n_features": n_features,
        "n_assets": n_assets,
        "sampling_hz": 1,
        "train_steps_per_asset": train_steps,
        "test_steps_per_asset": test_steps,
        "total_train_rows": train_scaled.shape[0],
        "total_test_rows": test_scaled.shape[0],
        "asset_ranges": asset_ranges,
        "fault_windows": all_fault_windows,
        "summary": {
            "test_anomalous_points": anomalous_points,
            "test_anomalous_ratio": round(anomalous_points / max(1, total_test_points), 4),
        },
        "outputs": {
            "train_npy": str(train_path),
            "test_npy": str(test_path),
            "labels_npy": str(labels_path),
            "fault_labels_json": str(fault_labels_path),
            "checkpoint": str(ckpt_path) if args.write_checkpoint else None,
        },
        "notes": {
            "labels_format": "(total_test_rows, n_features) with 1.0 for anomalous channel/time",
            "multi_asset": f"Data for {n_assets} assets concatenated vertically; see asset_ranges for slicing",
            "checkpoint_message": checkpoint_message,
        },
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    print(f"\n{domain.upper()} synthetic dataset generated successfully")
    print(f"  train shape: {train_scaled.shape}")
    print(f"  test shape:  {test_scaled.shape}")
    print(f"  labels shape:{labels_scaled.shape}")
    print(f"  assets:      {n_assets}")
    print(f"  anomalous ratio: {meta['summary']['test_anomalous_ratio']:.2%}")
    print(f"  fault windows:   {len(all_fault_windows)}")
    print(f"  train out:  {train_path}")
    print(f"  test out:   {test_path}")
    print(f"  labels out: {labels_path}")
    print(f"  faults out: {fault_labels_path}")
    print(f"  meta out:   {meta_path}")
    if args.write_checkpoint:
        print(f"  checkpoint: {ckpt_path}")
        if checkpoint_message:
            print(f"  WARNING: {checkpoint_message}")


if __name__ == "__main__":
    main()
