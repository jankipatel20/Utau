// TopologyPanel — Wind Turbine Digital Twin + Solar Farm Diagram
// Wind: Uses TurbineViewer with cinematic zoom to damaged component.
// Sensor → Component mapping is derived from wind_schema.json fault types.

import { Shield, Wind, Sun, AlertTriangle, Maximize2, X, Zap } from "lucide-react";
import { useMemo, useEffect, Suspense, useState, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import TurbineViewer from "./TurbineViewer";
import SolarViewer, { type SolarAnomalyType } from "./SolarViewer";

type AnomalyType = "gearbox" | "generator" | "bearing" | null;
export type AnyAnomaly = AnomalyType | SolarAnomalyType;

const G = "var(--gold)"; const CU = "var(--copper)";
const VI = "var(--teal)"; const CR = "var(--crimson)";
const TS = "var(--text-secondary)"; const TD = "var(--text-dim)";

type SysState = "HEALTHY" | "WARNING" | "CRITICAL";
function accent(s: SysState) { return s === "CRITICAL" ? CR : s === "WARNING" ? CU : G; }

// ── Sensor → 3D component mapping ────────────────────────────────────────
// Based on schema.json fault_types and field definitions:
function sensorToAnomaly(sensor: string | null, isWind: boolean): AnyAnomaly {
  if (!sensor) return null;
  
  if (isWind) {
    if (sensor === "gearbox_oil_temperature" || sensor === "s3") return "gearbox";
    if (sensor === "vibration_x" || sensor === "s0" || 
        sensor === "vibration_y" || sensor === "s1" || 
        sensor === "vibration_z" || sensor === "s2" || 
        sensor === "nacelle_vibration_rms" || sensor === "s10" || 
        sensor === "rotor_rpm" || sensor === "s5") return "bearing";
    if (sensor === "generator_temperature" || sensor === "s4" || 
        sensor === "power_output" || sensor === "s6" || 
        sensor === "power_residual" || sensor === "s11") return "generator";
  } else {
    // Solar Mapping
    if (sensor === "s2" || sensor === "s7") return "inverter";
    if (sensor === "s3" || sensor === "s6" || sensor === "s8" || sensor === "s9") return "panel";
    if (sensor === "s0" || sensor === "s1") return "junction_box";
  }
      
  return null;
}

const FAULT_LABELS: Record<NonNullable<AnyAnomaly>, { label: string; desc: string; color: string }> = {
  gearbox:   { label: "GEARBOX FAULT",   desc: "Oil temp drift + vibration increase — gear wear detected",    color: "#E74C3C" },
  generator: { label: "GENERATOR FAULT", desc: "Power output below curve — yaw misalignment / stator fault",  color: "#E67E22" },
  bearing:   { label: "BEARING FAULT",   desc: "Intermittent vibration spikes — bearing defect detected",     color: "#C0392B" },
  inverter:  { label: "INVERTER FAULT",  desc: "Efficiency dropped + AC power failure — isolation fault",     color: "#E67E22" },
  panel:     { label: "MODULE FAULT",    desc: "Temperature spike + power residual — hotspot / soiling",      color: "#C0392B" },
  junction_box: { label: "JUNCTION BOX", desc: "DC Voltage/Current irregularities — string disconnect",       color: "#E74C3C" }
};

const ANIM_CSS = `
  @keyframes critBlink { 0%,100%{opacity:1} 50%{opacity:0.32} }
  @keyframes fdDown { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes faultPulse { 0%,100%{box-shadow:0 0 18px rgba(231,76,60,0.6)} 50%{box-shadow:0 0 36px rgba(231,76,60,1)} }
`;

/* ── Main TopologyPanel ──────────────────────────────────────────────────── */
interface TopologyPanelProps {
  activeDataset: string;
  scoreComponents: { recon: number; forecast: number; corr: number } | null;
  alertExplanation: any | null;
  systemState: SysState;
}

export default function TopologyPanel({ activeDataset, scoreComponents, alertExplanation, systemState }: TopologyPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const isWind = activeDataset === "wind_synthetic";
  const isSolar = activeDataset === "solar_synthetic";
  const isCrit = systemState === "CRITICAL";
  const isWarn = systemState === "WARNING";
  const color = accent(systemState);

  // ── 1. Backend Anomaly Detection (Adds to Queue) ────────────────────────────
  const topSensor: string | null = alertExplanation?.top_contributors?.[0]?.sensor ?? null;
  const detectedAnomaly = useMemo<AnyAnomaly>(() => {
    if ((!isWind && !isSolar) || systemState === "HEALTHY") return null;
    return sensorToAnomaly(topSensor, isWind);
  }, [isWind, isSolar, topSensor, systemState]);

  // ── 2. The Anomaly Queue Manager ─────────────────────────────────────────────
  const [anomalyQueue, setAnomalyQueue] = useState<AnyAnomaly[]>([]);
  const [activeAnomaly, setActiveAnomaly] = useState<AnyAnomaly>(null);
  const displayTimerRef = useRef<any>(null);

  // Watch for real backend anomalies
  useEffect(() => {
    if (detectedAnomaly) {
      setAnomalyQueue(prev => {
        // Prevent spamming the same anomaly if it's already queued or currently showing
        if (prev.includes(detectedAnomaly) || activeAnomaly === detectedAnomaly) return prev;
        return [...prev, detectedAnomaly];
      });
    }
  }, [detectedAnomaly, activeAnomaly]);

  // Process the queue
  useEffect(() => {
    // If we are currently idle and there are anomalies waiting in the queue
    if (!activeAnomaly && anomalyQueue.length > 0) {
      const nextAnomaly = anomalyQueue[0];
      
      // Remove it from the queue
      setAnomalyQueue(prev => prev.slice(1));
      
      // Activate it (triggers the 3D cinematic zoom)
      setActiveAnomaly(nextAnomaly);

      // Keep it active for 10 seconds total:
      // (2.5s zoom in + 5.0s view + 2.5s zoom out)
      displayTimerRef.current = setTimeout(() => {
        setActiveAnomaly(null);
      }, 10000);
    }
    
    return () => {
      // Do not clear timeout on normal re-renders, only on unmount
    };
  }, [anomalyQueue, activeAnomaly]);

  // ── 3. Test Anomaly Trigger ──────────────────────────────────────────────────
  // (Test trigger logic handled in RightPanel / App.tsx)

  const faultInfo = activeAnomaly ? FAULT_LABELS[activeAnomaly] : null;
  const isTesting = activeAnomaly && systemState === "HEALTHY";

  // Auto-open modal on CRITICAL wind fault
  useEffect(() => { if (isWind && isCrit) setExpanded(true); }, [isWind, isCrit]);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const bars = isWind
    ? [{ key: "Vibration Deviation",     val: scoreComponents?.recon ?? 0,    c: G,  wt: 55 },
       { key: "Torque Forecast Error",   val: scoreComponents?.forecast ?? 0, c: CU, wt: 30 },
       { key: "Sensor Corr. Shift",      val: scoreComponents?.corr ?? 0,    c: VI, wt: 15 }]
    : isSolar
    ? [{ key: "Power Output Residual",   val: scoreComponents?.recon ?? 0,    c: G,  wt: 55 },
       { key: "Irradiance Forecast Err", val: scoreComponents?.forecast ?? 0, c: CU, wt: 30 },
       { key: "Sensor Corr. Shift",      val: scoreComponents?.corr ?? 0,    c: VI, wt: 15 }]
    : [{ key: "Reconstruction",          val: scoreComponents?.recon ?? 0,    c: G,  wt: 55 },
       { key: "Forecast",                val: scoreComponents?.forecast ?? 0, c: CU, wt: 30 },
       { key: "Correlation",             val: scoreComponents?.corr ?? 0,    c: VI, wt: 15 }];

  const panelBorder = isCrit ? "rgba(192,57,43,0.65)" : isWarn ? "rgba(184,115,51,0.5)" : "rgba(201,146,42,0.14)";
  const panelBg = isCrit ? "rgba(192,57,43,0.07)" : isWarn ? "rgba(184,115,51,0.05)" : "rgba(10,9,7,0.9)";
  const assetLabel = isWind ? "WIND TURBINE DIGITAL TWIN" : isSolar ? "SOLAR ARRAY SCHEMATIC" : `ASSET TWIN — ${activeDataset.toUpperCase()}`;

  const digitalTwin3D = (
    <div style={{ 
      width: "100%", height: "100%", position: "relative",
      background: "radial-gradient(circle at center, rgba(42, 60, 85, 0.45) 0%, rgba(10, 8, 6, 0.1) 80%)" 
    }}>
      <Canvas dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, toneMappingExposure: 1.1 }} style={{ width: "100%", height: "100%" }}>
        <Suspense fallback={null}>
          {isWind && <TurbineViewer activeAnomaly={activeAnomaly as any} />}
          {isSolar && <SolarViewer activeAnomaly={activeAnomaly as any} />}
        </Suspense>
      </Canvas>
    </div>
  );

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", padding: 16, height: "100%", overflow: "hidden", gap: 0 }}>
      <style dangerouslySetInnerHTML={{ __html: ANIM_CSS }} />

      {/* Compact asset viewer */}
      <div style={{
        height: activeAnomaly ? 360 : 258, position: "relative",
        background: panelBg, borderRadius: 6, border: `1px solid ${panelBorder}`,
        marginBottom: 14, overflow: "hidden",
        transition: "height 0.8s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.5s, box-shadow 0.5s",
        boxShadow: isCrit ? "0 0 30px rgba(192,57,43,0.2), inset 0 0 16px rgba(192,57,43,0.05)" : "none",
      }}>
        {/* Top-left label */}
        <div style={{ position: "absolute", top: 8, left: 10, zIndex: 20, display: "flex", alignItems: "center", gap: 5 }}>
          {isWind ? <Wind size={9} color={activeAnomaly ? CR : TD} />
            : isSolar ? <Sun size={9} color={isCrit ? CR : isWarn ? CU : TD} />
            : <Zap size={9} color={TD} />}
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 7.5, fontWeight: 600, letterSpacing: "0.16em", color: activeAnomaly ? CR : isCrit ? CR : isWarn ? CU : TD }}>
            {assetLabel}
          </span>
        </div>
        {/* Status badge */}
        <div style={{
          position: "absolute", top: 8, right: isWind ? 68 : 10, zIndex: 20,
          padding: "2px 8px",
          background: activeAnomaly ? "rgba(192,57,43,0.22)" : isCrit ? "rgba(192,57,43,0.22)" : isWarn ? "rgba(184,115,51,0.18)" : "rgba(39,174,96,0.1)",
          border: `1px solid ${activeAnomaly ? "rgba(192,57,43,0.55)" : isCrit ? "rgba(192,57,43,0.55)" : isWarn ? "rgba(184,115,51,0.45)" : "rgba(39,174,96,0.3)"}`,
          borderRadius: 3,
          fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, fontWeight: 700, letterSpacing: "0.15em",
          color: activeAnomaly ? CR : isCrit ? CR : isWarn ? CU : "#27AE60",
          animation: (activeAnomaly || isCrit) ? "critBlink 1.2s ease-in-out infinite" : "none",
        }}>
          {activeAnomaly ? `● ${activeAnomaly.toUpperCase()} FAULT` : isCrit ? "● FAULT DETECTED" : isWarn ? "● DEGRADED" : "● NOMINAL"}
        </div>
        {/* Wind/Solar: Expand buttons */}
        {(isWind || isSolar) && (
          <div style={{ position: "absolute", top: 7, right: 8, zIndex: 20, display: "flex", gap: 4 }}>
            {/* Expand button */}
            <button onClick={() => setExpanded(true)} title="Full screen analysis" style={{
              background: "rgba(201,146,42,0.08)", border: "1px solid rgba(201,146,42,0.2)",
              borderRadius: 3, padding: "3px 5px", cursor: "pointer", display: "flex", alignItems: "center",
            }}>
              <Maximize2 size={11} color="rgba(201,146,42,0.55)" />
            </button>
          </div>
        )}

        {/* Scene */}
        {(isWind || isSolar) ? digitalTwin3D : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: TD, letterSpacing: "0.15em" }}>SELECT SOLAR OR WIND DATASET</span>
          </div>
        )}

        {/* Removed CRT scan lines background */}
      </div>

      {/* ── Fault info bar under the 3D view ─────────────────────────────────── */}
      {isWind && activeAnomaly && faultInfo && (
        <div style={{
          marginBottom: 12, padding: "8px 12px", borderRadius: 5,
          background: `${faultInfo.color}12`,
          border: `1px solid ${faultInfo.color}55`,
          display: "flex", alignItems: "flex-start", gap: 8,
          animation: "fdDown 0.4s ease",
        }}>
          <AlertTriangle size={13} color={faultInfo.color} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: "0.13em", color: faultInfo.color }}>
              ⚠ {faultInfo.label}
              {isTesting ? <span style={{ fontSize: 8, opacity: 0.7, marginLeft: 8 }}>[TEST MODE]</span> : null}
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, color: TS, marginTop: 3, letterSpacing: "0.05em", lineHeight: 1.5 }}>
              {faultInfo.desc}
            </div>
            {topSensor && !isTesting && (
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 7.5, color: CU, marginTop: 3, letterSpacing: "0.08em" }}>
                PRIMARY SENSOR: {topSensor.replace(/_/g, " ").toUpperCase()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fusion score header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 10, borderBottom: "1px solid var(--border)", marginBottom: 14 }}>
        <Shield size={12} color={color} style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
        <span className="section-label" style={{ color }}>
          {isWind ? "VIBRATION FUSION SCORE" : isSolar ? "POWER FUSION SCORE" : "FUSION DECOMPOSITION"}
        </span>
      </div>

      {/* Score bars */}
      {scoreComponents && (
        <div style={{ display: "flex", flexDirection: "column", gap: 13, marginBottom: 14 }}>
          {bars.map(({ key, val, c: bc, wt }) => {
            const pct = Math.min(wt + val * 800, 100);
            return (
              <div key={key}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: TS, letterSpacing: "0.05em" }}>{key}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 700, color: bc }}>{val.toFixed(5)}</span>
                </div>
                <div style={{ height: 4, background: "rgba(232,220,195,0.08)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${bc}60, ${bc})`, borderRadius: 99, transition: "width 0.5s ease" }} />
                </div>
                <div style={{ textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, color: TD, marginTop: 2 }}>WEIGHT: {wt}%</div>
              </div>
            );
          })}
        </div>
      )}

      {alertExplanation && <div style={{ height: 1, background: "var(--border)", marginBottom: 12 }} />}

      {/* Action path hints */}
      {alertExplanation?.investigation_hints?.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 7, overflowY: "auto", flex: 1, paddingRight: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <AlertTriangle size={10} color={color} />
            <span className="section-label" style={{ color }}>
              {isWind ? "MAINTENANCE ACTION PATH" : isSolar ? "INSPECTION ACTION PATH" : "INVESTIGATION PATH"}
            </span>
          </div>
          {alertExplanation.investigation_hints.map((hint: string, i: number) => (
            <div key={i} style={{ padding: "7px 11px", borderRadius: 4, borderLeft: `2px solid ${color}55`, background: "rgba(201,146,42,0.04)" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, color: TS, lineHeight: 1.5 }}>
                <span style={{ color, marginRight: 6 }}>›</span>{hint}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* Fullscreen modal — cinematic fault analysis                        */}
      {expanded && (isWind || isSolar) && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 2000,
          background: "radial-gradient(circle at center, rgba(42, 60, 85, 0.95) 0%, rgba(10, 8, 6, 0.98) 100%)", 
          display: "flex", flexDirection: "column",
          animation: "fdDown 0.3s ease",
        }}>
          {/* Modal header */}
          <div style={{
            height: 56, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 36px",
            borderBottom: `1px solid ${activeAnomaly ? "rgba(192,57,43,0.4)" : "var(--border)"}`,
            background: "rgba(10,9,7,0.8)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              {isWind ? <Wind size={18} color={activeAnomaly ? CR : G} style={{ filter: activeAnomaly ? `drop-shadow(0 0 8px ${CR})` : "none" }} />
                      : <Sun size={18} color={activeAnomaly ? CR : G} style={{ filter: activeAnomaly ? `drop-shadow(0 0 8px ${CR})` : "none" }} />}
              <div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 700, color: activeAnomaly ? CR : G, letterSpacing: "0.18em" }}>
                  {activeAnomaly ? `${FAULT_LABELS[activeAnomaly].label} — CINEMATIC ANALYSIS` : isWind ? "WIND TURBINE DIGITAL TWIN" : "SOLAR ARRAY SCHEMATIC"}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, color: TD, letterSpacing: "0.1em", marginTop: 2 }}>
                  UTAU PREDICTIVE MAINTENANCE · INTERACTIVE 3D FAULT VIEWER · ESC TO CLOSE
                </div>
              </div>
              {activeAnomaly && (
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, fontWeight: 700, letterSpacing: "0.18em",
                  padding: "3px 10px",
                  background: "rgba(192,57,43,0.18)", border: "1px solid rgba(192,57,43,0.5)", borderRadius: 3,
                  color: CR, animation: "critBlink 1.1s ease-in-out infinite",
                }}>● {activeAnomaly.toUpperCase()} FAULT ACTIVE</span>
              )}
            </div>
            <button onClick={() => setExpanded(false)} style={{
              background: "rgba(201,146,42,0.06)", border: "1px solid rgba(201,146,42,0.18)",
              borderRadius: 4, padding: "8px 14px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
              fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "rgba(201,146,42,0.6)", letterSpacing: "0.12em",
            }}>
              <X size={13} color="rgba(201,146,42,0.55)" /> CLOSE
            </button>
          </div>

          {/* Full 3D canvas */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <Canvas dpr={[1, 2]}
              gl={{ antialias: true, alpha: false, toneMappingExposure: 1.15 }}
              style={{ width: "100%", height: "100%" }}>
              <Suspense fallback={null}>
                {isWind && <TurbineViewer activeAnomaly={activeAnomaly as any} />}
                {isSolar && <SolarViewer activeAnomaly={activeAnomaly as any} />}
              </Suspense>
            </Canvas>
          </div>

          {/* Component status bar */}
          <div style={{
            height: 60, flexShrink: 0,
            display: "flex", alignItems: "center",
            padding: "0 36px",
            borderTop: "1px solid var(--border)",
            background: "rgba(10,9,7,0.8)",
            gap: 0,
          }}>
            {(isWind ? ["gearbox", "generator", "bearing"] : ["panel", "inverter", "junction_box"]).map((compId, i) => {
              const isFault = compId === activeAnomaly;
              const info = FAULT_LABELS[compId as AnyAnomaly];
              if (!info) return null;
              return (
                <div key={compId} style={{
                  display: "flex", alignItems: "center", gap: 10, flex: 1,
                  borderRight: i < 2 ? "1px solid rgba(201,146,42,0.1)" : "none",
                  paddingRight: 24,
                }}>
                  <div style={{
                    width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
                    background: isFault ? info.color : "#27AE60",
                    boxShadow: isFault ? `0 0 10px ${info.color}` : "none",
                    animation: isFault ? "critBlink 1.1s ease-in-out infinite" : "none",
                  }} />
                  <div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.12em", color: isFault ? info.color : TD }}>
                      {compId.toUpperCase()}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 7, color: "rgba(201,146,42,0.35)", marginTop: 1, letterSpacing: "0.08em" }}>
                      {isFault ? "› FAULT DETECTED" : "NOMINAL"}
                    </div>
                  </div>
                </div>
              );
            })}
            <div style={{ marginLeft: "auto", fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, color: "rgba(201,146,42,0.22)", letterSpacing: "0.1em", whiteSpace: "nowrap" }}>
              DRAG TO ORBIT · SCROLL TO ZOOM
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
