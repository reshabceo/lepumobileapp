import React, { useEffect, useRef } from 'react';
import { MobileAppContainer } from '@/components/MobileAppContainer';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export type BPResult = {
  timestamp: string;
  systolic: number;
  diastolic: number;
  heartRate?: number;
  map?: number;
};

function categorize(sbp:number, dbp:number){
  if (sbp >= 180 || dbp >= 120) return {label:'Crisis', color:'#b91c1c'};
  if (sbp >= 140 || dbp >= 90)  return {label:'Stage 2', color:'#ef4444'};
  if (sbp >= 130 || dbp >= 80)  return {label:'Stage 1', color:'#f59e0b'};
  if (sbp >= 120 && dbp < 80)   return {label:'Elevated', color:'#eab308'};
  return {label:'Normal', color:'#22c55e'};
}

const xMin=60, xMax=110;  // DBP
const yMin=100, yMax=190; // SBP

const CategoryPlot: React.FC<{sbp:number; dbp:number;}> = ({sbp, dbp}) => {
  const ref = useRef<HTMLCanvasElement|null>(null);
  useEffect(()=> {
    const c = ref.current; if (!c) return;
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio||1));
    const cssW = c.clientWidth || 320; const cssH = c.clientHeight || 220;
    c.width = cssW * dpr; c.height = cssH * dpr;
    const ctx = c.getContext('2d'); if (!ctx) return; ctx.resetTransform(); ctx.scale(dpr,dpr);
    const W = cssW, H = cssH;

    const padL=48, padR=16, padT=16, padB=32;
    const PL = padL, PT = padT, PW = W-padL-padR, PH = H-padT-padB;
    const rx = (mm:number)=> PL + (mm - xMin)/(xMax-xMin)*PW;
    const ry = (mm:number)=> PT + (1 - (mm - yMin)/(yMax-yMin))*PH;

    ctx.fillStyle = '#0b1220'; ctx.fillRect(0,0,W,H);

    // Zones (draw back to front)
    // Red base
    ctx.fillStyle = '#ef4444'; ctx.fillRect(PL, PT, PW, PH);
    // Orange band: SBP 130–139 or DBP 80–89
    ctx.fillStyle = '#f59e0b';
    // SBP 130-139 full width
    ctx.fillRect(PL, ry(139.999), PW, ry(130)-ry(139.999));
    // DBP 80-89 full height
    ctx.fillRect(rx(80), PT, rx(89.999)-rx(80), PH);
    // Yellow: SBP 120–129 & DBP < 80
    ctx.fillStyle = '#eab308';
    ctx.fillRect(PL, ry(129.999), rx(79.999)-PL, ry(120)-ry(129.999));
    // Green: SBP < 120 & DBP < 80
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(PL, ry(119.999), rx(79.999)-PL, PH - (ry(119.999)-PT));

    // Axes labels
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '12px system-ui';
    ctx.fillText('SYS', 12, PT + 12);
    ctx.fillText('DIA', PL + PW - 20, PT + PH + 22);

    // Point
    const px = Math.max(PL, Math.min(PL+PW, rx(dbp)));
    const py = Math.max(PT, Math.min(PT+PH, ry(sbp))); 
    ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI*2);
    ctx.fillStyle = '#3b82f6'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'white'; ctx.stroke();
  }, [sbp, dbp]);

  return <canvas ref={ref} className="w-full h-56 rounded-md bg-[#0b1220]" />;
};

const BPResultScreen: React.FC = () => {
  const nav = useNavigate();
  const location = useLocation();
  const data: BPResult = (location.state as any)?.data || {
    timestamp: new Date().toISOString(), systolic: 128, diastolic: 82, heartRate: 72
  };
  const sbp = data.systolic, dbp = data.diastolic;
  const pulsePressure = sbp - dbp;
  const map = data.map ?? (dbp + (sbp - dbp)/3);
  const cat = categorize(sbp, dbp);

  return (
    <MobileAppContainer>
      <div className="min-h-screen bg-[#0F0F0F] text-white">
        <div className="bg-[#1E1E1E] p-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <button onClick={()=>nav(-1)} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="h-5 w-5" /> Back
            </button>
            <h1 className="text-xl font-semibold">Blood pressures</h1>
            <div className="w-10"/>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Result Card */}
          <div className="rounded-xl bg-[#0f172a] text-white p-5 border border-[#1f2a44]">
            <div className="text-sm text-gray-400 mb-1">{new Date(data.timestamp).toLocaleString()}</div>
            <div className="text-4xl sm:text-5xl font-bold">{sbp}/{dbp} <span className="text-base font-medium text-gray-300">mmHg</span></div>
            <div className="mt-2 inline-flex items-center gap-2 px-2 py-1 rounded-md" style={{backgroundColor: cat.color + '30'}}>
              <div className="w-2 h-2 rounded-full" style={{backgroundColor: cat.color}} />
              <span className="text-sm">{cat.label}</span>
            </div>
            { (sbp>=180 || dbp>=120) && (
              <div className="mt-3 px-3 py-2 rounded-md text-sm" style={{background:'#7f1d1d', color:'#fecaca'}}>Hypertensive crisis — seek medical advice.</div>
            )}
            <div className="grid grid-cols-3 gap-3 mt-5 text-sm">
              <div className="rounded-lg bg-[#0b1220] p-3 border border-[#1f2a44]"><div className="text-gray-400">Pulse Rate</div><div className="text-white font-semibold">{data.heartRate ?? '—'}<span className="text-xs text-gray-400">/min</span></div></div>
              <div className="rounded-lg bg-[#0b1220] p-3 border border-[#1f2a44]"><div className="text-gray-400">MAP</div><div className="text-white font-semibold">{Math.round(map)}<span className="text-xs text-gray-400"> mmHg</span></div></div>
              <div className="rounded-lg bg-[#0b1220] p-3 border border-[#1f2a44]"><div className="text-gray-400">Pulse pressure</div><div className="text-white font-semibold">{pulsePressure}<span className="text-xs text-gray-400"> mmHg</span></div></div>
            </div>
          </div>

          {/* Category plot */}
          <div className="rounded-xl bg-[#0f172a] p-4 border border-[#1f2a44]">
            <CategoryPlot sbp={sbp} dbp={dbp} />
          </div>

          {/* Notes */}
          <div className="rounded-xl bg-[#0f172a] p-4 border border-[#1f2a44]">
            <label className="block text-sm text-gray-400 mb-2">Add notes</label>
            <textarea className="w-full h-28 rounded-md bg-[#0b1220] border border-[#1f2a44] p-3 text-white placeholder:text-gray-500" placeholder="Add notes" />
          </div>
        </div>
      </div>
    </MobileAppContainer>
  );
};

export default BPResultScreen;

