import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDevice } from '@/contexts/DeviceContext';
import { wellueSDK, O2RingData } from '@/lib/wellue-sdk-bridge';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, 
  Heart, 
  Battery, 
  Activity, 
  ShieldAlert, 
  CheckCircle2, 
  Play, 
  Square, 
  Save, 
  RefreshCw, 
  Clock, 
  Sparkles, 
  TrendingUp,
  AlertTriangle,
  Bluetooth,
  BluetoothOff,
  Percent,
  Timer,
  CheckCircle,
  FileHeart
} from 'lucide-react';

const O2RingMonitor: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { connectedDevice, bluetoothEnabled } = useDevice();

  // O2 Ring live stats
  const [liveStats, setLiveStats] = useState<O2RingData | null>(null);
  const [isMeasuring, setIsMeasuring] = useState<boolean>(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Recording State
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'completed'>('idle');
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [recordedData, setRecordedData] = useState<{ spo2: number[]; hr: number[]; pi: number[] }>({
    spo2: [],
    hr: [],
    pi: []
  });

  // Modal / Saving state
  const [showSummary, setShowSummary] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Ref for callbacks to avoid stale state in listener
  const recordingStateRef = useRef(recordingState);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  // Watchdog: tracks whether we have received at least one RT packet since mount
  const hasReceivedDataRef = useRef(false);
  const watchdogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 5;

  useEffect(() => {
    recordingStateRef.current = recordingState;
  }, [recordingState]);

  // Set up SDK callbacks on mount
  useEffect(() => {
    if (!connectedDevice) return;

    console.log('📡 [O2RING MONITOR] Setting up oximeter callbacks...');
    hasReceivedDataRef.current = false;
    retryCountRef.current = 0;
    const prevCallbacks = wellueSDK.getCallbacks();

    wellueSDK.setCallbacks({
      ...prevCallbacks,
      onO2RingUpdate: (data: O2RingData) => {
        console.log('📡 [O2RING MONITOR] Live data packet received:', data);
        hasReceivedDataRef.current = true;
        // Clear watchdog once data starts flowing
        if (watchdogTimerRef.current) {
          clearTimeout(watchdogTimerRef.current);
          watchdogTimerRef.current = null;
        }
        setLiveStats(data);
        setIsMeasuring(true);
        setLastUpdate(new Date());

        // Accumulate data if actively recording.
        // state===0 means finger ON and measurement active in Viatom/Wellue SDK.
        if (recordingStateRef.current === 'recording' && data.state === 0) {
          setRecordedData(prev => ({
            spo2: [...prev.spo2, data.spo2],
            hr: [...prev.hr, data.heartRate],
            pi: [...prev.pi, data.pi]
          }));
        }
      },
      onDeviceDisconnected: (deviceId: string) => {
        console.log('🔌 [O2RING MONITOR] Device disconnected:', deviceId);
        if (prevCallbacks.onDeviceDisconnected) {
          prevCallbacks.onDeviceDisconnected(deviceId);
        }
        // Clear watchdog on disconnect
        if (watchdogTimerRef.current) {
          clearTimeout(watchdogTimerRef.current);
          watchdogTimerRef.current = null;
        }
        setIsMeasuring(false);
        setRecordingState('idle');
        toast({
          title: 'Device Disconnected',
          description: 'The connection to the O2 Ring was lost.',
          variant: 'destructive'
        });
      }
    });

    // Helper: start RT task and schedule watchdog retry if no data arrives
    const startRtWithWatchdog = () => {
      console.log(`📡 [O2RING MONITOR] Starting RT task (attempt ${retryCountRef.current + 1}/${MAX_RETRIES + 1})...`);
      wellueSDK.startRtTaskForConnectedDevice().catch(err => {
        console.error('❌ [O2RING MONITOR] Failed to start RT task:', err);
      });

      // Schedule a watchdog: if no data arrives within 5 seconds, retry
      if (watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = setTimeout(() => {
        if (!hasReceivedDataRef.current && retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1;
          console.warn(`⚠️ [O2RING WATCHDOG] No data received yet, retrying RT task (${retryCountRef.current}/${MAX_RETRIES})...`);
          startRtWithWatchdog();
        } else if (!hasReceivedDataRef.current) {
          console.error('❌ [O2RING WATCHDOG] Max retries reached. Device may not be streaming.');
        }
      }, 5000);
    };

    // Kick off the RT task immediately
    startRtWithWatchdog();

    return () => {
      console.log('📡 [O2RING MONITOR] Cleaning up O2Ring monitor callbacks...');
      // Clear watchdog
      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
      // Restore previous callbacks (but do NOT stop the native polling timer —
      // the device remains connected and the timer should keep running)
      wellueSDK.setCallbacks(prevCallbacks);
    };
  }, [connectedDevice]);

  // Recording Timer
  useEffect(() => {
    if (recordingState === 'recording') {
      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [recordingState]);

  // Action: Start Recording
  const startRecording = () => {
    if (liveStats?.state !== 0) {
      toast({
        title: 'Sensor Empty',
        description: 'Please insert your finger into the O2 Ring to begin recording.',
        variant: 'destructive'
      });
      return;
    }

    setRecordedData({ spo2: [], hr: [], pi: [] });
    setRecordingSeconds(0);
    setRecordingState('recording');
    toast({
      title: 'Recording Started',
      description: 'Now capturing oxygen saturation and heart rate.',
    });
  };

  // Action: Stop Recording
  const stopRecording = () => {
    if (recordingSeconds < 5) {
      toast({
        title: 'Session Too Short',
        description: 'Please record for at least 5 seconds to gather sufficient data.',
        variant: 'destructive'
      });
      setRecordingState('idle');
      setRecordingSeconds(0);
      return;
    }

    setRecordingState('completed');
    setShowSummary(true);
  };

  // Discard Session
  const discardSession = () => {
    setRecordingState('idle');
    setRecordingSeconds(0);
    setRecordedData({ spo2: [], hr: [], pi: [] });
    setShowSummary(false);
    toast({
      title: 'Session Discarded',
      description: 'The recording data was discarded.'
    });
  };

  // Calculate Averages and Aggregates
  const getSessionStats = () => {
    const { spo2, hr, pi } = recordedData;
    if (spo2.length === 0) return { avgSpo2: 0, avgHr: 0, avgPi: 0, minSpo2: 0, maxHr: 0 };

    const avgSpo2 = Math.round(spo2.reduce((a, b) => a + b, 0) / spo2.length);
    const avgHr = Math.round(hr.reduce((a, b) => a + b, 0) / hr.length);
    const avgPi = Number((pi.reduce((a, b) => a + b, 0) / pi.length).toFixed(1));
    const minSpo2 = Math.min(...spo2);
    const maxHr = Math.max(...hr);

    return { avgSpo2, avgHr, avgPi, minSpo2, maxHr };
  };

  // Save Session to Supabase
  const saveSession = async () => {
    setSaving(true);
    const stats = getSessionStats();
    
    try {
      const { db } = await import('@/lib/supabase');
      
      const vitalSignsData = {
        device_type: 'OXIMETER',
        measurement_type: 'oxygen_saturation',
        data: {
          oxygenSaturation: stats.avgSpo2,
          pulseRate: stats.avgHr,
          pi: stats.avgPi,
          minSpo2: stats.minSpo2,
          maxHr: stats.maxHr,
          durationSeconds: recordingSeconds,
          status: 'completed',
          deviceName: connectedDevice?.name || 'O2 Ring',
          source: 'device'
        },
        device_id: connectedDevice?.id || 'unknown',
        reading_timestamp: new Date().toISOString()
      };

      const { error } = await db.insertVitalSigns(vitalSignsData);
      
      if (error) {
        throw error;
      }

      setSaveSuccess(true);
      toast({
        title: 'Session Saved',
        description: 'Your measurement was saved to Supabase successfully.',
      });
    } catch (err: any) {
      console.error('❌ Failed to save oximeter reading:', err);
      toast({
        title: 'Save Failed',
        description: err.message || 'Could not save data. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  // Helper for rendering elapsed timer (MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Battery Level Helper
  const getBatteryIconColor = (pct: number) => {
    if (pct > 50) return 'text-green-400';
    if (pct > 20) return 'text-yellow-400';
    return 'text-red-500 animate-pulse';
  };

  const isOximeter = connectedDevice && (
    connectedDevice.name?.toLowerCase().includes('o2') ||
    connectedDevice.name?.toLowerCase().includes('ring') ||
    connectedDevice.name?.toLowerCase().includes('oxy') ||
    connectedDevice.model === 'O2Ring'
  );

  // If no device is connected or it's a different device model, prompt user to go to scanner
  if (!connectedDevice || !isOximeter) {
    return (
      <div className="min-h-screen bg-[#080D1A] text-white font-inter select-none flex flex-col justify-between p-4 pt-safe-top pb-safe-bottom">
        <div className="space-y-6">
          <header className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors active:scale-95 text-white"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl font-bold">O2 Ring Monitor</h1>
              <p className="text-xs text-gray-400 font-semibold">Lepu Pulse Oximeter</p>
            </div>
          </header>

          <Card className="bg-[#1A243D] border border-slate-700/40 shadow-xl rounded-3xl p-6 text-center">
            <div className="flex flex-col items-center justify-center space-y-6 py-6">
              <div className="h-16 w-16 bg-rose-500/10 rounded-2xl flex items-center justify-center border border-rose-500/30">
                <BluetoothOff className="h-8 w-8 text-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">
                  {!connectedDevice ? "No Device Connected" : "Incorrect Device Connected"}
                </h3>
                <p className="text-sm text-gray-400 max-w-xs mx-auto leading-relaxed">
                  {!connectedDevice 
                    ? "To view real-time oxygen saturation levels, please connect your O2 Ring in the device scanner."
                    : `Currently connected to a BP & ECG Device (${connectedDevice.name}). Please disconnect and connect an O2 Ring to monitor oxygen level.`}
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/wellue-scanner')}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg active:scale-95 mt-4"
            >
              Scan & Connect Device
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  // Calculate live stats
  const activeSpo2 = liveStats?.spo2 || 0;
  const activeHR = liveStats?.heartRate || 0;
  const activePI = liveStats?.pi || 0;
  const isFingerOn = liveStats?.state === 0;
  const batteryPct = liveStats?.batteryPercent ?? connectedDevice.battery ?? 0;

  // Custom keyframe styles for pulsing elements based on BPM
  const hrPulseDuration = activeHR > 0 ? `${60 / activeHR}s` : '1s';

  return (
    <div className="min-h-screen bg-[#080D1A] text-white font-inter select-none flex flex-col justify-between p-4 pt-safe-top pb-safe-bottom relative overflow-hidden">
      {/* Dynamic BPM Pulse style injector */}
      <style>{`
        @keyframes hr-heart-pulse {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.22); }
          40% { transform: scale(1.05); }
          55% { transform: scale(1.2); }
        }
        .animate-hr-pulse {
          animation: hr-heart-pulse ${hrPulseDuration} infinite ease-in-out;
        }
      `}</style>

      {/* Main Panel Content */}
      <div className="space-y-5 flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (recordingState === 'recording') {
                  toast({
                    title: 'Recording Active',
                    description: 'Please stop the recording before exiting.',
                    variant: 'destructive'
                  });
                  return;
                }
                navigate(-1);
              }}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors active:scale-95 text-white"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl font-bold">O2 Ring Monitor</h1>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{connectedDevice.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-[#1A243D] border border-slate-700/40 rounded-xl px-2.5 py-1 flex items-center gap-1.5">
              <Battery className={`h-4 w-4 ${getBatteryIconColor(batteryPct)}`} />
              <span className="text-xs font-bold text-slate-200">{batteryPct}%</span>
            </Badge>
          </div>
        </header>

        {/* Real-time Status banner */}
        {!isMeasuring ? (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-3 flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 text-yellow-400 animate-spin" />
            <span className="text-xs text-yellow-300 font-semibold">Connecting & establishing stream...</span>
          </div>
        ) : !isFingerOn ? (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 flex items-start gap-3 animate-pulse">
            <ShieldAlert className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-white">Finger Out</h4>
              <p className="text-xs text-gray-300 leading-normal mt-0.5">
                Insert your finger into the O2 Ring to display parameters.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-2.5 flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
            <span className="text-xs text-green-300 font-bold uppercase tracking-wider">Live stream active</span>
          </div>
        )}

        {/* Primary SpO2 Meter - Glassmorphic Circle Gauge */}
        {isFingerOn && (
          <div className="flex-1 flex flex-col justify-center items-center py-4">
            <div className="relative w-60 h-60 flex items-center justify-center">
              {/* Radial gradient background shadow */}
              <div className="absolute inset-4 rounded-full bg-rose-500/5 blur-xl" />
              
              {/* Radial progress ring SVG */}
              <svg className="w-full h-full transform -rotate-90">
                {/* Track circle */}
                <circle
                  cx="120"
                  cy="120"
                  r="92"
                  className="stroke-slate-800/80 fill-transparent"
                  strokeWidth="10"
                />
                {/* Progress bar circle */}
                <circle
                  cx="120"
                  cy="120"
                  r="92"
                  className="stroke-rose-500 fill-transparent transition-all duration-700 ease-out"
                  strokeWidth="10"
                  strokeDasharray={2 * Math.PI * 92}
                  strokeDashoffset={2 * Math.PI * 92 * (1 - activeSpo2 / 100)}
                  strokeLinecap="round"
                />
              </svg>
              
              {/* Inner metric display */}
              <div className="absolute flex flex-col items-center justify-center text-center">
                <div className="text-5xl font-black text-white tracking-tight flex items-baseline justify-center">
                  {activeSpo2}
                  <span className="text-2xl font-bold text-rose-400 ml-0.5">%</span>
                </div>
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-2.5">
                  Oxygen Level
                </div>
                <div className="text-[9px] font-semibold text-rose-300 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 mt-2">
                  SpO2 Saturation
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Metrics Grid (PR + PI) */}
        {isFingerOn && (
          <div className="grid grid-cols-2 gap-3.5">
            {/* Heart Rate / Pulse */}
            <Card className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-5 relative overflow-hidden">
              <div className="absolute top-4 right-4">
                <Heart className={`h-6 w-6 text-rose-500 ${activeHR > 0 ? 'animate-hr-pulse' : ''}`} />
              </div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">Pulse Rate</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">{activeHR || '--'}</span>
                <span className="text-xs font-bold text-gray-400">BPM</span>
              </div>
            </Card>

            {/* Perfusion Index */}
            <Card className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-5 relative overflow-hidden">
              <div className="absolute top-4 right-4">
                <TrendingUp className="h-5 w-5 text-blue-400" />
              </div>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">Perfusion Index</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">{activePI > 0 ? activePI.toFixed(1) : '--'}</span>
                <span className="text-xs font-bold text-gray-400">%</span>
              </div>
            </Card>
          </div>
        )}

        {/* Placeholder graphic if finger is off */}
        {isMeasuring && !isFingerOn && (
          <div className="flex-1 flex flex-col justify-center items-center py-6 text-center space-y-6">
            <div className="h-32 w-32 bg-[#1A243D]/50 border border-slate-700/30 rounded-full flex items-center justify-center relative">
              <div className="absolute inset-0 rounded-full border border-orange-500/20 animate-ping" />
              <Activity className="h-12 w-12 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-200">Waiting for sensor input</p>
              <p className="text-xs text-gray-400 max-w-xs mx-auto mt-1 leading-relaxed">
                Connect the ring to your finger. The sensor will automatically calibrate and display readings.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Recording Session Controller */}
      {isMeasuring && isFingerOn && (
        <div className="mt-5 space-y-4">
          {recordingState === 'idle' ? (
            <Button
              onClick={startRecording}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-950/20 active:scale-95 flex items-center justify-center gap-2"
            >
              <Play className="h-4 w-4 fill-white" />
              Start Recording Session
            </Button>
          ) : recordingState === 'recording' ? (
            <Card className="bg-[#1A243D] border border-rose-500/30 shadow-md rounded-3xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-rose-400">Recording live...</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300 font-mono text-sm bg-black/30 px-3 py-1 rounded-xl border border-slate-800">
                  <Timer className="h-4 w-4 text-rose-400" />
                  {formatTime(recordingSeconds)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 py-1 bg-[#121B32] border border-slate-700/40 rounded-xl px-3.5">
                <div>Sample count: {recordedData.spo2.length}</div>
                <div className="text-right">
                  Avg SpO2: {recordedData.spo2.length > 0 ? Math.round(recordedData.spo2.reduce((a,b)=>a+b, 0)/recordedData.spo2.length) : '--'}%
                </div>
              </div>

              <Button
                onClick={stopRecording}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
              >
                <Square className="h-4 w-4 fill-white" />
                Stop & Save Session
              </Button>
            </Card>
          ) : null}
        </div>
      )}

      {/* Session Summary Modal overlay */}
      {showSummary && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <Card className="bg-[#1A243D] border border-slate-700/40 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl p-6 space-y-5">
            {!saveSuccess ? (
              <>
                <div className="text-center space-y-1">
                  <FileHeart className="h-10 w-10 text-rose-400 mx-auto mb-2" />
                  <h3 className="text-lg font-black text-white">Measurement Complete</h3>
                  <p className="text-xs text-gray-400">Summary of recorded pulse oximeter vitals</p>
                </div>

                <div className="bg-[#121B32] border border-slate-700/40 rounded-2xl p-4.5 space-y-3.5">
                  <div className="flex justify-between items-center text-sm border-b border-slate-800 pb-2">
                    <span className="text-gray-400">Duration</span>
                    <span className="font-bold text-white">{formatTime(recordingSeconds)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-slate-800 pb-2">
                    <span className="text-gray-400">Average SpO2</span>
                    <span className="font-extrabold text-rose-400 text-base">{getSessionStats().avgSpo2}%</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-slate-800 pb-2">
                    <span className="text-gray-400">Min SpO2</span>
                    <span className="font-bold text-white">{getSessionStats().minSpo2}%</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-slate-800 pb-2">
                    <span className="text-gray-400">Average Pulse Rate</span>
                    <span className="font-extrabold text-white text-base">{getSessionStats().avgHr} BPM</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-slate-800 pb-2">
                    <span className="text-gray-400">Max Pulse Rate</span>
                    <span className="font-bold text-white">{getSessionStats().maxHr} BPM</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Average PI</span>
                    <span className="font-bold text-white">{getSessionStats().avgPi}%</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={discardSession}
                    disabled={saving}
                    variant="outline"
                    className="flex-1 border-slate-700 text-slate-300 hover:bg-white/5 py-4 rounded-xl text-xs font-bold"
                  >
                    Discard
                  </Button>
                  <Button
                    onClick={saveSession}
                    disabled={saving}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl text-xs shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    {saving ? (
                      <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Confirm & Save
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-6 space-y-6">
                <div className="h-16 w-16 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/30 mx-auto animate-bounce">
                  <CheckCircle className="h-8 w-8 text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Vitals Saved!</h3>
                  <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed mt-1">
                    Your oxygen levels and heart rate summary have been successfully transmitted.
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setShowSummary(false);
                    setSaveSuccess(false);
                    setRecordingState('idle');
                    setRecordingSeconds(0);
                    navigate(-1);
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl active:scale-95 shadow-md"
                >
                  Done
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default O2RingMonitor;
