import { useEffect, useState, type CSSProperties } from 'react';
import {
  RefreshCw, Cable, HeartPulse, FlaskConical, ShieldCheck,
  Plus, Radio, Wifi, Server, Globe, Power, PowerOff,
  CheckCircle2, AlertTriangle, XCircle, Clock, Trash2, Settings2, Signal
} from 'lucide-react';

type SourceItem = {
  id: number;
  name: string;
  protocol: 'kafka' | 'mqtt' | 'opcua' | 'http';
  endpoint: string;
  topic: string | null;
  dataset: string | null;
  expected_dimensions: number | null;
  enabled: boolean;
  is_active: boolean;
  notes: string | null;
  mapping: Record<string, unknown>;
  auth: Record<string, unknown>;
  created_at_ms: number;
  updated_at_ms: number;
};

type SourceHealth = {
  source_id: number;
  source_name: string;
  status: 'healthy' | 'degraded' | 'offline' | 'idle' | 'waiting';
  reason: string;
  message_age_ms: number | null;
  ingest_total: number;
  ingest_drop_ratio: number;
  kafka_connected: boolean;
  dataset_active: boolean;
};

type ValidationResult = {
  valid: boolean;
  issues: string[];
  warnings: string[];
  resolved_mapping: {
    timestamp_path: string;
    vector_path: string;
    expected_dimensions: number | null;
    active_model_dimensions: number;
  };
  sample_check: {
    checked: boolean;
    timestamp_ok: boolean;
    vector_ok: boolean;
    vector_length: number | null;
  };
};

type SourceForm = {
  name: string;
  protocol: 'kafka' | 'mqtt' | 'opcua' | 'http';
  endpoint: string;
  topic: string;
  dataset: string;
  expectedDimensions: string;
  enabled: boolean;
  isActive: boolean;
  notes: string;
  timestampPath: string;
  vectorPath: string;
  authUsername: string;
  authToken: string;
};

const API_BASE = 'http://127.0.0.1:8000';

const defaultForm = (): SourceForm => ({
  name: '',
  protocol: 'mqtt',
  endpoint: '127.0.0.1:1883',
  topic: 'esp32/telemetry',
  dataset: 'ESP32',
  expectedDimensions: '64',
  enabled: true,
  isActive: false,
  notes: '',
  timestampPath: 'timestamp_ms',
  vectorPath: 'sensors',
  authUsername: '',
  authToken: '',
});

const toForm = (source: SourceItem): SourceForm => ({
  name: source.name ?? '',
  protocol: source.protocol ?? 'kafka',
  endpoint: source.endpoint ?? '',
  topic: source.topic ?? '',
  dataset: source.dataset ?? '',
  expectedDimensions: source.expected_dimensions == null ? '' : String(source.expected_dimensions),
  enabled: Boolean(source.enabled),
  isActive: Boolean(source.is_active),
  notes: source.notes ?? '',
  timestampPath: String((source.mapping?.timestamp_path as string) ?? 'timestamp_ms'),
  vectorPath: String((source.mapping?.vector_path as string) ?? 'sensors'),
  authUsername: String((source.auth?.username as string) ?? ''),
  authToken: '',
});

const protocolMeta: Record<string, { icon: typeof Radio; color: string; label: string }> = {
  mqtt: { icon: Wifi, color: 'var(--teal)', label: 'MQTT' },
  kafka: { icon: Radio, color: 'var(--copper)', label: 'KAFKA' },
  opcua: { icon: Server, color: 'var(--gold)', label: 'OPC-UA' },
  http: { icon: Globe, color: '#7B93DB', label: 'HTTP' },
};

const healthMeta: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
  healthy: { color: 'var(--teal)', icon: CheckCircle2 },
  degraded: { color: 'var(--copper)', icon: AlertTriangle },
  offline: { color: 'var(--crimson)', icon: XCircle },
  idle: { color: 'var(--gold)', icon: Clock },
  waiting: { color: 'var(--gold)', icon: Clock },
};

export default function DataSourceTab() {
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<SourceForm>(defaultForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [health, setHealth] = useState<SourceHealth | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [sampleJson, setSampleJson] = useState('');
  const [editMode, setEditMode] = useState(false);

  const loadSources = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/sources`);
      if (!res.ok) throw new Error(`Failed to load sources (${res.status})`);
      const payload = await res.json();
      const items = Array.isArray(payload.items) ? payload.items as SourceItem[] : [];
      setSources(items);
      const nextSelected = items.find((x) => x.id === selectedId)
        ?? (payload.active_source_id ? items.find((x) => x.id === payload.active_source_id) : null)
        ?? items[0] ?? null;
      if (nextSelected) {
        setSelectedId(nextSelected.id);
        setForm(toForm(nextSelected));
      } else {
        setSelectedId(null);
        setForm(defaultForm());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sources');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadSources(); }, []);

  const selectSource = (source: SourceItem) => {
    setSelectedId(source.id);
    setForm(toForm(source));
    setMessage(''); setError(''); setValidation(null); setHealth(null);
    setEditMode(false);
  };

  const buildPayload = () => {
    const expected = form.expectedDimensions.trim();
    return {
      name: form.name.trim(), protocol: form.protocol,
      endpoint: form.endpoint.trim(), topic: form.topic.trim() || null,
      dataset: form.dataset.trim() || null,
      expected_dimensions: expected ? Number(expected) : null,
      enabled: form.enabled, is_active: form.isActive,
      notes: form.notes.trim() || null,
      mapping: { timestamp_path: form.timestampPath.trim() || 'timestamp_ms', vector_path: form.vectorPath.trim() || 'sensors' },
      auth: { username: form.authUsername.trim() || undefined, token: form.authToken.trim() || undefined },
    };
  };

  const saveSource = async (mode: 'create' | 'update') => {
    setIsSaving(true); setMessage(''); setError(''); setValidation(null);
    try {
      const payload = buildPayload();
      const endpoint = mode === 'create' ? `${API_BASE}/sources` : `${API_BASE}/sources/${selectedId}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const res = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Save failed (${res.status})`);
      setMessage(mode === 'create' ? 'Source created successfully.' : 'Source updated.');
      setEditMode(false);
      await loadSources();
      if (mode === 'create' && data?.item?.id) setSelectedId(Number(data.item.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save source');
    } finally { setIsSaving(false); }
  };

  const checkHealth = async () => {
    if (!selectedId) return;
    setError(''); setMessage('');
    try {
      const res = await fetch(`${API_BASE}/sources/${selectedId}/health`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Health check failed (${res.status})`);
      setHealth(data as SourceHealth);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Health check failed');
    }
  };

  const validateMapping = async () => {
    if (!selectedId) return;
    setError(''); setMessage('');
    try {
      let sample: Record<string, unknown> | undefined;
      if (sampleJson.trim()) {
        const parsed = JSON.parse(sampleJson);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('Sample JSON must be an object.');
        sample = parsed as Record<string, unknown>;
      }
      const res = await fetch(`${API_BASE}/sources/${selectedId}/mapping/validate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sample }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `Validation failed (${res.status})`);
      setValidation(data as ValidationResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mapping validation failed');
    }
  };

  const selected = sources.find(s => s.id === selectedId) ?? null;
  const proto = protocolMeta[selected?.protocol ?? 'mqtt'] ?? protocolMeta.mqtt;
  const ProtoIcon = proto.icon;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%', minHeight: 0 }}>

      {/* ── Top Stats Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
        {[
          { label: 'TOTAL SOURCES', value: sources.length, accent: 'var(--gold)' },
          { label: 'ONLINE', value: sources.filter(s => s.enabled).length, accent: 'var(--teal)' },
          { label: 'ACTIVE', value: sources.filter(s => s.is_active).length, accent: 'var(--copper)' },
          { label: 'DIMENSIONS', value: selected?.expected_dimensions ?? '—', accent: '#7B93DB' },
        ].map(stat => (
          <div key={stat.label} style={{
            padding: '14px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: stat.accent, opacity: 0.6 }} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--text-dim)', marginBottom: 6 }}>{stat.label}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--text-primary)', lineHeight: 1 }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* ── Main Grid: Sensor List + Detail Panel ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 0, flex: 1, minHeight: 0, border: '1px solid var(--border)' }}>

        {/* ── Left: Sensor Inventory ── */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', background: 'var(--bg-card)' }}>
          {/* List header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(184,134,42,0.03)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Signal size={13} color="var(--gold)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', color: 'var(--text-secondary)' }}>SENSOR INVENTORY</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => { setSelectedId(null); setForm(defaultForm()); setEditMode(true); setHealth(null); setValidation(null); setMessage(''); setError(''); }}
                style={{ ...iconBtnStyle, background: 'rgba(42,122,106,0.15)', border: '1px solid rgba(42,122,106,0.3)' }} title="Add new sensor source">
                <Plus size={13} color="var(--teal)" />
              </button>
              <button onClick={() => void loadSources()} disabled={isLoading}
                style={iconBtnStyle} title="Refresh list">
                <RefreshCw size={12} color="var(--text-dim)" className={isLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* List body */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {sources.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <Cable size={28} color="var(--text-dim)" style={{ opacity: 0.3, marginBottom: 12 }} />
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)' }}>No sensor sources configured</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)', marginTop: 4, opacity: 0.6 }}>Click + to add your first source</div>
              </div>
            ) : sources.map(s => {
              const isActive = selectedId === s.id;
              const p = protocolMeta[s.protocol] ?? protocolMeta.mqtt;
              const PIcon = p.icon;
              return (
                <button key={s.id} onClick={() => selectSource(s)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px', textAlign: 'left', cursor: 'pointer',
                  background: isActive ? 'rgba(184,134,42,0.08)' : 'transparent',
                  border: 'none', borderBottom: '1px solid var(--border)',
                  borderLeft: isActive ? '3px solid var(--gold)' : '3px solid transparent',
                  transition: 'all 0.15s ease',
                }}>
                  {/* Protocol icon */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${p.color}15`, border: `1px solid ${p.color}30`, flexShrink: 0,
                  }}>
                    <PIcon size={16} color={p.color} />
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 600 }}>
                        {s.name || 'Unnamed'}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.12em', padding: '2px 6px', borderRadius: 3,
                        color: p.color, background: `${p.color}12`, border: `1px solid ${p.color}25`,
                      }}>{p.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)' }}>
                      <span>{s.endpoint.length > 24 ? s.endpoint.slice(0, 22) + '..' : s.endpoint}</span>
                      <span style={{ opacity: 0.4 }}>|</span>
                      <span style={{ color: s.is_active ? 'var(--teal)' : 'var(--text-dim)' }}>
                        {s.is_active ? 'ACTIVE' : s.enabled ? 'STANDBY' : 'OFF'}
                      </span>
                    </div>
                  </div>
                  {/* Status dot */}
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: s.is_active ? 'var(--teal)' : s.enabled ? 'var(--gold)' : 'var(--text-dim)',
                    boxShadow: s.is_active ? '0 0 8px var(--teal)' : 'none',
                    animation: s.is_active ? 'dot-pulse 1.6s infinite' : 'none',
                  }} />
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right: Detail / Edit Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>

          {/* Detail header */}
          <div style={{
            padding: '12px 20px', borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'var(--bg-card)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {selected && <ProtoIcon size={14} color={proto.color} />}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', color: 'var(--text-primary)', fontWeight: 600 }}>
                {editMode && !selected ? 'NEW SENSOR SOURCE' : selected ? selected.name : 'SELECT A SOURCE'}
              </span>
              {selected && (
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 8, padding: '2px 8px', borderRadius: 3,
                  background: selected.is_active ? 'rgba(42,122,106,0.15)' : 'rgba(184,134,42,0.1)',
                  color: selected.is_active ? 'var(--teal)' : 'var(--text-dim)',
                  border: `1px solid ${selected.is_active ? 'rgba(42,122,106,0.3)' : 'var(--border)'}`,
                  letterSpacing: '0.15em',
                }}>{selected.is_active ? 'ACTIVE' : selected.enabled ? 'ENABLED' : 'DISABLED'}</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {selected && !editMode && (
                <button onClick={() => setEditMode(true)} style={{ ...smallBtnStyle, color: 'var(--gold)' }}>
                  <Settings2 size={11} /> CONFIGURE
                </button>
              )}
              {selected && (
                <button onClick={checkHealth} style={{ ...smallBtnStyle, color: 'var(--teal)' }}>
                  <HeartPulse size={11} /> HEALTH
                </button>
              )}
              {selected && (
                <button onClick={validateMapping} style={{ ...smallBtnStyle, color: 'var(--copper)' }}>
                  <FlaskConical size={11} /> VALIDATE
                </button>
              )}
            </div>
          </div>

          {/* Detail body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

            {!selected && !editMode && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.4 }}>
                <Cable size={48} color="var(--text-dim)" />
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', marginTop: 16 }}>Select a sensor source or add a new one</div>
              </div>
            )}

            {(selected || editMode) && !editMode && (
              /* ── Read-only detail view ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Info grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                  {[
                    { label: 'PROTOCOL', value: selected!.protocol.toUpperCase(), color: proto.color },
                    { label: 'ENDPOINT', value: selected!.endpoint, color: 'var(--text-primary)' },
                    { label: 'TOPIC', value: selected!.topic || '—', color: 'var(--text-secondary)' },
                    { label: 'DATASET', value: selected!.dataset || 'All', color: 'var(--text-primary)' },
                    { label: 'DIMENSIONS', value: selected!.expected_dimensions ?? 'Auto', color: '#7B93DB' },
                    { label: 'LAST UPDATED', value: new Date(selected!.updated_at_ms).toLocaleString(), color: 'var(--text-dim)' },
                  ].map(f => (
                    <div key={f.label} style={{ padding: '12px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.2em', color: 'var(--text-dim)', marginBottom: 6 }}>{f.label}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: f.color, wordBreak: 'break-all' }}>{f.value}</div>
                    </div>
                  ))}
                </div>

                {/* Mapping info */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: 16 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--text-dim)', marginBottom: 12 }}>DATA MAPPING</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)', marginBottom: 4 }}>TIMESTAMP PATH</div>
                      <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--teal)', background: 'rgba(42,122,106,0.08)', padding: '4px 8px', borderRadius: 3 }}>
                        {(selected!.mapping?.timestamp_path as string) || 'timestamp_ms'}
                      </code>
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-dim)', marginBottom: 4 }}>VECTOR PATH</div>
                      <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--copper)', background: 'rgba(160,88,26,0.08)', padding: '4px 8px', borderRadius: 3 }}>
                        {(selected!.mapping?.vector_path as string) || 'sensors'}
                      </code>
                    </div>
                  </div>
                </div>

                {selected!.notes && (
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: 14 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.18em', color: 'var(--text-dim)', marginBottom: 8 }}>NOTES</div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{selected!.notes}</div>
                  </div>
                )}
              </div>
            )}

            {editMode && (
              /* ── Edit / Create form ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Section: Identity */}
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--text-dim)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 2, height: 10, background: 'var(--gold)' }} />
                    IDENTITY
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <FormField label="Source Name" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="e.g. ESP32-Panel-A" />
                    <FormSelect label="Protocol" value={form.protocol} onChange={v => setForm(p => ({ ...p, protocol: v as SourceForm['protocol'] }))}
                      options={[{ value: 'mqtt', label: 'MQTT' }, { value: 'kafka', label: 'Kafka' }, { value: 'opcua', label: 'OPC-UA' }, { value: 'http', label: 'HTTP' }]} />
                  </div>
                </div>

                {/* Section: Connection */}
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--text-dim)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 2, height: 10, background: 'var(--teal)' }} />
                    CONNECTION
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <FormField label="Endpoint" value={form.endpoint} onChange={v => setForm(p => ({ ...p, endpoint: v }))} placeholder="127.0.0.1:1883" />
                    <FormField label="Topic / Channel" value={form.topic} onChange={v => setForm(p => ({ ...p, topic: v }))} placeholder="esp32/telemetry" />
                  </div>
                </div>

                {/* Section: Schema */}
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--text-dim)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 2, height: 10, background: 'var(--copper)' }} />
                    SCHEMA & MAPPING
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    <FormSelect label="Dataset" value={form.dataset} onChange={v => setForm(p => ({ ...p, dataset: v }))}
                      options={[{ value: '', label: 'All Datasets' }, { value: 'SMD', label: 'SMD' }, { value: 'MSL', label: 'MSL' }, { value: 'SMAP', label: 'SMAP' }, { value: 'ESP32', label: 'ESP32' }, { value: 'synthetic', label: 'Generic' }]} />
                    <FormField label="Expected Dimensions" value={form.expectedDimensions} onChange={v => setForm(p => ({ ...p, expectedDimensions: v }))} placeholder="e.g. 10" />
                    <FormField label="Timestamp Path" value={form.timestampPath} onChange={v => setForm(p => ({ ...p, timestampPath: v }))} placeholder="timestamp_ms" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 10 }}>
                    <FormField label="Vector Path" value={form.vectorPath} onChange={v => setForm(p => ({ ...p, vectorPath: v }))} placeholder="sensors" />
                    <FormField label="Auth Username" value={form.authUsername} onChange={v => setForm(p => ({ ...p, authUsername: v }))} placeholder="(optional)" />
                    <FormField label="Auth Token" value={form.authToken} onChange={v => setForm(p => ({ ...p, authToken: v }))} placeholder="(optional)" type="password" />
                  </div>
                </div>

                {/* Section: Status Toggles */}
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--text-dim)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 2, height: 10, background: '#7B93DB' }} />
                    STATUS
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <ToggleSwitch label="Enabled" checked={form.enabled} onChange={v => setForm(p => ({ ...p, enabled: v }))} color="var(--teal)" />
                    <ToggleSwitch label="Set as Active" checked={form.isActive} onChange={v => setForm(p => ({ ...p, isActive: v }))} color="var(--gold)" />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.15em', color: 'var(--text-dim)', marginBottom: 6 }}>NOTES</div>
                  <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    style={{ ...inputStyle, minHeight: 60, resize: 'vertical', width: '100%' }} placeholder="Optional notes about this source..." />
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                  {selected ? (
                    <button onClick={() => void saveSource('update')} disabled={isSaving} style={primaryBtnStyle}>
                      {isSaving ? 'SAVING...' : 'UPDATE SOURCE'}
                    </button>
                  ) : (
                    <button onClick={() => void saveSource('create')} disabled={isSaving} style={primaryBtnStyle}>
                      <Plus size={12} /> {isSaving ? 'CREATING...' : 'CREATE SOURCE'}
                    </button>
                  )}
                  <button onClick={() => { setEditMode(false); if (selected) setForm(toForm(selected)); }} style={secondaryBtnStyle}>
                    CANCEL
                  </button>
                </div>
              </div>
            )}

            {/* ── Status Messages ── */}
            {error && (
              <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(168,50,64,0.08)', border: '1px solid rgba(168,50,64,0.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <XCircle size={13} color="var(--crimson)" />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--crimson)' }}>{error}</span>
              </div>
            )}
            {message && (
              <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(42,122,106,0.08)', border: '1px solid rgba(42,122,106,0.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={13} color="var(--teal)" />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--teal)' }}>{message}</span>
              </div>
            )}

            {/* ── Health Result ── */}
            {health && (
              <div style={{ marginTop: 16, background: 'var(--bg-card)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{
                  padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
                  background: `${(healthMeta[health.status] ?? healthMeta.idle).color}08`,
                  borderBottom: '1px solid var(--border)',
                }}>
                  {(() => { const H = (healthMeta[health.status] ?? healthMeta.idle); const Icon = H.icon; return <Icon size={14} color={H.color} />; })()}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.15em', color: (healthMeta[health.status] ?? healthMeta.idle).color, fontWeight: 700 }}>
                    HEALTH: {health.status.toUpperCase()}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)', marginLeft: 'auto' }}>{health.reason}</span>
                </div>
                <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                  {[
                    { label: 'MESSAGES', value: health.ingest_total.toLocaleString(), color: 'var(--text-primary)' },
                    { label: 'DROP RATE', value: `${(health.ingest_drop_ratio * 100).toFixed(1)}%`, color: health.ingest_drop_ratio > 0.05 ? 'var(--crimson)' : 'var(--teal)' },
                    { label: 'KAFKA', value: health.kafka_connected ? 'CONNECTED' : 'DISCONNECTED', color: health.kafka_connected ? 'var(--teal)' : 'var(--text-dim)' },
                    { label: 'MSG AGE', value: health.message_age_ms != null ? `${(health.message_age_ms / 1000).toFixed(1)}s` : '—', color: 'var(--text-secondary)' },
                  ].map(m => (
                    <div key={m.label} style={{ padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.15em', color: 'var(--text-dim)', marginBottom: 4 }}>{m.label}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: m.color, fontWeight: 600 }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Validation Result ── */}
            {validation && (
              <div style={{ marginTop: 16, background: 'var(--bg-card)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{
                  padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
                  background: validation.valid ? 'rgba(42,122,106,0.06)' : 'rgba(160,88,26,0.06)',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <ShieldCheck size={14} color={validation.valid ? 'var(--teal)' : 'var(--copper)'} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.15em', color: validation.valid ? 'var(--teal)' : 'var(--copper)', fontWeight: 700 }}>
                    MAPPING: {validation.valid ? 'VALID' : 'ISSUES FOUND'}
                  </span>
                </div>
                <div style={{ padding: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: validation.issues.length || validation.warnings.length ? 12 : 0 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>
                      Timestamp: <code style={{ color: 'var(--teal)' }}>{validation.resolved_mapping.timestamp_path}</code>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>
                      Vector: <code style={{ color: 'var(--copper)' }}>{validation.resolved_mapping.vector_path}</code>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>
                      Expected dim: <span style={{ color: 'var(--text-primary)' }}>{validation.resolved_mapping.expected_dimensions ?? 'unset'}</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>
                      Model dim: <span style={{ color: 'var(--text-primary)' }}>{validation.resolved_mapping.active_model_dimensions}</span>
                    </div>
                  </div>
                  {validation.issues.map((issue, i) => (
                    <div key={i} style={{ padding: '6px 10px', marginBottom: 4, background: 'rgba(168,50,64,0.06)', border: '1px solid rgba(168,50,64,0.2)', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--crimson)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <XCircle size={11} /> {issue}
                    </div>
                  ))}
                  {validation.warnings.map((warn, i) => (
                    <div key={i} style={{ padding: '6px 10px', marginBottom: 4, background: 'rgba(160,88,26,0.06)', border: '1px solid rgba(160,88,26,0.2)', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--copper)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={11} /> {warn}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Sample JSON for validation ── */}
            {(selected || editMode) && (
              <div style={{ marginTop: 16, background: 'var(--bg-card)', border: '1px solid var(--border)', padding: 14 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.18em', color: 'var(--text-dim)', marginBottom: 8 }}>SAMPLE PAYLOAD (for mapping validation)</div>
                <textarea value={sampleJson} onChange={e => setSampleJson(e.target.value)}
                  style={{ ...inputStyle, minHeight: 72, resize: 'vertical', width: '100%', fontFamily: 'var(--font-mono)', fontSize: 11 }}
                  placeholder='{"timestamp_ms": 1710000000000, "sensors": [0.1, 0.2, ...]}'
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


/* ── Reusable sub-components ── */

function FormField({ label, value, onChange, placeholder, type }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.15em', color: 'var(--text-dim)' }}>{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type}
        style={inputStyle} />
    </label>
  );
}

function FormSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.15em', color: 'var(--text-dim)' }}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function ToggleSwitch({ label, checked, onChange, color }: { label: string; checked: boolean; onChange: (v: boolean) => void; color: string }) {
  return (
    <button onClick={() => onChange(!checked)} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', cursor: 'pointer',
      background: checked ? `${color}10` : 'transparent',
      border: `1px solid ${checked ? `${color}40` : 'var(--border)'}`,
      borderRadius: 4, transition: 'all 0.2s',
    }}>
      <div style={{
        width: 32, height: 16, borderRadius: 8, position: 'relative',
        background: checked ? `${color}40` : 'rgba(255,255,255,0.06)',
        border: `1px solid ${checked ? color : 'var(--border)'}`,
        transition: 'all 0.2s',
      }}>
        <div style={{
          width: 12, height: 12, borderRadius: '50%', position: 'absolute', top: 1,
          left: checked ? 17 : 1,
          background: checked ? color : 'var(--text-dim)',
          transition: 'all 0.2s',
          boxShadow: checked ? `0 0 6px ${color}` : 'none',
        }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: checked ? 'var(--text-primary)' : 'var(--text-dim)', letterSpacing: '0.1em' }}>
        {label}
      </span>
    </button>
  );
}


/* ── Styles ── */

const inputStyle: CSSProperties = {
  border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)',
  padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, borderRadius: 3,
  outline: 'none', transition: 'border-color 0.2s',
};

const iconBtnStyle: CSSProperties = {
  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', borderRadius: 4,
};

const smallBtnStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px',
  border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer',
  fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', borderRadius: 3,
  transition: 'all 0.15s',
};

const primaryBtnStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px',
  border: '1px solid var(--gold)', background: 'rgba(184,134,42,0.12)', color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', cursor: 'pointer', borderRadius: 3,
  fontWeight: 600, transition: 'all 0.2s',
};

const secondaryBtnStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px',
  border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-dim)',
  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', cursor: 'pointer', borderRadius: 3,
  transition: 'all 0.2s',
};
