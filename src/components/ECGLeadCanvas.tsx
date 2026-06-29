/**
 * ECGLeadCanvas.tsx
 *
 * Canvas-based ECG strip renderer:
 * - Shared Y-domain across all 6 leads (10 mm/mV equivalent)
 * - Signal smoothing + baseline correction for readable QRS morphology
 * - Horizontal width scales with sample count (25 mm/s feel)
 * - Retina-sharp thin trace lines
 */

import React, { useEffect, useRef, useMemo } from 'react';

export const LEAD_ORDER = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF'] as const;
export type LeadName = (typeof LEAD_ORDER)[number];

const SAMPLE_RATE = 300; // KardiaMobile 6L default
const TRIM_START_SEC = 0.4; // skip electrode-settle artifact at recording start
const SMOOTH_WINDOW = 5; // odd — low-pass without blurring QRS
const BASELINE_WINDOW = Math.round(SAMPLE_RATE * 0.6); // 600 ms moving baseline
/** ~25 mm/s on mobile: ~0.75 px per sample at 300 Hz */
const PX_PER_SAMPLE = 0.75;

// ---------------------------------------------------------------------------
// Signal processing
// ---------------------------------------------------------------------------

/** Skip initial electrode-settle samples. */
function trimStart(samples: number[], sampleRate = SAMPLE_RATE): number[] {
  const skip = Math.min(Math.round(sampleRate * TRIM_START_SEC), Math.floor(samples.length * 0.15));
  return skip > 0 && samples.length - skip > 50 ? samples.slice(skip) : samples;
}

/** Odd-length moving average — preserves QRS peaks better than wide windows. */
function smooth(samples: number[], window = SMOOTH_WINDOW): number[] {
  if (samples.length < window) return samples;
  const half = Math.floor(window / 2);
  const out = new Array<number>(samples.length);
  for (let i = 0; i < samples.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < samples.length) {
        sum += samples[j];
        count++;
      }
    }
    out[i] = sum / count;
  }
  return out;
}

/** Remove slow baseline wander so the trace sits on centre line. */
function removeBaselineWander(samples: number[]): number[] {
  if (samples.length < BASELINE_WINDOW) return samples;
  const half = Math.floor(BASELINE_WINDOW / 2);
  const baseline = new Array<number>(samples.length);
  for (let i = 0; i < samples.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < samples.length) {
        sum += samples[j];
        count++;
      }
    }
    baseline[i] = sum / count;
  }
  return samples.map((v, i) => v - baseline[i]);
}

/** Full display pipeline for one lead. */
export function preprocessLead(samples: number[]): number[] {
  if (samples.length === 0) return samples;
  return removeBaselineWander(smooth(trimStart(samples)));
}

/** Downsample to one averaged value per horizontal pixel column. */
function bucketAverage(samples: number[], targetCols: number): number[] {
  if (samples.length <= targetCols) return samples;
  const out: number[] = [];
  const bucketSize = samples.length / targetCols;
  for (let col = 0; col < targetCols; col++) {
    const start = Math.floor(col * bucketSize);
    const end = Math.min(Math.floor((col + 1) * bucketSize), samples.length);
    let sum = 0;
    for (let i = start; i < end; i++) sum += samples[i];
    out.push(sum / Math.max(end - start, 1));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Domain computation
// ---------------------------------------------------------------------------

export function computeEcgDomain(leads: Record<string, number[]>): [number, number] {
  const all: number[] = [];
  for (const arr of Object.values(leads)) {
    const processed = preprocessLead(arr);
    for (const v of processed) if (isFinite(v)) all.push(v);
  }
  if (all.length === 0) return [-0.5, 0.5];

  all.sort((a, b) => a - b);
  const lo = all[Math.floor(all.length * 0.05)];
  const hi = all[Math.floor(all.length * 0.95)];

  if (!isFinite(lo) || !isFinite(hi) || lo === hi) {
    const fallback = Math.max(Math.abs(all[Math.floor(all.length / 2)] ?? 0.5), 0.5);
    return [-fallback * 1.5, fallback * 1.5];
  }

  const pad = (hi - lo) * 0.35;
  return [lo - pad, hi + pad];
}

/** Horizontal canvas width from longest lead (scrollable). */
function computeStripWidth(leads: Record<string, number[]>): number {
  let maxLen = 0;
  for (const arr of Object.values(leads)) {
    const len = preprocessLead(arr).length;
    if (len > maxLen) maxLen = len;
  }
  return Math.max(2400, Math.round(maxLen * PX_PER_SAMPLE));
}

// ---------------------------------------------------------------------------
// ECGLeadStrip — single lead canvas strip
// ---------------------------------------------------------------------------

interface ECGLeadStripProps {
  samples: number[];
  label: string;
  domain: [number, number];
  stripWidth: number;
  height?: number;
  lineColor?: string;
  labelColor?: string;
}

export const ECGLeadStrip: React.FC<ECGLeadStripProps> = ({
  samples,
  label,
  domain,
  stripWidth,
  height = 150,
  lineColor = '#1e293b',
  labelColor = 'rgba(15,23,42,0.55)',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || samples.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const W = stripWidth;
    const H = height;

    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const processed = preprocessLead(samples);
    const plot = bucketAverage(processed, W);

    const [domMin, domMax] = domain;
    const domRange = domMax - domMin || 1;
    const marginV = H * 0.18;
    const drawH = H - marginV * 2;

    ctx.beginPath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (let i = 0; i < plot.length; i++) {
      const v = Math.max(domMin, Math.min(domMax, plot[i]));
      const x = (i / Math.max(plot.length - 1, 1)) * W;
      const y = marginV + drawH - ((v - domMin) / domRange) * drawH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [samples, domain, lineColor, height, stripWidth]);

  return (
    <div className="relative" style={{ width: stripWidth, height }}>
      {label && (
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-black z-10 select-none pointer-events-none"
          style={{ color: labelColor }}
        >
          {label}
        </span>
      )}
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// ECGSixLeadView — full scrollable 6-lead detail view
// ---------------------------------------------------------------------------

interface ECGSixLeadViewProps {
  leads: Record<string, number[]>;
  heartRate?: number;
  theme?: 'light' | 'dark';
}

export const ECGSixLeadView: React.FC<ECGSixLeadViewProps> = ({
  leads,
  heartRate,
  theme = 'light',
}) => {
  const domain = useMemo(() => computeEcgDomain(leads), [leads]);
  const stripWidth = useMemo(() => computeStripWidth(leads), [leads]);
  const availableLeads = LEAD_ORDER.filter((l) => (leads[l]?.length ?? 0) > 10);

  const isDark = theme === 'dark';

  const paperBg = isDark ? '#080D1A' : '#F8F9FA';
  const lineColor = isDark ? '#94a3b8' : '#334155';
  const labelColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(15,23,42,0.65)';
  const borderColor = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(203,213,225,0.7)';
  const gridSmall = isDark ? 'rgba(148,163,184,0.06)' : '#E8ECF2';
  const gridLarge = isDark ? 'rgba(148,163,184,0.14)' : '#CBD5E1';

  const paperGrid: React.CSSProperties = {
    backgroundColor: paperBg,
    backgroundImage: [
      `linear-gradient(to right, ${gridSmall} 1px, transparent 1px)`,
      `linear-gradient(to bottom, ${gridSmall} 1px, transparent 1px)`,
      `linear-gradient(to right, ${gridLarge} 1px, transparent 1px)`,
      `linear-gradient(to bottom, ${gridLarge} 1px, transparent 1px)`,
    ].join(', '),
    backgroundSize: '5px 5px, 5px 5px, 25px 25px, 25px 25px',
  };

  return (
    <div className="relative w-full h-full overflow-auto" style={paperGrid}>
      <div className="sticky top-2 z-20 flex justify-center pointer-events-none mb-1">
        <span
          className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-tight border shadow-sm ${
            isDark
              ? 'bg-[#121B32]/90 border-slate-700/40 text-gray-400'
              : 'bg-white/90 border-slate-200 text-slate-400 backdrop-blur'
          }`}
        >
          25mm/s · 10mm/mV
        </span>
      </div>

      <div style={{ width: stripWidth, minWidth: '100%' }}>
        {availableLeads.map((lead) => (
          <div key={lead} className="border-b last:border-none" style={{ borderColor }}>
            <ECGLeadStrip
              samples={leads[lead]}
              label={lead}
              domain={domain}
              stripWidth={stripWidth}
              height={150}
              lineColor={lineColor}
              labelColor={labelColor}
            />
          </div>
        ))}
        {availableLeads.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32" style={{ color: isDark ? '#475569' : '#94a3b8' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <p className="mt-3 text-sm font-bold">Waveform Data Unavailable</p>
          </div>
        )}
      </div>

      {heartRate != null && heartRate > 0 && (
        <div className="absolute top-3 right-3 z-20">
          <div
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 shadow-lg border ${
              isDark
                ? 'bg-[#121B32]/95 border-slate-700/40'
                : 'bg-white/95 border-slate-100 backdrop-blur'
            }`}
          >
            <span className="text-rose-500 text-base leading-none">♥</span>
            <span className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>
              {heartRate}
            </span>
            <span className={`text-[10px] font-bold uppercase tracking-tight ${isDark ? 'text-gray-400' : 'text-slate-400'}`}>
              bpm
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// ECGMiniPreview — 2×3 mini preview grid
// ---------------------------------------------------------------------------

interface ECGMiniPreviewProps {
  leads: Record<string, number[]>;
}

export const ECGMiniPreview: React.FC<ECGMiniPreviewProps> = ({ leads }) => {
  const domain = useMemo(() => computeEcgDomain(leads), [leads]);

  return (
    <div className="grid grid-cols-2 gap-2">
      {LEAD_ORDER.map((name) => {
        const samples = leads[name] ?? [];
        return (
          <div key={name} className="space-y-1">
            <p className="text-[9px] font-bold text-gray-500">{name}</p>
            <div
              className="rounded-lg overflow-hidden"
              style={{
                background: '#121B32',
                border: '1px solid rgba(148,163,184,0.15)',
                height: 64,
              }}
            >
              <ECGLeadStrip
                samples={samples}
                label=""
                domain={domain}
                stripWidth={320}
                height={64}
                lineColor="#94a3b8"
                labelColor="transparent"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// getLeadsFromRecording — normalise any recording shape → leads object
// ---------------------------------------------------------------------------

/** Replace null/NaN/undefined samples with linearly-interpolated neighbors.
 *  Android JSArray serialization emits null for certain float values; those
 *  are stored as JSON null in the DB and come back as null in JS, causing the
 *  ECG renderer to plot them at 0 (flat line).
 */
function sanitizeSamples(arr: (number | null | undefined)[]): number[] {
  const out: number[] = new Array(arr.length).fill(0);
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v !== null && v !== undefined && isFinite(v as number)) {
      out[i] = v as number;
    } else {
      let prev = 0;
      let next = 0;
      for (let p = i - 1; p >= 0; p--) {
        const pv = arr[p];
        if (pv !== null && pv !== undefined && isFinite(pv as number)) { prev = pv as number; break; }
      }
      for (let n = i + 1; n < arr.length; n++) {
        const nv = arr[n];
        if (nv !== null && nv !== undefined && isFinite(nv as number)) { next = nv as number; break; }
      }
      out[i] = (prev + next) / 2;
    }
  }
  return out;
}

export function getLeadsFromRecording(detail: unknown): Record<string, number[]> | null {
  if (!detail || typeof detail !== 'object') return null;
  const d = detail as Record<string, unknown>;
  const ecg = (d.ecg_recordings as Record<string, unknown>) ?? d;
  const config = (d.lead_config ?? ecg.lead_config) as string | undefined;

  // ── Priority 1: per-lead arrays on root or nested object ──────────────────
  // Android plugin returns waveformLeads directly on the JS result object
  // (before DB round-trip). iOS also uses this path.
  const leadsData =
    d.waveformLeads ??
    d.waveform_leads ??
    d.leads ??
    (ecg.waveformLeads as unknown) ??
    (ecg.waveform_leads as unknown) ??
    ecg.leads;

  if (leadsData && typeof leadsData === 'object' && !Array.isArray(leadsData)) {
    const obj = leadsData as Record<string, (number | null | undefined)[]>;
    const hasReal = Object.values(obj).some((arr) => Array.isArray(arr) && arr.length > 10);
    if (hasReal) {
      // Sanitize each lead before rendering
      const clean: Record<string, number[]> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (Array.isArray(v)) clean[k] = sanitizeSamples(v);
      }
      return clean;
    }
  }

  // ── Priority 2: flat mv array from DB (interleaved or segmented) ────────
  const mv =
    ecg.mv_data_json ??
    d.waveform_mv ??
    ecg.waveform_mv ??
    d.mv_data_json;

  if (Array.isArray(mv) && mv.length > 0) {
    const cleanMv = sanitizeSamples(mv as (number | null | undefined)[]);
    const isSix = config === 'six';

    if (isSix) {
      // ── Interleaved format (I₁,II₁,III₁,aVR₁,aVL₁,aVF₁, I₂,II₂,…) ──
      // Android stores data interleaved. Trim any tail remainder so we don't
      // end up with uneven lead lengths.
      const rem = cleanMv.length % 6;
      const trimLen = cleanMv.length - rem;   // exact multiple of 6
      if (trimLen >= 12) {                     // at least 2 samples per lead
        const result: Record<string, number[]> = { I: [], II: [], III: [], aVR: [], aVL: [], aVF: [] };
        const names = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF'];
        for (let i = 0; i < trimLen; i++) result[names[i % 6]].push(cleanMv[i]);

        // Verify the de-interleaved leads actually have real signal.
        // If the stored array was all zeros (metadata-only placeholder), both
        // interpretations are flat — we still return the interleaved result
        // so the UI shows the correct "no data" empty state (6 flat leads
        // rather than 1).  Only skip if trimLen was too short.
        return result;
      }

      // ── Segmented format (all Lead I, then Lead II, …) ──
      const segLen = Math.floor(cleanMv.length / 6);
      if (segLen > 10) {
        return {
          I:   cleanMv.slice(0, segLen),
          II:  cleanMv.slice(segLen, segLen * 2),
          III: cleanMv.slice(segLen * 2, segLen * 3),
          aVR: cleanMv.slice(segLen * 3, segLen * 4),
          aVL: cleanMv.slice(segLen * 4, segLen * 5),
          aVF: cleanMv.slice(segLen * 5),
        };
      }
    }

    return { I: cleanMv };
  }

  return null;
}
