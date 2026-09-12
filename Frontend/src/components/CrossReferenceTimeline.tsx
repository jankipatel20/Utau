import { useState, useEffect } from 'react';
import { Camera, AlertTriangle, Activity, ChevronDown, ChevronUp, X } from 'lucide-react';

const G  = 'var(--gold)';
const CR = 'var(--crimson)';
const CU = 'var(--copper)';
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

interface InspectionJob {
  job_id: string;
  asset_id: string;
  asset_type: string;
  status: string;
  total_frames: number;
  total_detections: number;
  created_at: number;
  completed_at: number | null;
}

interface Props {
  activeDataset: string;
  isAnomalous: boolean;
  anomalyScore: number;
}

function classColor(cls: string): string {
  if (cls.includes('damage') || cls.includes('crack')) return CR;
  if (cls.includes('dust') || cls.includes('bird') || cls.includes('erosion')) return CU;
  if (cls.includes('snow') || cls.includes('leaf')) return TL;
  return G;
}

export default function CrossReferenceTimeline({ activeDataset, isAnomalous, anomalyScore }: Props) {
  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [jobResults, setJobResults] = useState<FrameResult[] | null>(null);
  const [findings, setFindings] = useState<any>(null);
  const [selectedFrame, setSelectedFrame] = useState<FrameResult | null>(null);

  const isSolarWind = activeDataset.includes('solar') || activeDataset.includes('wind');

  useEffect(() => {
    if (!isSolarWind) return;
    let cancelled = false;
    const fetchJobs = async () => {
      try {
        const res = await fetch(`${API}/api/inspection/jobs?limit=5`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setJobs((data.jobs || []).filter((j: InspectionJob) => j.status === 'done'));
      } catch { /* ignore */ }
    };
    fetchJobs();
    const id = window.setInterval(fetchJobs, 10000);
    return () => { cancelled = true; clearInterval(id); };
  }, [activeDataset, isSolarWind]);

  useEffect(() => {
    if (!isSolarWind) return;
    let cancelled = false;
    const fetchFindings = async () => {
      try {
        const res = await fetch(`${API}/api/inspection/findings`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setFindings(data);
      } catch { /* ignore */ }
    };
    fetchFindings();
    const id = window.setInterval(fetchFindings, 10000);
    return () => { cancelled = true; clearInterval(id); };
  }, [activeDataset, isSolarWind]);

  const loadJobResults = async (jobId: string) => {
    if (selectedJob === jobId) {
      setSelectedJob(null);
      setJobResults(null);
      setSelectedFrame(null);
      return;
    }
    try {
      const res = await fetch(`${API}/api/inspection/results/${jobId}`);
      if (!res.ok) return;
      const data = await res.json();
      setSelectedJob(jobId);
      setJobResults((data.results || []).filter((r: FrameResult) => r.detection_count > 0));
      setSelectedFrame(null);
    } catch { /* ignore */ }
  };

  if (!isSolarWind || jobs.length === 0) return null;

  const hasDefects = findings?.total_assets_with_findings > 0;
  const corroborated = isAnomalous && hasDefects;

  return (
    <div style={{
      background: corroborated ? 'rgba(168, 50, 64, 0.06)' : 'var(--bg-panel)',
      border: `1px solid ${corroborated ? CR + '40' : 'var(--gold-border)'}`,
      borderRadius: 10, padding: 14, marginTop: 10,
      boxShadow: corroborated ? `0 2px 16px ${CR}12` : '0 2px 8px rgba(140, 100, 30, 0.04)',
    }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Camera size={13} color={G} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: TP }}>
            VISUAL INSPECTION
          </span>
          {corroborated && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px',
              background: `${CR}15`, border: `1px solid ${CR}40`, borderRadius: 12,
              fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 700,
              letterSpacing: '0.12em', color: CR,
              animation: 'golden-breathe 1.5s infinite',
            }}>
              <AlertTriangle size={9} /> CORROBORATED
            </span>
          )}
          {hasDefects && !corroborated && (
            <span style={{
              padding: '2px 8px', background: `${CU}12`, border: `1px solid ${CU}40`, borderRadius: 12,
              fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 700,
              letterSpacing: '0.12em', color: CU,
            }}>
              DEFECTS FOUND
            </span>
          )}
          {!hasDefects && (
            <span style={{
              padding: '2px 8px', background: `${TL}12`, border: `1px solid ${TL}40`, borderRadius: 12,
              fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 700,
              letterSpacing: '0.12em', color: TL,
            }}>
              {jobs.length} INSPECTION(S)
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={14} color={TD} /> : <ChevronDown size={14} color={TD} />}
      </button>

      {/* Corroboration callout */}
      {expanded && corroborated && (
        <div style={{
          marginTop: 10, padding: '8px 12px', background: `${CR}08`,
          border: `1px solid ${CR}25`, borderRadius: 6,
          fontFamily: 'var(--font-mono)', fontSize: 10, color: TS, lineHeight: 1.5,
        }}>
          <strong style={{ color: CR }}>Sensor + Visual corroboration:</strong> This asset shows both an active sensor anomaly
          (score {anomalyScore.toFixed(3)}) and confirmed visual defects from drone inspection.
          This multi-modal evidence strengthens the case for maintenance action.
        </div>
      )}

      {/* Job list */}
      {expanded && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {jobs.map(job => (
            <div key={job.job_id}>
              <button
                onClick={() => loadJobResults(job.job_id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                  background: selectedJob === job.job_id ? `${G}10` : 'transparent',
                  border: `1px solid ${selectedJob === job.job_id ? G + '40' : 'var(--gold-border)'}`,
                  borderRadius: 6, cursor: 'pointer', textAlign: 'left',
                }}
              >
                <Activity size={11} color={job.total_detections > 0 ? CU : TL} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: TP }}>
                    {job.asset_id} — {job.asset_type}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: TD, marginTop: 2 }}>
                    {job.total_detections} defect(s) in {job.total_frames} frames
                    {job.completed_at && ` • ${new Date(job.completed_at * 1000).toLocaleTimeString()}`}
                  </div>
                </div>
                <span style={{
                  fontFamily: 'var(--font-display)', fontSize: 8, fontWeight: 700, letterSpacing: '0.1em',
                  color: job.total_detections > 0 ? CU : TL,
                  padding: '2px 6px', background: `${job.total_detections > 0 ? CU : TL}12`,
                  borderRadius: 4,
                }}>
                  {job.total_detections > 0 ? 'DEFECTS' : 'CLEAN'}
                </span>
              </button>

              {/* Inline frame results */}
              {selectedJob === job.job_id && jobResults && (
                <div style={{ marginTop: 6, marginLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {jobResults.length === 0 ? (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: TD, fontStyle: 'italic', padding: 6 }}>
                      No frames with defects.
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {jobResults.slice(0, 8).map(fr => (
                          <button
                            key={fr.frame_index}
                            onClick={() => setSelectedFrame(selectedFrame?.frame_index === fr.frame_index ? null : fr)}
                            style={{
                              width: 100, background: selectedFrame?.frame_index === fr.frame_index ? `${G}12` : 'var(--bg-recessed)',
                              border: `1px solid ${selectedFrame?.frame_index === fr.frame_index ? G : 'var(--gold-border)'}`,
                              borderRadius: 6, overflow: 'hidden', cursor: 'pointer', padding: 0,
                            }}
                          >
                            {fr.annotated_file && (
                              <img
                                src={`${API}/inspection-files/${job.job_id}/annotated/${fr.annotated_file}`}
                                alt={`f${fr.frame_index}`}
                                style={{ width: '100%', height: 60, objectFit: 'cover', display: 'block' }}
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            )}
                            <div style={{ padding: '3px 6px', fontFamily: 'var(--font-mono)', fontSize: 8, color: TD }}>
                              {fr.timestamp_sec.toFixed(1)}s • {fr.detection_count}
                            </div>
                          </button>
                        ))}
                      </div>

                      {/* Frame detail inline */}
                      {selectedFrame && (
                        <div style={{
                          marginTop: 6, padding: 10, background: 'var(--bg-panel)',
                          border: `1px solid ${G}30`, borderRadius: 8, position: 'relative',
                        }}>
                          <button onClick={() => setSelectedFrame(null)} style={{
                            position: 'absolute', top: 6, right: 6, background: 'none', border: 'none', cursor: 'pointer',
                          }}>
                            <X size={12} color={TD} />
                          </button>
                          {selectedFrame.annotated_file && (
                            <img
                              src={`${API}/inspection-files/${job.job_id}/annotated/${selectedFrame.annotated_file}`}
                              alt="annotated"
                              style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 6, marginBottom: 6 }}
                            />
                          )}
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {selectedFrame.detections.map((d, i) => (
                              <span key={i} style={{
                                fontFamily: 'var(--font-mono)', fontSize: 9, color: classColor(d.class_name),
                                padding: '2px 8px', background: `${classColor(d.class_name)}10`,
                                border: `1px solid ${classColor(d.class_name)}30`, borderRadius: 4,
                              }}>
                                {d.class_name} {(d.confidence * 100).toFixed(0)}%
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
