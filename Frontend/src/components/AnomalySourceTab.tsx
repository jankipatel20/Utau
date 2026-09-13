import { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw, Activity, Layers, ActivitySquare, Database,
  AlertTriangle, Shield, Zap, TrendingUp, ChevronRight,
  Search, FileText, ArrowUpRight, ArrowDownRight, Minus,
  Clock, Target, Crosshair, BarChart3
} from 'lucide-react';

type ScoreComponents = { recon: number; forecast: number; corr: number; };
type SensorContributor = { sensor: string; sensor_label?: string; contribution_pct: number; recon_error?: number; forecast_error?: number; };

type SOPHistoryItem = {
  created_at_ms: number;
  mode: 'llm' | 'fallback';
  provider?: string;
  model?: string;
  objective: string;
  constraints?: string[];
  sop: string;
  llm_error?: string | null;
};

type AlertExplanation = {
  severity_score: number; severity_level: 'info' | 'warning' | 'critical';
  confidence: number; anomaly_type: string; duration_steps: number;
  top_contributors: SensorContributor[];
  investigation_hints: string[];
};

type AnomalySourcePayload = {
  breakdown: { contribution_pct: { recon: number; forecast: number; corr: number; }; z_scores: { recon: number; forecast: number; corr: number; }; };
  correlation_change: {
    ready: boolean; fro_norm: number;
    top_pair_changes: Array<{ sensor_a: string; sensor_b: string; sensor_a_label?: string; sensor_b_label?: string; prev_corr: number; curr_corr: number; delta: number; abs_delta: number; }>;
  };
};

type AnomalyRecord = {
  id: number; created_at_ms: number; dataset: string; tick: number; system_loss: number;
  threshold: number; severity_score: number; severity_level: string; confidence: number;
  anomaly_type: string; duration_steps: number; top_sensor: string; top_sensor_label?: string;
  top_contributors: SensorContributor[];
  investigation_hints: string[]; score_components: ScoreComponents;
  sensor_snapshot?: {
    top_sensors?: Array<{ sensor: string; sensor_label?: string; actual: number; forecast: number; abs_residual: number; recon_error: number; forecast_error: number; }>;
  } | null;
  sop_history?: SOPHistoryItem[];
  anomaly_source?: AnomalySourcePayload | null;
};

type Props = {
  activeDataset: string; alertExplanation: AlertExplanation | null;
  anomalySource: AnomalySourcePayload | null; scoreComponents: ScoreComponents | null; isConnected: boolean;
};

const API_BASE = 'http://127.0.0.1:8000';

const severityConfig: Record<string, { color: string; bg: string; border: string; icon: typeof AlertTriangle }> = {
  critical: { color: 'var(--crimson)', bg: 'rgba(168,50,64,0.1)', border: 'rgba(168,50,64,0.3)', icon: AlertTriangle },
  warning: { color: 'var(--copper)', bg: 'rgba(160,88,26,0.1)', border: 'rgba(160,88,26,0.3)', icon: Shield },
  info: { color: 'var(--gold)', bg: 'rgba(184,134,42,0.08)', border: 'rgba(184,134,42,0.2)', icon: Activity },
};

const cleanLabel = (s: string) => s.replace(/\bSynthetic\b\s*/gi, '').replace(/\bSyntheti\b\s*/gi, '').trim() || s;

const sensorDisplayName = (sensor?: string, label?: string) => {
  if (label?.trim()) return cleanLabel(label);
  if (!sensor) return 'unknown';
  return cleanLabel(sensor.toUpperCase());
};

export default function AnomalySourceTab({
  activeDataset, alertExplanation, anomalySource, scoreComponents, isConnected,
}: Props) {
  const [items, setItems] = useState<AnomalyRecord[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<AnomalyRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSopLoading, setIsSopLoading] = useState(false);
  const [sopText, setSopText] = useState('');
  const [sopMode, setSopMode] = useState<'llm' | 'fallback' | ''>('');
  const [sopError, setSopError] = useState('');

  const loadAnomalies = async () => {
    setIsLoading(true); setError('');
    try {
      const response = await fetch(`${API_BASE}/anomalies?dataset=${encodeURIComponent(activeDataset)}&limit=120`);
      if (!response.ok) throw new Error(`failed to load anomalies: ${response.status}`);
      const payload = await response.json();
      const list = (payload.items ?? []) as AnomalyRecord[];
      setItems(list);
      if (list.length > 0 && (selectedId === null || !list.some(x => x.id === selectedId))) setSelectedId(list[0].id);
      if (list.length === 0) { setSelectedId(null); setSelectedItem(null); }
    } catch (err) { setError(err instanceof Error ? err.message : 'failed to load anomaly list'); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { setSelectedId(null); setSelectedItem(null); void loadAnomalies(); }, [activeDataset]);

  useEffect(() => {
    if (selectedId === null) return;
    setSopText(''); setSopMode(''); setSopError('');
    const fetchDetail = async () => {
      setIsDetailLoading(true);
      try {
        const response = await fetch(`${API_BASE}/anomalies/${selectedId}`);
        if (!response.ok) throw new Error(`failed to load anomaly detail: ${response.status}`);
        setSelectedItem(await response.json() as AnomalyRecord);
      } catch (err) { setError(err instanceof Error ? err.message : 'failed to load detail'); }
      finally { setIsDetailLoading(false); }
    };
    void fetchDetail();
  }, [selectedId]);

  const sourceView = useMemo(() => selectedItem?.anomaly_source ?? anomalySource, [selectedItem, anomalySource]);

  const sourceContributors = useMemo(() => {
    if (selectedItem?.top_contributors?.length) return selectedItem.top_contributors.slice(0, 5);
    if (alertExplanation?.top_contributors?.length) return alertExplanation.top_contributors.slice(0, 5);
    return [] as SensorContributor[];
  }, [selectedItem, alertExplanation]);

  const selectedTopSensors = useMemo(() => selectedItem?.sensor_snapshot?.top_sensors ?? [], [selectedItem]);

  const generateSop = async () => {
    if (!selectedItem) return;
    setIsSopLoading(true); setSopError('');
    try {
      const response = await fetch(`${API_BASE}/anomalies/${selectedItem.id}/sop`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objective: 'Prevent recurrence at source', max_steps: 8 }),
      });
      if (!response.ok) throw new Error(`failed to generate SOP: ${response.status}`);
      const data = await response.json();
      setSopText(String(data.sop ?? '')); setSopMode(data.mode === 'llm' ? 'llm' : 'fallback');
      if (data.history_entry) {
        setSelectedItem(prev => {
          if (!prev) return prev;
          return { ...prev, sop_history: [...(prev.sop_history ?? []), data.history_entry as SOPHistoryItem] };
        });
      }
    } catch (err) { setSopError(err instanceof Error ? err.message : 'failed to generate SOP'); }
    finally { setIsSopLoading(false); }
  };

  const sopHistory = useMemo(() => (selectedItem?.sop_history ?? []).slice().reverse(), [selectedItem]);

  const liveConf = alertExplanation ? severityConfig[alertExplanation.severity_level] ?? severityConfig.info : null;

  // Stats
  const critCount = items.filter(i => i.severity_level === 'critical').length;
  const warnCount = items.filter(i => i.severity_level === 'warning').length;
  const avgConfidence = items.length ? items.reduce((a, b) => a + b.confidence, 0) / items.length : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%', minHeight: 0 }}>

      {/* ── Top Stats Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1 }}>
        {[
          { label: 'TOTAL EVENTS', value: items.length, accent: 'var(--gold)', icon: Database },
          { label: 'CRITICAL', value: critCount, accent: 'var(--crimson)', icon: AlertTriangle },
          { label: 'WARNING', value: warnCount, accent: 'var(--copper)', icon: Shield },
          { label: 'AVG CONFIDENCE', value: `${(avgConfidence * 100).toFixed(0)}%`, accent: 'var(--teal)', icon: Target },
          {
            label: 'LIVE STATUS',
            value: alertExplanation ? alertExplanation.severity_level.toUpperCase() : 'NOMINAL',
            accent: liveConf?.color ?? 'var(--gold)', icon: Activity,
          },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} style={{
              padding: '14px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: stat.accent, opacity: 0.6 }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.2em', color: 'var(--text-dim)', marginBottom: 6 }}>{stat.label}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: stat.accent, lineHeight: 1 }}>{stat.value}</div>
                </div>
                <Icon size={18} color={stat.accent} style={{ opacity: 0.25 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Live Analysis Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 0.8fr', gap: 1 }}>

        {/* Card 1: Live Snapshot */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8,
            background: liveConf ? liveConf.bg : 'transparent',
          }}>
            <Zap size={12} color={liveConf?.color ?? 'var(--gold)'} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em', color: liveConf?.color ?? 'var(--text-dim)', fontWeight: 700 }}>LIVE SNAPSHOT</span>
            {alertExplanation && (
              <span style={{
                marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 8, padding: '2px 8px', borderRadius: 3,
                color: liveConf!.color, background: liveConf!.bg, border: `1px solid ${liveConf!.border}`,
                letterSpacing: '0.12em', fontWeight: 700,
              }}>{alertExplanation.severity_level.toUpperCase()}</span>
            )}
          </div>
          <div style={{ padding: 16, flex: 1 }}>
            {!alertExplanation ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.4 }}>
                <Activity size={28} color="var(--text-dim)" />
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', marginTop: 10 }}>Awaiting anomalous event...</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <MetricCell label="TYPE" value={alertExplanation.anomaly_type.replace('_', ' ')} color="var(--text-primary)" />
                  <MetricCell label="SEVERITY" value={String(alertExplanation.severity_score)} color={liveConf!.color} />
                  <MetricCell label="CONFIDENCE" value={`${(alertExplanation.confidence * 100).toFixed(1)}%`} color="var(--teal)" />
                  <MetricCell label="DURATION" value={`${alertExplanation.duration_steps} steps`} color="var(--text-secondary)" />
                </div>
                {scoreComponents && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.15em', color: 'var(--text-dim)', marginBottom: 8 }}>SCORE COMPONENTS</div>
                    {[
                      { label: 'RECONSTRUCTION', value: scoreComponents.recon, color: 'var(--crimson)', max: Math.max(scoreComponents.recon, scoreComponents.forecast, scoreComponents.corr, 0.001) },
                      { label: 'FORECAST', value: scoreComponents.forecast, color: 'var(--teal)', max: Math.max(scoreComponents.recon, scoreComponents.forecast, scoreComponents.corr, 0.001) },
                      { label: 'CORRELATION', value: scoreComponents.corr, color: 'var(--copper)', max: Math.max(scoreComponents.recon, scoreComponents.forecast, scoreComponents.corr, 0.001) },
                    ].map(bar => (
                      <div key={bar.label} style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)', letterSpacing: '0.1em' }}>{bar.label}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: bar.color, fontWeight: 600 }}>{bar.value.toFixed(5)}</span>
                        </div>
                        <div style={{ height: 3, background: 'rgba(184,134,42,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', width: `${Math.min((bar.value / bar.max) * 100, 100)}%`,
                            background: bar.color, borderRadius: 2,
                            transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                            boxShadow: `0 0 8px ${bar.color}50`,
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Source Breakdown */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Crosshair size={12} color="var(--teal)" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--teal)', fontWeight: 700 }}>SOURCE ATTRIBUTION</span>
            {sourceContributors.length > 0 && (
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)' }}>{sourceContributors.length} sensors</span>
            )}
          </div>
          <div style={{ padding: 16, flex: 1 }}>
            {sourceContributors.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.4 }}>
                <Layers size={28} color="var(--text-dim)" />
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', marginTop: 10 }}>Waiting for source data...</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sourceContributors.map((c, idx) => {
                  const isTop = idx === 0;
                  const barColor = isTop ? 'var(--crimson)' : idx === 1 ? 'var(--copper)' : 'var(--teal)';
                  return (
                    <div key={c.sensor} style={{
                      padding: '10px 12px', background: isTop ? 'rgba(168,50,64,0.06)' : 'var(--bg)',
                      border: `1px solid ${isTop ? 'rgba(168,50,64,0.2)' : 'var(--border)'}`,
                      borderRadius: 3,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {isTop && <Zap size={10} color="var(--crimson)" />}
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: 11, color: isTop ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontWeight: isTop ? 700 : 400,
                          }}>{sensorDisplayName(c.sensor, c.sensor_label)}</span>
                          {isTop && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--crimson)', letterSpacing: '0.15em', padding: '1px 5px', background: 'rgba(168,50,64,0.12)', borderRadius: 2 }}>PRIMARY</span>}
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: barColor, fontWeight: 700 }}>{c.contribution_pct.toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 3, background: 'rgba(184,134,42,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${Math.max(2, Math.min(100, c.contribution_pct))}%`,
                          background: barColor, borderRadius: 2,
                          boxShadow: `0 0 8px ${barColor}40`,
                          transition: 'width 0.4s ease',
                        }} />
                      </div>
                    </div>
                  );
                })}
                {sourceView && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, marginTop: 4 }}>
                    <MetricCell label="Z-RECON" value={sourceView.breakdown.z_scores.recon.toFixed(3)} color="var(--crimson)" />
                    <MetricCell label="Z-FORECAST" value={sourceView.breakdown.z_scores.forecast.toFixed(3)} color="var(--teal)" />
                    <MetricCell label="Z-CORR" value={sourceView.breakdown.z_scores.corr.toFixed(3)} color="var(--copper)" />
                  </div>
                )}
                <div style={{
                  padding: '6px 10px', background: 'rgba(160,88,26,0.05)', border: '1px solid rgba(160,88,26,0.15)',
                  fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--copper)', letterSpacing: '0.08em', lineHeight: 1.5, borderRadius: 2,
                }}>
                  Source ranking is probabilistic attribution, not guaranteed root-cause.
                  Confidence: {((selectedItem?.confidence ?? alertExplanation?.confidence ?? 0) * 100).toFixed(1)}%
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Correlation Shift + SOP */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={12} color="var(--copper)" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--copper)', fontWeight: 700 }}>CORRELATION</span>
          </div>
          <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column' }}>
            {!sourceView?.correlation_change.ready ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, opacity: 0.4 }}>
                <ActivitySquare size={24} color="var(--text-dim)" />
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)', marginTop: 8 }}>Building correlation baseline...</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                <MetricCell label="FROBENIUS NORM" value={sourceView.correlation_change.fro_norm.toFixed(5)} color="var(--copper)" />
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {sourceView.correlation_change.top_pair_changes.slice(0, 4).map(pair => {
                    const d = pair.delta;
                    const DIcon = d > 0 ? ArrowUpRight : d < 0 ? ArrowDownRight : Minus;
                    return (
                      <div key={`${pair.sensor_a}-${pair.sensor_b}`} style={{
                        padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 2,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-secondary)' }}>
                          {sensorDisplayName(pair.sensor_a, pair.sensor_a_label).slice(0, 8)} - {sensorDisplayName(pair.sensor_b, pair.sensor_b_label).slice(0, 8)}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <DIcon size={10} color={Math.abs(d) > 0.1 ? 'var(--crimson)' : 'var(--copper)'} />
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: Math.abs(d) > 0.1 ? 'var(--crimson)' : 'var(--copper)', fontWeight: 600 }}>
                            {d > 0 ? '+' : ''}{d.toFixed(3)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SOP section */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={11} color="var(--gold)" />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.15em', color: 'var(--text-dim)' }}>SOP</span>
                </div>
                <button onClick={() => void generateSop()} disabled={isSopLoading || !selectedItem} style={{
                  padding: '4px 10px', border: '1px solid var(--border)', background: selectedItem ? 'rgba(184,134,42,0.08)' : 'transparent',
                  color: selectedItem ? 'var(--gold)' : 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.1em',
                  cursor: selectedItem ? 'pointer' : 'not-allowed', borderRadius: 2, transition: 'all 0.15s',
                }}>
                  {isSopLoading ? 'GENERATING...' : 'GENERATE'}
                </button>
              </div>
              {sopError && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--crimson)', marginBottom: 6 }}>{sopError}</div>}
              {sopText && (
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', padding: 10, borderRadius: 2, maxHeight: 120, overflowY: 'auto' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-dim)', marginBottom: 4, letterSpacing: '0.12em' }}>MODE: {(sopMode || 'fallback').toUpperCase()}</div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-primary)', lineHeight: 1.5 }}>{sopText}</pre>
                </div>
              )}
              {sopHistory.length > 0 && !sopText && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)' }}>{sopHistory.length} SOP(s) generated</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Historical List + Detail ── */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 0, border: '1px solid var(--border)' }}>

        {/* Left: Event List */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', background: 'var(--bg-card)' }}>
          {/* List header */}
          <div style={{
            padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'rgba(184,134,42,0.03)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database size={12} color="var(--gold)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--text-secondary)' }}>ANOMALY EVENTS</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)', padding: '1px 6px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 3 }}>{items.length}</span>
            </div>
            <button onClick={() => void loadAnomalies()} disabled={isLoading} style={{
              width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', borderRadius: 3,
            }}>
              <RefreshCw size={11} color="var(--text-dim)" className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          {!isConnected && (
            <div style={{ padding: '6px 16px', background: 'rgba(160,88,26,0.06)', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--copper)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={10} /> Backend disconnected — data may be stale
            </div>
          )}

          {error && (
            <div style={{ padding: '6px 16px', background: 'rgba(168,50,64,0.06)', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--crimson)' }}>{error}</div>
          )}

          {/* List body */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {items.length === 0 && !isLoading ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <Search size={24} color="var(--text-dim)" style={{ opacity: 0.3, marginBottom: 8 }} />
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)' }}>No anomalies recorded</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)', opacity: 0.5, marginTop: 4 }}>{activeDataset === 'solar_synthetic' ? 'Solar Array' : activeDataset === 'wind_synthetic' ? 'Wind Farm' : activeDataset === 'synthetic' ? 'Generic' : activeDataset.replace(/_synthetic/g, '').replace(/_/g, ' ')}</div>
              </div>
            ) : items.map(item => {
              const isActive = selectedId === item.id;
              const sev = severityConfig[item.severity_level] ?? severityConfig.info;
              return (
                <button key={item.id} onClick={() => setSelectedId(item.id)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', textAlign: 'left', cursor: 'pointer',
                  background: isActive ? 'rgba(184,134,42,0.08)' : 'transparent',
                  border: 'none', borderBottom: '1px solid var(--border)',
                  borderLeft: isActive ? '3px solid var(--gold)' : '3px solid transparent',
                  transition: 'all 0.15s ease',
                }}>
                  {/* Severity dot */}
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: sev.color,
                    boxShadow: item.severity_level === 'critical' ? `0 0 8px ${sev.color}` : 'none',
                  }} />
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 600 }}>
                        #{item.id} @ tick {item.tick}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.12em', padding: '2px 6px', borderRadius: 2,
                        color: sev.color, background: sev.bg, border: `1px solid ${sev.border}`, fontWeight: 700,
                      }}>{item.severity_level.toUpperCase()}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)' }}>
                      <span>{item.anomaly_type.replace('_', ' ')}</span>
                      <span style={{ opacity: 0.4 }}>|</span>
                      <span>loss: {item.system_loss.toFixed(4)}</span>
                    </div>
                  </div>
                  <ChevronRight size={12} color={isActive ? 'var(--gold)' : 'var(--text-dim)'} style={{ opacity: isActive ? 1 : 0.3, flexShrink: 0 }} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Detail Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
          {/* Detail header */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--text-primary)', fontWeight: 600 }}>
              {selectedItem ? `EVENT #${selectedItem.id}` : 'EVENT DETAIL'}
            </span>
            {selectedItem && (() => {
              const sev = severityConfig[selectedItem.severity_level] ?? severityConfig.info;
              return (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 7, padding: '2px 8px', borderRadius: 2,
                  color: sev.color, background: sev.bg, border: `1px solid ${sev.border}`, letterSpacing: '0.12em', fontWeight: 700,
                }}>{selectedItem.severity_level.toUpperCase()}</span>
              );
            })()}
            {selectedItem && (
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={10} /> {new Date(selectedItem.created_at_ms).toLocaleString()}
              </span>
            )}
          </div>

          {/* Detail body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            {isDetailLoading && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)' }}>Loading detail...</div>
            )}
            {!isDetailLoading && !selectedItem && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.4 }}>
                <Search size={36} color="var(--text-dim)" />
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', marginTop: 12 }}>Select an anomaly event to inspect</div>
              </div>
            )}
            {!isDetailLoading && selectedItem && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Key metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                  <MetricCell label="ANOMALY TYPE" value={selectedItem.anomaly_type.replace('_', ' ')} color="var(--text-primary)" />
                  <MetricCell label="SYSTEM LOSS" value={selectedItem.system_loss.toFixed(5)} color="var(--crimson)" />
                  <MetricCell label="CONFIDENCE" value={`${(selectedItem.confidence * 100).toFixed(1)}%`} color="var(--teal)" />
                  <MetricCell label="DURATION" value={`${selectedItem.duration_steps} steps`} color="var(--text-secondary)" />
                </div>

                {/* Investigation Hints */}
                {selectedItem.investigation_hints.length > 0 && (
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.18em', color: 'var(--text-dim)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 2, height: 10, background: 'var(--gold)' }} />
                      INVESTIGATION HINTS
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {selectedItem.investigation_hints.map((hint, i) => (
                        <div key={i} style={{
                          padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 2,
                          fontFamily: 'var(--font-serif)', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5,
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                        }}>
                          <ChevronRight size={12} color="var(--gold)" style={{ marginTop: 2, flexShrink: 0 }} />
                          {hint}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Sensor Evidence */}
                {selectedTopSensors.length > 0 && (
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.18em', color: 'var(--text-dim)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 2, height: 10, background: 'var(--crimson)' }} />
                      SENSOR EVIDENCE
                    </div>
                    <div style={{ border: '1px solid var(--border)', overflow: 'hidden', borderRadius: 2 }}>
                      {/* Table header */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: 0, background: 'rgba(184,134,42,0.04)', borderBottom: '1px solid var(--border)' }}>
                        {['SENSOR', 'ACTUAL', 'FORECAST', 'RESIDUAL'].map(h => (
                          <div key={h} style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.15em', color: 'var(--text-dim)' }}>{h}</div>
                        ))}
                      </div>
                      {selectedTopSensors.slice(0, 5).map((se, idx) => (
                        <div key={se.sensor} style={{
                          display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: 0,
                          borderBottom: idx < selectedTopSensors.length - 1 ? '1px solid var(--border)' : 'none',
                          background: idx === 0 ? 'rgba(168,50,64,0.04)' : 'transparent',
                        }}>
                          <div style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, color: idx === 0 ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: idx === 0 ? 600 : 400 }}>
                            {sensorDisplayName(se.sensor, se.sensor_label)}
                          </div>
                          <div style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>{se.actual.toFixed(4)}</div>
                          <div style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--teal)' }}>{se.forecast.toFixed(4)}</div>
                          <div style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--crimson)', fontWeight: 600 }}>{se.abs_residual.toFixed(4)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SOP History */}
                {sopHistory.length > 0 && (
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.18em', color: 'var(--text-dim)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 2, height: 10, background: 'var(--teal)' }} />
                      SOP HISTORY ({sopHistory.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                      {sopHistory.slice(0, 5).map((item, idx) => (
                        <div key={`${item.created_at_ms}-${idx}`} style={{
                          padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 2,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)', marginBottom: 4 }}>
                            <span>{new Date(item.created_at_ms).toLocaleString()}</span>
                            <span style={{
                              padding: '1px 6px', borderRadius: 2,
                              background: item.mode === 'llm' ? 'rgba(42,122,106,0.1)' : 'rgba(184,134,42,0.1)',
                              color: item.mode === 'llm' ? 'var(--teal)' : 'var(--gold)',
                            }}>{item.mode.toUpperCase()}</span>
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.objective}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


function MetricCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.18em', color: 'var(--text-dim)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color, fontWeight: 600, wordBreak: 'break-all' }}>{value}</div>
    </div>
  );
}
