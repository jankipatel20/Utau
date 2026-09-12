// LeftHud — Glass analytics sidebar
// Contains: Sensor Heatmap, Live Sparklines for top anomalous sensors, Score decomposition bars
// All data comes from App.tsx state — zero new logic.

import { useMemo } from "react";

interface Props {
  activeDataset: string;
  scoreComponents: { recon: number; forecast: number; corr: number } | null;
  alertExplanation: any | null;
  data: { tick: number; system_loss: number; actual?: number[]; is_anomalous: boolean }[];
  dimensions: number;
  sensorLabels: string[];
  systemState: "HEALTHY" | "WARNING" | "CRITICAL";
}

const G = "var(--gold)";
const CU = "var(--copper)";
const CR = "var(--crimson)";
const TD = "var(--text-dim)";
const TS = "var(--text-secondary)";

function accent(s: "HEALTHY" | "WARNING" | "CRITICAL") {
  return s === "CRITICAL" ? CR : s === "WARNING" ? CU : G;
}

// ── Sensor Heatmap ─────────────────────────────────────────────────────────────
function SensorHeatmap({
  dimensions,
  alertExplanation,
  sensorLabels,
  activeDataset,
}: Pick<Props, "dimensions" | "alertExplanation" | "sensorLabels" | "activeDataset">) {
  const hotSet = new Set<string>(alertExplanation?.top_contributors?.map((c: any) => c.sensor) ?? []);
  const count = Math.min(dimensions || 12, 24);
  const cells = Array.from({ length: count }, (_, i) => `s${i}`);

  // contribution score for color intensity
  const contribMap: Record<string, number> = {};
  (alertExplanation?.top_contributors ?? []).forEach((c: any) => {
    contribMap[c.sensor] = c.contribution_pct ?? c.contribution_score ?? 0;
  });
  const maxContrib = Math.max(...Object.values(contribMap), 1);

  const isWind = activeDataset === "wind_synthetic";
  const isSolar = activeDataset === "solar_synthetic";

  const getLabel = (sensor: string) => {
    const idx = parseInt(sensor.replace("s", ""), 10);
    if (sensorLabels[idx]) {
      const raw = sensorLabels[idx];
      // Shorten the label to 6 chars max
      return raw.split(" ")[0].slice(0, 6).toUpperCase();
    }
    if (isWind) {
      const windLabels: Record<string, string> = {
        s0: "VIB_X", s1: "VIB_Y", s2: "VIB_Z", s3: "GEAR",
        s4: "GEN_T", s5: "RPM", s6: "PWR", s7: "PITCH",
        s8: "YAW", s9: "TEMP", s10: "NAC_V", s11: "P_RES",
      };
      return windLabels[sensor] ?? sensor.toUpperCase();
    }
    if (isSolar) {
      const solarLabels: Record<string, string> = {
        s0: "DC_V", s1: "DC_A", s2: "AC_V", s3: "MOD_T",
        s4: "IRRAD", s5: "AMB_T", s6: "SOIL", s7: "INV_E",
        s8: "STR_A", s9: "P_RES",
      };
      return solarLabels[sensor] ?? sensor.toUpperCase();
    }
    return sensor.toUpperCase();
  };

  return (
    <div style={{ padding: "14px 16px 10px" }}>
      {/* Section header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6, marginBottom: 10,
      }}>
        <div style={{ width: 2, height: 12, background: G, borderRadius: 1 }} />
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 8.5, fontWeight: 700,
          letterSpacing: "0.18em", color: TD,
        }}>SENSOR MATRIX</span>
      </div>

      {/* Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 4,
      }}>
        {cells.map((sensor) => {
          const isHot = hotSet.has(sensor);
          const intensity = contribMap[sensor] ? contribMap[sensor] / maxContrib : 0;
          const bg = isHot
            ? `rgba(168,50,64,${0.18 + intensity * 0.55})`
            : "rgba(184,134,42,0.06)";
          const border = isHot
            ? `1px solid rgba(168,50,64,${0.5 + intensity * 0.5})`
            : "1px solid rgba(184,134,42,0.1)";

          return (
            <div
              key={sensor}
              title={sensorLabels[parseInt(sensor.replace("s", ""), 10)] || sensor}
              style={{
                background: bg,
                border,
                borderRadius: 3,
                padding: "4px 2px",
                textAlign: "center",
                position: "relative",
                transition: "all 0.4s ease",
              }}
            >
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 7.5, color: isHot ? CR : TD,
                letterSpacing: "0.06em", lineHeight: 1,
              }}>
                {getLabel(sensor)}
              </div>
              {isHot && (
                <div style={{
                  position: "absolute", top: 1, right: 1,
                  width: 3, height: 3, borderRadius: "50%",
                  background: CR,
                  animation: "critBlink 1.1s ease-in-out infinite",
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <div style={{ width: 6, height: 6, borderRadius: 1, background: "rgba(184,134,42,0.12)", border: "1px solid rgba(184,134,42,0.2)" }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: TD, letterSpacing: "0.06em" }}>NOMINAL</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <div style={{ width: 6, height: 6, borderRadius: 1, background: "rgba(168,50,64,0.55)", border: "1px solid rgba(168,50,64,0.8)" }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: TD, letterSpacing: "0.06em" }}>FAULT</span>
        </div>
      </div>
    </div>
  );
}

// ── Sparklines ─────────────────────────────────────────────────────────────────
function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  const W = 140, H = 28;
  if (values.length < 2) return <div style={{ width: W, height: H }} />;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg width={W} height={H} style={{ display: "block", overflow: "visible" }}>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.8}
      />
      {/* Hot dot on last point */}
      {(() => {
        const last = pts[pts.length - 1].split(",");
        return (
          <circle
            cx={parseFloat(last[0])}
            cy={parseFloat(last[1])}
            r={2.5}
            fill={color}
            opacity={0.9}
          />
        );
      })()}
    </svg>
  );
}

function LiveSparklines({
  data,
  dimensions,
  alertExplanation,
  sensorLabels,
}: Pick<Props, "data" | "dimensions" | "alertExplanation" | "sensorLabels">) {
  const topSensors: string[] = useMemo(() => {
    return (alertExplanation?.top_contributors ?? [])
      .slice(0, 3)
      .map((c: any) => c.sensor as string);
  }, [alertExplanation]);

  if (topSensors.length === 0 || data.length < 2) {
    return (
      <div style={{ padding: "10px 16px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <div style={{ width: 2, height: 12, background: G, borderRadius: 1 }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.18em", color: TD }}>SIGNAL TRACE</span>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: TD, fontStyle: "italic" }}>awaiting anomaly signal…</span>
      </div>
    );
  }

  return (
    <div style={{ padding: "10px 16px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <div style={{ width: 2, height: 12, background: CR, borderRadius: 1 }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: CR, letterSpacing: "0.18em" }}>
          SIGNAL TRACE
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 7.5, color: TD, marginLeft: 4, letterSpacing: "0.08em" }}>TOP 3 FAULT SENSORS</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {topSensors.map((sensor, si) => {
          const idx = parseInt(sensor.replace("s", ""), 10);
          const values = data
            .map((d) => (d.actual && idx < d.actual.length ? d.actual[idx] : 0));
          const label = sensorLabels[idx]
            ? sensorLabels[idx].split(" ")[0]
            : sensor.toUpperCase();
          const colors = [CR, CU, G];
          const col = colors[si] ?? G;

          return (
            <div key={sensor}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "baseline",
                marginBottom: 3,
              }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: col, letterSpacing: "0.1em" }}>
                  {label}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: TD }}>
                  {values.length > 0 ? values[values.length - 1].toFixed(3) : "—"}
                </span>
              </div>
              <MiniSparkline values={values} color={col} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Score Decomposition ────────────────────────────────────────────────────────
function ScoreBars({ scoreComponents, systemState }: Pick<Props, "scoreComponents" | "systemState">) {
  const col = accent(systemState);
  const bars = [
    { key: "recon", label: "RECONSTRUCTION", value: scoreComponents?.recon ?? 0, color: col },
    { key: "forecast", label: "FORECAST DRIFT", value: scoreComponents?.forecast ?? 0, color: CU },
    { key: "corr", label: "CORRELATION", value: scoreComponents?.corr ?? 0, color: G },
  ];
  const max = Math.max(...bars.map((b) => b.value), 0.001);

  return (
    <div style={{ padding: "10px 16px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <div style={{ width: 2, height: 12, background: col, borderRadius: 1 }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.18em", color: TD }}>SCORE DECOMP</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {bars.map((b) => {
          const pct = Math.min((b.value / max) * 100, 100);
          return (
            <div key={b.key}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: TD, letterSpacing: "0.1em" }}>{b.label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: b.color }}>{b.value.toFixed(4)}</span>
              </div>
              <div style={{ height: 4, background: "rgba(184,134,42,0.08)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${pct}%`,
                  background: b.color,
                  borderRadius: 2,
                  transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
                  boxShadow: `0 0 6px ${b.color}66`,
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── System Ticker ──────────────────────────────────────────────────────────────
function SystemTicker({ data, systemState }: Pick<Props, "data" | "systemState">) {
  const col = accent(systemState);
  const latest = data.length ? data[data.length - 1] : null;

  return (
    <div style={{ padding: "10px 16px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <div style={{ width: 2, height: 12, background: col, borderRadius: 1 }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.18em", color: TD }}>LIVE TELEMETRY</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {[
          { label: "TICK", value: latest ? `#${latest.tick}` : "—" },
          { label: "LOSS", value: latest ? latest.system_loss.toFixed(5) : "—" },
          { label: "STATUS", value: systemState, color: col },
          { label: "ANOMALY", value: latest?.is_anomalous ? "YES" : "NO", color: latest?.is_anomalous ? CR : G },
        ].map((item) => (
          <div key={item.label} style={{
            background: "rgba(184,134,42,0.05)",
            border: "1px solid rgba(184,134,42,0.1)",
            borderRadius: 4, padding: "5px 8px",
          }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: TD, letterSpacing: "0.1em", marginBottom: 2 }}>{item.label}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: item.color ?? TS }}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Divider ────────────────────────────────────────────────────────────────────
function HudDivider() {
  return (
    <div style={{ padding: "0 16px", position: "relative" }}>
      <div style={{ height: 1, background: "linear-gradient(to right, transparent, rgba(184,134,42,0.2), transparent)" }} />
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        background: "var(--bg-page)", padding: "0 6px",
        fontFamily: "var(--font-mono)", fontSize: 7, color: "rgba(184,134,42,0.25)",
      }}>·</div>
    </div>
  );
}

// ── Main LeftHud ───────────────────────────────────────────────────────────────
export default function LeftHud({ activeDataset, scoreComponents, alertExplanation, data, dimensions, sensorLabels, systemState }: Props) {
  return (
    <div
      className="left-hud"
      style={{
        position: "relative", zIndex: 10,
        display: "flex", flexDirection: "column",
        height: "100%", overflow: "hidden",
      }}
    >
      {/* Corner ticks */}
      <div className="hud-corner hud-corner-tl" />
      <div className="hud-corner hud-corner-tr" />
      <div className="hud-corner hud-corner-bl" />
      <div className="hud-corner hud-corner-br" />

      {/* Panel header */}
      <div style={{
        padding: "10px 16px 8px",
        borderBottom: "1px solid rgba(184,134,42,0.15)",
        flexShrink: 0,
      }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", color: TD }}>
          DIAGNOSTICS HUD
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, color: "rgba(184,134,42,0.35)", marginTop: 1, letterSpacing: "0.1em" }}>
          {activeDataset === "wind_synthetic" ? "WIND FARM // AEGIS-7" : activeDataset === "solar_synthetic" ? "SOLAR ARRAY // HELIO-3" : "GENERIC STREAM"}
        </div>
      </div>

      {/* Introduction text */}
      <div style={{ padding: "12px 16px 4px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: TD, lineHeight: 1.5, letterSpacing: "0.03em" }}>
          Monitors live asset telemetry. The <strong style={{ color: "var(--gold)" }}>System Ticker</strong> tracks real-time data loss, while the <strong style={{ color: "var(--gold)" }}>Sensor Matrix</strong> highlights subsystem deviations.
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        <SystemTicker data={data} systemState={systemState} />
        <HudDivider />
        <SensorHeatmap dimensions={dimensions} alertExplanation={alertExplanation} sensorLabels={sensorLabels} activeDataset={activeDataset} />
        <HudDivider />
        <LiveSparklines data={data} dimensions={dimensions} alertExplanation={alertExplanation} sensorLabels={sensorLabels} />
        <HudDivider />
        <ScoreBars scoreComponents={scoreComponents} systemState={systemState} />
      </div>
    </div>
  );
}
