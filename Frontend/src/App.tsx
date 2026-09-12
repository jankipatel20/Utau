// import { useState, useEffect, useRef } from 'react';
// import { motion, AnimatePresence } from 'framer-motion';
// import { AlertTriangle, X } from 'lucide-react';
// import jsPDF from 'jspdf';
// import autoTable from 'jspdf-autotable';
// import { UtauHeader }  from './components/Header';
// import TopologyPanel    from './components/TopologyPanel';
// import { HeroSection, ResidualSection } from './components/CenterPanel';
// import { IncidentReport, RootCausePanel, SimilarIncidents, GovernancePanel } from './components/RightPanel';
// import AnomalySourceTab from './components/AnomalySourceTab';
// import DataSourceTab from './components/DataSourceTab';
// import LandingPage from './LandingPage';
// import AIChatPage from './AIChatPage';

// interface AlertExplanation {
//   severity_score: number;
//   severity_level: 'info' | 'warning' | 'critical';
//   confidence: number;
//   anomaly_type: string;
//   duration_steps: number;
//   top_contributors: { sensor: string; contribution_pct: number }[];
//   historical_similar: { tick: number; dataset: string; summary: string; similarity?: number }[];
//   investigation_hints: string[];
// }

// interface DataPoint {
//   tick: number; system_loss: number; is_anomalous: boolean; threshold: number;
//   score_components?: { recon: number; forecast: number; corr: number };
//   alert_explanation?: AlertExplanation;
//   [key: string]: any;
// }

// const DATASET_TABS = [
//   { label: 'SMD',       value: 'SMD'       },
//   { label: 'MSL',       value: 'MSL'       },
//   { label: 'SMAP',      value: 'SMAP'      },
//   { label: 'ESP32',     value: 'ESP32'     },
//   { label: 'Synthetic', value: 'synthetic' },
// ];

// const featureFlag = (value: unknown, defaultValue = false): boolean => {
//   if (typeof value !== 'string') return defaultValue;
//   return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
// };

// export default function App() {
//   const isAnomalySourceTabEnabled = featureFlag(import.meta.env.VITE_FEATURE_ANOMALY_SOURCE_TAB, true);
//   const isDataSourceTabEnabled = featureFlag(import.meta.env.VITE_FEATURE_DATA_SOURCE_TAB, true);
//   const isRlPolicySuggestionsEnabled = featureFlag(import.meta.env.VITE_FEATURE_RL_POLICY_SUGGESTIONS);

//   const [data,                  setData]                  = useState<DataPoint[]>([]);
//   const [isConnected,           setIsConnected]           = useState(false);
//   const [systemState,           setSystemState]           = useState<'HEALTHY' | 'WARNING' | 'CRITICAL'>('HEALTHY');
//   const [dimensions,            setDimensions]            = useState<number>(0);
//   const [activeDataset,         setActiveDataset]         = useState('SMD');
//   const [isTransitioning,       setIsTransitioning]       = useState(false);
//   const [alertExplanation,      setAlertExplanation]      = useState<AlertExplanation | null>(null);
//   const [anomalySource,         setAnomalySource]         = useState<any | null>(null);
//   const [scoreComponents,       setScoreComponents]       = useState<{ recon: number; forecast: number; corr: number } | null>(null);
//   const [feedbackStatus,        setFeedbackStatus]        = useState('');
//   const [isSubmittingFeedback,  setIsSubmittingFeedback]  = useState(false);
//   const [activeFeatureTab,      setActiveFeatureTab]      = useState<'live' | 'anomaly-source' | 'data-source'>('live');
//   const [currentPath,           setCurrentPath]           = useState(() => window.location.pathname === '/dashboard' ? '/dashboard' : '/landing');
  
// // Custom Visual Notifications
//   const [anomalyPopup, setAnomalyPopup] = useState<{ show: boolean; msg: string; dataset: string }>({ show: false, msg: '', dataset: '' });
//   const hasAlertedRef = useRef(false);
//   const anomalyPopupTimerRef = useRef<number | null>(null);

//   const generatePDFReport = async () => {
//     try {
//       // 1. Fetch data from backend
//       const res = await fetch('http://127.0.0.1:8000/api/feedback_history?limit=100');
//       if (!res.ok) throw new Error("Failed to fetch feedback history");
//       const history = await res.json();

//       // 2. Initialize jsPDF
//       const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      
//       // 3. Document Title
//       doc.setFontSize(22);
//       doc.setTextColor(40, 40, 40);
//       doc.text("UTAU-IIoT Operational Threat Report", 14, 22);

//       doc.setFontSize(11);
//       doc.setTextColor(100, 100, 100);
//       doc.text(`Active Dataset: ${activeDataset.toUpperCase()}`, 14, 30);
//       doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 36);

//       // 4. Construct Table
//       const tableColumn = ["ID", "Time", "Tick", "Dataset", "Anomaly Type", "Severity", "Confirmed", "Notes"];
//       const tableRows = history.map((item: any) => [
//         item.id,
//         new Date(item.created_at_ms).toLocaleString(),
//         item.tick || 'N/A',
//         item.dataset,
//         item.anomaly_type || 'Unknown Error',
//         item.severity_level || 'N/A',
//         item.was_anomaly ? 'Yes' : 'No',
//         item.note || ''
//       ]);

//       // 5. Generate AutoTable
//       autoTable(doc, {
//         head: [tableColumn],
//         body: tableRows,
//         startY: 45,
//         theme: 'grid',
//         headStyles: { fillColor: [184, 134, 42], textColor: [255, 255, 255] }, // Gold Theme Header
//         alternateRowStyles: { fillColor: [248, 245, 240] },
//         styles: { fontSize: 9, cellPadding: 3, font: 'helvetica' }
//       });

//       // 6. Save
//       doc.save(`UTAU_Threat_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
//     } catch (err) {
//       console.error("Failed to generate PDF Data Report", err);
//     }
//   };

//   const wsRef = useRef<WebSocket | null>(null);
//   const reconnectTimerRef = useRef<number | null>(null);

//   useEffect(() => {
//     let stopped = false;
    
//     // Set initial route explicitly
//     if (window.location.pathname === '/' || window.location.pathname === '') {
//       window.history.replaceState(null, '', '/landing');
//     }

//     const handlePopState = () => {
//       let nextPath = window.location.pathname;
//       if (nextPath !== '/landing' && nextPath !== '/ai-chat' && nextPath !== '/fleet' && nextPath !== '/inspect') nextPath = '/dashboard';
//       setCurrentPath(nextPath);
//     };
//     window.addEventListener('popstate', handlePopState);

//     const wsScheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
//     const wsUrl = `${wsScheme}://127.0.0.1:8000/ws/stream`;

//     const connect = () => {
//       if (stopped) return;
//       const ws = new WebSocket(wsUrl);
//       wsRef.current = ws;

//       ws.onopen = () => setIsConnected(true);
//       ws.onclose = () => {
//         setIsConnected(false);
//         if (!stopped) {
//           reconnectTimerRef.current = window.setTimeout(connect, 1000);
//         }
//       };
//       ws.onerror = () => {
//         if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
//           ws.close();
//         }
//       };
//       ws.onmessage = (event) => {
//         const payload = JSON.parse(event.data);
//         if (payload.dimensions) {
//           setDimensions(prev => (payload.dimensions !== prev ? payload.dimensions : prev));
//         }
//         const newPoint: DataPoint = {
//           tick: payload.tick, system_loss: payload.system_loss,
//           is_anomalous: payload.is_anomalous, threshold: payload.threshold,
//           score_components: payload.score_components, alert_explanation: payload.alert_explanation,
//           ...payload.sensors, ...payload.forecast,
//         };
//         if (payload.alert_explanation) setAlertExplanation(payload.alert_explanation);
//         if (payload.anomaly_source)    setAnomalySource(payload.anomaly_source);
//         if (payload.score_components)  setScoreComponents(payload.score_components);
//         setData(prev => { const n = [...prev, newPoint]; if (n.length > 50) n.shift(); return n; });
        
//         if (payload.is_anomalous) {
//           setSystemState('CRITICAL');
//           if (!hasAlertedRef.current) {
//             hasAlertedRef.current = true;
//             const type = payload.alert_explanation?.anomaly_type || 'unauthorized_deviation';
//             setAnomalyPopup({ show: true, msg: `CRITICAL DEVIATION [${type.toUpperCase()}] DETECTED`, dataset: activeDataset });
//             // Auto-dismiss after 4 seconds
//             if (anomalyPopupTimerRef.current !== null) {
//               window.clearTimeout(anomalyPopupTimerRef.current);
//             }
//             anomalyPopupTimerRef.current = window.setTimeout(() => {
//               setAnomalyPopup(prev => ({ ...prev, show: false }));
//             }, 4000);
//           }
//         }
//         else if (payload.system_loss > payload.threshold * 0.8) {
//           setSystemState('WARNING');
//         }
//         else {
//           setSystemState('HEALTHY');
//           hasAlertedRef.current = false; // Reset trigger so next anomaly alerts again
//           setAnomalyPopup(prev => ({ ...prev, show: false }));
//         }
//       };
//     };

//     connect();
//     return () => {
//       stopped = true;
//       if (reconnectTimerRef.current !== null) {
//         window.clearTimeout(reconnectTimerRef.current);
//         reconnectTimerRef.current = null;
//       }
//       if (anomalyPopupTimerRef.current !== null) {
//         window.clearTimeout(anomalyPopupTimerRef.current);
//         anomalyPopupTimerRef.current = null;
//       }
//       if (wsRef.current) {
//         wsRef.current.close();
//         wsRef.current = null;
//       }
//       window.removeEventListener('popstate', handlePopState);
//     };
//   }, []);

//   const submitFeedback = async (wasAnomaly: boolean, calibrateRequested: boolean, note: string) => {
//     const last = data.length ? data[data.length - 1] : null;
//     const res = await fetch('http://127.0.0.1:8000/feedback', {
//       method: 'POST', headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({
//         was_anomaly: wasAnomaly, tick: last?.tick, note,
//         severity_level: alertExplanation?.severity_level, confidence: alertExplanation?.confidence,
//         anomaly_type: alertExplanation?.anomaly_type, calibrate_requested: calibrateRequested,
//         system_loss: last?.system_loss, threshold: last?.threshold,
//       }),
//     });
//     if (!res.ok) throw new Error(`feedback submit failed: ${res.status}`);
//     return res.json();
//   };

//   const dismissAlarm = async () => {
//     setIsSubmittingFeedback(true); setFeedbackStatus('');
//     try {
//       await submitFeedback(false, true, 'Operator dismissed alert and requested adaptive calibration.');
//       await fetch('http://localhost:8000/calibrate', { method: 'POST' });
//       setSystemState('HEALTHY');
//       setFeedbackStatus('Dismissed as non-anomalous. Calibration executed.');
//     } catch (err) { setFeedbackStatus('Failed to submit dismissal or calibration.'); } 
//     finally { setIsSubmittingFeedback(false); }
//   };

//   const acknowledgeAlert = async () => {
//     setIsSubmittingFeedback(true); setFeedbackStatus('');
//     try {
//       await submitFeedback(true, false, 'Operator acknowledged anomaly alert as valid.');
//       setFeedbackStatus('Alert acknowledged. Feedback recorded for retraining.');
//     } catch (err) { setFeedbackStatus('Failed to submit acknowledgment feedback.'); } 
//     finally { setIsSubmittingFeedback(false); }
//   };

//   const changeDataset = async (ds: string) => {
//     if (ds === activeDataset) return;
//     setIsTransitioning(true);
//     setData([]); setDimensions(0); setAlertExplanation(null);
//     setAnomalySource(null); setScoreComponents(null); setActiveDataset(ds);
//     try {
//       await fetch('http://127.0.0.1:8000/change_dataset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataset: ds }) });
//     } catch (e) { console.error('Failed to hot-swap dataset:', e); }
//     finally { setIsTransitioning(false); }
//   };

//   const navigateTo = (path: string) => {
//     window.history.pushState(null, '', path);
//     setCurrentPath(path);
//   };

//   const hotSensors = new Set<string>(alertExplanation?.top_contributors.map(c => c.sensor) ?? []);

//   if (currentPath === '/landing') {
//     return <LandingPage onLaunch={() => {
//       navigateTo('/dashboard');
//     }} />;
//   }
  
//   if (currentPath === '/ai-chat') {
//     return <AIChatPage 
//       onBack={() => navigateTo('/dashboard')} 
//       systemState={systemState}
//       activeDataset={activeDataset}
//       alertExplanation={alertExplanation}
//       currentMetrics={data.length ? data[data.length - 1] : null}
//     />;
//   }

//   return (
//     <div id="utau-dashboard-capture" style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden', background: 'var(--bg-page)' }}>
      
//       {/* ── Custom Animated Anomaly Popup ── */}
//       <AnimatePresence>
//         {anomalyPopup.show && (
//           <motion.div
//             initial={{ y: -100, opacity: 0, scale: 0.95 }}
//             animate={{ y: 20, opacity: 1, scale: 1 }}
//             exit={{ y: -50, opacity: 0, scale: 0.95 }}
//             transition={{ type: 'spring', stiffness: 400, damping: 25 }}
//             style={{
//               position: 'fixed', top: 0, left: '50%', x: '-50%', zIndex: 9999,
//               background: 'rgba(30, 8, 8, 0.95)', backdropFilter: 'blur(12px)',
//               border: '1px solid var(--crimson)', borderRadius: 12, padding: '12px 24px',
//               boxShadow: '0 8px 32px rgba(220, 20, 60, 0.4), inset 0 0 16px rgba(220, 20, 60, 0.2)',
//               display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer'
//             }}
//             onClick={() => setAnomalyPopup(prev => ({ ...prev, show: false }))}
//           >
//             <div style={{ padding: 10, background: 'rgba(220, 20, 60, 0.2)', borderRadius: 50 }}>
//               <AlertTriangle color="var(--crimson)" size={28} style={{ animation: 'golden-breathe 1s infinite' }} />
//             </div>
//             <div style={{ display: 'flex', flexDirection: 'column' }}>
//               <span style={{ color: 'var(--crimson)', fontFamily: "'Cinzel', serif", fontWeight: 800, letterSpacing: '0.15em', fontSize: 13 }}>
//                 SYSTEM SEVERITY: CRITICAL
//               </span>
//               <span style={{ color: 'var(--text-secondary)', fontFamily: "'Cormorant Garamond', serif", fontSize: 15, marginTop: 2 }}>
//                 {anomalyPopup.msg} IN <strong style={{ color: 'var(--text-primary)' }}>{anomalyPopup.dataset.toUpperCase()}</strong>
//               </span>
//             </div>
//             <X size={16} color="var(--text-dim)" style={{ marginLeft: 16 }} />
//           </motion.div>
//         )}
//       </AnimatePresence>

//       {/* Header */}
//       <div style={{ height: 56, flexShrink: 0 }} className="hud-header">
//         <UtauHeader
//           state={systemState} isConnected={isConnected && !isTransitioning}
//           tabs={DATASET_TABS} activeDataset={activeDataset} isTransitioning={isTransitioning}
//           onChangeDataset={changeDataset} isAnomalySourceTabEnabled={isAnomalySourceTabEnabled}
//           isDataSourceTabEnabled={isDataSourceTabEnabled}
//           isRlPolicySuggestionsEnabled={isRlPolicySuggestionsEnabled}
//           activeFeatureTab={activeFeatureTab} onFeatureTabChange={setActiveFeatureTab}
//           onNavigateHome={() => navigateTo('/landing')}
//           onNavigateToChat={() => navigateTo('/ai-chat')}
//           onGeneratePDF={generatePDFReport}
//         />
//       </div>

//       {/* Body */}
//       {activeFeatureTab === 'anomaly-source' ? (
//         <div className="panel" style={{ margin: 12, overflow: 'auto', padding: 18, flex: 1, minHeight: 0 }}>
//           <AnomalySourceTab activeDataset={activeDataset} alertExplanation={alertExplanation} anomalySource={anomalySource} scoreComponents={scoreComponents} isConnected={isConnected} />
//         </div>
//       ) : activeFeatureTab === 'data-source' ? (
//         <div className="panel" style={{ margin: 12, overflow: 'auto', padding: 18, flex: 1, minHeight: 0 }}>
//           <DataSourceTab />
//         </div>
//       ) : (
//         /* Standard 3-Column Dashboard */
//         <div style={{
//           flex: 1, minHeight: 0,
//           display: 'grid',
//           gridTemplateColumns: '320px 1fr 340px',
//           gap: 16, padding: '16px',
//         }}>

//           {/* LEFT: 3D Asset & Topology */}
//           <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
//             <TopologyPanel activeDataset={activeDataset} scoreComponents={scoreComponents} alertExplanation={alertExplanation} systemState={systemState} />
//           </div>

//           {/* CENTER: Charts dominating the center */}
//           <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
//             {/* Hero score chart */}
//             <div style={{ flex: '0 0 45%', minHeight: 0 }}>
//               <HeroSection data={data} systemState={systemState} dimensions={dimensions} />
//             </div>
//             {/* Sensor residuals */}
//             <div style={{ flex: 1, minHeight: 0 }}>
//               <ResidualSection data={data} dimensions={dimensions} activeDataset={activeDataset} hotSensors={hotSensors} />
//             </div>
//           </div>

//           {/* RIGHT: Incident & Governance */}
//           <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
//             <IncidentReport alertExplanation={alertExplanation} activeDataset={activeDataset} />
//             <RootCausePanel alertExplanation={alertExplanation} />
//             <SimilarIncidents alertExplanation={alertExplanation} />
//             <GovernancePanel systemState={systemState} isSubmitting={isSubmittingFeedback} feedbackStatus={feedbackStatus} onAcknowledge={acknowledgeAlert} onDismiss={dismissAlarm} />
//           </div>

//         </div>
//       )}
//     </div>
//   );
// }



import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { UtauHeader }  from './components/Header';
import { HeroSection, ResidualSection } from './components/CenterPanel';
import AnomalySourceTab from './components/AnomalySourceTab';
import DataSourceTab from './components/DataSourceTab';
import LandingPage from './LandingPage';
import AIChatPage from './AIChatPage';
import FleetView from './FleetView';
import InspectionPage from './InspectionPage';
import ChatbotPopup from './components/ChatbotPopup';
import CrossReferenceTimeline from './components/CrossReferenceTimeline';
import BackgroundViewer from './components/BackgroundViewer';
import LeftHud from './components/LeftHud';
import RightHud from './components/RightHud';

interface AlertExplanation {
  severity_score: number;
  severity_level: 'info' | 'warning' | 'critical';
  confidence: number;
  anomaly_type: string;
  duration_steps: number;
  top_contributors: { sensor: string; contribution_pct: number }[];
  historical_similar: { tick: number; dataset: string; summary: string; similarity?: number }[];
  investigation_hints: string[];
}

interface DataPoint {
  tick: number; system_loss: number; is_anomalous: boolean; threshold: number;
  actual?: number[];
  forecast?: number[];
  [key: string]: any;
}

const UI_UPDATE_INTERVAL_MS = 350;
const MAX_CHART_POINTS = 30;

const DATASET_TABS = [
  { label: 'SOLAR ARRAY',  value: 'solar_synthetic' },
  { label: 'WIND FARM',    value: 'wind_synthetic'  },
  { label: 'GENERIC',      value: 'synthetic'       },
];

const featureFlag = (value: unknown, defaultValue = false): boolean => {
  if (typeof value !== 'string') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

export default function App() {
  const isAnomalySourceTabEnabled = featureFlag(import.meta.env.VITE_FEATURE_ANOMALY_SOURCE_TAB, true);
  const isDataSourceTabEnabled = featureFlag(import.meta.env.VITE_FEATURE_DATA_SOURCE_TAB, true);
  const isRlPolicySuggestionsEnabled = featureFlag(import.meta.env.VITE_FEATURE_RL_POLICY_SUGGESTIONS);

  const [data,                  setData]                  = useState<DataPoint[]>([]);
  const [isConnected,           setIsConnected]           = useState(false);
  const [systemState,           setSystemState]           = useState<'HEALTHY' | 'WARNING' | 'CRITICAL'>('HEALTHY');
  const [dimensions,            setDimensions]            = useState<number>(0);
  const [activeDataset,         setActiveDataset]         = useState('solar_synthetic');
  const [isTransitioning,       setIsTransitioning]       = useState(false);
  const [isModelLoading,        setIsModelLoading]        = useState(false);
  const [alertExplanation,      setAlertExplanation]      = useState<AlertExplanation | null>(null);
  const [anomalySource,         setAnomalySource]         = useState<any | null>(null);
  const [scoreComponents,       setScoreComponents]       = useState<{ recon: number; forecast: number; corr: number } | null>(null);
  const [feedbackStatus,        setFeedbackStatus]        = useState('');
  const [isSubmittingFeedback,  setIsSubmittingFeedback]  = useState(false);
  const [activeFeatureTab,      setActiveFeatureTab]      = useState<'live' | 'anomaly-source' | 'data-source'>('live');
  const [activeLeftTab,         setActiveLeftTab]         = useState<'diagnostics' | 'residuals'>('diagnostics');
  const [currentPath,           setCurrentPath]           = useState(() => window.location.pathname === '/dashboard' ? '/dashboard' : '/landing');

  // ── NEW: adaptive fine-tune state ────────────────────────────────────────
  // modelVersion reflects model_registry["model_version"] from the backend.
  // retrainRecommended mirrors retrain_state["recommended"].
  const [modelVersion,          setModelVersion]          = useState<string>('default');
  const [retrainRecommended,    setRetrainRecommended]    = useState<boolean>(false);
  const [sensorLabels,          setSensorLabels]          = useState<string[]>([]);
  const [revenueLoss,            setRevenueLoss]           = useState<any>(null);

  // ── NEW: rolling sensor buffer — last 110 frames × n_feats ───────────────
  // Each entry is an ordered array of raw sensor values matching live_buffer in server.py.
  // We keep 110 frames so slice(-100) always yields a full n_window window even
  // if a few frames arrive slightly late or out-of-order.
  const sensorBufferRef = useRef<number[][]>([]);
  const latestPayloadRef = useRef<any | null>(null);
  const uiFlushTimerRef = useRef<number | null>(null);
  const activeDatasetRef = useRef(activeDataset);

  // Custom Visual Notifications
  const [anomalyPopup, setAnomalyPopup] = useState<{ show: boolean; msg: string; dataset: string }>({ show: false, msg: '', dataset: '' });
  const hasAlertedRef = useRef(false);
  const anomalyPopupTimerRef = useRef<number | null>(null);

  useEffect(() => {
    activeDatasetRef.current = activeDataset;
    // Trigger a 2.5s visual loading overlay to mask the 3D model auto-play clicks
    setIsModelLoading(true);
    const timer = setTimeout(() => setIsModelLoading(false), 2500);
    return () => clearTimeout(timer);
  }, [activeDataset]);

  // ── Poll /api/status every 10 s to pick up model version bumps ───────────
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/status?dataset=${activeDataset}`);
        if (!res.ok) throw new Error("Network response was not ok");
        const status = await res.json();
        // model_version key lives in model_registry inside the status payload
        if (status.model_version && status.model_version !== modelVersion) {
          setModelVersion(status.model_version);
        }
        if (typeof status.retrain_recommended === 'boolean') {
          setRetrainRecommended(status.retrain_recommended);
        }
      } catch {
        // silently ignore — server might be starting up
      }
    };
    fetchStatus();
    const id = window.setInterval(fetchStatus, 10_000);
    return () => window.clearInterval(id);
  }, []); // runs once; modelVersion intentionally excluded to avoid restart loop

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/domain_context')
      .then(r => r.ok ? r.json() : null)
      .then(ctx => {
        if (ctx && ctx.fields && ctx.fields.length > 0) {
          setSensorLabels(ctx.fields.map((f: any) => `${f.label} (${f.unit})`));
        } else {
          setSensorLabels([]);
        }
      })
      .catch(() => setSensorLabels([]));
  }, [activeDataset]);

  const generatePDFReport = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/feedback_history?limit=100');
      if (!res.ok) throw new Error("Failed to fetch feedback history");
      const history = await res.json();

      let aiInsight = "System is operating within expected parameters. Continue standard monitoring protocols.";
      try {
        const aiRes = await fetch('http://127.0.0.1:8000/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{
              role: 'user', 
              content: `Write a short 2-sentence executive summary for an industrial health report. The current system state is ${systemState}, active asset is ${activeDataset}, and there are ${history.length} historical events logged. Be highly professional and concise.`
            }],
            temperature: 0.3
          })
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          if (aiData?.choices?.[0]?.message?.content) {
            aiInsight = aiData.choices[0].message.content.trim();
          }
        }
      } catch (e) {
        console.warn("Failed to fetch AI insight for PDF", e);
      }

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // --- 1. PREMIUM HEADER BAND ---
      doc.setFillColor(10, 9, 7); // Dark Slate background
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      // Draw UTAU Vector Logo (Diamond)
      const logoX = 20;
      const logoY = 20;
      const logoR = 6;
      doc.setDrawColor(184, 134, 42); // Gold
      doc.setLineWidth(0.8);
      doc.lines([[logoR, logoR], [-logoR, logoR], [-logoR, -logoR], [logoR, -logoR]], logoX, logoY - logoR);
      doc.setFillColor(184, 134, 42);
      const innerR = 2.5;
      doc.lines([[innerR, innerR], [-innerR, innerR], [-innerR, -innerR], [innerR, -innerR]], logoX, logoY - innerR, [1, 1], 'F');

      // Header Text
      doc.setTextColor(240, 235, 224); // Cream text
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text("UTAU", 38, 22);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(184, 134, 42); // Gold text
      doc.text("EXECUTIVE HEALTH REPORT", 38, 28);
      
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(9);
      doc.text(`DATE: ${new Date().toLocaleDateString()}`, pageWidth - 20, 22, { align: 'right' });
      doc.text(`ASSET: ${activeDataset.toUpperCase()}`, pageWidth - 20, 28, { align: 'right' });

      // --- 2. EXECUTIVE SUMMARY SECTION ---
      let currentY = 50;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(44, 30, 10);
      doc.text("SYSTEM SNAPSHOT", 14, currentY);
      currentY += 8;
      
      // Status Indicator Box
      const stateColor = systemState === 'CRITICAL' ? [168, 50, 64] : systemState === 'WARNING' ? [160, 88, 26] : [184, 134, 42];
      doc.setFillColor(stateColor[0], stateColor[1], stateColor[2]);
      doc.rect(14, currentY, 4, 16, 'F');
      doc.setFontSize(11);
      doc.setTextColor(80, 60, 40);
      doc.text("CURRENT STATE", 22, currentY + 6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(stateColor[0], stateColor[1], stateColor[2]);
      doc.text(systemState, 22, currentY + 14);

      // Financial Impact Box (if available)
      if (revenueLoss) {
        doc.setFillColor(184, 134, 42);
        doc.rect(80, currentY, 4, 16, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(80, 60, 40);
        doc.text("FINANCIAL IMPACT", 88, currentY + 6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(44, 30, 10);
        doc.text(revenueLoss.status_text || "NOMINAL", 88, currentY + 14);
      }
      
      currentY += 24;

      // --- NEW: AI EXECUTIVE SUMMARY ---
      doc.setFillColor(28, 26, 23); // Dark slate
      doc.rect(14, currentY, pageWidth - 28, 30, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(184, 134, 42); // Gold
      doc.text("GROQ AI EXECUTIVE INSIGHT", 20, currentY + 8);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(240, 235, 224); // Cream
      const insightLines = doc.splitTextToSize(aiInsight, pageWidth - 40);
      doc.text(insightLines, 20, currentY + 16);
      
      currentY += 40;

      // --- 3. ACTIVE ANOMALY INTELLIGENCE ---
      if (systemState !== 'HEALTHY' && alertExplanation) {
        doc.setFillColor(244, 237, 216); // Light cream background
        doc.rect(14, currentY, pageWidth - 28, 40, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(168, 50, 64);
        doc.text("AI COPILOT: ACTIVE THREAT ANALYSIS", 20, currentY + 10);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(44, 30, 10);
        const topSensor = alertExplanation.top_contributors?.[0]?.sensor || 'Unknown';
        doc.text(`Primary Contributor: ${topSensor}`, 20, currentY + 18);
        
        const hints = doc.splitTextToSize(alertExplanation.investigation_hints?.join(" ") || "No hints available.", pageWidth - 40);
        doc.text(hints, 20, currentY + 26);
        
        currentY += 52;
      }

      // --- 4. HISTORICAL TELEMETRY AUDIT ---
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(44, 30, 10);
      doc.text("HISTORICAL TELEMETRY AUDIT", 14, currentY);
      
      const tableColumn = ["Time", "Tick", "Type", "Severity", "Confirmed", "Notes"];
      const tableRows = history.map((item: any) => [
        new Date(item.created_at_ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        item.tick || 'N/A',
        (item.anomaly_type || 'Unknown').replace(/_/g, ' ').toUpperCase(),
        (item.severity_level || 'N/A').toUpperCase(),
        item.was_anomaly ? 'YES' : 'NO',
        item.note || '--',
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: currentY + 6,
        theme: 'grid',
        headStyles: { fillColor: [184, 134, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 245, 240] },
        styles: { fontSize: 9, cellPadding: 4, font: 'helvetica', textColor: [60, 50, 40] },
        columnStyles: {
          3: { fontStyle: 'bold' } // Severity column
        },
        willDrawCell: function (data: any) {
          // Color code severity in the table
          if (data.section === 'body' && data.column.index === 3) {
            if (data.cell.raw === 'CRITICAL') {
              doc.setTextColor(168, 50, 64);
            } else if (data.cell.raw === 'WARNING') {
              doc.setTextColor(160, 88, 26);
            } else {
              doc.setTextColor(184, 134, 42);
            }
          }
        },
      });

      // --- 5. FOOTER ---
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(`Generated by UTAU Advanced Telemetry & AI Copilot  •  Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
      }

      doc.save(`UTAU_Executive_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("Failed to generate Premium PDF Data Report", err);
    }
  };

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let stopped = false;

    if (window.location.pathname === '/' || window.location.pathname === '') {
      window.history.replaceState(null, '', '/landing');
    }

    const handlePopState = () => {
      let nextPath = window.location.pathname;
      if (nextPath !== '/landing' && nextPath !== '/ai-chat' && nextPath !== '/fleet' && nextPath !== '/inspect') nextPath = '/dashboard';
      setCurrentPath(nextPath);
    };
    window.addEventListener('popstate', handlePopState);

    const wsScheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${wsScheme}://127.0.0.1:8000/ws/stream`;

    const connect = () => {
      if (stopped) return;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setIsConnected(true);
      ws.onclose = () => {
        setIsConnected(false);
        if (!stopped) {
          reconnectTimerRef.current = window.setTimeout(connect, 1000);
        }
      };
      ws.onerror = () => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      };

      const flushLatestPayload = () => {
        uiFlushTimerRef.current = null;
        const payload = latestPayloadRef.current;
        latestPayloadRef.current = null;
        if (!payload) return;

        if (payload.dimensions) {
          setDimensions(prev => (payload.dimensions !== prev ? payload.dimensions : prev));
        }

        const dims = Number(payload.dimensions) || 0;
        const actualArr: number[] = [];
        const forecastArr: number[] = [];
        if (dims > 0) {
          for (let i = 0; i < dims; i += 1) {
            actualArr.push(Number(payload.sensors?.[`s${i}_actual`]) || 0);
            forecastArr.push(Number(payload.forecast?.[`s${i}_forecast`]) || 0);
          }
        }

        const newPoint: DataPoint = {
          tick: payload.tick,
          system_loss: payload.system_loss,
          is_anomalous: payload.is_anomalous,
          threshold: payload.threshold,
          actual: actualArr,
          forecast: forecastArr,
        };

        if (payload.alert_explanation) {
          if (payload.alert_explanation.manual_trigger) {
            const isSolar = activeDatasetRef.current === "solar_synthetic";
            const testSensors = isSolar ? ["s7", "s6", "s0"] : ["s3", "s10", "s6"]; // Solar: Inverter, Panel, JBox. Wind: Gearbox, Bearing, Generator
            const randomSensor = testSensors[Math.floor(Math.random() * testSensors.length)];
            if (payload.alert_explanation.top_contributors?.length > 0) {
              payload.alert_explanation.top_contributors[0].sensor = randomSensor;
            } else {
              payload.alert_explanation.top_contributors = [{ sensor: randomSensor, contribution_score: 99.9 }];
            }
          }
          setAlertExplanation(payload.alert_explanation);
        }
        if (payload.anomaly_source) setAnomalySource(payload.anomaly_source);
        if (payload.score_components) setScoreComponents(payload.score_components);
        if (payload.revenue_loss) setRevenueLoss(payload.revenue_loss);

        setData(prev => {
          if (prev.length >= MAX_CHART_POINTS) {
            return [...prev.slice(-(MAX_CHART_POINTS - 1)), newPoint];
          }
          return [...prev, newPoint];
        });

        if (payload.is_anomalous) {
          setSystemState('CRITICAL');
          if (!hasAlertedRef.current) {
            hasAlertedRef.current = true;
            const type = payload.alert_explanation?.anomaly_type || 'unauthorized_deviation';
            setAnomalyPopup({
              show: true,
              msg: `CRITICAL DEVIATION [${type.toUpperCase()}] DETECTED`,
              dataset: activeDatasetRef.current,
            });
            if (anomalyPopupTimerRef.current !== null) {
              window.clearTimeout(anomalyPopupTimerRef.current);
            }
            anomalyPopupTimerRef.current = window.setTimeout(() => {
              setAnomalyPopup(prev => ({ ...prev, show: false }));
            }, 4000);
          }
        } else if (payload.system_loss > payload.threshold * 0.8) {
          setSystemState('WARNING');
        } else {
          setSystemState('HEALTHY');
          hasAlertedRef.current = false;
          setAnomalyPopup(prev => ({ ...prev, show: false }));
        }
      };

      const schedulePayloadFlush = () => {
        if (uiFlushTimerRef.current !== null) return;
        uiFlushTimerRef.current = window.setTimeout(flushLatestPayload, UI_UPDATE_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        let payload: any;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }

        // Keep retrain feedback fidelity by buffering every sensor frame received.
        if (payload.sensors && typeof payload.sensors === 'object') {
          const keys = (Object.keys(payload.sensors) as string[]).sort((a, b) => {
            const na = parseInt(a.replace(/\D/g, ''), 10) || 0;
            const nb = parseInt(b.replace(/\D/g, ''), 10) || 0;
            return na - nb;
          });
          const frame = keys.map(k => Number(payload.sensors[k]) || 0);
          if (frame.length > 0) {
            sensorBufferRef.current.push(frame);
            if (sensorBufferRef.current.length > 110) {
              sensorBufferRef.current.shift();
            }
          }
        }

        latestPayloadRef.current = payload;
        schedulePayloadFlush();
      };
    };

    connect();
    return () => {
      stopped = true;
      if (reconnectTimerRef.current !== null) { window.clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
      if (uiFlushTimerRef.current !== null) { window.clearTimeout(uiFlushTimerRef.current); uiFlushTimerRef.current = null; }
      if (anomalyPopupTimerRef.current !== null) { window.clearTimeout(anomalyPopupTimerRef.current); anomalyPopupTimerRef.current = null; }
      latestPayloadRef.current = null;
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // ── UPDATED: submitFeedback now includes raw_window ───────────────────────
  const submitFeedback = async (wasAnomaly: boolean, calibrateRequested: boolean, note: string) => {
    const last = data.length ? data[data.length - 1] : null;

    // Take the last 100 frames from the rolling buffer and flatten to 1-D list.
    // server.py / online_finetuner.py will reshape it back to (n_window, n_feats).
    const rawWindowFrames = sensorBufferRef.current.slice(-100);
    const rawWindowFlat: number[] | undefined =
      rawWindowFrames.length > 0 ? rawWindowFrames.flat() : undefined;

    const res = await fetch('http://127.0.0.1:8000/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        was_anomaly:          wasAnomaly,
        tick:                 last?.tick,
        note,
        severity_level:       alertExplanation?.severity_level,
        confidence:           alertExplanation?.confidence,
        anomaly_type:         alertExplanation?.anomaly_type,
        calibrate_requested:  calibrateRequested,
        system_loss:          last?.system_loss,
        threshold:            last?.threshold,
        // ── NEW ──────────────────────────────────────────────────────────────
        raw_window:           rawWindowFlat,   // undefined → server falls back to live_buffer
      }),
    });
    if (!res.ok) throw new Error(`feedback submit failed: ${res.status}`);
    return res.json();
  };

  const dismissAlarm = async () => {
    setIsSubmittingFeedback(true); setFeedbackStatus('');
    try {
      await submitFeedback(false, true, 'Operator dismissed alert and requested adaptive calibration.');
      await fetch('http://localhost:8000/calibrate', { method: 'POST' });
      setSystemState('HEALTHY');
      setFeedbackStatus('Dismissed as non-anomalous. Calibration executed.');
    } catch (err) {
      setFeedbackStatus('Failed to submit dismissal or calibration.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const acknowledgeAlert = async () => {
    setIsSubmittingFeedback(true); setFeedbackStatus('');
    try {
      await submitFeedback(true, false, 'Operator acknowledged anomaly alert as valid.');
      setFeedbackStatus('Alert acknowledged. Feedback recorded for retraining.');
    } catch (err) {
      setFeedbackStatus('Failed to submit acknowledgment feedback.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // ── NEW: manual retrain trigger ───────────────────────────────────────────
  const triggerManualRetrain = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/retrain', { method: 'POST' });
      if (!res.ok) {
        setFeedbackStatus(`Retrain failed: ${res.status}`);
        return;
      }
      const result = await res.json();
      setFeedbackStatus(`Fine-tune started (${result.current_version}). Model will update in background.`);
      // Optimistically update version label; polling will correct it
      if (result.current_version) setModelVersion(result.current_version);
      setRetrainRecommended(false);
    } catch (err) {
      setFeedbackStatus('Could not reach server for manual retrain.');
    }
  };

  const triggerManualAnomaly = async () => {
    setFeedbackStatus('');
    try {
      const res = await fetch('http://127.0.0.1:8000/api/anomaly/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticks: 1, reason: 'dashboard test trigger' }),
      });
      if (!res.ok) {
        setFeedbackStatus(`Manual anomaly trigger failed: ${res.status}`);
        return;
      }
      const result = await res.json();
      setFeedbackStatus(`Manual anomaly armed (${result.pending_ticks} tick pending).`);
    } catch {
      setFeedbackStatus('Could not reach server for manual anomaly trigger.');
    }
  };

  const changeDataset = async (ds: string) => {
    if (ds === activeDataset) return;
    setIsTransitioning(true);
    setData([]); setDimensions(0); setAlertExplanation(null);
    setAnomalySource(null); setScoreComponents(null); setActiveDataset(ds);
    // Clear sensor buffer on dataset swap — new dataset has different n_feats
    sensorBufferRef.current = [];
    try {
      await fetch('http://127.0.0.1:8000/change_dataset', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset: ds }),
      });
    } catch (e) {
      console.error('Failed to hot-swap dataset:', e);
    } finally {
      setIsTransitioning(false);
    }
  };

  const navigateTo = (path: string) => {
    window.history.pushState(null, '', path);
    setCurrentPath(path);
  };

  const hotSensors = new Set<string>(alertExplanation?.top_contributors.map(c => c.sensor) ?? []);

  if (currentPath === '/landing') {
    return <LandingPage onLaunch={() => { navigateTo('/dashboard'); }} />;
  }

  if (currentPath === '/ai-chat') {
    return (
      <AIChatPage
        onBack={() => navigateTo('/dashboard')}
        systemState={systemState}
        activeDataset={activeDataset}
        alertExplanation={alertExplanation}
        currentMetrics={data.length ? data[data.length - 1] : null}
      />
    );
  }

  if (currentPath === '/fleet') {
    return (
      <FleetView
        onBack={() => navigateTo('/dashboard')}
        activeDataset={activeDataset}
      />
    );
  }

  if (currentPath === '/inspect') {
    return (
      <InspectionPage
        onBack={() => navigateTo('/dashboard')}
        activeDataset={activeDataset}
      />
    );
  }

  return (
    <div id="utau-dashboard-capture" className="dashboard-immersive" style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── Custom Animated Anomaly Popup ── */}
      <AnimatePresence>
        {anomalyPopup.show && (
          <motion.div
            initial={{ y: -100, opacity: 0, scale: 0.95 }}
            animate={{ y: 20, opacity: 1, scale: 1 }}
            exit={{ y: -50, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            style={{
              position: 'fixed', top: 0, left: '50%', x: '-50%', zIndex: 9999,
              background: 'rgba(30, 8, 8, 0.95)', backdropFilter: 'blur(12px)',
              border: '1px solid var(--crimson)', borderRadius: 12, padding: '12px 24px',
              boxShadow: '0 8px 32px rgba(220, 20, 60, 0.4), inset 0 0 16px rgba(220, 20, 60, 0.2)',
              display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer',
            }}
            onClick={() => setAnomalyPopup(prev => ({ ...prev, show: false }))}
          >
            <div style={{ padding: 10, background: 'rgba(220, 20, 60, 0.2)', borderRadius: 50 }}>
              <AlertTriangle color="var(--crimson)" size={28} style={{ animation: 'golden-breathe 1s infinite' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: 'var(--crimson)', fontFamily: "'Cinzel', serif", fontWeight: 800, letterSpacing: '0.15em', fontSize: 13 }}>
                SYSTEM SEVERITY: CRITICAL
              </span>
              <span style={{ color: 'var(--text-secondary)', fontFamily: "'Cormorant Garamond', serif", fontSize: 15, marginTop: 2 }}>
                {anomalyPopup.msg} IN <strong style={{ color: 'var(--text-primary)' }}>{anomalyPopup.dataset.toUpperCase()}</strong>
              </span>
            </div>
            <X size={16} color="var(--text-dim)" style={{ marginLeft: 16 }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div style={{ height: 72, flexShrink: 0, position: 'relative', zIndex: 100 }} className="hud-header">
        <UtauHeader
          state={systemState} isConnected={isConnected && !isTransitioning}
          tabs={DATASET_TABS} activeDataset={activeDataset} isTransitioning={isTransitioning}
          onChangeDataset={changeDataset} isAnomalySourceTabEnabled={isAnomalySourceTabEnabled}
          isDataSourceTabEnabled={isDataSourceTabEnabled}
          isRlPolicySuggestionsEnabled={isRlPolicySuggestionsEnabled}
          activeFeatureTab={activeFeatureTab} onFeatureTabChange={setActiveFeatureTab}
          onNavigateHome={() => navigateTo('/landing')}
          onNavigateToChat={() => navigateTo('/ai-chat')}
          onNavigateToFleet={() => navigateTo('/fleet')}
          onNavigateToInspect={() => navigateTo('/inspect')}
          onGeneratePDF={generatePDFReport}
        />
      </div>

      {/* Body */}
      {activeFeatureTab === 'anomaly-source' ? (
        <div className="panel" style={{ margin: 12, overflow: 'auto', padding: 18, flex: 1, minHeight: 0 }}>
          <AnomalySourceTab activeDataset={activeDataset} alertExplanation={alertExplanation} anomalySource={anomalySource} scoreComponents={scoreComponents} isConnected={isConnected} />
        </div>
      ) : activeFeatureTab === 'data-source' ? (
        <div className="panel" style={{ margin: 12, overflow: 'auto', padding: 18, flex: 1, minHeight: 0 }}>
          <DataSourceTab />
        </div>
      ) : (
        /* ── Immersive Full-Bleed Dashboard ── */
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>

          {/* ── Visual Loading Overlay (masks 3D model load and auto-clicks) ── */}
          <AnimatePresence>
            {isModelLoading && (
              <motion.div
                initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                animate={{ opacity: 1, backdropFilter: 'blur(20px)' }}
                exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                transition={{ duration: 0.4 }}
                style={{
                  position: 'absolute', inset: 0, zIndex: 100,
                  background: 'rgba(10, 9, 7, 0.75)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 20
                }}
              >
                <div className="animate-spin" style={{
                  width: 50, height: 50, borderRadius: '50%',
                  border: '3px solid rgba(212, 168, 83, 0.2)',
                  borderTopColor: 'var(--gold)'
                }} />
                <div className="animate-pulse" style={{
                  fontFamily: 'var(--font-mono)', fontSize: 13,
                  fontWeight: 700, letterSpacing: '0.2em', color: 'var(--gold)'
                }}>
                  INITIALIZING SECURE 3D FEED...
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Layer 0: Full-bleed interactive 3D background ── */}
          <BackgroundViewer 
            activeDataset={activeDataset} 
            topSensor={alertExplanation?.top_contributors?.[0]?.sensor ?? null} 
          />

          {/* ── Layer 1: Edge-aligned HUD overlay (Center stays completely clear!) ── */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 5,
            display: 'flex', justifyContent: 'space-between',
            padding: '16px', gap: '20px',
            pointerEvents: 'none',
          }}>

            {/* TOP CENTER BANNER: Fused Anomaly Score */}
            <div style={{
              position: 'absolute', top: 16, left: 380 + 36, right: 380 + 36,
              height: 160, pointerEvents: 'auto', display: 'flex', flexDirection: 'column'
            }} className="glass-hud">
              <HeroSection data={data} systemState={systemState} dimensions={dimensions} />
            </div>

            {/* LEFT COLUMN: Diagnostics & Data */}
            <div style={{ width: '380px', pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
              
              {/* Tab Toggle */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button 
                  onClick={() => setActiveLeftTab('diagnostics')}
                  style={{
                    flex: 1, padding: '10px 0', border: '1px solid', borderRadius: 4, cursor: 'pointer',
                    background: activeLeftTab === 'diagnostics' ? 'var(--gold-dim)' : 'transparent',
                    borderColor: activeLeftTab === 'diagnostics' ? 'var(--gold)' : 'var(--border)',
                    color: activeLeftTab === 'diagnostics' ? 'var(--text-primary)' : 'var(--text-dim)',
                    fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em',
                    transition: 'all 0.2s ease', backdropFilter: 'blur(10px)'
                  }}
                >
                  DIAGNOSTICS HUD
                </button>
                <button 
                  onClick={() => setActiveLeftTab('residuals')}
                  style={{
                    flex: 1, padding: '10px 0', border: '1px solid', borderRadius: 4, cursor: 'pointer',
                    background: activeLeftTab === 'residuals' ? 'var(--gold-dim)' : 'transparent',
                    borderColor: activeLeftTab === 'residuals' ? 'var(--gold)' : 'var(--border)',
                    color: activeLeftTab === 'residuals' ? 'var(--text-primary)' : 'var(--text-dim)',
                    fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em',
                    transition: 'all 0.2s ease', backdropFilter: 'blur(10px)'
                  }}
                >
                  SENSOR RESIDUALS
                </button>
              </div>

              {activeLeftTab === 'diagnostics' ? (
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} className="glass-hud">
                  <LeftHud
                    activeDataset={activeDataset}
                    scoreComponents={scoreComponents}
                    alertExplanation={alertExplanation}
                    data={data}
                    dimensions={dimensions}
                    sensorLabels={sensorLabels}
                    systemState={systemState}
                  />
                </div>
              ) : (
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }} className="glass-hud">
                  <ResidualSection data={data} dimensions={dimensions} activeDataset={activeDataset} hotSensors={hotSensors} sensorLabels={sensorLabels} />
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Intelligence & Governance */}
            <div style={{ width: '380px', pointerEvents: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, overflow: 'auto' }} className="glass-hud">
                <RightHud
                  alertExplanation={alertExplanation}
                  activeDataset={activeDataset}
                  systemState={systemState}
                  revenueLoss={revenueLoss}
                  isSubmittingFeedback={isSubmittingFeedback}
                  feedbackStatus={feedbackStatus}
                  onAcknowledge={acknowledgeAlert}
                  onDismiss={dismissAlarm}
                  modelVersion={modelVersion}
                  retrainRecommended={retrainRecommended}
                  onManualRetrain={triggerManualRetrain}
                  onTriggerAnomaly={triggerManualAnomaly}
                />
                <div style={{ padding: '0 12px 12px' }}>
                  <CrossReferenceTimeline
                    activeDataset={activeDataset}
                    isAnomalous={systemState !== 'HEALTHY'}
                    anomalyScore={data.length > 0 ? (data[data.length - 1].system_loss || 0) : 0}
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Floating Chatbot Popup ── */}
      <ChatbotPopup
        systemState={systemState}
        activeDataset={activeDataset}
        alertExplanation={alertExplanation}
        currentMetrics={data.length ? data[data.length - 1] : null}
      />
    </div>
  );
}