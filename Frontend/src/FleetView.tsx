import { useState, useEffect } from 'react';
import { Layers, AlertTriangle, ChevronRight, DollarSign, Activity, Zap } from 'lucide-react';

const G  = 'var(--gold)';
const GB = 'var(--gold-bright)';
const CU = 'var(--copper)';
const CR = 'var(--crimson)';
const TL = 'var(--teal)';
const TP = 'var(--text-primary)';
const TS = 'var(--text-secondary)';
const TD = 'var(--text-dim)';

interface FleetAsset {
  asset_id: string;
  dataset_type: string;
  is_anomalous: boolean;
  anomaly_score: number;
  severity_level: string;
  priority_score: number;
  last_update_tick: number;
  revenue_loss: {
    cumulative_energy_loss_kwh: number;
    cumulative_revenue_loss_usd: number;
    current_deficit_rate_kw: number;
    anomaly_active: boolean;
    anomaly_duration_ticks: number;
  };
}

interface FleetSummary {
  dataset: string;
  domain: string;
  total_assets: number;
  anomalous_assets: number;
  total_revenue_loss_usd: number;
  assets: FleetAsset[];
}

interface FleetViewProps {
  onBack: () => void;
  activeDataset: string;
}

function severityColor(level: string) {
  if (level === 'critical') return CR;
  if (level === 'warning') return CU;
  return TL;
}

function severityBg(level: string) {
  if (level === 'critical') return 'rgba(168, 50, 64, 0.10)';
  if (level === 'warning') return 'rgba(160, 88, 26, 0.10)';
  return 'rgba(42, 122, 106, 0.10)';
}

export default function FleetView({ onBack, activeDataset }: FleetViewProps) {
  const [fleet, setFleet] = useState<FleetSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchFleet = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/fleet/summary');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setFleet(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };
    fetchFleet();
    const id = window.setInterval(fetchFleet, 3000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [activeDataset]);

  const domain = fleet?.domain || 'unknown';
  const domainLabel = domain === 'solar' ? 'SOLAR FARM' : domain === 'wind' ? 'WIND FARM' : 'FLEET';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', background: 'var(--bg-page)', overflow: 'hidden' }}>

      {/* Header bar */}
      <div style={{
        height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px', borderBottom: '1px solid var(--gold-border)',
        background: 'rgba(252, 245, 228, 0.88)', backdropFilter: 'blur(24px)',
        boxShadow: '0 2px 20px rgba(140, 100, 30, 0.10)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={onBack}
            style={{
              background: 'none', border: '1px solid var(--gold-border)', borderRadius: 6,
              padding: '6px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: "var(--font-display)", fontSize: 10, fontWeight: 600,
              letterSpacing: '0.18em', color: TS,
            }}
          >
            DASHBOARD
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={16} color={G} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, letterSpacing: '0.15em', color: TP }}>
              {domainLabel} FLEET
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {fleet && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={14} color={G} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: TS }}>
                  {fleet.total_assets} assets
                </span>
              </div>
              {fleet.anomalous_assets > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: `${CR}12`, border: `1px solid ${CR}30`, borderRadius: 6 }}>
                  <AlertTriangle size={13} color={CR} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: CR, fontWeight: 600 }}>
                    {fleet.anomalous_assets} at risk
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <DollarSign size={14} color={CU} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: CU, fontWeight: 600 }}>
                  ${fleet.total_revenue_loss_usd.toFixed(2)} loss
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Fleet cards */}
      <div style={{ flex: 1, overflow: 'auto', padding: 32 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, fontFamily: 'var(--font-serif)', fontSize: 16, color: TD, fontStyle: 'italic' }}>
            Loading fleet data...
          </div>
        ) : !fleet || fleet.assets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Layers size={48} color={TD} style={{ marginBottom: 16 }} />
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: TD }}>
              No fleet assets available for <strong>{activeDataset}</strong>
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: TD, marginTop: 8 }}>
              Fleet view is available for solar_synthetic and wind_synthetic datasets.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 900, margin: '0 auto' }}>
            {/* Column headers */}
            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.2fr 1fr 40px',
              gap: 16, padding: '8px 20px',
              fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 600,
              letterSpacing: '0.22em', color: TD, textTransform: 'uppercase',
            }}>
              <span>Asset</span>
              <span>Status</span>
              <span>Score</span>
              <span>Revenue Loss</span>
              <span>Priority</span>
              <span></span>
            </div>

            {fleet.assets.map((asset) => {
              const sColor = severityColor(asset.severity_level);
              const sBg = severityBg(asset.severity_level);
              return (
                <button
                  key={asset.asset_id}
                  onClick={onBack}
                  style={{
                    display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.2fr 1fr 40px',
                    gap: 16, padding: '16px 20px', alignItems: 'center',
                    background: asset.is_anomalous ? sBg : 'var(--bg-panel)',
                    border: `1px solid ${asset.is_anomalous ? sColor + '40' : 'var(--gold-border)'}`,
                    borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.2s', width: '100%',
                    boxShadow: asset.is_anomalous
                      ? `0 2px 16px ${sColor}18`
                      : '0 2px 12px rgba(140, 100, 30, 0.08)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 4px 24px ${sColor || G}25`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = asset.is_anomalous ? `0 2px 16px ${sColor}18` : '0 2px 12px rgba(140, 100, 30, 0.08)'; }}
                >
                  {/* Asset ID */}
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: TP }}>
                      {asset.asset_id}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: TD, marginTop: 2, letterSpacing: '0.1em' }}>
                      {asset.dataset_type.toUpperCase()} ASSET
                    </div>
                  </div>

                  {/* Status badge */}
                  <div>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 10px', borderRadius: 20,
                      border: `1px solid ${sColor}50`,
                      background: sBg,
                      fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700,
                      color: sColor, letterSpacing: '0.15em',
                      animation: asset.severity_level === 'critical' ? 'golden-breathe 1s infinite' : 'none',
                    }}>
                      {asset.is_anomalous && <AlertTriangle size={10} />}
                      {asset.severity_level.toUpperCase()}
                    </span>
                  </div>

                  {/* Anomaly score */}
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: asset.is_anomalous ? sColor : TS }}>
                    {asset.anomaly_score.toFixed(3)}
                  </div>

                  {/* Revenue loss */}
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: asset.revenue_loss.cumulative_revenue_loss_usd > 0 ? CU : TS }}>
                      ${asset.revenue_loss.cumulative_revenue_loss_usd.toFixed(4)}
                    </div>
                    {asset.revenue_loss.current_deficit_rate_kw > 0 && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: CR, marginTop: 2 }}>
                        -{asset.revenue_loss.current_deficit_rate_kw.toFixed(2)} kW
                      </div>
                    )}
                  </div>

                  {/* Priority bar */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: 'var(--bg-recessed)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 99,
                          width: `${Math.min(100, asset.priority_score * 100)}%`,
                          background: asset.priority_score > 0.7
                            ? `linear-gradient(90deg, ${CR}80, ${CR})`
                            : asset.priority_score > 0.3
                            ? `linear-gradient(90deg, ${CU}80, ${CU})`
                            : `linear-gradient(90deg, ${G}60, ${G})`,
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: TD, minWidth: 32, textAlign: 'right' }}>
                        {(asset.priority_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <ChevronRight size={16} color={TD} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
