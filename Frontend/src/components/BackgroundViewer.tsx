// BackgroundViewer — Ambient full-bleed 3D background canvas
// Always auto-rotates slowly. Never enters fault-zoom mode.
// Shares the same GLTFs as TurbineViewer/SolarViewer (preloaded, cached by drei).

import { useRef, useEffect, useMemo, useState, useCallback } from "react";

type AnomalyType = "gearbox" | "generator" | "bearing" | "inverter" | "panel" | "junction_box" | null;
type AnyAnomaly = AnomalyType;

// ── Sensor → 3D component mapping ────────────────────────────────────────
function sensorToAnomaly(sensor: string | null, isWind: boolean): AnyAnomaly {
  if (!sensor) return null;
  if (isWind) {
    if (sensor === "gearbox_oil_temperature" || sensor === "s3") return "gearbox";
    if (sensor === "vibration_x" || sensor === "s0" ||
      sensor === "vibration_y" || sensor === "s1" ||
      sensor === "vibration_z" || sensor === "s2" ||
      sensor === "nacelle_vibration_rms" || sensor === "s10" ||
      sensor === "rotor_rpm" || sensor === "s5") return "bearing";
    if (sensor === "generator_temperature" || sensor === "s4" ||
      sensor === "power_output" || sensor === "s6" ||
      sensor === "power_residual" || sensor === "s11") return "generator";
  } else {
    if (sensor === "s2" || sensor === "s7") return "inverter";
    if (sensor === "s3" || sensor === "s6" || sensor === "s8" || sensor === "s9") return "panel";
    if (sensor === "s0" || sensor === "s1") return "junction_box";
  }
  return null;
}



// ── Wind Turbine ambient scene ─────────────────────────────────────────────────
// (Ambient scenes removed in favor of the interactive viewers)

// ── Main export ────────────────────────────────────────────────────────────────
interface BackgroundViewerProps {
  activeDataset: string;
  topSensor: string | null;
}

export default function BackgroundViewer({ activeDataset, topSensor }: BackgroundViewerProps) {
  const isWind = activeDataset === "wind_synthetic";
  const isSolar = activeDataset === "solar_synthetic";

  const detectedAnomaly = useMemo(() => sensorToAnomaly(topSensor, isWind), [topSensor, isWind]);

  const [anomalyQueue, setAnomalyQueue] = useState<AnyAnomaly[]>([]);
  const [activeAnomaly, setActiveAnomaly] = useState<AnyAnomaly>(null);
  const displayTimerRef = useRef<any>(null);
  const windIframeRef = useRef<HTMLIFrameElement>(null);
  const solarIframeRef = useRef<HTMLIFrameElement>(null);

  // Auto-activate the iframe model when it appears — tries focus + keyboard Enter
  // to bypass the "click to play" overlay that cross-origin iframes sometimes show
  const autoActivateIframe = useCallback((ref: React.RefObject<HTMLIFrameElement>) => {
    const attempt = (delay: number) => setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      // Try postMessage in case the site supports it
      try { el.contentWindow?.postMessage({ action: 'play' }, '*'); } catch {}
      try { el.contentWindow?.postMessage('play', '*'); } catch {}
      // Simulate Enter and Space key on the focused iframe
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', keyCode: 32, bubbles: true }));
      // Also synthesize a click at the visual center of the iframe
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
      document.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
    }, delay);
    attempt(600);
    attempt(1400);
    attempt(2500);
  }, []);

  // Watch for incoming backend anomalies
  useEffect(() => {
    if (detectedAnomaly) {
      setAnomalyQueue(prev => {
        // Prevent spamming the same anomaly if it's already queued or currently showing
        if (prev.includes(detectedAnomaly) || activeAnomaly === detectedAnomaly) return prev;
        return [...prev, detectedAnomaly];
      });
    }
  }, [detectedAnomaly, activeAnomaly]);

  // Process the queue and hold each anomaly for 10 seconds
  useEffect(() => {
    if (!activeAnomaly && anomalyQueue.length > 0) {
      const nextAnomaly = anomalyQueue[0];
      setAnomalyQueue(prev => prev.slice(1));
      setActiveAnomaly(nextAnomaly);

      displayTimerRef.current = setTimeout(() => {
        setActiveAnomaly(null);
      }, 5000);
    }
    return () => {
      // Do not clear timeout on normal re-renders, only on unmount
    };
  }, [anomalyQueue, activeAnomaly]);

  // Auto-activate when dataset switches
  useEffect(() => {
    if (isWind) autoActivateIframe(windIframeRef);
  }, [isWind, autoActivateIframe]);

  useEffect(() => {
    if (isSolar) autoActivateIframe(solarIframeRef);
  }, [isSolar, autoActivateIframe]);

  if (!isWind && !isSolar) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        background: (isWind || isSolar) ? "transparent" : "radial-gradient(ellipse at 42% 72%, transparent 28%, rgba(244,237,216,0.55) 68%, rgba(244,237,216,0.95) 100%)",
      }}
    >
      {isWind && (
        // overflow:hidden clips the top-right corner where the watermark lives — same layout as solar
        <div style={{
          position: "absolute", top: 190, bottom: 30, left: 420, right: 420,
          pointerEvents: "auto",
          borderRadius: 12, overflow: "hidden",
          border: "1px solid rgba(212,168,83,0.3)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
          background: "rgba(10,9,7,0.4)",
        }}>
          <iframe
            ref={windIframeRef}
            src="https://3d.energyencyclopedia.com/wind_turbine?mode=iframe&autoplay=1"
            frameBorder="0"
            allowFullScreen
            onLoad={() => autoActivateIframe(windIframeRef)}
            style={{
              // Symmetric overflow — clips watermark (top-right) and play button (bottom-left)
              // without pushing the model off-center
              width: "calc(100% + 520px)",
              height: "calc(100% + 120px)",
              border: "none",
              marginLeft: "-260px",  // clip equal amount from both left and right
              marginRight: "-260px",
              marginTop: "-60px",    // clip equal amount top and bottom
              display: "block",
            }}
          />
        </div>
      )}

      {isSolar && (
        // overflow:hidden clips the top-right corner where the watermark lives
        <div style={{
          position: "absolute", top: 190, bottom: 30, left: 420, right: 420,
          pointerEvents: "auto",
          borderRadius: 12, overflow: "hidden",
          border: "1px solid rgba(212,168,83,0.3)",
          boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
          background: "rgba(10,9,7,0.4)",
        }}>
          <iframe
            ref={solarIframeRef}
            src="https://3d.energyencyclopedia.com/solar_photovoltaic?mode=iframe&autoplay=1"
            frameBorder="0"
            allowFullScreen
            onLoad={() => autoActivateIframe(solarIframeRef)}
            style={{
              // Symmetric overflow — clips watermark (top-right) and play button (bottom-left)
              // without pushing the model off-center
              width: "calc(100% + 520px)",
              height: "calc(100% + 120px)",
              border: "none",
              marginLeft: "-260px",  // clip equal amount from both left and right
              marginRight: "-260px",
              marginTop: "-60px",    // clip equal amount top and bottom
              display: "block",
            }}
          />
        </div>
      )}
    </div>
  );
}
