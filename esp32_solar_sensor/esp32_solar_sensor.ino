/*
 * ESP32 Solar Panel Sensor Node — UTAU Predictive Maintenance
 *
 * Sends 10-field telemetry matching solar_schema.json to the UTAU
 * server via HTTP POST to /ingest every SEND_INTERVAL_MS.
 *
 * Fields (index order):
 *   0: dc_voltage       (V)      — 28-38 V typical for a residential string
 *   1: dc_current       (A)      — 0-10 A, tracks irradiance
 *   2: ac_power_output  (kW)     — ~voltage * current * efficiency / 1000
 *   3: module_temperature (°C)   — ambient + 20-30°C under sun
 *   4: ambient_temperature (°C)  — 20-40°C range
 *   5: irradiance       (W/m²)  — 0-1000, diurnal sine curve
 *   6: soiling_index    (0-1)    — 1.0 = clean, degrades slowly
 *   7: inverter_efficiency (%)   — 92-97% normal
 *   8: power_residual   (kW)     — actual - expected (derived)
 *   9: temperature_delta (°C)    — module - ambient (derived)
 *
 * Hardware:  ESP32 DevKit (any variant with WiFi)
 * IDE:       Arduino IDE 2.x  or  PlatformIO
 * Libraries: WiFi.h (built-in), HTTPClient.h (built-in)
 *
 * ── HOW TO USE ──
 * 1. Set WIFI_SSID and WIFI_PASS below
 * 2. Set SERVER_IP to your computer's local IP (run `ipconfig`)
 * 3. Flash to ESP32
 * 4. Make sure UTAU server is running on solar_synthetic dataset
 * 5. Watch the Serial Monitor (115200 baud) for status
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <math.h>

// ═══════════════════════════════════════════════════════════════
// ██  CONFIGURE THESE  ██
// ═══════════════════════════════════════════════════════════════
const char* WIFI_SSID   = "YOUR_WIFI_SSID";
const char* WIFI_PASS   = "YOUR_WIFI_PASSWORD";
const char* SERVER_IP   = "192.168.1.100";  // Your computer's local IP
const int   SERVER_PORT = 8000;
// ═══════════════════════════════════════════════════════════════

const unsigned long SEND_INTERVAL_MS = 1000;  // 1 reading per second
const int   LED_PIN = 2;                       // Built-in LED

// ── Simulation state ──
float soiling        = 1.0;    // starts clean
float sim_hour       = 8.0;    // start at 8 AM
unsigned long tick    = 0;
bool  fault_active   = false;
int   fault_type     = 0;      // 0=none, 1=soiling, 2=hotspot, 3=inverter
unsigned long fault_start_tick = 0;

// ── Forward declarations ──
void connectWiFi();
void sendTelemetry(float* sensors, int n);
float randFloat(float lo, float hi);
float diurnalIrradiance(float hour);

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("╔══════════════════════════════════════╗");
  Serial.println("║  UTAU ESP32 Solar Sensor Node v1.0   ║");
  Serial.println("╚══════════════════════════════════════╝");

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  connectWiFi();

  // Seed RNG from analog noise
  randomSeed(analogRead(0) ^ (micros() << 16));
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // ── Advance simulated time (1 tick = ~1 second real, ~1 minute sim) ──
  sim_hour += 1.0 / 60.0;  // each tick = 1 simulated minute
  if (sim_hour >= 24.0) sim_hour -= 24.0;
  tick++;

  // ── Random fault injection every ~300 ticks (~5 min) ──
  if (!fault_active && tick > 50 && random(0, 300) == 0) {
    fault_active = true;
    fault_type = random(1, 4);  // 1, 2, or 3
    fault_start_tick = tick;
    Serial.printf("[FAULT] Injecting fault type %d at tick %lu\n", fault_type, tick);
  }
  // Auto-clear faults after 30-60 ticks
  if (fault_active && (tick - fault_start_tick) > (unsigned long)random(30, 61)) {
    Serial.printf("[FAULT] Clearing fault type %d after %lu ticks\n", fault_type, tick - fault_start_tick);
    fault_active = false;
    fault_type = 0;
    soiling = min(1.0f, soiling + 0.1f);  // partial recovery after soiling fault
  }

  // ── Generate sensor readings ──
  float irrad = diurnalIrradiance(sim_hour);
  float ambient_temp = 25.0 + 8.0 * sin((sim_hour - 6.0) * PI / 12.0) + randFloat(-1.0, 1.0);
  float module_temp  = ambient_temp + irrad * 0.025 + randFloat(-0.5, 0.5);

  // Soiling degrades slowly
  soiling = max(0.3f, soiling - 0.0001f + randFloat(-0.0002f, 0.0001f));

  float inv_eff = 95.0 + randFloat(-1.0, 1.5);
  float dc_voltage = 32.0 + irrad * 0.004 + randFloat(-0.3, 0.3);
  float dc_current = max(0.0f, irrad * 0.009f * soiling + randFloat(-0.1f, 0.1f));
  float ac_power = dc_voltage * dc_current * (inv_eff / 100.0) / 1000.0;

  // Expected power from simple physics model
  float temp_coeff = -0.004;  // -0.4%/°C
  float stc_power = irrad / 1000.0 * 5.0;  // 5 kW nameplate at STC
  float expected_power = stc_power * (1.0 + temp_coeff * (module_temp - 25.0)) * soiling * (inv_eff / 100.0);
  float power_residual = ac_power - expected_power;
  float temp_delta = module_temp - ambient_temp;

  // ── Apply fault effects ──
  if (fault_active) {
    switch (fault_type) {
      case 1:  // Soiling — gradual power drop
        soiling = max(0.3f, soiling - 0.01f);
        ac_power *= soiling;
        power_residual = ac_power - expected_power;
        break;

      case 2:  // Hotspot — temperature spike + power drop
        module_temp += 15.0 + randFloat(0.0, 8.0);
        temp_delta = module_temp - ambient_temp;
        ac_power *= 0.7 + randFloat(-0.05, 0.05);
        power_residual = ac_power - expected_power;
        break;

      case 3:  // Inverter fault — efficiency crash
        inv_eff = 40.0 + randFloat(-10.0, 10.0);
        ac_power = dc_voltage * dc_current * (inv_eff / 100.0) / 1000.0;
        dc_current *= 0.3;
        power_residual = ac_power - expected_power;
        break;
    }
  }

  // ── Pack sensor array (must match solar_schema.json field order) ──
  float sensors[10];
  sensors[0] = dc_voltage;
  sensors[1] = dc_current;
  sensors[2] = ac_power;
  sensors[3] = module_temp;
  sensors[4] = ambient_temp;
  sensors[5] = irrad;
  sensors[6] = soiling;
  sensors[7] = inv_eff;
  sensors[8] = power_residual;
  sensors[9] = temp_delta;

  // ── Send to server ──
  sendTelemetry(sensors, 10);

  // ── Serial log ──
  if (tick % 10 == 0) {
    Serial.printf("[T=%lu h=%.1f] irr=%.0f pwr=%.3f kW soil=%.2f inv=%.1f%% %s\n",
      tick, sim_hour, irrad, ac_power, soiling, inv_eff,
      fault_active ? (fault_type == 1 ? "FAULT:SOIL" : fault_type == 2 ? "FAULT:HOT" : "FAULT:INV") : "OK");
  }

  delay(SEND_INTERVAL_MS);
}


// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

void connectWiFi() {
  Serial.printf("Connecting to WiFi: %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nConnected! IP: %s\n", WiFi.localIP().toString().c_str());
    digitalWrite(LED_PIN, HIGH);
  } else {
    Serial.println("\nWiFi connection failed — will retry on next loop.");
    digitalWrite(LED_PIN, LOW);
  }
}

void sendTelemetry(float* sensors, int n) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  char url[128];
  snprintf(url, sizeof(url), "http://%s:%d/ingest", SERVER_IP, SERVER_PORT);
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  // Build JSON: {"timestamp_ms": <ms>, "sensors": [f0, f1, ...]}
  unsigned long ts_ms = millis();  // relative uptime as timestamp
  String json = "{\"timestamp_ms\":";
  json += String(ts_ms);
  json += ",\"sensors\":[";
  for (int i = 0; i < n; i++) {
    if (i > 0) json += ",";
    json += String(sensors[i], 4);
  }
  json += "]}";

  int code = http.POST(json);
  if (code == 200) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
    if (tick % 20 == 0) {
      Serial.printf("[HTTP] POST failed: %d\n", code);
    }
  }
  http.end();
}

float diurnalIrradiance(float hour) {
  // Bell curve: peak at solar noon (12:00), zero before 6 and after 18
  if (hour < 6.0 || hour > 18.0) return randFloat(0.0, 5.0);
  float x = (hour - 12.0) / 3.0;
  float base = 950.0 * exp(-0.5 * x * x);
  return max(0.0f, base + randFloat(-30.0f, 30.0f));
}

float randFloat(float lo, float hi) {
  return lo + (hi - lo) * (random(0, 10001) / 10000.0);
}
