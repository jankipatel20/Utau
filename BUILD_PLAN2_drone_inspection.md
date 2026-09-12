# BUILD_PLAN2_drone_inspection.md
## Phase 10 — Video-Based Drone Inspection Defect Detection Module

---

## 0. READ THIS FIRST — Rules for the coding assistant

This document **replaces the placeholder "Phase 10 (stretch)" section** in `BUILD_PLAN1.md`. Phases 0–8 of that document are assumed **already complete** — the solar/wind telemetry pipeline, revenue-loss module, fleet prioritization view, Copilot domain adaptation, and dashboard UI updates are working. Do not re-touch those unless something in this phase genuinely requires it (and if so, stop and flag it rather than silently modifying).

**Hard rules (same spirit as BUILD_PLAN1.md):**
1. **Work through the sub-phases below in order.** Do not jump ahead or combine steps.
2. **Before editing any existing file, open and read it first.** Do not assume current schemas/endpoints from BUILD_PLAN1.md's descriptions are still accurate — re-verify, since real implementation details may have shifted during Phases 0–8.
3. **This is a new, additive module.** It must not break or modify the existing time-series ingestion, transformer model, or fused anomaly scoring pipeline. It runs alongside them and feeds into the same downstream layers (revenue-loss, fleet priority, Copilot) as a **second, independent signal source**.
4. **Be honest about capability limits.** Do not claim thermal-imagery extraction from RGB video anywhere in code comments, UI copy, or reports — this is not physically possible and must not be implied. RGB video → RGB-visible defects only (cracks, soiling, physical damage, discoloration, panel misalignment). Thermal video (already false-color thermal footage) → hotspot/thermal-anomaly detection. The system must detect which mode applies and say so in the UI, not silently guess.
5. **After each sub-phase, stop and report back** using the same reporting format as BUILD_PLAN1.md section 14, before proceeding.
6. **If a public dataset link, package, or API behaves differently than described here, stop and flag it** rather than inventing a workaround silently. This document's dataset references were verified via web research at planning time but must be re-confirmed by you at implementation time (links/APIs can change).

---

## 1. Context — What this phase adds and why

### 1.1 The problem being solved

The core telemetry pipeline (Phases 0–8) detects anomalies from sensor time-series data. It cannot see **physical/visual defects** — cracks, soiling, hotspots, corrosion, physical damage — which is a distinct and complementary detection modality used in real-world solar/wind O&M (drone-based thermal and RGB inspection is a mature, commercially standard practice).

### 1.2 What we're building

A **video upload + defect detection module**:
- User uploads a drone inspection video (or pastes a YouTube URL) for a specific asset.
- The system extracts frames, runs a pretrained object detection model (one for solar, one for wind — see section 1.4) to find visible defects, and presents annotated results.
- Detected defects become new events that feed into the **existing** revenue-loss module (Phase 5), fleet priority view (Phase 6), and Copilot context (Phase 7) — as a second, corroborating evidence source alongside sensor-based anomaly scores.

### 1.3 Why this is legitimate and not just a "YOLO demo bolted on"

Real-world predictive maintenance platforms combine sensor telemetry AND periodic visual inspection — they are not substitutes for each other. Drone inspection is typically periodic (weekly/monthly), unlike continuous sensor telemetry, so building this as an **async, on-demand batch job** (not a live stream) accurately reflects real practice, not a shortcut.

### 1.4 Model sourcing strategy — using pretrained models, no training required

This build uses two existing **pretrained** models, chosen and confirmed by the user, rather than fine-tuning a model from a public dataset. This significantly simplifies Sub-Phases 10.1–10.4 relative to earlier drafts of this plan.

**Solar model: `4keles/solar-panel-od` (Hugging Face)**
- Format: YOLO, exported to ONNX (`v1.2.1/best.onnx`).
- Classes: `["bird_drop", "bird_feather", "physical_damage", "dust_partical", "leaf", "snow"]` — note this covers soiling-adjacent categories (dust, leaf, bird_drop) and physical damage, but does **not** include thermal/hotspot detection, since it was trained on RGB imagery. This aligns with the RGB-vs-thermal honesty constraint in section 1.2's rules — do not present this model's output as thermal analysis.
- License: MIT.
- Loaded via `huggingface_hub.hf_hub_download` + `ultralytics.YOLO(..., task="detect")`, runs on CPU without issue (ONNX export).

**Wind model: Roboflow-hosted `wind-turbine-blade-1djka` project, version 7**
- Served via Roboflow's serverless inference API: `https://serverless.roboflow.com/wind-turbine-blade-1djka/7`.
- This is an **API-based model, not local weights** — inference happens via an HTTP call to Roboflow's hosted endpoint, requiring a Roboflow API key (free tier available) and network access at inference time. This is a meaningful architectural difference from the solar model (local ONNX file) and must be handled accordingly (see Sub-Phase 10.1, 10.5).
- Exact class list and confidence behavior for this specific model version should be confirmed empirically in Sub-Phase 10.1 by running it against a handful of test images and inspecting the raw response — do not assume specific class names without checking, since this was not independently re-verified against the live endpoint at planning time.
- Because this depends on an external network call, **plan for graceful failure handling** (timeout, API downtime, rate limits) in Sub-Phase 10.5's job logic — this is a real operational risk for a live demo that a local-weights model wouldn't have.

**YouTube-sourced footage**: still used, but purely as **inference-time input** for the demo (per Sub-Phase 10.3) — not for any training step, since there is no training step in this version of the plan.

**Known limitation to expect, not fix**: both models are trained on specific, relatively small datasets with their own class taxonomies (see above). Expect imperfect generalization to footage that looks visually different from their original training distribution (different camera angle, resolution, lighting, drone altitude, panel/blade type). This is normal and expected for using pretrained, non-fine-tuned models — Sub-Phase 10.4 exists specifically to characterize this honestly, not to assume the models will perform well on arbitrary footage.

---

## 2. Sub-Phase Plan

| Sub-Phase | Goal |
|---|---|
| 10.0 | Reconnaissance — confirm current repo state post-Phase-8, decide integration points |
| 10.1 | Wire up the two pretrained models (solar + wind) and confirm they load and run |
| 10.2 | *(Collapsed — no training needed; see note below)* |
| 10.3 | Build video/frame processing pipeline (upload or YouTube URL → sampled frames → inference) |
| 10.4 | Qualitatively validate pretrained model outputs on real footage; document limitations honestly |
| 10.5 | Build backend job/endpoint layer (async processing + results storage) |
| 10.6 | Wire results into existing revenue-loss, fleet priority, and Copilot layers |
| 10.7 | Build frontend upload + results UI |
| 10.8 | Cross-referencing view: sensor anomaly timeline + visual defect markers combined |
| 10.9 | End-to-end test + demo script update |

**Do not proceed to the next sub-phase until the current one is confirmed working and reported back.**

**Important change from the original plan:** this version uses two existing **pretrained, ready-to-use** models instead of fine-tuning from scratch. No dataset acquisition, no training run, no GPU requirement. This trades a small amount of domain-fit accuracy for a much faster, lower-risk build — appropriate given the goal is a "decent, working" defect-detection signal feeding the rest of the system, not a state-of-the-art detector. Sub-Phase 10.2 (fine-tuning) from the original plan is removed entirely. If the coding assistant or the user later decides fine-tuning is worth doing, that would be reintroduced as a future Sub-Phase, not assumed here.

---

## 3. Sub-Phase 10.0 — Reconnaissance

**Goal:** Re-confirm current repo state before adding a new module, since Phases 0–8 may have changed things from BUILD_PLAN1.md's original assumptions.

Steps:
1. Re-open `TranAD-main/server.py` (or wherever the FastAPI app now lives) and list all current endpoints as they actually exist now — confirm which of Phase 5 (revenue-loss), Phase 6 (fleet summary), and Phase 7 (Copilot context) endpoints exist, their exact names, and their request/response schemas.
2. Confirm how `asset_id` is represented across the system (string? UUID? integer?) — this phase needs to attach video-detected defects to the same asset identifiers used elsewhere.
3. Confirm what background/async job handling (if any) already exists in the codebase (e.g., is there already a task queue, or does everything run synchronously in request handlers?). This determines whether Sub-Phase 10.5 needs to introduce a new async pattern (e.g., `BackgroundTasks` in FastAPI, or a simple job-status-in-SQLite polling pattern) or reuse an existing one.
4. Confirm current Python environment/dependencies (check `requirements.txt` or equivalent) — note what's already installed (PyTorch version, OpenCV presence, etc.) so Sub-Phase 10.1's new dependencies (`ultralytics`, `huggingface_hub`, `inference-sdk`) don't introduce conflicting versions.
5. Confirm available compute — check whether a GPU is available in the dev/deploy environment. This matters less than it would for training (no training happens in this plan), but local ONNX inference for the solar model is still faster with a GPU; this mainly affects Sub-Phase 10.3's frame-sampling rate (how many frames per second of video can be processed in reasonable time).
6. **Report back**: findings, plus explicitly flag any mismatch with this document's assumptions (e.g., if Phase 6's endpoint is named differently than expected).

---

## 4. Sub-Phase 10.1 — Wire Up the Two Pretrained Models

**Goal:** Get both pretrained models loading and producing predictions on a test image each, before building any pipeline around them. No training, no dataset acquisition.

Steps:
1. Create a new top-level directory for this module, e.g. `drone-inspection/` (do not mix with existing `TranAD-main/` folders), with subfolders:
   - `drone-inspection/models/` (for the local solar ONNX file, once downloaded/cached)
   - `drone-inspection/inference/` (for the wrapper code written in this sub-phase)
2. **Solar model setup** (local, `4keles/solar-panel-od`):
   - Install dependencies: `pip install ultralytics huggingface_hub`.
   - Download and load:
     ```python
     from huggingface_hub import hf_hub_download
     from ultralytics import YOLO

     model_path = hf_hub_download(repo_id="4keles/solar-panel-od", filename="v1.2.1/best.onnx")
     solar_model = YOLO(model_path, task="detect")
     ```
   - Run a test prediction against any sample solar panel image (a stock photo is fine for this smoke test) and confirm it returns bounding boxes with class labels from `["bird_drop", "bird_feather", "physical_damage", "dust_partical", "leaf", "snow"]`.
   - Write a small wrapper function, e.g. `run_solar_inference(image_path_or_array) -> list[Detection]`, where `Detection` includes class name, confidence, and bounding box coordinates — this wrapper is what later sub-phases will call, so keep its interface stable and simple.
3. **Wind model setup** (remote, Roboflow-hosted):
   - Sign up for a free Roboflow account and obtain an API key.
   - Install dependencies: `pip install inference-sdk`.
   - Confirm the exact endpoint and model ID: `wind-turbine-blade-1djka`, version `7`, served at `https://serverless.roboflow.com/wind-turbine-blade-1djka/7`.
   - Run a test inference call:
     ```python
     from inference_sdk import InferenceHTTPClient, InferenceConfiguration

     CLIENT = InferenceHTTPClient(
         api_url="https://serverless.roboflow.com",
         api_key="YOUR_ROBOFLOW_API_KEY"
     ).configure(InferenceConfiguration(api_key_transport="header"))

     result = CLIENT.infer("sample_turbine_blade.jpg", model_id="wind-turbine-blade-1djka/7")
     print(result)
     ```
   - **Inspect the raw response structure and actual class names returned** — do not assume specific class names in advance; this must be confirmed empirically against the live endpoint, since it was not independently re-verified at planning time.
   - Write an equivalent wrapper function, e.g. `run_wind_inference(image_path) -> list[Detection]`, normalizing the Roboflow response into the **same `Detection` shape** used by the solar wrapper (class name, confidence, bounding box) — this shared interface matters a lot for keeping Sub-Phases 10.3, 10.5, and 10.6 asset-type-agnostic wherever possible.
   - **Handle failure modes explicitly**: wrap the API call in a try/except for network errors, timeouts, and non-200 responses, and decide what `run_wind_inference` returns on failure (e.g., an empty list plus a logged error, not a silent crash) — this matters because, unlike the solar model, this one depends on external network access at inference time, which is a real risk during a live demo.
4. Store the Roboflow API key via an environment variable or config file, not hardcoded in source — confirm how the existing repo handles other secrets (e.g., Twilio/Groq keys, per BUILD_PLAN1.md Phase 0 findings) and follow the same convention.
5. **Report back**: confirmation both wrappers run successfully against test images, the actual class list returned by the wind model (once observed), and any issues encountered with API access, rate limits, or response format.

---

## 5. Sub-Phase 10.2 — (Collapsed, no action needed)

This sub-phase is intentionally empty in this version of the plan. The original plan's fine-tuning step is not needed because Sub-Phase 10.1 already produced two working, pretrained detection models. Proceed directly to Sub-Phase 10.3.

If, after seeing real results in Sub-Phase 10.4, the user or coding assistant decides fine-tuning would meaningfully improve results, that should be scoped as a new, explicitly-approved sub-phase at that time — not assumed as part of this plan.

---

## 6. Sub-Phase 10.3 — Video/Frame Processing Pipeline

**Goal:** Build the extraction pipeline that turns an uploaded video or YouTube URL into a set of frames, run through the correct pretrained model wrapper from Sub-Phase 10.1 based on asset type.

Steps:
1. Create a new module, e.g. `drone-inspection/pipeline/frame_extraction.py`.
2. Support two input types:
   - Direct file upload (video file saved to a temp/staging path).
   - YouTube URL — use `yt-dlp` to download the video to the same staging path.
3. Use OpenCV to sample frames at a configurable rate (default: 1 frame per second — adjust based on typical drone footage pacing; avoid over-sampling near-duplicate frames from slow panning).
4. Implement a basic blur filter (e.g., variance-of-Laplacian thresholding — a standard, well-documented OpenCV technique) to discard motion-blurred frames before they reach either model.
5. Since both pretrained models from Sub-Phase 10.1 are RGB-based (neither does thermal analysis), this sub-phase does **not** need an RGB-vs-thermal detection heuristic — simplify relative to earlier plan drafts. Instead, add a clear, static UI-facing note (used in Sub-Phase 10.7) stating that detection is based on visible-light imagery, so uploaded thermal footage is not silently misrepresented as thermally analyzed. If thermal footage is uploaded, the models will still run on it as if it were an RGB image and may produce unreliable results — this should be disclosed, not hidden.
6. Route frames to the correct wrapper based on the asset's type (solar → `run_solar_inference`, wind → `run_wind_inference`, both from Sub-Phase 10.1) — the asset type should come from the existing asset/fleet metadata (confirm exact field per Sub-Phase 10.0 findings), not be re-detected from the image.
7. Output: a folder of sampled, filtered frames plus metadata (timestamp in video, frame index) alongside each frame's detection results, ready for aggregation.
8. **Report back**: sample output on a test video (frame count before/after blur filtering, sample detections), and flag if the blur filter is too aggressive/lenient based on manual spot-check.

---

## 7. Sub-Phase 10.4 — Honest Qualitative Validation

**Goal:** Since these are pretrained, non-fine-tuned models with no ground-truth labels for our own footage, this sub-phase is **qualitative spot-checking**, not formal metric computation (no mAP/precision/recall is possible without labeled data for our specific footage). Do this before wiring results into the live product, so downstream phases (revenue-loss, fleet priority) aren't built on unvalidated assumptions.

Steps:
1. Gather a small test set of real-world footage for each asset type: a mix of the YouTube-sourced videos identified for the demo (per Sub-Phase 10.3) and, if available, a few standalone images.
2. Run both models (via the Sub-Phase 10.1 wrappers) across this test set.
3. Manually review every detection (this test set should be small enough — 20–40 frames per asset type — to review by hand, not sampled statistically):
   - Does the bounding box actually contain the defect it claims to? (visual sanity check, not a numeric score)
   - Are there obvious, confident false positives (e.g., flagging a shadow as physical damage)?
   - Are there obvious missed defects visible to the human eye that the model didn't flag?
4. Document findings honestly per class, per asset type — e.g., "the solar model reliably catches large soiling/dust regions but misses subtle bird-drop marks; the wind model catches large visible cracks/breakage but produces occasional false positives on blade-tip glare." Do not claim performance levels that weren't actually observed.
5. Based on this review, pick a practical confidence threshold per model to use downstream (Sub-Phase 10.6) — e.g., "only treat detections above 0.5 confidence as real for revenue-loss/priority purposes" — chosen from what actually looked reliable in this manual review, not a default value assumed without checking.
6. **Report back**: a short written summary of observed strengths/weaknesses per model, the chosen confidence thresholds, and example frames (good and bad detections) to justify the choice.

---

## 8. Sub-Phase 10.5 — Backend Job & Endpoint Layer

**Goal:** Expose this pipeline via the API as an async job, consistent with how video processing takes real time and shouldn't block requests.

Steps:
1. Based on Sub-Phase 10.0 findings on existing async patterns, implement:
   - `POST /api/inspection/upload` — accepts a video file OR a YouTube URL + `asset_id`, starts a background job, returns a `job_id` immediately.
   - `GET /api/inspection/status/{job_id}` — returns job status (`queued`, `extracting_frames`, `running_detection`, `compiling_results`, `done`, `failed`) and progress percentage if feasible.
   - `GET /api/inspection/results/{job_id}` — returns final results once done: list of defects found, each with frame timestamp, defect class, confidence, bounding box coordinates, and a reference to the annotated frame image (saved to disk/served statically).
   - If existing WebSocket infrastructure (from the core telemetry pipeline) can be reused to push job progress instead of polling, prefer that for consistency with the rest of the app — confirm feasibility during implementation rather than assuming.
2. **Wind-specific reliability note**: since `run_wind_inference` (Sub-Phase 10.1) calls an external Roboflow API rather than local weights, this job layer must handle that call failing mid-job (timeout, rate limit, API downtime) without crashing the whole job — a failed frame's inference should be logged and skipped, not fatal to the batch, and the final job status/results should indicate if some frames could not be processed. Retry with backoff for a small number of attempts before giving up on a given frame is reasonable; do not retry indefinitely.
3. Store job records and results in SQLite (reuse the existing governance/feedback DB from Phase 0/5 if schema allows, or a new table — check existing schema conventions found in Sub-Phase 10.0 first).
4. Persist annotated frame images (with bounding boxes drawn) to a static-served directory so the frontend can display them.
5. **Report back**: confirm the full upload → status polling → results retrieval loop works for a test video, including at least one deliberately-simulated wind API failure (e.g., a bad API key) to confirm the failure handling from step 2 works as intended.

---

## 9. Sub-Phase 10.6 — Wire Into Existing Revenue-Loss, Fleet Priority, and Copilot Layers

**Goal:** Make visual defect detections actually matter to the rest of the system, not just sit as a standalone gallery.

Steps:
1. **Revenue-loss integration**: When a defect is confirmed above the Sub-Phase 10.4-recommended confidence threshold, apply an assumed power-derating estimate per defect type (e.g., a confirmed hotspot on a string implies an estimated % output reduction for that string — use a simple, clearly-documented assumption, not a precise physical model, and label it as an estimate in the UI). Feed this into the existing Phase 5 revenue-loss module as an additional loss-contributing event tied to the asset.
2. **Fleet priority integration**: Update the Phase 6 priority score formula to optionally factor in "has an unresolved visual defect finding" as a boosting term, so an asset with both a sensor anomaly AND a corroborating visual defect ranks above one with either signal alone. Keep the formula simple and documented (per BUILD_PLAN1.md's Phase 6 guidance).
3. **Copilot integration**: Extend the Phase 7 context-construction code so that, when discussing an asset, the Copilot is given a summary of any recent visual inspection findings alongside sensor anomaly history. Prompt it to explicitly note when sensor and visual evidence corroborate each other (this is your strongest, most defensible "AI insight" — say so plainly rather than burying it) versus when only one signal is present (in which case it should hedge more, per BUILD_PLAN1.md's existing root-cause hedging instruction).
4. **Report back**: confirm a test case — inject a synthetic sensor anomaly (from BUILD_PLAN1.md's Phase 2 simulator) and upload a test video with a corresponding visual defect for the same asset — and confirm revenue-loss, fleet priority, and Copilot all reflect the combined evidence correctly.

---

## 10. Sub-Phase 10.7 — Frontend Upload + Results UI

**Goal:** Build the user-facing experience: upload video → see progress → see annotated results.

Steps:
1. New page/view, e.g. "Inspect Asset" — asset selector (reusing existing asset list from the fleet view, which also determines which pretrained model wrapper is used) + file upload input + YouTube URL input field (either/or).
2. Progress UI while the job runs: poll `GET /api/inspection/status/{job_id}` (or subscribe via WebSocket per Sub-Phase 10.5) and show human-readable stage labels ("Extracting frames…", "Running defect detection… (frame 42/180)", "Compiling report…") — do not just show a generic spinner, since stage labels make the demo feel substantive.
3. Results view, once done:
   - Annotated frame gallery — thumbnails with bounding boxes drawn, filterable by defect class.
   - Defect summary table — class, timestamp in source video, confidence.
   - A visible, static disclosure that detection is based on visible-light (RGB) imagery, not thermal analysis — per section 1.2/1.4's honesty constraint, this should appear regardless of what footage was uploaded, so the system never implies thermal capability it doesn't have.
   - Revenue-loss estimate contribution from this inspection (pulled from Sub-Phase 10.6's integration), clearly labeled as an estimate.
4. **Report back**: screenshots/description of the full upload-to-results flow working in the browser.

---

## 11. Sub-Phase 10.8 — Cross-Referencing View

**Goal:** Build the specific visual that ties sensor time-series anomalies and visual inspection findings together on one timeline — this is the strongest differentiator for a demo.

Steps:
1. On the existing single-asset dashboard (from BUILD_PLAN1.md Phase 8), add a combined timeline component: the existing anomaly-score time-series chart, with visual-defect-detection events overlaid as markers at their corresponding dates/times.
2. Clicking a marker shows the relevant annotated frame + defect details inline (reuse components from Sub-Phase 10.7 where possible, don't duplicate UI logic).
3. **Report back**: confirm the combined view correctly aligns a test sensor anomaly and a test visual defect finding on the same timeline when both are present for the same asset and time period.

---

## 12. Sub-Phase 10.9 — End-to-End Test + Demo Script Update

**Goal:** Verify the full addon works end-to-end and update demo materials.

Steps:
1. Full walkthrough test: upload a real (or YouTube-sourced) test video for a solar asset and a wind asset separately, confirm detection, revenue-loss update, fleet priority update, Copilot awareness, and cross-referencing view all work.
2. Confirm this module does not break or slow down the existing core telemetry pipeline (regression check — run both simultaneously).
3. Update `DEMO_SCRIPT.md` (from BUILD_PLAN1.md Phase 9) with a new section covering the video inspection flow — exact sequence of actions for a live demo, including which pre-selected test video(s) to use so the demo is repeatable and not dependent on live YouTube access during a presentation (download and keep local copies of demo videos in advance).
4. **Report back**: final confirmation, plus an honest summary of current system limitations worth mentioning proactively in a demo Q&A (e.g., "detection accuracy on subtle defects is limited by dataset size," "revenue-loss-per-defect is an estimate, not a calibrated physical model").

---

## 13. Reporting Format

Use the same format as BUILD_PLAN1.md section 14 after every sub-phase:

```
### Sub-Phase 10.N complete: [name]

**Changed/added files:**
- ...

**What was tested:**
- ...

**Results/output:**
- ...

**Deviations from this plan (if any):**
- ...

**Open questions / decisions needed before next sub-phase:**
- ...
```

Do not proceed to the next sub-phase until this report has been reviewed.
