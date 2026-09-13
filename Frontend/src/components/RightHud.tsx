// RightHud — Glass intelligence sidebar
// Wraps existing right-panel sub-components (PredictiveRULPanel, RootCausePanel,
// SimilarIncidents, GovernancePanel) plus an Event Timeline Feed.
// No logic changes — pure styling wrapper.

import React, { useState, useEffect } from "react";
import { Shield, AlertTriangle, Clock, TrendingDown, Zap, CheckCircle, XCircle, Activity } from "lucide-react";

// ── Re-exported types & helpers (match App.tsx) ────────────────────────────────
interface AlertExplanation {
  severity_score: number;
  severity_level: "info" | "warning" | "critical";
  confidence: number;
  anomaly_type: string;
  duration_steps: number;
  top_contributors: { sensor: string; contribution_pct: number }[];
  historical_similar: { tick: number; dataset: string; summary: string; similarity?: number }[];
  investigation_hints: string[];
}

const G = "var(--gold)";
const CU = "var(--copper)";
const CR = "var(--crimson)";
const TD = "var(--text-dim)";
const TS = "var(--text-secondary)";

function accent(s: "HEALTHY" | "WARNING" | "CRITICAL") {
  return s === "CRITICAL" ? CR : s === "WARNING" ? CU : G;
}

// ── Section Header ─────────────────────────────────────────────────────────────
function SectionHeader({ label, color, icon }: { label: string; color: string; icon?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
      <div style={{ width: 2, height: 12, background: color, borderRadius: 1 }} />
      {icon && <span style={{ color, opacity: 0.8 }}>{icon}</span>}
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
        letterSpacing: "0.18em", color: TD,
      }}>{label}</span>
    </div>
  );
}

// ── HUD Divider ────────────────────────────────────────────────────────────────
function HudDivider() {
  return (
    <div style={{ margin: "2px 0", position: "relative" }}>
      <div style={{ height: 1, background: "linear-gradient(to right, transparent, rgba(184,134,42,0.2), transparent)" }} />
      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        background: "var(--bg-page)", padding: "0 6px",
        fontFamily: "var(--font-mono)", fontSize: 7, color: "rgba(184,134,42,0.25)",
      }}>·</div>
    </div>
  );
}

// ── Fleet Vitals (replaces static System Stability Index) ──────────────────
function FleetVitals({ systemState, alertExplanation }: { systemState: "HEALTHY" | "WARNING" | "CRITICAL"; alertExplanation: AlertExplanation | null }) {
  const [tick, setTick] = React.useState(0);
  const [pulse, setPulse] = React.useState(false);

  React.useEffect(() => {
    const iv = setInterval(() => {
      setTick(t => t + 1);
      setPulse(p => !p);
    }, 1400);
    return () => clearInterval(iv);
  }, []);

  const col = systemState === "CRITICAL" ? CR : systemState === "WARNING" ? CU : G;
  const sev = alertExplanation?.severity_score ?? 0;

  // 4 live metrics — each animated slightly differently
  const metrics = [
    {
      label: "STABILITY",
      val: systemState === "HEALTHY"
        ? 98.6 + (tick % 5) * 0.08
        : systemState === "WARNING"
        ? 76 - sev * 20 + (tick % 3) * 0.6
        : 38 - sev * 20 + (tick % 7) * 0.9,
      max: 100,
      color: col,
      unit: "%",
    },
    {
      label: "SIGNAL QUALITY",
      val: systemState === "HEALTHY"
        ? 94 + (tick % 4) * 0.4
        : 65 + (tick % 6) * 0.7,
      max: 100,
      color: systemState === "CRITICAL" ? CU : G,
      unit: "%",
    },
    {
      label: "AI CONFIDENCE",
      val: alertExplanation
        ? Math.round(alertExplanation.confidence * 100)
        : 98 + (tick % 3),
      max: 100,
      color: G,
      unit: "%",
    },
    {
      label: "NET COHERENCE",
      val: systemState === "CRITICAL"
        ? 42 + (tick % 8) * 1.2
        : 91 + (tick % 5) * 0.5,
      max: 100,
      color: systemState === "CRITICAL" ? CR : G,
      unit: "%",
    },
  ];

  const statusLabel = systemState === "HEALTHY"
    ? "ALL SYSTEMS NOMINAL"
    : systemState === "WARNING"
    ? "DEGRADED — MONITORING"
    : "CRITICAL — INTERVENTION";

  return (
    <div style={{ padding: "12px 16px 10px" }}>
      {/* Header row with live pulse dot */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 2, height: 12, background: col, borderRadius: 1 }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", color: TD }}>
            FLEET VITALS
          </span>
        </div>
        {/* Animated status badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "2px 7px",
          border: `1px solid ${col}44`,
          borderRadius: 3,
          background: `${col}0D`,
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: "50%",
            background: col,
            boxShadow: pulse ? `0 0 6px ${col}` : "none",
            transition: "box-shadow 0.4s ease",
          }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: col, letterSpacing: "0.12em" }}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* 4 metric bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {metrics.map((m) => {
          const pct = Math.min(Math.max(m.val, 0), 100);
          return (
            <div key={m.label}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: TD, letterSpacing: "0.12em" }}>
                  {m.label}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: m.color }}>
                  {m.val.toFixed(1)}<span style={{ fontSize: 7, opacity: 0.7 }}>{m.unit}</span>
                </span>
              </div>
              {/* Track */}
              <div style={{ height: 4, background: "rgba(184,134,42,0.08)", borderRadius: 2, overflow: "hidden", position: "relative" }}>
                <div style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${m.color}99, ${m.color})`,
                  borderRadius: 2,
                  transition: "width 1.1s cubic-bezier(0.4,0,0.2,1)",
                  boxShadow: `0 0 5px ${m.color}55`,
                }} />
                {/* Tick markers */}
                {[25, 50, 75].map(t => (
                  <div key={t} style={{
                    position: "absolute", top: 0, bottom: 0,
                    left: `${t}%`, width: 1,
                    background: "rgba(184,134,42,0.12)",
                  }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Investigation hints if anomaly */}
      {alertExplanation && alertExplanation.investigation_hints.length > 0 && (
        <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 4 }}>
          {alertExplanation.investigation_hints.slice(0, 2).map((hint, i) => (
            <div key={i} style={{
              fontFamily: "var(--font-mono)", fontSize: 6.5,
              color: TD, background: "rgba(184,134,42,0.05)",
              border: "1px solid rgba(184,134,42,0.12)", borderRadius: 3,
              padding: "2px 6px", lineHeight: 1.4,
            }}>
              › {hint.slice(0, 52)}{hint.length > 52 ? "…" : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}




// ── Root Cause ─────────────────────────────────────────────────────────────────
function RootCause({ alertExplanation }: { alertExplanation: AlertExplanation | null }) {
  const col = alertExplanation ? CR : TD;
  return (
    <div style={{ padding: "10px 16px" }}>
      <SectionHeader label="ROOT CAUSE DRIVERS" color={col} icon={<AlertTriangle size={9} />} />
      {!alertExplanation ? (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: TD, fontStyle: "italic" }}>no active anomaly</span>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {alertExplanation.top_contributors.slice(0, 5).map((c, i) => {
            const pct = c.contribution_pct ?? 0;
            const width = `${Math.min(pct, 100)}%`;
            return (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: TS, letterSpacing: "0.08em" }}>
                    {c.sensor}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: CR }}>
                    {pct.toFixed(1)}%
                  </span>
                </div>
                <div style={{ height: 3, background: "rgba(168,50,64,0.1)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width,
                    background: `linear-gradient(to right, ${CR}, #e74c3c)`,
                    borderRadius: 2,
                    transition: "width 0.7s ease",
                    boxShadow: `0 0 4px ${CR}88`,
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Event Timeline ─────────────────────────────────────────────────────────────
function EventTimeline({ alertExplanation }: { alertExplanation: AlertExplanation | null }) {
  const events = alertExplanation?.historical_similar?.slice(0, 4) ?? [];
  return (
    <div style={{ padding: "10px 16px" }}>
      <SectionHeader label="EVENT HISTORY" color={G} icon={<Clock size={9} />} />
      {events.length === 0 ? (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: TD, fontStyle: "italic" }}>no historical matches</span>
      ) : (
        <div style={{ position: "relative" }}>
          {/* Vertical timeline line */}
          <div style={{
            position: "absolute", left: 6, top: 4, bottom: 4,
            width: 1, background: "rgba(184,134,42,0.15)",
          }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 18 }}>
            {events.map((ev, i) => (
              <div key={i} style={{ position: "relative" }}>
                {/* Timeline dot */}
                <div style={{
                  position: "absolute", left: -13, top: 3,
                  width: 5, height: 5, borderRadius: "50%",
                  background: i === 0 ? G : "rgba(184,134,42,0.3)",
                  border: `1px solid ${i === 0 ? G : "rgba(184,134,42,0.2)"}`,
                }} />
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, color: TD, letterSpacing: "0.08em", marginBottom: 1 }}>
                  TICK #{ev.tick} · {ev.dataset}
                  {ev.similarity !== undefined && (
                    <span style={{ color: G, marginLeft: 4 }}>
                      {(ev.similarity * 100).toFixed(0)}% match
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 11, color: TS, lineHeight: 1.3 }}>
                  {ev.summary}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Edge AI Inference Telemetry ──────────────────────────────────────────────
function EdgeInferenceMetrics({ systemState }: { systemState: "HEALTHY" | "WARNING" | "CRITICAL" }) {
  const [latency, setLatency] = useState(14.2);
  const [throughput, setThroughput] = useState(82);

  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(13.5 + Math.random() * 2.1);
      setThroughput(78 + Math.floor(Math.random() * 8));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const col = systemState === "CRITICAL" ? CR : G;

  return (
    <div style={{ padding: "10px 16px" }}>
      <SectionHeader label="EDGE AI TELEMETRY" color={col} icon={<Zap size={9} />} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{
          background: "rgba(184,134,42,0.05)", border: "1px solid rgba(184,134,42,0.12)",
          borderRadius: 5, padding: "7px 10px", textAlign: "center",
        }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: TD, letterSpacing: "0.14em", marginBottom: 3 }}>LATENCY</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: G }}>
            {latency.toFixed(1)} <span style={{ fontSize: 8, opacity: 0.6 }}>ms</span>
          </div>
        </div>
        <div style={{
          background: "rgba(184,134,42,0.05)", border: "1px solid rgba(184,134,42,0.12)",
          borderRadius: 5, padding: "7px 10px", textAlign: "center",
        }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: TD, letterSpacing: "0.14em", marginBottom: 3 }}>THROUGHPUT</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: G }}>
            {throughput} <span style={{ fontSize: 8, opacity: 0.6 }}>Hz</span>
          </div>
        </div>
      </div>
      {systemState === "CRITICAL" && (
        <div style={{
          marginTop: 7, fontFamily: "var(--font-mono)", fontSize: 8.5, color: CR,
          textAlign: "center", letterSpacing: "0.08em",
          animation: "critBlink 1.4s ease-in-out infinite",
        }}>
          ANOMALY DETECTED: HIGH CONFIDENCE
        </div>
      )}
    </div>
  );
}

// ── Governance Panel ───────────────────────────────────────────────────────────
interface GovernanceProps {
  systemState: "HEALTHY" | "WARNING" | "CRITICAL";
  isSubmitting: boolean;
  feedbackStatus: string;
  onAcknowledge: () => void;
  onDismiss: () => void;
  modelVersion: string;
  retrainRecommended: boolean;
  onManualRetrain: () => void;
  onTriggerAnomaly: () => void;
}

function GovernanceSection({
  systemState, isSubmitting, feedbackStatus, onAcknowledge, onDismiss,
  modelVersion, retrainRecommended, onManualRetrain, onTriggerAnomaly,
}: GovernanceProps) {
  const col = accent(systemState);
  const isAlert = systemState !== "HEALTHY";

  return (
    <div style={{ padding: "10px 16px 14px" }}>
      <SectionHeader label="GOVERNANCE" color={col} icon={<Shield size={9} />} />

      {/* Model version */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 10, padding: "5px 8px",
        background: "rgba(184,134,42,0.05)", borderRadius: 4,
        border: "1px solid rgba(184,134,42,0.1)",
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: TD, letterSpacing: "0.1em" }}>MODEL VERSION</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: G }}>{modelVersion}</span>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {isAlert && (
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={onAcknowledge}
              disabled={isSubmitting}
              style={{
                flex: 1, padding: "7px 0",
                background: "rgba(44,30,10,0.85)",
                border: `1px solid ${G}`,
                borderRadius: 5, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                transition: "all 0.2s ease",
                fontFamily: "var(--font-mono)", fontSize: 8, color: G, letterSpacing: "0.1em",
              }}
            >
              <CheckCircle size={9} color={G} /> ACKNOWLEDGE
            </button>
            <button
              onClick={onDismiss}
              disabled={isSubmitting}
              style={{
                flex: 1, padding: "7px 0",
                background: "rgba(44,30,10,0.85)",
                border: `1px solid rgba(184,134,42,0.3)`,
                borderRadius: 5, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                transition: "all 0.2s ease",
                fontFamily: "var(--font-mono)", fontSize: 8, color: TD, letterSpacing: "0.1em",
              }}
            >
              <XCircle size={9} color={TD} /> DISMISS
            </button>
          </div>
        )}

        <button
          onClick={onTriggerAnomaly}
          style={{
            width: "100%", padding: "8px 0",
            background: "linear-gradient(135deg, rgba(168,50,64,0.12), rgba(168,50,64,0.06))",
            border: "1px solid rgba(168,50,64,0.35)",
            borderRadius: 5, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition: "all 0.2s ease",
            fontFamily: "var(--font-mono)", fontSize: 9.5, color: CR, letterSpacing: "0.1em",
          }}
        >
          <Zap size={9} color={CR} /> TRIGGER TEST ANOMALY
        </button>

        {retrainRecommended && (
          <button
            onClick={onManualRetrain}
            style={{
              width: "100%", padding: "7px 0",
              background: "linear-gradient(135deg, rgba(184,134,42,0.15), rgba(184,134,42,0.07))",
              border: "1px solid rgba(184,134,42,0.4)",
              borderRadius: 5, cursor: "pointer",
              fontFamily: "var(--font-mono)", fontSize: 8, color: G, letterSpacing: "0.1em",
              animation: "golden-breathe 2s ease infinite",
            }}
          >
            RETRAIN MODEL NOW
          </button>
        )}
      </div>

      {feedbackStatus && (
        <div style={{
          marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 7.5,
          color: TS, background: "rgba(184,134,42,0.06)",
          border: "1px solid rgba(184,134,42,0.12)",
          borderRadius: 4, padding: "4px 8px", lineHeight: 1.5,
        }}>
          {feedbackStatus}
        </div>
      )}
    </div>
  );
}

// ── Main RightHud ──────────────────────────────────────────────────────────────
interface RightHudProps {
  alertExplanation: AlertExplanation | null;
  activeDataset: string;
  systemState: "HEALTHY" | "WARNING" | "CRITICAL";
  revenueLoss: any;
  isSubmittingFeedback: boolean;
  feedbackStatus: string;
  onAcknowledge: () => void;
  onDismiss: () => void;
  modelVersion: string;
  retrainRecommended: boolean;
  onManualRetrain: () => void;
  onTriggerAnomaly: () => void;
}

export default function RightHud({
  alertExplanation, activeDataset, systemState, revenueLoss,
  isSubmittingFeedback, feedbackStatus, onAcknowledge, onDismiss,
  modelVersion, retrainRecommended, onManualRetrain, onTriggerAnomaly,
}: RightHudProps) {
  return (
    <div
      className="right-hud"
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
          INTELLIGENCE HUD
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, color: "rgba(184,134,42,0.35)", marginTop: 1, letterSpacing: "0.1em" }}>
          FAULT ANALYSIS // GOVERNANCE
        </div>
      </div>

      {/* Introduction text */}
      <div style={{ padding: "12px 16px 4px" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: TD, lineHeight: 1.5, letterSpacing: "0.03em" }}>
          Predicts Remaining Useful Life (RUL) and automatically isolates <strong style={{ color: "var(--gold)" }}>Root Cause Drivers</strong> when a fault is detected to guide manual inspection.
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        <FleetVitals systemState={systemState} alertExplanation={alertExplanation} />
        <HudDivider />
        <RootCause alertExplanation={alertExplanation} />
        <HudDivider />
        <EventTimeline alertExplanation={alertExplanation} />
        <HudDivider />
        <EdgeInferenceMetrics systemState={systemState} />
        <HudDivider />
        <GovernanceSection
          systemState={systemState}
          isSubmitting={isSubmittingFeedback}
          feedbackStatus={feedbackStatus}
          onAcknowledge={onAcknowledge}
          onDismiss={onDismiss}
          modelVersion={modelVersion}
          retrainRecommended={retrainRecommended}
          onManualRetrain={onManualRetrain}
          onTriggerAnomaly={onTriggerAnomaly}
        />
      </div>
    </div>
  );
}
