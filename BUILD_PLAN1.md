# BUILD_PLAN1.md
## Adapting UTAU (Spatio-Temporal Predictive Transformer for AD) into a Solar & Wind Predictive Maintenance Platform

---

## 0. READ THIS FIRST — Rules for the coding assistant

You are working inside an **already-cloned, already-working repository**:
`UTAU-Spatio-Temporal-Predictive-Transformer-for-AD`

This is **not a greenfield project**. Do not scaffold a new backend, new frontend, or new repo structure. Do not "start over." Your job is **incremental addon work** on top of existing, working infrastructure.

**Hard rules:**
1. **Do not skip ahead.** Work through the phases below in order. Do not start Phase 3 work while "also" touching Phase 5 files. One phase, fully done and confirmed working, before the next.
2. **Do not modify files you haven't opened and read first.** Before editing any file, `view`/open it and confirm its actual current contents — do not assume a function signature, schema, or variable name from this document. This document describes intent and target behavior, not verified current source code (it was written without direct access to the private repo contents).
3. **Never delete or rewrite the existing generic IIoT anomaly pipeline.** The domain-agnostic transformer, Kafka/MQTT ingestion, WebSocket streaming, feedback/governance loop, and Copilot must keep working for the original generic dataset. Solar/wind support is **additive** — new dataset types, new feature schemas, new modules — not a replacement.
4. **After each phase, stop and report back** what was changed, what was tested, and what still needs human decision-making, before moving to the next phase.
5. **If something in this plan doesn't match what you find in the actual code** (a file doesn't exist, an endpoint is named differently, the schema is different), **stop and flag the mismatch** rather than guessing or inventing a workaround silently.
6. **Do not hallucinate library capabilities.** If unsure whether a package function exists or works a certain way, check the actual installed version/docs rather than assuming.

---

## 1. Context — What this project already is

### 1.1 What exists today (do not rebuild these)

A working full-stack real-time anomaly detection platform:

- **Edge layer**: ESP32 hardware sends telemetry over MQTT (Mosquitto broker). A `kafka_producer.py` script can also simulate synthetic datasets and push them to Kafka.
- **Ingestion**: Apache Kafka (`telemetry-stream` topic) receives sensor data, either from real ESP32 hardware or from the synthetic simulator.
- **AI engine**: A custom **Spatio-Temporal Predictive Transformer** (built on/extending TranAD, lives in `TranAD-main/`), written in PyTorch. It produces a **fused anomaly score** combining:
  - reconstruction loss
  - forecasting error
  - correlation-shift measurement
- **Backend**: FastAPI (`server.py` inside `TranAD-main/`), with:
  - `POST /ingest` — direct HTTP ingestion alternative to Kafka
  - `WS /ws/stream` — live WebSocket telemetry + anomaly scores to frontend
  - `GET /status` — engine state, ingestion counts, active policy
  - `POST /change_dataset` — hot-swap which dataset/model weights are active
  - `POST /feedback` — operator logs resolution/annotation to SQLite
  - `GET /api/feedback_history` — feedback log, used as context for the Copilot
  - `POST /api/whatsapp/test` — Twilio WhatsApp pager alert trigger
  - `GET /policy/suggest`, `POST /policy/apply` — RL-based adaptive threshold suggestion/override (feature-gated)
- **Storage**: SQLite for governance/feedback data, InfluxDB for time-series persistence.
- **AI Copilot**: Groq (Llama3) powered chat that explains anomalies using live system context + historical operator feedback from SQLite.
- **Frontend**: React (Vite) + Recharts + Framer Motion, in `Frontend/`. Live dashboard rendering 64+ dimensions of telemetry via WebSocket, plus a Copilot chat UI.
- **Alerting**: Twilio WhatsApp integration fires on critical threshold deviation.
- **Adaptive governance**: RL-based policy suggestions + operator feedback loop + guarded model re-calibration for concept drift.

### 1.2 What this was originally built for

Generic Industrial IoT (IIoT) anomaly detection — domain-agnostic multivariate time-series telemetry, benchmarked against SOTA anomaly detection baselines (TranAD, GDN, etc.).

### 1.3 What we are changing it into

A **predictive maintenance system for solar panel arrays and wind turbines**, per this problem statement:

> Unplanned downtime of solar panels or wind turbines causes significant energy and revenue loss, and manual inspection is slow and costly. Build a system using sensor data (vibration, temperature, current, panel soiling, etc.) to detect early signs of equipment degradation or failure. The platform should flag at-risk assets, prioritize maintenance visits, and estimate the energy/revenue loss of inaction.
> Users: solar/wind farm operators, maintenance technicians, asset management companies.

### 1.4 Why we are reusing this repo instead of building from scratch

The hard, error-prone infrastructure is already built and working: streaming ingestion, a transformer-based multi-signal anomaly fusion model, a live dashboard, an LLM explanation layer, and — most importantly — an **adaptive feedback/governance loop**, which is a genuinely rare feature (most commercial predictive maintenance platforms use static or manually-retuned thresholds). Rebuilding this would throw away real, working, differentiated engineering. The domain adaptation (solar/wind vs. generic IIoT) mostly changes **input schema, contextual normalization, and business-logic outputs** — not the core architecture.

### 1.5 What is genuinely new / must be added

1. Domain-specific input schemas for solar and wind sensor data.
2. Weather/environmental context features so the model doesn't flag normal weather-driven variation as anomalous (this was a known unsolved pain point in real-world deployments — see 1.6).
3. A synthetic solar/wind physics-based data simulator (extend the existing `kafka_producer.py` synthetic mode) so the system can be demoed without real hardware.
4. A revenue/energy-loss estimation layer downstream of the anomaly score.
5. A fleet-level, multi-asset view that ranks assets by (severity × revenue-at-risk) for maintenance prioritization.
6. Domain-aware Copilot prompting (solar/wind vocabulary, fault types, maintenance actions) instead of generic IIoT language.
7. (Stretch, later phase) Optional image-based inspection module (thermal/RGB) — a **separate model type**, not an extension of the transformer. Explicitly out of scope until the core telemetry pipeline is fully adapted.

### 1.6 Known hard problems in this domain (keep these in mind, do not silently "solve" them with overconfident claims)

- **False positives are the industry's #1 unsolved trust problem** in predictive maintenance for wind/solar — caused by rare failure events (imbalanced data) and highly variable operating conditions (wind speed, irradiance, temperature). The existing fused-scoring approach (reconstruction + forecast + correlation-shift) plus the feedback/RL governance loop is a legitimate mitigation — lean into it, don't claim it's "solved."
- **Weather/irradiance/wind-speed confounds** — a real anomaly (e.g., gearbox wear) and a benign condition (e.g., low wind, cloud cover) can look similar in raw sensor space. Contextual features are required so the model learns *conditional* normal behavior, not just raw thresholds.
- **No industry-standard schema** — we are defining our own schema for this project; do not try to match a specific vendor's SCADA format.
- **Root-cause attribution is hard** — the Copilot should explain *plausible* causes using context, not assert a definitive diagnosis. Keep language appropriately hedged in prompts/UI copy (e.g., "likely cause," not "confirmed cause").

---

## 2. Overall Phase Plan (high level — details in each phase section below)

| Phase | Goal | Touches |
|---|---|---|
| 0 | Repo reconnaissance — map actual file structure and confirm assumptions in this doc | Read-only |
| 1 | Define solar & wind data schemas | New schema/config files |
| 2 | Build synthetic solar/wind data simulator | New simulator script(s), extend `kafka_producer.py` |
| 3 | Adapt ingestion + model input pipeline for new schemas + contextual normalization | `server.py`, ingestion/preprocessing code, possibly model input layer |
| 4 | Train/validate model on synthetic solar & wind data, confirm fused scoring still works | Training scripts, model checkpoints |
| 5 | Build revenue/energy-loss estimation module | New backend module + endpoint |
| 6 | Build fleet-level multi-asset prioritization view | Backend endpoint(s) + new frontend view |
| 7 | Adapt Copilot prompting for solar/wind domain language | Copilot prompt/context construction code |
| 8 | Update dashboard UI copy/labels/units for solar & wind (from generic IIoT labels) | `Frontend/` |
| 9 | End-to-end integration test + demo script | All layers |
| 10 (stretch) | Image-based inspection module (thermal/RGB) — separate track | New module, isolated from core pipeline |

**Do not proceed to a phase until the previous phase is confirmed working and reported back.**

---

## 3. Phase 0 — Repo Reconnaissance (do this before writing any code)

**Goal:** Build an accurate map of the actual repo so later phases don't guess wrong.

Steps:
1. List the full directory tree of the repo (`Frontend/`, `TranAD-main/`, `assets/`, root files).
2. Open and read `TranAD-main/server.py` in full. Document:
   - Actual endpoint implementations (confirm they match section 1.1 above; note any differences).
   - How `/ingest` and the Kafka consumer parse incoming telemetry (what shape/schema is currently expected — field names, number of dimensions, dtypes).
   - How `/change_dataset` selects a dataset and loads model weights (what determines "dataset type" — a string key? a folder path? a config file?).
3. Open and read the model definition inside `TranAD-main/` (the Spatio-Temporal Transformer implementation). Document:
   - Expected input tensor shape (window length, number of features/channels).
   - Where the fused score (reconstruction + forecasting + correlation-shift) is computed.
   - Whether feature count is hardcoded anywhere (this matters — solar/wind schemas will likely have a different number of channels than the current generic IIoT dataset).
4. Open `kafka_producer.py`. Document:
   - How `--dataset synthetic` currently generates data (what distribution/pattern, how many channels, how anomalies are injected if at all).
5. Open the SQLite schema (feedback/governance tables) and the InfluxDB write logic. Document field names and types.
6. Open `Frontend/` structure — identify which component(s) render the live dashboard, which handle the WebSocket connection, and which render the Copilot chat, so later UI work touches the right files.
7. Open `context.md` and `something.txt` in the repo root — read their actual contents (their purpose isn't documented in the README; they may contain useful prior notes or may be scratch files — determine which before assuming either way).
8. **Report back**: a short written summary of actual findings, and explicitly flag anywhere this BUILD_PLAN1.md's assumptions (section 1.1) turned out to be wrong or incomplete.

**Stop here and wait for confirmation before Phase 1.**

---

## 4. Phase 1 — Define Solar & Wind Data Schemas

**Goal:** Decide the exact sensor fields for each asset type, as plain config/schema files, before touching any pipeline code.

### 4.1 Solar panel array schema (per inverter/string or per panel — decide granularity based on Phase 0 findings on current channel-count handling)

Proposed fields (adjust based on what Phase 0 reveals about model input flexibility):
- `timestamp`
- `asset_id` (which panel/string/site)
- `dc_voltage` (V)
- `dc_current` (A)
- `ac_power_output` (kW)
- `module_temperature` (°C)
- `ambient_temperature` (°C)
- `irradiance` (W/m²) — **contextual feature**, critical for normalizing expected output
- `soiling_index` (0–1 estimate, or proxy via power-output-vs-expected ratio if no dedicated soiling sensor exists)
- `inverter_status_code` (categorical/enum, if available)

### 4.2 Wind turbine schema

Proposed fields:
- `timestamp`
- `asset_id` (turbine ID)
- `vibration_x`, `vibration_y`, `vibration_z` (accelerometer axes) — or a single vibration magnitude if only one sensor axis is simulated initially
- `gearbox_oil_temperature` (°C)
- `generator_temperature` (°C)
- `rotor_rpm`
- `wind_speed` (m/s) — **contextual feature**, critical for normalizing expected power output
- `wind_direction` (degrees, optional)
- `power_output` (kW)
- `nacelle_vibration_rms` (optional, if simulating a second vibration signal)

### 4.3 Deliverable for this phase

- A schema definition file per asset type (e.g., `schemas/solar_schema.json` and `schemas/wind_schema.json`, or Python dataclasses/pydantic models — pick whichever matches the existing code style found in Phase 0).
- Explicitly mark which fields are **contextual/environmental** (irradiance, wind speed, ambient temp) vs. **asset-health signals** (vibration, temperature, current) — this distinction matters for Phase 3's normalization logic.
- No pipeline code changes yet. This phase is schema definition only.
- **Report back** the finalized schemas for confirmation before Phase 2.

---

## 5. Phase 2 — Synthetic Solar & Wind Data Simulator

**Goal:** Extend the existing synthetic data generation path so the system can be demoed end-to-end without real hardware, using physically plausible solar/wind behavior with injectable faults.

Steps:
1. Based on Phase 0 findings on `kafka_producer.py`'s current `--dataset synthetic` mode, add new dataset modes: `--dataset solar_synthetic` and `--dataset wind_synthetic`.
2. **Solar simulator logic:**
   - Model expected `ac_power_output` as a function of `irradiance` and `module_temperature` (simple physics approximation is fine — e.g., a basic single-diode-model approximation or even a calibrated linear/polynomial fit is acceptable for a demo; do not over-engineer this).
   - Add a diurnal irradiance curve (sinusoidal or similar, zero at night, peak at midday) plus cloud-cover noise.
   - Inject fault patterns as time-windowed deviations from expected behavior:
     - **Soiling**: gradual, slow decline in power output relative to expected (over many simulated days).
     - **Hotspot/cell degradation**: localized temperature spike + power drop.
     - **Inverter fault**: sudden power drop to near-zero for a string/asset while others remain normal.
3. **Wind simulator logic:**
   - Model expected `power_output` as a function of `wind_speed` using a simplified turbine power curve (cubic relationship below rated wind speed, flat above rated speed, per typical published wind turbine power curve shapes — Phase 0/research this shape rather than inventing arbitrary numbers).
   - Inject fault patterns:
     - **Gearbox wear**: gradual upward drift in `gearbox_oil_temperature` and/or vibration RMS, uncorrelated with load.
     - **Bearing fault**: vibration spikes at specific frequency bands (simplified: injected periodic high-frequency noise bursts) independent of wind speed/RPM.
     - **Yaw misalignment**: power output below the expected power curve for a given wind speed, without a corresponding sensor fault (this is a "soft" anomaly — good test case for the fused scoring approach).
4. Both simulators must support multiple simulated `asset_id`s running concurrently (so Phase 6's fleet view has something to rank).
5. Each simulator run should log **ground-truth fault labels** (what fault was injected, when) to a local file — this is essential for Phase 4 evaluation (precision/recall against known ground truth), and for later demo narration ("the system caught the injected gearbox fault X minutes after onset").
6. **Report back**: sample output data, a plot or printed summary showing normal vs. faulted periods, before proceeding to Phase 3.

---

## 6. Phase 3 — Adapt Ingestion & Preprocessing Pipeline

**Goal:** Make the existing ingestion path (`/ingest`, Kafka consumer, `/change_dataset`) accept the new solar/wind schemas, and add contextual normalization so weather/environmental variation isn't flagged as anomalous.

Steps:
1. Based on Phase 0's documented current ingestion parsing logic, add schema-aware parsing: when `dataset_type` (or however `/change_dataset` identifies the active dataset — confirm exact mechanism from Phase 0) is `solar` or `wind`, validate/parse incoming records against the Phase 1 schemas.
2. **Contextual normalization** — this is the key new logic:
   - For solar: compute an "expected power output" from `irradiance` + `module_temperature` using the same simplified model from Phase 2's simulator (or a lightweight learned regression, if time allows — simulator-derived formula is sufficient for v1). Feed the **residual** (actual − expected) as an additional derived feature into the model, alongside raw sensor values — do not just feed raw irradiance/power_output and hope the transformer learns the relationship implicitly, since that increases false-positive risk under limited training data.
   - For wind: same approach using the wind power curve — derive an expected-power residual feature from `wind_speed` + `power_output`.
   - Confirm with Phase 0 findings whether the model's input feature count is hardcoded (likely yes, given a fixed transformer input dimension) — if so, this phase must also produce a config change for feature count per dataset type, not just new fields silently appended.
3. Confirm `/status` endpoint correctly reports which dataset type (`generic` / `solar` / `wind`) is currently active.
4. **Do not touch the original generic IIoT dataset path.** It must continue working unmodified — test this explicitly after changes.
5. **Report back**: confirm ingestion works for solar synthetic data, wind synthetic data, and the original generic dataset, with a quick before/after check that generic-dataset behavior is unchanged.

---

## 7. Phase 4 — Model Training/Validation on Solar & Wind Data

**Goal:** Confirm the existing transformer architecture (with contextual residual features added) trains successfully and produces sensible fused anomaly scores on the new synthetic data, using the ground-truth fault labels from Phase 2 to sanity-check.

Steps:
1. Train (or fine-tune, if the architecture allows transfer from the generic-trained weights — check Phase 0 findings on how model weights/checkpoints are organized per dataset) separate model weights for `solar` and `wind` datasets, using the Phase 2 synthetic data.
2. Confirm training converges (loss curves look sane — no need for exhaustive hyperparameter tuning at this stage).
3. Run the trained model against a held-out synthetic test set with known injected faults (from Phase 2's ground-truth labels). Compute basic precision/recall/F1 against those labels.
4. **Be honest in reporting these numbers.** Do not claim high accuracy without actually computing it against ground truth. If false-positive rate is high, report it as-is — this is expected and matches known real-world difficulty (see section 1.6); the next phases (feedback loop, contextual features) are the mitigation, not a guarantee of near-zero false positives.
5. Confirm the existing `/change_dataset` hot-swap mechanism correctly loads the new solar/wind weights when requested.
6. **Report back**: training results, precision/recall numbers on synthetic ground truth, and honest notes on any weak points (e.g., "soft" anomalies like yaw misalignment are harder to detect than "hard" faults like inverter cutoff — expect and report this if it happens).

---

## 8. Phase 5 — Revenue / Energy-Loss Estimation Module

**Goal:** Add a new backend module that converts anomaly detections into estimated $/energy impact — this is a core requirement from the original problem statement and is currently missing from the repo.

Steps:
1. Create a new module (e.g., `TranAD-main/revenue_loss.py` or similar, matching existing code organization found in Phase 0).
2. Logic:
   - Use the same "expected output" model from Phase 3 (irradiance/wind-speed-based expected power) as the baseline.
   - `energy_loss_kWh = max(0, expected_power_output − actual_power_output) × time_interval_hours`, accumulated over the duration an anomaly has been active.
   - `revenue_loss = energy_loss_kWh × price_per_kWh` (make `price_per_kWh` a configurable parameter, not hardcoded — different operators have different tariffs/PPAs).
   - Only attribute loss to periods where the anomaly score exceeds the active threshold (don't attribute normal operating variance as "loss").
3. Add a new endpoint, e.g. `GET /api/revenue_loss/{asset_id}` returning cumulative and current-rate loss estimates, and/or extend the existing `/status` or WebSocket payload to include this per-asset.
4. Persist running loss totals per asset (SQLite, matching existing governance DB pattern found in Phase 0, or InfluxDB alongside time-series data — pick based on what Phase 0 reveals is more consistent with existing patterns).
5. **Report back**: sample output showing an injected fault (from Phase 2 test data) producing a plausible, correctly-scaled revenue loss estimate. Sanity-check the numbers manually (e.g., "a 2kW deficit for 3 hours at $0.12/kWh should be ~$0.72," confirm the module outputs something in that ballpark for an equivalent test case).

---

## 9. Phase 6 — Fleet-Level Multi-Asset Prioritization View

**Goal:** Add a view that ranks multiple assets by urgency, combining anomaly severity and revenue-at-risk — directly serving the "prioritize maintenance visits" requirement.

Steps:
1. Backend: new endpoint, e.g. `GET /api/fleet/summary`, returning a list of all active assets with: current anomaly score, dataset type (solar/wind), cumulative + current-rate revenue loss (from Phase 5), and a computed **priority score** (e.g., a simple weighted combination — document the exact formula chosen, keep it simple and explainable, e.g. `priority = normalized_anomaly_score × 0.5 + normalized_revenue_rate × 0.5`, adjustable).
2. Frontend: new dashboard view/page listing assets sorted by priority score, showing asset ID, type, current status, anomaly score, and revenue-at-risk — a table or card-list view (match existing frontend component style found in Phase 0).
3. Clicking/selecting an asset in this view should route to (or reuse) the existing single-asset live telemetry dashboard.
4. Ensure this view updates live (via existing WebSocket pattern, or polling `/api/fleet/summary` on an interval — pick based on what's simpler given current frontend architecture from Phase 0).
5. **Report back**: screenshot or description of the fleet view working with Phase 2's multiple simulated assets, confirming sorting/prioritization behaves sensibly (an asset with a high, sustained anomaly score and high revenue-at-risk should rank above a low-severity blip).

---

## 10. Phase 7 — Copilot Domain Adaptation

**Goal:** Update the Groq/Llama3 Copilot's prompting/context construction so it speaks in solar/wind maintenance terms rather than generic IIoT language, and appropriately hedges root-cause claims.

Steps:
1. Locate the Copilot's prompt-construction code (from Phase 0 findings).
2. Add dataset-type-aware context injection: when the active dataset is `solar` or `wind`, include:
   - The asset schema field meanings (so the LLM knows what `gearbox_oil_temperature` or `irradiance` means).
   - A short list of common fault types for that asset type (soiling, hotspot, inverter fault / gearbox wear, bearing fault, yaw misalignment) so the Copilot can reason toward plausible explanations rather than generic ones.
   - The current revenue-loss estimate (from Phase 5) so the Copilot can discuss business impact, not just technical anomaly description, when asked.
3. Explicitly prompt the model to hedge causal claims (e.g., instruct it to say "this pattern is consistent with X" rather than "this is caused by X," given root-cause attribution is a known hard, unsolved problem — see section 1.6).
4. Test the Copilot against a few of Phase 2's known injected-fault scenarios and confirm its explanations are domain-plausible (a gearbox-wear scenario should not produce a solar-soiling explanation).
5. **Report back**: sample Copilot conversation transcripts for at least one solar fault scenario and one wind fault scenario.

---

## 11. Phase 8 — Dashboard UI/Copy Updates

**Goal:** Update frontend labels, units, and terminology from generic IIoT language to solar/wind-appropriate language, without restructuring the component architecture.

Steps:
1. Update chart axis labels/units to match Phase 1 schemas (°C, kW, m/s, W/m², etc.) per active dataset type.
2. Update any generic "sensor 1 / sensor 2..." style labels to the actual field names from the schema (`gearbox_oil_temperature`, `irradiance`, etc.).
3. Add a dataset-type indicator/switcher in the UI (solar / wind / generic) that calls the existing `/change_dataset` endpoint.
4. Integrate the Phase 6 fleet view into the navigation.
5. Integrate Phase 5's revenue-loss numbers into the existing single-asset dashboard view (a simple stat card is sufficient — no need for elaborate new visualizations at this stage).
6. **Report back**: confirm the UI cleanly switches between dataset types and displays correct units/labels for each.

---

## 12. Phase 9 — End-to-End Integration Test + Demo Script

**Goal:** Verify the whole system works together, and produce a repeatable demo sequence.

Steps:
1. Run the full stack (Kafka, MQTT if used, backend, frontend) with Phase 2's solar simulator active.
2. Confirm: data flows in → anomaly scores compute → (when a fault is injected) alert fires (including WhatsApp/Twilio, if configured) → revenue loss accumulates → fleet view reflects the asset's rising priority → Copilot can explain the event when asked → operator feedback via `/feedback` is logged and reflected in future Copilot context.
3. Repeat for the wind simulator.
4. Confirm the original generic IIoT dataset path still works, unaffected (regression check).
5. Write a short `DEMO_SCRIPT.md` (separate file) documenting the exact sequence of actions to run for a live demo (which commands to run, what to click, what to point out, in what order) — this is for presentation purposes, not for the coding assistant to execute.
6. **Report back**: confirmation that the full loop works for solar, wind, and the original generic dataset.

---

## 13. Phase 10 (Stretch, Later, Separate Track) — Image-Based Inspection Module

**Explicitly out of scope until Phases 0–9 are complete and confirmed working.**

This would add thermal/RGB image classification (drone or static camera imagery) for solar panel soiling/hotspot detection, as a **separate model** (CNN-based image classifier, not the time-series transformer) feeding into the same fleet prioritization and revenue-loss logic as an additional signal source. Do not begin scoping this until explicitly instructed after Phase 9 is done — flag it as future work in any demo/writeup instead.

---

## 14. Reporting Format (use this after every phase)

At the end of each phase, report back in this format:

```
### Phase N complete: [phase name]

**Changed/added files:**
- ...

**What was tested:**
- ...

**Results/output (numbers, sample data, screenshots as applicable):**
- ...

**Deviations from BUILD_PLAN1.md (if any):**
- ...

**Open questions / decisions needed before next phase:**
- ...
```

Do not proceed to the next phase until this report has been reviewed.
