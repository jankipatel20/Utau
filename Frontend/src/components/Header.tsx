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
    padding: '4px 10px', border: isActive ? '1px solid rgba(201,146,42,0.12)' : '1px solid transparent',
    background: isActive ? 'rgba(28,26,23,0.8)' : 'transparent',
    fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 500, letterSpacing: '0.1em',
    color: isActive ? '#F0EBE0' : '#A09D94', cursor: 'pointer', transition: 'all 0.2s',
    display: 'flex', alignItems: 'center', gap: 6, borderRadius: 4, whiteSpace: 'nowrap' as const
  });

  return (
    <header style={{
      height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', borderBottom: '1px solid var(--border)', background: 'rgba(8,8,7,0.95)',
      position: 'relative', zIndex: 100, gap: 12
    }}>
      {/* ── Brand (Left) ── */}
      <div style={{ flex: '0 0 auto' }}>
        <button onClick={onNavigateHome} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <div style={{ width: 28, height: 28, border: '1.5px solid var(--gold)', transform: 'rotate(45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="logo-icon-inner" style={{ width: 10, height: 10, background: 'var(--gold)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: '0.2em', color: '#F0EBE0', lineHeight: 1 }}>UTAU</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, fontWeight: 500, color: '#A09D94', letterSpacing: '0.35em', lineHeight: 1 }}>RENEWABLE ENERGY HUB</div>
          </div>
        </button>
      </div>

      {/* ── Center Navigation ── */}
      <div style={{ flex: '1 1 auto', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
        
        {/* Dataset Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'rgba(28,26,23,0.5)', padding: '4px', borderRadius: 6, border: '1px solid rgba(201,146,42,0.15)' }}>
          {tabs.map(t => (
            <button
              key={t.value}
              style={{
                display: 'flex', alignItems: 'center',
                padding: '4px 10px', borderRadius: 4, whiteSpace: 'nowrap',
                background: activeDataset === t.value ? 'rgba(201,146,42,0.15)' : 'transparent',
                border: activeDataset === t.value ? '1px solid rgba(201,146,42,0.3)' : '1px solid transparent',
                fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
                color: activeDataset === t.value ? 'var(--gold-bright)' : '#A09D94',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
              onClick={() => onChangeDataset(t.value)}
              onMouseEnter={e => { if (activeDataset !== t.value) e.currentTarget.style.color = '#F0EBE0'; }}
              onMouseLeave={e => { if (activeDataset !== t.value) e.currentTarget.style.color = '#A09D94'; }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Feature Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'rgba(28,26,23,0.3)', padding: '4px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.02)' }}>
          <button style={tabStyle(activeFeatureTab === 'live')} onClick={() => onFeatureTabChange('live')}>
            <Radio size={12} color={activeFeatureTab === 'live' ? 'var(--gold-bright)' : 'var(--gold)'} /> LIVE
          </button>
          {isAnomalySourceTabEnabled && (
            <button style={tabStyle(activeFeatureTab === 'anomaly-source')} onClick={() => onFeatureTabChange('anomaly-source')}>
              <Cpu size={12} color={activeFeatureTab === 'anomaly-source' ? 'var(--gold-bright)' : 'var(--crimson)'} /> SOURCE
            </button>
          )}
          {isDataSourceTabEnabled && (
            <button style={tabStyle(activeFeatureTab === 'data-source')} onClick={() => onFeatureTabChange('data-source')}>
              <Activity size={12} color={activeFeatureTab === 'data-source' ? 'var(--gold-bright)' : 'var(--teal)'} /> SENSORS
            </button>
          )}
        </div>

        {/* Tools Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'rgba(28,26,23,0.3)', padding: '4px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.02)' }}>
          <button style={tabStyle(false)} onClick={onNavigateToFleet}>
            <Layers size={12} color="var(--copper)" /> FLEET
          </button>
          {onNavigateToInspect && (
            <button style={tabStyle(false)} onClick={onNavigateToInspect}>
              <Camera size={12} color="var(--teal)" /> INSPECT
            </button>
          )}
          <button style={tabStyle(false)} onClick={onNavigateToChat}>
            <MessageSquare size={12} color="#F0EBE0" /> COPILOT
          </button>
        </div>
      </div>

      {/* ── Status + Actions (Right) ── */}
      <div style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
        {onGeneratePDF && (
          <button
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 4, border: '1px solid rgba(201,146,42,0.4)', background: 'rgba(201,146,42,0.1)', cursor: 'pointer', whiteSpace: 'nowrap' }}
            onClick={onGeneratePDF}
            title="Export High-Quality PDF Report"
          >
            <FileDown size={14} color="var(--gold-bright)" />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600, color: 'var(--gold-bright)', letterSpacing: '0.1em' }}>EXPORT</span>
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 4, border: `1px solid ${color}40`, background: `${color}10`, whiteSpace: 'nowrap' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}` }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600, color, letterSpacing: '0.15em' }}>
            {stateLabel(state)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 4, border: '1px solid rgba(201,146,42,0.2)', background: 'rgba(28,26,23,0.8)', whiteSpace: 'nowrap' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: isConnected ? 'var(--gold-bright)' : '#A09D94', animation: isConnected ? 'dot-pulse 1.6s infinite' : 'none' }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600, color: isConnected ? 'var(--gold-bright)' : '#A09D94', letterSpacing: '0.1em' }}>
            {isConnected ? 'STREAMING' : 'OFFLINE'}
          </span>
        </div>
      </div>
    </header>
  );
}
