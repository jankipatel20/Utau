import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, Video, Camera, AlertTriangle, CheckCircle, Loader,
  ChevronLeft, Eye, Filter, BarChart3, ShieldAlert, Info,
} from 'lucide-react';

const G  = 'var(--gold)';
const GB = 'var(--gold-bright)';
const CU = 'var(--copper)';
const CR = 'var(--crimson)';
const TL = 'var(--teal)';
const TP = 'var(--text-primary)';
const TS = 'var(--text-secondary)';
const TD = 'var(--text-dim)';
const API = 'http://127.0.0.1:8000';

interface Detection {
  class_name: string;
  confidence: number;
  bbox: { x1: number; y1: number; x2: number; y2: number };
  model_source: string;
}

interface FrameResult {
  frame_index: number;
  timestamp_sec: number;
  detection_count: number;
  detections: Detection[];
  annotated_file?: string;
}

interface JobStatus {
  job_id: string;
  asset_id: string;
  asset_type: string;
  status: string;
  progress: number;
  progress_detail: string;
  total_frames: number;
  processed_frames: number;
  total_detections: number;
  error?: string;
}

interface InspectionPageProps {
  onBack: () => void;
  activeDataset: string;
}

const STAGE_LABELS: Record<string, string> = {
  queued: 'Queued',
  extracting_frames: 'Extracting Frames',
  running_detection: 'Running Defect Detection',
  compiling_results: 'Compiling Results',
  done: 'Complete',
  failed: 'Failed',
};

function classColor(cls: string): string {
  const map: Record<string, string> = {
    physical_damage: CR,
    crack: CR,
    damage: CR,
    snow: 'var(--teal)',
    dust_partical: CU,
    bird_drop: CU,
    bird_feather: CU,
    leaf: TL,
    erosion: CU,
    defect: CR,
  };
  for (const [key, val] of Object.entries(map)) {
    if (cls.toLowerCase().includes(key)) return val;
  }
  return G;
}

export default function InspectionPage({ onBack, activeDataset }: InspectionPageProps) {
  const [assetId, setAssetId] = useState('');
  const [assetType, setAssetType] = useState<'solar' | 'wind'>('solar');
  const [inputMode, setInputMode] = useState<'file' | 'youtube'>('youtube');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [results, setResults] = useState<FrameResult[] | null>(null);
  const [findings, setFindings] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [selectedFrame, setSelectedFrame] = useState<FrameResult | null>(null);
  const [thermalFiles, setThermalFiles] = useState<File[]>([]);
  const [thermalResults, setThermalResults] = useState<any>(null);
  const [thermalUploading, setThermalUploading] = useState(false);
  const [selectedThermal, setSelectedThermal] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thermalInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    const domain = activeDataset.includes('solar') ? 'solar' : activeDataset.includes('wind') ? 'wind' : 'solar';
    setAssetType(domain as 'solar' | 'wind');
    setAssetId(`${domain}_asset_00`);
  }, [activeDataset]);

  const pollJob = useCallback((jid: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/inspection/status/${jid}`);
        if (!res.ok) return;
        const status: JobStatus = await res.json();
        setJobStatus(status);
        if (status.status === 'done' || status.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          if (status.status === 'done') {
            const rr = await fetch(`${API}/api/inspection/results/${jid}`);
            if (rr.ok) {
              const data = await rr.json();
              setResults(data.results || []);
            }
            const fr = await fetch(`${API}/api/inspection/findings/${status.asset_id}`);
            if (fr.ok) setFindings(await fr.json());
          }
        }
      } catch { /* ignore */ }
    }, 1500);
  }, []);

  useEffect(() => { return () => { if (pollRef.current) clearInterval(pollRef.current); }; }, []);

  const handleSubmit = async () => {
    setError('');
    setResults(null);
    setFindings(null);
    setSelectedFrame(null);
    setSubmitting(true);
    try {
      let res: Response;

      if (inputMode === 'youtube') {
        if (!youtubeUrl.trim()) { setError('Enter a YouTube URL'); setSubmitting(false); return; }
        res = await fetch(`${API}/api/inspection/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            asset_id: assetId,
            asset_type: assetType,
            youtube_url: youtubeUrl.trim(),
          }),
        });
      } else {
        if (!selectedFile) { setError('Select a video file'); setSubmitting(false); return; }
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('asset_id', assetId);
        formData.append('asset_type', assetType);
        res = await fetch(`${API}/api/inspection/upload_file`, {
          method: 'POST',
          body: formData,
        });
      }

      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setJobId(data.job_id);
      setJobStatus({ job_id: data.job_id, asset_id: assetId, asset_type: assetType, status: 'queued', progress: 0, progress_detail: 'Job created', total_frames: 0, processed_frames: 0, total_detections: 0 });
      pollJob(data.job_id);
    } catch (e: any) {
      setError(e.message || 'Failed to start inspection');
    } finally {
      setSubmitting(false);
    }
  };

  const handleThermalUpload = async () => {
    if (thermalFiles.length === 0) return;
    setThermalUploading(true);
    setThermalResults(null);
    setSelectedThermal(null);
    try {
      const formData = new FormData();
      thermalFiles.forEach(f => formData.append('files', f));
      formData.append('asset_id', assetId);
      formData.append('asset_type', assetType);
      const res = await fetch(`${API}/api/inspection/thermal`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Thermal upload failed');
      const data = await res.json();
      setThermalResults(data);
    } catch (e: any) {
      setError(e.message || 'Thermal analysis failed');
    } finally {
      setThermalUploading(false);
    }
  };

  const allClasses = results
    ? [...new Set(results.flatMap(r => r.detections.map(d => d.class_name)))]
    : [];

  const filteredResults = results
    ? results.filter(r => r.detection_count > 0 && (filterClass === 'all' || r.detections.some(d => d.class_name === filterClass)))
    : [];

  const totalDets = results ? results.reduce((s, r) => s + r.detection_count, 0) : 0;
  const framesWithDets = results ? results.filter(r => r.detection_count > 0).length : 0;

  const isDone = jobStatus?.status === 'done';
  const isFailed = jobStatus?.status === 'failed';
  const isRunning = jobStatus && !isDone && !isFailed;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', background: 'var(--bg-page)', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{
        height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px', borderBottom: '1px solid var(--gold-border)',
        background: 'rgba(252, 245, 228, 0.88)', backdropFilter: 'blur(24px)',
        boxShadow: '0 2px 20px rgba(140, 100, 30, 0.10)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={onBack} style={{
            background: 'none', border: '1px solid var(--gold-border)', borderRadius: 6,
            padding: '6px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', color: TS,
          }}>
            <ChevronLeft size={12} /> DASHBOARD
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Camera size={16} color={G} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, letterSpacing: '0.15em', color: TP }}>
              DRONE INSPECTION
            </span>
          </div>
        </div>
        {isDone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={14} color={TL} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: TL, fontWeight: 600 }}>
              {totalDets} defect(s) in {results?.length || 0} frames
            </span>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: 32 }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>

          {/* ── RGB Disclosure ── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', marginBottom: 20,
            background: 'rgba(42, 122, 106, 0.08)', border: '1px solid rgba(42, 122, 106, 0.25)', borderRadius: 8,
          }}>
            <Info size={14} color={TL} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: TS, letterSpacing: '0.05em' }}>
              Detection is based on visible-light (RGB) imagery — not thermal analysis. Uploaded thermal footage is processed as RGB and results may be unreliable.
            </span>
          </div>

          {/* ── Upload Form ── */}
          {!jobId && (
            <div style={{
              background: 'var(--bg-panel)', border: '1px solid var(--gold-border)', borderRadius: 12,
              padding: 28, boxShadow: '0 2px 16px rgba(140, 100, 30, 0.06)',
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, letterSpacing: '0.18em', color: TP, marginBottom: 20 }}>
                UPLOAD INSPECTION VIDEO
              </div>

              {/* Asset config row */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ ...labelStyle }}>ASSET ID</label>
                  <input
                    value={assetId}
                    onChange={e => setAssetId(e.target.value)}
                    style={{ ...inputStyle }}
                    placeholder="solar_asset_00"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ ...labelStyle }}>ASSET TYPE</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['solar', 'wind'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setAssetType(t)}
                        style={{
                          flex: 1, padding: '8px 0',
                          background: assetType === t ? `${G}18` : 'transparent',
                          border: `1px solid ${assetType === t ? G : 'var(--gold-border)'}`,
                          borderRadius: 6, cursor: 'pointer',
                          fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 600,
                          letterSpacing: '0.15em', color: assetType === t ? TP : TD,
                        }}
                      >
                        {t === 'solar' ? '☀ SOLAR' : '💨 WIND'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Input mode toggle */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button onClick={() => setInputMode('youtube')} style={{ ...toggleBtn(inputMode === 'youtube') }}>
                  <Video size={12} /> YouTube URL
                </button>
                <button onClick={() => setInputMode('file')} style={{ ...toggleBtn(inputMode === 'file') }}>
                  <Upload size={12} /> File Upload
                </button>
              </div>

              {inputMode === 'youtube' ? (
                <input
                  value={youtubeUrl}
                  onChange={e => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  style={{ ...inputStyle, marginBottom: 16 }}
                />
              ) : (
                <div style={{ marginBottom: 16 }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    style={{ display: 'none' }}
                    onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      ...inputStyle, cursor: 'pointer', textAlign: 'left',
                      color: selectedFile ? TP : TD,
                    }}
                  >
                    {selectedFile ? selectedFile.name : 'Click to select video file...'}
                  </button>
                </div>
              )}

              {error && (
                <div style={{ color: CR, fontFamily: 'var(--font-mono)', fontSize: 11, marginBottom: 12 }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  width: '100%', padding: '12px 0',
                  background: `linear-gradient(135deg, ${G}, ${CU})`,
                  border: 'none', borderRadius: 8, cursor: submitting ? 'wait' : 'pointer',
                  fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700,
                  letterSpacing: '0.2em', color: '#fff',
                  opacity: submitting ? 0.7 : 1,
                  boxShadow: '0 4px 20px rgba(184, 134, 42, 0.3)',
                }}
              >
                {submitting ? 'SUBMITTING...' : 'START INSPECTION'}
              </button>
            </div>
          )}

          {/* ── Progress ── */}
          {isRunning && jobStatus && (
            <div style={{
              background: 'var(--bg-panel)', border: '1px solid var(--gold-border)', borderRadius: 12,
              padding: 28, boxShadow: '0 2px 16px rgba(140, 100, 30, 0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <Loader size={16} color={G} className="animate-spin" />
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, letterSpacing: '0.15em', color: TP }}>
                  {STAGE_LABELS[jobStatus.status] || jobStatus.status}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: TS, marginBottom: 12 }}>
                {jobStatus.progress_detail}
              </div>
              <div style={{ height: 8, background: 'var(--bg-recessed)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 99, transition: 'width 0.5s ease',
                  width: `${jobStatus.progress}%`,
                  background: `linear-gradient(90deg, ${G}, ${GB})`,
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: TD }}>
                  {jobStatus.processed_frames}/{jobStatus.total_frames} frames
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: TD }}>
                  {jobStatus.progress.toFixed(0)}%
                </span>
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {isFailed && jobStatus && (
            <div style={{
              background: `${CR}10`, border: `1px solid ${CR}40`, borderRadius: 12,
              padding: 24, display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <AlertTriangle size={20} color={CR} />
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: CR, letterSpacing: '0.1em' }}>
                  INSPECTION FAILED
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: TS, marginTop: 4 }}>
                  {jobStatus.error || 'Unknown error'}
                </div>
              </div>
              <button
                onClick={() => { setJobId(null); setJobStatus(null); setError(''); }}
                style={{ marginLeft: 'auto', ...toggleBtn(true), padding: '6px 16px' }}
              >
                TRY AGAIN
              </button>
            </div>
          )}

          {/* ── Results ── */}
          {isDone && results && (
            <>
              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                <SummaryCard icon={<Eye size={16} color={G} />} label="FRAMES" value={`${results.length}`} sub={`${framesWithDets} with defects`} />
                <SummaryCard icon={<ShieldAlert size={16} color={CR} />} label="DEFECTS" value={`${totalDets}`} sub={`${allClasses.length} class(es)`} />
                <SummaryCard icon={<BarChart3 size={16} color={CU} />} label="DERATING" value={findings?.derating_pct != null ? `${(findings.derating_pct * 100).toFixed(0)}%` : 'N/A'} sub="est. power loss" />
                <SummaryCard icon={<Filter size={16} color={TL} />} label="THRESHOLD" value={findings?.confidence_threshold != null ? `${(findings.confidence_threshold * 100).toFixed(0)}%` : '—'} sub="confidence cutoff" />
              </div>

              {/* Class filter */}
              {allClasses.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                  <button onClick={() => setFilterClass('all')} style={{ ...chipBtn(filterClass === 'all') }}>ALL</button>
                  {allClasses.map(cls => (
                    <button key={cls} onClick={() => setFilterClass(cls)} style={{ ...chipBtn(filterClass === cls), borderColor: classColor(cls) + '60' }}>
                      {cls.toUpperCase().replace('_', ' ')}
                    </button>
                  ))}
                </div>
              )}

              {/* Defect summary table */}
              {allClasses.length > 0 && (
                <div style={{
                  background: 'var(--bg-panel)', border: '1px solid var(--gold-border)', borderRadius: 10,
                  padding: 16, marginBottom: 20, overflowX: 'auto',
                }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: TD, marginBottom: 10 }}>
                    DEFECT SUMMARY
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--gold-border)' }}>
                        <th style={{ ...thStyle }}>Class</th>
                        <th style={{ ...thStyle }}>Count</th>
                        <th style={{ ...thStyle }}>Avg Confidence</th>
                        <th style={{ ...thStyle }}>Est. Derating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allClasses.map(cls => {
                        const dets = results.flatMap(r => r.detections).filter(d => d.class_name === cls);
                        const avgConf = dets.reduce((s, d) => s + d.confidence, 0) / dets.length;
                        return (
                          <tr key={cls} style={{ borderBottom: '1px solid var(--gold-border)' }}>
                            <td style={{ ...tdStyle, color: classColor(cls), fontWeight: 600 }}>{cls}</td>
                            <td style={{ ...tdStyle }}>{dets.length}</td>
                            <td style={{ ...tdStyle }}>{(avgConf * 100).toFixed(0)}%</td>
                            <td style={{ ...tdStyle, color: CU }}>est.</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Frame gallery */}
              {filteredResults.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                  {filteredResults.map(fr => (
                    <button
                      key={fr.frame_index}
                      onClick={() => setSelectedFrame(selectedFrame?.frame_index === fr.frame_index ? null : fr)}
                      style={{
                        background: selectedFrame?.frame_index === fr.frame_index ? `${G}12` : 'var(--bg-panel)',
                        border: `1px solid ${selectedFrame?.frame_index === fr.frame_index ? G : 'var(--gold-border)'}`,
                        borderRadius: 10, padding: 0, cursor: 'pointer', overflow: 'hidden',
                        textAlign: 'left', transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 6px 20px ${G}18`; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      {fr.annotated_file && jobId && (
                        <div style={{ width: '100%', aspectRatio: '4/3', overflow: 'hidden', borderBottom: '1px solid var(--gold-border)' }}>
                          <img
                            src={`${API}/inspection-files/${jobId}/annotated/${fr.annotated_file}`}
                            alt={`Frame ${fr.frame_index}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        </div>
                      )}
                      <div style={{ padding: '8px 10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: TD }}>
                            {fr.timestamp_sec.toFixed(1)}s
                          </span>
                          <span style={{
                            fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 700, letterSpacing: '0.12em',
                            color: fr.detection_count > 2 ? CR : CU,
                            padding: '2px 6px', background: `${fr.detection_count > 2 ? CR : CU}12`,
                            border: `1px solid ${fr.detection_count > 2 ? CR : CU}40`,
                            borderRadius: 12,
                          }}>
                            {fr.detection_count} DEFECT{fr.detection_count !== 1 ? 'S' : ''}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 3, marginTop: 5, flexWrap: 'wrap' }}>
                          {fr.detections.slice(0, 3).map((d, i) => (
                            <span key={i} style={{
                              fontFamily: 'var(--font-mono)', fontSize: 8, color: classColor(d.class_name),
                              padding: '1px 5px', background: `${classColor(d.class_name)}10`,
                              border: `1px solid ${classColor(d.class_name)}30`, borderRadius: 4,
                            }}>
                              {d.class_name} {(d.confidence * 100).toFixed(0)}%
                            </span>
                          ))}
                          {fr.detections.length > 3 && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: TD }}>
                              +{fr.detections.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : results.length > 0 ? (
                <div style={{ textAlign: 'center', padding: 40, fontFamily: 'var(--font-serif)', fontSize: 15, color: TD, fontStyle: 'italic' }}>
                  No defects detected in any frame — asset appears clean.
                </div>
              ) : null}

              {/* Selected frame detail */}
              {selectedFrame && (
                <div style={{
                  marginTop: 20, background: 'var(--bg-panel)', border: `1px solid ${G}40`,
                  borderRadius: 12, padding: 20, boxShadow: `0 4px 24px ${G}10`,
                }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', color: TP, marginBottom: 12 }}>
                    FRAME {selectedFrame.frame_index} — {selectedFrame.timestamp_sec.toFixed(1)}s
                  </div>
                  {selectedFrame.annotated_file && jobId && (
                    <img
                      src={`${API}/inspection-files/${jobId}/annotated/${selectedFrame.annotated_file}`}
                      alt={`Frame ${selectedFrame.frame_index} annotated`}
                      style={{ width: '100%', maxHeight: 500, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--gold-border)', marginBottom: 12 }}
                    />
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedFrame.detections.map((d, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                        background: `${classColor(d.class_name)}08`, border: `1px solid ${classColor(d.class_name)}25`,
                        borderRadius: 6,
                      }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: classColor(d.class_name), minWidth: 120 }}>
                          {d.class_name}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: TS }}>
                          {(d.confidence * 100).toFixed(1)}% confidence
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: TD, marginLeft: 'auto' }}>
                          {d.model_source}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Thermal Section ── */}
              <div style={{
                marginTop: 24, background: 'var(--bg-panel)', border: '1px solid var(--gold-border)',
                borderRadius: 12, padding: 20, boxShadow: '0 2px 12px rgba(140, 100, 30, 0.06)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(135deg, #ff4500, #ff8c00, #ffd700)' }} />
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', color: TP }}>
                    THERMAL IMAGERY
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, color: TD, marginLeft: 'auto',
                    padding: '2px 8px', background: `${CU}10`, border: `1px solid ${CU}30`, borderRadius: 12,
                  }}>
                    SUPPLEMENTARY
                  </span>
                </div>
                <div style={{
                  padding: '8px 12px', marginBottom: 14,
                  background: `${CU}08`, border: `1px solid ${CU}20`, borderRadius: 6,
                  fontFamily: 'var(--font-mono)', fontSize: 9, color: TS, lineHeight: 1.5,
                }}>
                  Upload false-color thermal images for hotspot detection. This uses color-thresholding on rendered thermal palettes — it does not extract temperature values.
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
                  <input
                    ref={thermalInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={e => setThermalFiles(Array.from(e.target.files || []))}
                  />
                  <button
                    onClick={() => thermalInputRef.current?.click()}
                    style={{
                      flex: 1, padding: '10px 14px', textAlign: 'left',
                      background: 'var(--bg-recessed)', border: '1px solid var(--gold-border)', borderRadius: 6,
                      fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer',
                      color: thermalFiles.length > 0 ? TP : TD,
                    }}
                  >
                    {thermalFiles.length > 0 ? `${thermalFiles.length} thermal image(s) selected` : 'Select thermal images...'}
                  </button>
                  <button
                    onClick={handleThermalUpload}
                    disabled={thermalFiles.length === 0 || thermalUploading}
                    style={{
                      padding: '10px 20px', borderRadius: 6, border: 'none', cursor: thermalFiles.length === 0 ? 'not-allowed' : 'pointer',
                      background: thermalFiles.length > 0 ? `linear-gradient(135deg, #ff6b35, ${CU})` : 'var(--bg-recessed)',
                      fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em',
                      color: thermalFiles.length > 0 ? '#fff' : TD,
                      opacity: thermalUploading ? 0.6 : 1,
                    }}
                  >
                    {thermalUploading ? 'ANALYZING...' : 'DETECT HOTSPOTS'}
                  </button>
                </div>

                {/* Thermal Results Grid */}
                {thermalResults && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: TP, fontWeight: 600 }}>
                        {thermalResults.total_hotspots} hotspot(s) across {thermalResults.total_images} image(s)
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                      {thermalResults.results.map((tr: any) => (
                        <button
                          key={tr.index}
                          onClick={() => setSelectedThermal(selectedThermal?.index === tr.index ? null : tr)}
                          style={{
                            background: selectedThermal?.index === tr.index ? 'rgba(255, 107, 53, 0.08)' : 'var(--bg-recessed)',
                            border: `1px solid ${selectedThermal?.index === tr.index ? '#ff6b35' : 'var(--gold-border)'}`,
                            borderRadius: 8, padding: 0, cursor: 'pointer', overflow: 'hidden', textAlign: 'left',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(255, 107, 53, 0.15)'; }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                        >
                          <div style={{ width: '100%', aspectRatio: '4/3', overflow: 'hidden', borderBottom: '1px solid var(--gold-border)', position: 'relative' }}>
                            <img
                              src={`${API}${tr.annotated_url || tr.original_url}`}
                              alt={tr.filename}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              onError={e => { (e.target as HTMLImageElement).src = `${API}${tr.original_url}`; }}
                            />
                            {tr.hotspot_count > 0 && (
                              <div style={{
                                position: 'absolute', top: 6, right: 6,
                                padding: '2px 8px', borderRadius: 12,
                                background: 'rgba(255, 69, 0, 0.85)', backdropFilter: 'blur(4px)',
                                fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700,
                                color: '#fff', letterSpacing: '0.1em',
                              }}>
                                {tr.hotspot_count} HOT
                              </div>
                            )}
                          </div>
                          <div style={{ padding: '6px 8px' }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: TD, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {tr.filename}
                            </div>
                            {tr.hotspot_count > 0 && (
                              <div style={{ display: 'flex', gap: 3, marginTop: 4, flexWrap: 'wrap' }}>
                                {tr.detections.slice(0, 3).map((d: any, i: number) => (
                                  <span key={i} style={{
                                    fontFamily: 'var(--font-mono)', fontSize: 8,
                                    color: d.class_name.includes('severe') ? '#ff4500' : d.class_name.includes('moderate') ? '#ff8c00' : '#ffa500',
                                    padding: '1px 5px', borderRadius: 4,
                                    background: d.class_name.includes('severe') ? 'rgba(255,69,0,0.12)' : 'rgba(255,140,0,0.10)',
                                    border: `1px solid ${d.class_name.includes('severe') ? 'rgba(255,69,0,0.3)' : 'rgba(255,140,0,0.25)'}`,
                                  }}>
                                    {d.class_name.replace('hotspot_', '')} {(d.confidence * 100).toFixed(0)}%
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Selected thermal detail */}
                    {selectedThermal && (
                      <div style={{
                        marginTop: 12, padding: 14, background: 'rgba(255, 107, 53, 0.04)',
                        border: '1px solid rgba(255, 107, 53, 0.25)', borderRadius: 10,
                      }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: TP, marginBottom: 8 }}>
                          {selectedThermal.filename}
                        </div>
                        <img
                          src={`${API}${selectedThermal.annotated_url || selectedThermal.original_url}`}
                          alt="thermal detail"
                          style={{ width: '100%', maxHeight: 400, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--gold-border)', marginBottom: 8 }}
                        />
                        {selectedThermal.detections.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {selectedThermal.detections.map((d: any, i: number) => (
                              <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px',
                                background: d.class_name.includes('severe') ? 'rgba(255,69,0,0.08)' : 'rgba(255,140,0,0.06)',
                                border: `1px solid ${d.class_name.includes('severe') ? 'rgba(255,69,0,0.2)' : 'rgba(255,140,0,0.18)'}`,
                                borderRadius: 6,
                              }}>
                                <span style={{
                                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, minWidth: 110,
                                  color: d.class_name.includes('severe') ? '#ff4500' : d.class_name.includes('moderate') ? '#ff8c00' : '#ffa500',
                                }}>
                                  {d.class_name.replace('hotspot_', '').toUpperCase()}
                                </span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: TS }}>
                                  {(d.confidence * 100).toFixed(0)}% confidence
                                </span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: TD, marginLeft: 'auto' }}>
                                  {d.model_source}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: TL, fontStyle: 'italic' }}>
                            No hotspots detected — image appears thermally uniform.
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* New inspection button */}
              <button
                onClick={() => { setJobId(null); setJobStatus(null); setResults(null); setFindings(null); setSelectedFrame(null); setThermalResults(null); setThermalFiles([]); setSelectedThermal(null); setError(''); }}
                style={{
                  marginTop: 20, padding: '10px 24px',
                  background: 'transparent', border: `1px solid ${G}`, borderRadius: 8, cursor: 'pointer',
                  fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', color: TP,
                }}
              >
                NEW INSPECTION
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Shared styles ── */
const labelStyle: React.CSSProperties = {
  display: 'block', fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 600,
  letterSpacing: '0.2em', color: 'var(--text-dim)', marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  background: 'var(--bg-recessed)', border: '1px solid var(--gold-border)', borderRadius: 6,
  fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)',
  outline: 'none', boxSizing: 'border-box',
};

const toggleBtn = (active: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
  background: active ? 'var(--gold)18' : 'transparent',
  border: `1px solid ${active ? 'var(--gold)' : 'var(--gold-border)'}`,
  borderRadius: 6, cursor: 'pointer',
  fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 600,
  letterSpacing: '0.12em', color: active ? 'var(--text-primary)' : 'var(--text-dim)',
});

const chipBtn = (active: boolean): React.CSSProperties => ({
  padding: '4px 12px',
  background: active ? 'var(--gold)15' : 'transparent',
  border: `1px solid ${active ? 'var(--gold)' : 'var(--gold-border)'}`,
  borderRadius: 20, cursor: 'pointer',
  fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 600,
  letterSpacing: '0.12em', color: active ? 'var(--text-primary)' : 'var(--text-dim)',
});

const thStyle: React.CSSProperties = {
  padding: '6px 10px', textAlign: 'left', fontSize: 9, fontWeight: 700,
  letterSpacing: '0.15em', color: 'var(--text-dim)',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 10px', color: 'var(--text-secondary)',
};

function SummaryCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div style={{
      background: 'var(--bg-panel)', border: '1px solid var(--gold-border)', borderRadius: 10,
      padding: 16, display: 'flex', flexDirection: 'column', gap: 6,
      boxShadow: '0 2px 12px rgba(140, 100, 30, 0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon}
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--text-dim)' }}>
          {label}
        </span>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
        {value}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)' }}>
        {sub}
      </div>
    </div>
  );
}
