// Header.tsx — Dark Prestige UTAU Command Center Header
import { Activity, Cpu, Radio, Zap, MessageSquare, FileDown, Layers, Camera, Sun, Wind, Box } from 'lucide-react';

export type SystemState = 'HEALTHY' | 'WARNING' | 'CRITICAL';

const stateColor = (s: SystemState) => s === 'CRITICAL' ? 'var(--crimson)' : s === 'WARNING' ? 'var(--copper)' : 'var(--gold)';
const stateLabel = (s: SystemState) => s === 'CRITICAL' ? 'CRITICAL' : s === 'WARNING' ? 'WARNING' : 'NOMINAL';

interface UtauHeaderProps {
  state: SystemState;
  isConnected: boolean;
  tabs: { label: string; value: string }[];
  activeDataset: string;
  isTransitioning: boolean;
  onChangeDataset: (ds: string) => void;
  isAnomalySourceTabEnabled: boolean;
  isDataSourceTabEnabled: boolean;
  isRlPolicySuggestionsEnabled?: boolean;
  activeFeatureTab: 'live' | 'anomaly-source' | 'data-source';
  onFeatureTabChange: (tab: 'live' | 'anomaly-source' | 'data-source') => void;
  onNavigateHome: () => void;
  onNavigateToChat: () => void;
  onNavigateToFleet: () => void;
  onNavigateToInspect?: () => void;
  onGeneratePDF?: () => void;
}

export function UtauHeader({
  state, isConnected, tabs, activeDataset, isTransitioning,
  onChangeDataset, isAnomalySourceTabEnabled, isDataSourceTabEnabled, isRlPolicySuggestionsEnabled,
  activeFeatureTab, onFeatureTabChange, onNavigateHome, onNavigateToChat, onNavigateToFleet, onNavigateToInspect, onGeneratePDF
}: UtauHeaderProps) {
  const color = stateColor(state);

  const tabStyle = (isActive: boolean) => ({
    padding: '8px 16px', border: isActive ? '1px solid rgba(201,146,42,0.12)' : '1px solid transparent',
    background: isActive ? 'rgba(28,26,23,0.8)' : 'transparent',
    fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 500, letterSpacing: '0.15em',
    color: isActive ? '#F0EBE0' : '#A09D94', cursor: 'pointer', transition: 'all 0.2s',
  });

  return (
    <header style={{
      height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px', borderBottom: '1px solid var(--border)', background: 'rgba(8,8,7,0.92)',
      backdropFilter: 'blur(12px)', position: 'relative', zIndex: 100
    }}>

      {/* ── Brand (Left) ── */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
        <button onClick={onNavigateHome} style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
          <div style={{ width: 32, height: 32, border: '1.5px solid var(--gold)', transform: 'rotate(45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="logo-icon-inner" style={{ width: 12, height: 12, background: 'var(--gold)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.2em', color: '#F0EBE0', lineHeight: 1 }}>
              UTAU
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, fontWeight: 500, color: '#A09D94', letterSpacing: '0.35em', lineHeight: 1 }}>
              RENEWABLE ENERGY HUB
            </div>
          </div>
        </button>
      </div>

      {/* ── Center Navigation ── */}
      <div style={{ flex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24 }}>
        
        {/* Dataset Segmented Control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(28,26,23,0.5)', padding: '4px', borderRadius: 6, border: '1px solid rgba(201,146,42,0.15)' }}>
          {tabs.map(t => (
            <button
              key={t.value}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 16px', borderRadius: 4,
                background: activeDataset === t.value ? 'rgba(201,146,42,0.15)' : 'transparent',
                border: activeDataset === t.value ? '1px solid rgba(201,146,42,0.3)' : '1px solid transparent',
                fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600, letterSpacing: '0.15em',
                color: activeDataset === t.value ? 'var(--gold-bright)' : '#A09D94',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
              disabled={isTransitioning}
              onClick={() => onChangeDataset(t.value)}
              onMouseEnter={e => { if (activeDataset !== t.value) e.currentTarget.style.color = '#F0EBE0'; }}
              onMouseLeave={e => { if (activeDataset !== t.value) e.currentTarget.style.color = '#A09D94'; }}
            >
              {t.value === 'solar_synthetic' && <Sun size={12} color={activeDataset === t.value ? 'var(--gold-bright)' : '#A09D94'} style={{ transition: 'color 0.2s' }} />}
              {t.value === 'wind_synthetic' && <Wind size={12} color={activeDataset === t.value ? 'var(--gold-bright)' : '#A09D94'} style={{ transition: 'color 0.2s' }} />}
              {t.value === 'synthetic' && <Box size={12} color={activeDataset === t.value ? 'var(--gold-bright)' : '#A09D94'} style={{ transition: 'color 0.2s' }} />}
              {t.label}
            </button>
          ))}
        </div>

        {/* View Mode Segmented Control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(28,26,23,0.5)', padding: '4px', borderRadius: 6, border: '1px solid rgba(201,146,42,0.15)' }}>
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 4,
              background: activeFeatureTab === 'live' ? 'rgba(201,146,42,0.15)' : 'transparent',
              border: activeFeatureTab === 'live' ? '1px solid rgba(201,146,42,0.3)' : '1px solid transparent',
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
              color: activeFeatureTab === 'live' ? '#F0EBE0' : '#A09D94', cursor: 'pointer', transition: 'all 0.2s',
            }}
            onClick={() => onFeatureTabChange('live')}
          >
            <Radio size={12} color={activeFeatureTab === 'live' ? 'var(--gold)' : '#A09D94'} /> LIVE
          </button>
          
          {isAnomalySourceTabEnabled && (
            <button
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 4,
                background: activeFeatureTab === 'anomaly-source' ? 'rgba(168,50,64,0.15)' : 'transparent',
                border: activeFeatureTab === 'anomaly-source' ? '1px solid rgba(168,50,64,0.3)' : '1px solid transparent',
                fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
                color: activeFeatureTab === 'anomaly-source' ? '#F0EBE0' : '#A09D94', cursor: 'pointer', transition: 'all 0.2s',
              }}
              onClick={() => onFeatureTabChange('anomaly-source')}
            >
              <Cpu size={12} color={activeFeatureTab === 'anomaly-source' ? 'var(--crimson)' : '#A09D94'} /> ANOMALIES
            </button>
          )}

          {isDataSourceTabEnabled && (
            <button
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 4,
                background: activeFeatureTab === 'data-source' ? 'rgba(42,122,106,0.15)' : 'transparent',
                border: activeFeatureTab === 'data-source' ? '1px solid rgba(42,122,106,0.3)' : '1px solid transparent',
                fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
                color: activeFeatureTab === 'data-source' ? '#F0EBE0' : '#A09D94', cursor: 'pointer', transition: 'all 0.2s',
              }}
              onClick={() => onFeatureTabChange('data-source')}
            >
              <Activity size={12} color={activeFeatureTab === 'data-source' ? 'var(--teal)' : '#A09D94'} /> DATA
            </button>
          )}
        </div>

        {/* Global Tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 8 }}>
          <button
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600, color: '#F0EBE0', cursor: 'pointer', letterSpacing: '0.1em' }}
            onClick={onNavigateToFleet}
          >
            <Layers size={14} color="var(--copper)" /> FLEET
          </button>
          {onNavigateToInspect && (
            <button
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600, color: '#F0EBE0', cursor: 'pointer', letterSpacing: '0.1em' }}
              onClick={onNavigateToInspect}
            >
              <Camera size={14} color="var(--teal)" /> INSPECT
            </button>
          )}
          <button
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600, color: '#F0EBE0', cursor: 'pointer', letterSpacing: '0.1em' }}
            onClick={onNavigateToChat}
          >
            <MessageSquare size={14} color="var(--gold)" /> COPILOT
          </button>

          {onGeneratePDF && (
            <button
              style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--gold-bright)', borderRadius: 4, padding: '6px 16px', background: 'rgba(212,168,83,0.1)', cursor: 'pointer' }}
              onClick={onGeneratePDF}
            >
              <FileDown size={14} color="var(--gold-bright)" /> 
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, color: 'var(--gold-bright)', letterSpacing: '0.1em' }}>EXPORT</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Status + Connection (Right) ── */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 4, border: `1px solid ${color}40`, background: `${color}10` }}>
          <span className="eyebrow-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}`, display: 'inline-block' }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600, color, letterSpacing: '0.2em' }}>
            {stateLabel(state)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 4, border: '1px solid rgba(201,146,42,0.2)', background: 'rgba(28,26,23,0.8)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: isConnected ? 'var(--gold-bright)' : '#A09D94', display: 'inline-block', animation: isConnected ? 'dot-pulse 1.6s infinite' : 'none' }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600, color: isConnected ? 'var(--gold-bright)' : '#A09D94', letterSpacing: '0.15em' }}>
            {isConnected ? 'STREAMING' : 'OFFLINE'}
          </span>
        </div>
      </div>
    </header>
  );
}
