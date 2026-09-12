# UTAU – Spatio-Temporal Predictive Transformer for Predictive Maintenance
**Solar & Wind Turbine · Generic IIoT · Real-Time Streaming · AI Copilot · ESP32 Integration**

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![PyTorch](https://img.shields.io/badge/PyTorch-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-000000?style=for-the-badge&logo=groq&logoColor=white)
![Kafka](https://img.shields.io/badge/Apache_Kafka-231F20?style=for-the-badge&logo=apache-kafka&logoColor=white)

**Features** • **Demo** • **Installation** • **Architecture** • **API**

---

## 🏗️ Architecture Diagram

**System Architecture**
Our custom Neural Network architecture outperforms SOTA baseline architectures like TranAD, GDN, etc., for time-series anomaly detection.

![Architecture Diagram](assets/UTAU_NN_arch.png)

---

## 🖼️ UI Screenshots & Features

### 1. Command Center & Dashboard
**Homeland Gateway**
A high-tech, industrial-grade landing experience acting as the gateway to your live sensor hub.
![Command Center](assets/home.png)

### 2. Live Telemetry Analytics
**Real-Time Dashboarding**
Track real-time anomalies, fused scoring, and correlation shifts simultaneously across synthetic datasets or live hardware.
<table>
  <tr>
    <td><img src="assets/dash1.png" alt="Dashboard View 1"/></td>
    <td><img src="assets/dash2.png" alt="Dashboard View 2"/></td>
  </tr>
  <tr>
    <td><img src="assets/dash3.png" alt="Dashboard View 3"/></td>
    <td><img src="assets/dash4.png" alt="Dashboard View 4"/></td>
  </tr>
</table>

### 3. UTAU AI Copilot
**Cybernetic Agent Assistant**
Interact directly with your anomaly data using an advanced AI Copilot backed by Groq or OpenAI LLMs. Ask for diagnostic insights, get structured Standard Operating Procedure (SOP) suggestions per anomaly event, analyze historical operator feedback, and request active mitigation strategies — all domain-aware for solar, wind, or generic IIoT contexts.
![AI Copilot](assets/chat.png)

### 4. SOTA Benchmark Scores
**Performance Proof**
Empirically validated performance against industry standard datasets.
![Benchmark Scores](assets/scores.png)

---

## 🎯 System Overview

This project is a State-of-the-Art (SOTA) streaming anomaly detection platform built around a novel **Spatio-Temporal Predictive Transformer**. Originally built for generic Industrial IoT (IIoT) anomaly detection, it has been extended into a **predictive maintenance system for solar panel arrays and wind turbines** — while keeping the original generic IIoT pipeline fully intact.

It bridges the gap between raw hardware telemetry (ESP32 or SCADA) and high-level autonomous governance, providing a closed-loop system for predicting, explaining, and mitigating equipment failure across multiple asset domains simultaneously.

---

## 🚀 What It Does

- **Real-Time AI Inference**: Fused scoring combining reconstruction loss, forecasting error, and correlation-shift measurements via PyTorch.
- **Solar & Wind Predictive Maintenance**: Domain-specific schemas, physics-based synthetic data simulators, and fault-type aware inference for solar panels (soiling, hotspot, inverter fault) and wind turbines (gearbox wear, bearing fault, yaw misalignment).
- **Revenue & Energy-Loss Estimation**: Quantifies the financial cost of each ongoing anomaly in real-time — expected vs. actual power output tracked per asset, converted to USD at a configurable tariff rate.
- **Fleet-Level Prioritization View**: Multi-asset dashboard ranking assets by `anomaly severity × revenue risk` so maintenance teams know which unit to act on first.
- **UTAU AI Copilot (SOP Generator)**: Groq/OpenAI-backed LLM generates structured Standard Operating Procedures per anomaly event, with domain-aware context (field meanings, fault types, revenue impact) and appropriately hedged root-cause language.
- **WhatsApp Pager Alerts**: Built-in Twilio integration immediately alerts operators via WhatsApp when critical threshold deviations occur.
- **ESP32 Edge Integration**: End-to-end hardware pipeline from physical ESP32 sensors over MQTT to Kafka to the neural network backend.
- **Live WebSocket Engine**: The React UI renders fast, high-density graphs updating dynamically without refreshing — 64 dimensions in generic/synthetic mode, domain-specific fields (10 for solar, 12 for wind) in predictive maintenance mode.
- **Adaptive Policy Governance**: RL suggestion loop, operator feedback, guarded model re-calibration, and rollback controls to adapt to concept drift without auto-applying unsafe changes.
- **Data Source Registry**: Register, manage, and health-check multiple named ingestion sources (HTTP, Kafka, MQTT) directly from the dashboard UI.

---

## 🌞🌬️ Solar & Wind Predictive Maintenance

### Supported Domains

| Domain | Dataset Key | Features | Fault Types |
|---|---|---|---|
| Solar Panel Array | `solar_synthetic` | 10 | Soiling, Hotspot/Cell Degradation, Inverter Fault |
| Wind Turbine | `wind_synthetic` | 12 | Gearbox Wear, Bearing Fault, Yaw Misalignment |
| Generic IIoT | `synthetic`, `SMD`, `MSL`, `SMAP`, `ESP32` | 38–64 | Generic multivariate anomalies |

### Solar Schema (`schemas/solar_schema.json` — 10 features)

| Index | Field | Unit | Category |
|---|---|---|---|
| 0 | `dc_voltage` | V | health |
| 1 | `dc_current` | A | health |
| 2 | `ac_power_output` | kW | health |
| 3 | `module_temperature` | °C | health |
| 4 | `ambient_temperature` | °C | contextual |
| 5 | `irradiance` | W/m² | contextual |
| 6 | `soiling_index` | 0–1 | health |
| 7 | `inverter_efficiency` | % | health |
| 8 | `power_residual` | kW | derived |
| 9 | `temperature_delta` | °C | derived |

### Wind Schema (`schemas/wind_schema.json` — 12 features)

| Index | Field | Unit | Category |
|---|---|---|---|
| 0 | `vibration_x` | g | health |
| 1 | `vibration_y` | g | health |
| 2 | `vibration_z` | g | health |
| 3 | `gearbox_oil_temperature` | °C | health |
| 4 | `generator_temperature` | °C | health |
| 5 | `rotor_rpm` | RPM | health |
| 6 | `power_output` | kW | health |
| 7 | `wind_speed` | m/s | contextual |
| 8 | `wind_direction` | ° | contextual |
| 9 | `ambient_temperature` | °C | contextual |
| 10 | `nacelle_vibration_rms` | g | health |
| 11 | `power_residual` | kW | derived |

> **Contextual features** (irradiance, wind speed, ambient temperature) are used to compute expected power output. The `power_residual` (actual − expected) is a derived feature fed into the model so the transformer learns *conditional* normal behavior, not raw thresholds — the key mitigation for weather-driven false positives.

### Generating Synthetic Solar / Wind Data

```bash
cd TranAD-main

# Generate solar dataset (3 simulated assets, with injectable faults)
python generate_solar_wind_synthetic.py --domain solar --assets 3 --write-checkpoint

# Generate wind dataset (3 simulated assets, with injectable faults)
python generate_solar_wind_synthetic.py --domain wind --assets 3 --write-checkpoint
```

**Outputs (solar example):**
- `processed/solar_synthetic/train.npy`, `test.npy`, `labels.npy`
- `data/solar_synthetic/meta.json` (asset fleet map — required for fleet view)
- `checkpoints/STP_TranAD_solar_synthetic/model.ckpt` (if `--write-checkpoint`)
- Ground-truth fault label file for precision/recall evaluation

### Switching Domains at Runtime

```bash
# Switch to solar mode
curl -X POST http://127.0.0.1:8000/change_dataset \
  -H "Content-Type: application/json" \
  -d "{\"dataset\": \"solar_synthetic\"}"

# Switch to wind mode
curl -X POST http://127.0.0.1:8000/change_dataset \
  -H "Content-Type: application/json" \
  -d "{\"dataset\": \"wind_synthetic\"}"

# Switch back to generic 64-signal synthetic
curl -X POST http://127.0.0.1:8000/change_dataset \
  -H "Content-Type: application/json" \
  -d "{\"dataset\": \"synthetic\"}"
```

The frontend also exposes a dataset/domain switcher tab that calls this endpoint directly.

---

## 📊 Performance & Technologies

### Component Breakdown
```
┌─────────────────────────────────────────────────────────────┐
│  USER DASHBOARD: "Interactive Web UI & Operator Panels"     │
│  - Live Telemetry · Fleet View · Copilot · Data Sources     │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼ (WebSockets / HTTP)
┌─────────────────────────────────────────────────────────────┐
│  FASTAPI SERVICES (Python)                                  │
│  - WebSocket Live Stream Telemetry Sync                     │
│  - Domain-Aware Policy Governance & Model Hot-Swapping      │
│  - Revenue/Energy-Loss Estimation per Asset                 │
│  - Fleet Prioritization (Anomaly x Revenue Risk)            │
│  - Twilio WhatsApp Integration (Alerts)                     │
│  - Data Source Registry (HTTP / Kafka / MQTT)               │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼ (Data Feed)
┌─────────────────────────────────────────────────────────────┐
│  DATA PROCESSING / AI ENGINE                                │
│  - Custom Spatio-Temporal Transformer (PyTorch)             │
│  - Contextual Normalization (irradiance / wind-speed model) │
│  - UTAU SOP Copilot — Groq Llama3 or OpenAI GPT            │
│  - Kafka Streaming Consumer & InfluxDB Persistence          │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼ (Hardware / Ingestion)
┌─────────────────────────────────────────────────────────────┐
│  EDGE LAYER                                                 │
│  - ESP32 Hardware Telemetry via MQTT                        │
│  - Synthetic Dataset Simulators (Solar, Wind, Generic)      │
└─────────────────────────────────────────────────────────────┘
```

### Key Technologies
- **Frontend**: React (Vite), Framer Motion (premium animations), Recharts, Lucide Icons.
- **Backend**: FastAPI (Python), Uvicorn, WebSockets.
- **AI / Deep Learning**: PyTorch (STP-TranAD model), Groq or OpenAI API (SOP Copilot).
- **Messaging / Ingest**: Apache Kafka, Mosquitto (MQTT), Twilio (Alerts).
- **Storage**: SQLite (Governance/Feedback), InfluxDB (Time-series persistence).

---

## ⚙️ Installation & Setup

### Prerequisites
- Windows / Linux
- Python 3.10+ (Conda environment recommended)
- Node.js 18+
- Docker Desktop (for Kafka & InfluxDB)
- Groq API Key or OpenAI API Key (for SOP Copilot)
- Twilio API Keys (for WhatsApp pager alerts)

### 1. Infrastructure Setup
From the repository root:
```bash
# Start both Kafka and InfluxDB
docker compose up -d kafka influxdb

# Optional — for local MQTT / ESP32:
docker run -d --name catch-mosquitto -p 1883:1883 eclipse-mosquitto:2
```

### 2. Backend Setup
```bash
cd TranAD-main

# Create environment
conda create -n tranad python=3.10
conda activate tranad
pip install -r requirements.txt
```

**Start the backend (PowerShell):**
```powershell
$env:KAFKA_CONSUMER_ENABLED="true"
$env:KAFKA_BOOTSTRAP_SERVERS="127.0.0.1:29092"
$env:KAFKA_TOPIC="telemetry-stream"
python server.py
```

**Start the backend (CMD / bash):**
```bash
set KAFKA_CONSUMER_ENABLED=true
set KAFKA_BOOTSTRAP_SERVERS=127.0.0.1:29092
set KAFKA_TOPIC=telemetry-stream
python server.py
```

*The API runs on http://127.0.0.1:8000*

*(Optional) Start Kafka Data Simulator in a new terminal:*
```bash
cd TranAD-main
conda activate tranad

# Generic 64-signal synthetic
python kafka_producer.py --dataset synthetic --topic telemetry-stream --hz 2 --loop

# Solar mode (requires generate_solar_wind_synthetic.py --domain solar first)
python kafka_producer.py --dataset solar_synthetic --topic telemetry-stream --hz 2 --loop

# Wind mode (requires generate_solar_wind_synthetic.py --domain wind first)
python kafka_producer.py --dataset wind_synthetic --topic telemetry-stream --hz 2 --loop
```

*(Optional) Enable InfluxDB persistence — PowerShell:*
```powershell
$env:INFLUX_ENABLED="true"
$env:INFLUX_URL="http://127.0.0.1:8086"
$env:INFLUX_TOKEN="catch-dev-token"
$env:INFLUX_ORG="catch-org"
$env:INFLUX_BUCKET="catch-telemetry"
python server.py
```

### 3. Frontend Setup
```bash
cd Frontend
npm install
npm run dev
```
*The App runs on http://localhost:5173*

---

## 🔌 API Endpoints

### Core Streaming & Model Ops
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/ingest` | Direct HTTP telemetry ingestion (alternative to Kafka) |
| `WS` | `/ws/stream` | Live WebSocket: telemetry vectors, fused scores, anomaly payloads |
| `GET` | `/status` | Full engine state: ingest stats, scoring, governance, Kafka, InfluxDB, revenue loss |
| `POST` | `/change_dataset` | Hot-swap active dataset/model (`synthetic`, `solar_synthetic`, `wind_synthetic`, `SMD`, `ESP32`, etc.) |
| `POST` | `/calibrate` | Guarded model recalibration from operator-confirmed window |

### Anomaly Investigation
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/anomalies` | List anomaly events — filters: `dataset`, `severity_min`, `anomaly_type`, `limit`, `offset` |
| `GET` | `/anomalies/{anomaly_id}` | Full detail for a specific anomaly event |
| `GET` | `/anomalies/{anomaly_id}/source` | Anomaly source breakdown: contributor weights, correlation-shift pairs |
| `POST` | `/anomalies/{anomaly_id}/sop` | Generate LLM-backed Standard Operating Procedure (Groq or OpenAI, rule-based fallback) |
| `GET` | `/anomalies/{anomaly_id}/sop/history` | All prior SOPs generated for this anomaly event |

### Governance & Notifications
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/feedback` | Log operator resolution & annotation to SQLite |
| `GET` | `/feedback/summary` | Feedback counters (total / confirmed / dismissed) + recent entries |
| `GET` | `/api/feedback_history` | Recent feedback entries used as LLM Copilot context |
| `GET` | `/retrain/plan` | Drift state + current retrain recommendation |
| `POST` | `/retrain/mark_applied` | Acknowledge a retrain cycle as applied |
| `POST` | `/api/retrain` | Manually trigger a background fine-tuning cycle |
| `POST` | `/api/anomaly/trigger` | Force next N inference ticks to be flagged anomalous (demo / testing) |
| `POST` | `/api/whatsapp/test` | Trigger Twilio WhatsApp pager alert |
| `GET` | `/api/whatsapp/status` | Twilio configuration state and cooldown remaining |

### Domain & Revenue
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/domain_context` | Active domain schema, fault types, asset label, and revenue aggregate |
| `GET` | `/api/revenue_loss` | All-asset revenue/energy-loss summary (total kWh deficit, total USD loss) |
| `GET` | `/api/revenue_loss/{asset_id}` | Single-asset cumulative and current-rate loss |
| `GET` | `/api/fleet/summary` | Fleet prioritization: all assets ranked by anomaly severity x revenue risk |

### Data Source Registry
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/sources` | List all registered data sources with active/enabled state |
| `POST` | `/sources` | Register a new data source (HTTP, Kafka, MQTT) |
| `PATCH` | `/sources/{source_id}` | Update source configuration |
| `GET` | `/sources/{source_id}/health` | Connectivity health check for a source |
| `POST` | `/sources/{source_id}/mapping/validate` | Validate a sample payload against source field mapping |

### RL Policy (Feature Gated — `FEATURE_RL_POLICY_SUGGESTIONS=true`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/policy/suggest` | Generate a threshold adjustment suggestion via RL — suggestion only, never auto-applied |
| `POST` | `/policy/reward` | Record operator reward for a prior suggestion (updates Q-value) |
| `GET` | `/policy/stats` | Q-table and action history statistics |
| `POST` | `/policy/apply` | Apply a suggestion with mode: `dry_run` / `canary` / `force` (guarded — delta limits + canary replay check) |
| `POST` | `/policy/rollback` | Restore the previous policy snapshot |
| `GET` | `/policy/history` | Audit log of all apply and rollback events |

---

## 🔧 Environment Variable Reference

### Kafka
| Variable | Default | Description |
|---|---|---|
| `KAFKA_CONSUMER_ENABLED` | `false` | Enable Kafka consumer |
| `KAFKA_BOOTSTRAP_SERVERS` | `127.0.0.1:29092` | Broker address |
| `KAFKA_TOPIC` | `telemetry-stream` | Topic to consume |
| `KAFKA_GROUP_ID` | `stp-tranad-consumer` | Consumer group ID |

### InfluxDB
| Variable | Default | Description |
|---|---|---|
| `INFLUX_ENABLED` | `false` | Enable InfluxDB persistence |
| `INFLUX_URL` | `http://127.0.0.1:8086` | InfluxDB endpoint |
| `INFLUX_TOKEN` | *(empty)* | Auth token |
| `INFLUX_ORG` | `catch-org` | Organisation |
| `INFLUX_BUCKET` | `catch-telemetry` | Bucket name |

### AI Copilot (SOP Generator)
| Variable | Default | Description |
|---|---|---|
| `SOP_LLM_PROVIDER` | `groq` | LLM backend: `groq` or `openai` |
| `SOP_GROQ_API_KEY` | *(empty)* | Groq API key |
| `SOP_GROQ_MODEL` | `llama-3.3-70b-versatile` | Groq model name |
| `SOP_OPENAI_API_KEY` | *(empty)* | OpenAI API key |
| `SOP_OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model name |

### Revenue Loss
| Variable | Default | Description |
|---|---|---|
| `REVENUE_PRICE_PER_KWH` | `0.12` | Electricity tariff USD/kWh (configurable per operator PPA) |
| `REVENUE_SAMPLING_INTERVAL_HOURS` | `~0.000278` (1 s) | Sample interval in hours |

### Fused Scoring
| Variable | Default | Description |
|---|---|---|
| `FUSED_WEIGHT_RECON` | `0.55` | Reconstruction loss weight |
| `FUSED_WEIGHT_FORECAST` | `0.30` | Forecasting error weight |
| `FUSED_WEIGHT_CORR` | `0.15` | Correlation-shift weight |
| `FUSED_THRESHOLD_DEFAULT` | `1.5` | Anomaly threshold before warmup |
| `FUSED_THRESHOLD_PERCENTILE` | `97.5` | Percentile for dynamic threshold post-warmup |
| `FUSED_THRESHOLD_WARMUP` | `120` | Samples before dynamic threshold activates |

### RL Policy
| Variable | Default | Description |
|---|---|---|
| `FEATURE_RL_POLICY_SUGGESTIONS` | `false` | Enable RL suggestion endpoints |
| `RL_POLICY_LEARNING_RATE` | `0.12` | Q-learning rate |
| `RL_POLICY_DISCOUNT` | `0.90` | Discount factor |
| `RL_POLICY_EPSILON` | `0.05` | Exploration epsilon |
| `POLICY_APPLY_MAX_THRESHOLD_DELTA` | `0.20` | Max allowed threshold change per apply |
| `POLICY_CANARY_MIN_POINTS` | `60` | Min history points for canary replay check |
| `POLICY_CANARY_MAX_ALERT_RATE_DELTA` | `0.20` | Max allowed alert-rate shift in canary check |

### Feature Flags
| Variable | Default | Description |
|---|---|---|
| `FEATURE_ANOMALY_SOURCE_TAB` | `true` | Enable anomaly source breakdown tab in frontend |
| `FEATURE_DATA_SOURCE_TAB` | `true` | Enable data source registry tab in frontend |

### Twilio
| Variable | Default | Description |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | *(empty)* | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | *(empty)* | Twilio auth token |
| `TWILIO_FROM_WHATSAPP` | `whatsapp:+14155238886` | Sender WhatsApp number |
| `TWILIO_TO_WHATSAPP` | *(empty)* | Comma-separated recipient numbers |
| `TWILIO_ALERT_COOLDOWN_SEC` | `30` | Minimum seconds between alerts |
| `TWILIO_MIN_SEVERITY` | `warning` | Minimum severity to alert: `info` / `warning` / `critical` |

---

## 📜 License
This project utilizes and builds upon the base TranAD implementation. Please refer to upstream TranAD publications for model attribution context. Ensure appropriate credentials are used per the LICENSE.

## 🙏 Acknowledgments
- **Groq** for high-speed anomaly explanation and SOP generation.
- **Twilio** for robust physical-world pager integration.
- Foundational Transformer time-series researchers (TranAD, VLDB 2022).
