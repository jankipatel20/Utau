// RightHud — Glass intelligence sidebar
// Wraps existing right-panel sub-components (PredictiveRULPanel, RootCausePanel,
// SimilarIncidents, GovernancePanel) plus an Event Timeline Feed.
// No logic changes — pure styling wrapper.

import { Shield, AlertTriangle, Clock, TrendingDown, Zap, CheckCircle, XCircle } from "lucide-react";

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

// ── RUL / Predictive Health ────────────────────────────────────────────────────
function RulPanel({ alertExplanation, activeDataset }: { alertExplanation: AlertExplanation | null; activeDataset: string }) {
  const pct = alertExplanation
    ? Math.max(0, 100 - alertExplanation.severity_score * 100)
    : 100;
  const col = pct < 40 ? CR : pct < 70 ? CU : G;
  const rul = alertExplanation
    ? Math.max(0, Math.round((1 - alertExplanation.severity_score) * 720))
    : null;
  const isWind = activeDataset === "wind_synthetic";

  return (
    <div style={{ padding: "14px 16px 10px" }}>
      <SectionHeader label="PREDICTIVE HEALTH" color={col} icon={<TrendingDown size={9} />} />

      {/* RUL ring */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}>
          <svg width={52} height={52} viewBox="0 0 52 52">
            <circle cx={26} cy={26} r={22} fill="none" stroke="rgba(184,134,42,0.1)" strokeWidth={4} />
            <circle
              cx={26} cy={26} r={22}
              fill="none"
              stroke={col}
              strokeWidth={4}
              strokeDasharray={`${(pct / 100) * 138.2} 138.2`}
              strokeLinecap="round"
              transform="rotate(-90 26 26)"
              style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)" }}
            />
          </svg>
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, color: col, lineHeight: 1 }}>
              {pct.toFixed(0)}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 5.5, color: TD }}>%</span>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: TD, letterSpacing: "0.1em", marginBottom: 4 }}>
            {isWind ? "TURBINE HEALTH" : "ARRAY HEALTH"}
          </div>
          {rul !== null ? (
            <>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: col }}>
                ~{rul}h
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, color: TD, marginTop: 2 }}>
                EST. REMAINING USEFUL LIFE
              </div>
            </>
          ) : (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: G }}>
              NOMINAL OPERATION
            </div>
          )}
        </div>
      </div>

      {alertExplanation && (
        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 5 }}>
          {alertExplanation.investigation_hints.slice(0, 2).map((hint, i) => (
            <div key={i} style={{
              fontFamily: "var(--font-mono)", fontSize: 6.5,
              color: TD, background: "rgba(184,134,42,0.06)",
              border: "1px solid rgba(184,134,42,0.12)", borderRadius: 3,
              padding: "2px 6px", lineHeight: 1.4,
            }}>
              › {hint.slice(0, 48)}{hint.length > 48 ? "…" : ""}
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

// ── Revenue Impact ─────────────────────────────────────────────────────────────
function RevenueImpact({ revenueLoss, activeDataset }: { revenueLoss: any; activeDataset: string }) {
  if (!revenueLoss) return null;
  const isEnergy = activeDataset === "solar_synthetic" || activeDataset === "wind_synthetic";
  if (!isEnergy) return null;

  const energyLoss = Number(revenueLoss.cumulative_energy_loss_kwh || 0);
  const revLoss = Number(revenueLoss.cumulative_revenue_loss_usd || 0);
  const deficit = Number(revenueLoss.current_deficit_rate_kw || 0);
  const isActive = !!revenueLoss.anomaly_active;

  return (
    <div style={{ padding: "10px 16px" }}>
      <SectionHeader label="REVENUE IMPACT" color={isActive ? CR : G} icon={<TrendingDown size={9} />} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{
          background: "rgba(184,134,42,0.05)", border: "1px solid rgba(184,134,42,0.12)",
          borderRadius: 5, padding: "7px 10px", textAlign: "center",
        }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: TD, letterSpacing: "0.14em", marginBottom: 3 }}>ENERGY LOSS</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: energyLoss > 0 ? CU : G }}>
            {energyLoss.toFixed(4)} <span style={{ fontSize: 8, opacity: 0.6 }}>kWh</span>
          </div>
        </div>
        <div style={{
          background: "rgba(184,134,42,0.05)", border: "1px solid rgba(184,134,42,0.12)",
          borderRadius: 5, padding: "7px 10px", textAlign: "center",
        }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: TD, letterSpacing: "0.14em", marginBottom: 3 }}>REV LOSS</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: revLoss > 0 ? CR : G }}>
            ${revLoss.toFixed(4)}
          </div>
        </div>
      </div>
      {isActive && (
        <div style={{
          marginTop: 7, fontFamily: "var(--font-mono)", fontSize: 8.5, color: CR,
          textAlign: "center", letterSpacing: "0.08em",
          animation: "critBlink 1.4s ease-in-out infinite",
        }}>
          ACTIVE DEFICIT: -{deficit.toFixed(2)} kW
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
        <RulPanel alertExplanation={alertExplanation} activeDataset={activeDataset} />
        <HudDivider />
        <RootCause alertExplanation={alertExplanation} />
        <HudDivider />
        <EventTimeline alertExplanation={alertExplanation} />
        {revenueLoss && (
          <>
            <HudDivider />
            <RevenueImpact revenueLoss={revenueLoss} activeDataset={activeDataset} />
          </>
        )}
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
