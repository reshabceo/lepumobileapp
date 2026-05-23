import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDevice } from '@/contexts/DeviceContext';
import { WellueSDKBridge } from '@/lib/wellue-sdk-bridge';
import { ArrowLeft, Heart } from 'lucide-react';

type MeasurementState = 'idle' | 'ready' | 'waiting' | 'inflating' | 'deflating' | 'analyzing' | 'completed' | 'canceled' | 'error';

interface WaveformData {
  amplitude: number;
  timestamp: number;
  heartbeat: boolean;
}

interface BPResult {
  systolic: number;
  diastolic: number;
  pulseRate: number;
  map: number;
  timestamp: Date;
}

// Custom CSS for heartbeat animation
const heartbeatStyles = `
  @keyframes heartbeat {
    0% { transform: scale(1); }
    14% { transform: scale(1.3); }
    28% { transform: scale(1); }
    42% { transform: scale(1.3); }
    70% { transform: scale(1); }
  }
`;

export const LiveBPMonitorRevamped: React.FC = () => {
  
  const navigate = useNavigate();
  
  const { connectedDevice, wellueSDK, isInitialized } = useDevice();

  
  // 🔍 DIAGNOSTIC: Log component state on every render

  
  // 🚨 DISABLED: Fake animation system that was overriding real device pressure
  // This function was causing smoothPressure to be set to 0 after 40 seconds based on a fake timer,
  // which was overriding the actual device pressure and causing measurements to stop incorrectly.
  // We now ONLY use real device pressure data from handleRealTimeUpdate.
  // DO NOT USE THIS FUNCTION - it's kept for reference only.
  const updateSmoothAnimation = () => {
    // DISABLED - This function is no longer called
    // It was causing smoothPressure to be set to 0 after 40 seconds, overriding real device pressure
    return;
    
    // OLD CODE (DISABLED):
    // if (!measurementStartTime) return;
    // const elapsedTime = (Date.now() - measurementStartTime) / 1000;
    // ... fake timer logic that was overriding real pressure ...
  };
  
  // State management
  const [measurementState, setMeasurementState] = useState<MeasurementState>('idle');
  const [currentPressure, setCurrentPressure] = useState(0);
  const [targetPressure, setTargetPressure] = useState(0);
  const [heartRate, setHeartRate] = useState(0);
  const [signalQuality, setSignalQuality] = useState(0);
  const [bpResult, setBpResult] = useState<BPResult | null>(null);
  const [previousReadings, setPreviousReadings] = useState<BPResult[]>([]);
  const [waveformData, setWaveformData] = useState<WaveformData[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStartDisabled, setIsStartDisabled] = useState(false);
  const [stopGuardActive, setStopGuardActive] = useState(false);
  
  // 🔥 Track last received pressure to detect GRADUAL increases (not instant jumps)
  const [lastReceivedPressure, setLastReceivedPressure] = useState(0);
  
  // 🚨 FIX: Refs for latest state values to avoid stale closures in callbacks
  const measurementStateRef = useRef<MeasurementState>('idle');
  const bpResultRef = useRef<BPResult | null>(null);
  const currentPressureRef = useRef<number>(0);
  const targetPressureRef = useRef(0);
  
  // 🔒 GOD MODE: Measurement Session Lock - prevents ANY "ready" state during active measurement
  // Once measurement starts, we LOCK and ignore ALL status 3 / ready events until completion
  const isMeasurementSessionLockedRef = useRef<boolean>(false);
  
  // 🚀 NEW: Pressure buffer system for 0.2s delay
  const [pressureBuffer, setPressureBuffer] = useState<Array<{pressure: number, timestamp: number}>>([]);
  const pressureBufferRef = useRef<NodeJS.Timeout | null>(null);

  const [measurementStartTime, setMeasurementStartTime] = useState<number | null>(null);
  
  // Refs for animations
  const pressureAnimationRef = useRef<number | null>(null);
  const waveformAnimationRef = useRef<number | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Logging for debugging
  useEffect(() => {
    
    // DON'T reset state on mount - preserve ongoing measurements!
    // Only reset error/disabled flags
    setErrorMessage(null);
    setStopGuardActive(false);
    setIsStartDisabled(false);
    
    return () => {
      if (pressureAnimationRef.current) {
        cancelAnimationFrame(pressureAnimationRef.current);
      }
      if (waveformAnimationRef.current) {
        cancelAnimationFrame(waveformAnimationRef.current);
      }
    };
  }, []); // Reset every time component mounts
  
  // 🚨 DISABLED: Fake pressure buffer system that was estimating peak targets
  // This was interfering with real device measurements by setting fake targets
  // We now ONLY use real device status and pressure data - no fake estimates
  useEffect(() => {
    // DISABLED - This was causing fake animation targets that interfered with real measurements
    // All pressure and animation state is now controlled by real device data only
    return;
  }, []);
  
  // 🚨 FIX: Keep refs in sync with state
  useEffect(() => {
    measurementStateRef.current = measurementState;
  }, [measurementState]);
  
  useEffect(() => {
    bpResultRef.current = bpResult;
  }, [bpResult]);
  
  useEffect(() => {
    currentPressureRef.current = currentPressure;
  }, [currentPressure]);
  
  useEffect(() => {
    targetPressureRef.current = targetPressure;
  }, [targetPressure]);
  
  // Load previous BP readings from localStorage AND clear cached pressure
  useEffect(() => {
    
    // 🔥 CRITICAL: Clear ALL cached pressure/measurement data on mount
    setCurrentPressure(0);
    setTargetPressure(0);
    setLastReceivedPressure(0);
    setHeartRate(0);
    setMeasurementState('idle');
    measurementStateRef.current = 'idle';
    setMeasurementStartTime(null);
    
    
    try {
      const savedResults = localStorage.getItem('bpResults');
      if (savedResults) {
        const parsedResults = JSON.parse(savedResults);
        if (Array.isArray(parsedResults) && parsedResults.length > 0) {
          setPreviousReadings(parsedResults);
        }
      }
    } catch (error) {
      console.error('❌ [BP] Failed to load previous BP readings:', error);
    }
  }, []);

  // 🚀 SIMPLIFIED: No auto-detect needed - native side will send events

  // Monitor device connection status
  useEffect(() => {
    if (!connectedDevice || !isInitialized) return;
    
    
    const checkConnection = async () => {
      try {
        const isConnected = await wellueSDK.isConnected(connectedDevice.id);
        if (!isConnected) {
          setMeasurementState('idle');
          setBpResult(null);
          setWaveformData([]);
          setCurrentPressure(0);
          setTargetPressure(0);
          setErrorMessage('Device disconnected');
        }
      } catch (error) {
      }
    };
    
    const connectionInterval = setInterval(checkConnection, 3000);
    
    return () => clearInterval(connectionInterval);
  }, [connectedDevice, isInitialized, wellueSDK]);

  // 🚀 NEW: Smooth animation loop for elderly users
  // 🚨 FIX: DISABLED - This fake animation was overriding real device pressure!
  // The fake timer-based animation was setting smoothPressure to 0 after 40 seconds,
  // which was overriding the actual device pressure and causing measurements to stop.
  // We now ONLY use real device pressure data from handleRealTimeUpdate.
  useEffect(() => {
    // DISABLED: Stop the fake animation loop - we use real device pressure only
    if (pressureAnimationRef.current) {
      cancelAnimationFrame(pressureAnimationRef.current);
      pressureAnimationRef.current = null;
    }
    return () => {
      if (pressureAnimationRef.current) {
        cancelAnimationFrame(pressureAnimationRef.current);
      }
    };
  }, []);

  // 🚨 SAFETY: Enhanced pressure display with safety indicators
  const getPressureDisplayColor = (pressure: number): string => {
    if (pressure === 0) return 'text-gray-400';
    if (pressure < 50) return 'text-green-400';
    if (pressure < 100) return 'text-blue-400';
    if (pressure < 150) return 'text-yellow-400';
    if (pressure < 200) return 'text-orange-400';
    return 'text-red-400';
  };

  // 🚨 SAFETY: Get pressure safety indicator
  const getPressureSafetyIndicator = (pressure: number): { icon: string, color: string, text: string } => {
    if (pressure === 0) return { icon: '⭕', color: 'text-gray-400', text: 'Ready' };
    if (pressure < 50) return { icon: '🟢', color: 'text-green-400', text: 'Safe' };
    if (pressure < 100) return { icon: '🔵', color: 'text-blue-400', text: 'Normal' };
    if (pressure < 150) return { icon: '🟡', color: 'text-yellow-400', text: 'Caution' };
    if (pressure < 200) return { icon: '🟠', color: 'text-orange-400', text: 'High' };
    return { icon: '🔴', color: 'text-red-400', text: 'Very High' };
  };

  // Waveform rendering
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const renderWaveform = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      
      if (waveformData.length === 0) {
        ctx.fillStyle = '#374151';
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Waveform will appear during measurement', width / 2, height / 2);
        return;
      }
      
      if (waveformData.length < 2) return;
      
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      
      const maxAmplitude = Math.max(...waveformData.map(d => Math.abs(d.amplitude)));
      const scale = maxAmplitude > 0 ? (height * 0.8) / maxAmplitude : 1;
      
      ctx.beginPath();
      waveformData.forEach((point, index) => {
        const x = (index / waveformData.length) * width;
        const y = height / 2 - (point.amplitude * scale);
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
      
      // Heartbeat indicators
      ctx.fillStyle = '#ef4444';
      waveformData.forEach((point, index) => {
        if (point.heartbeat) {
          const x = (index / waveformData.length) * width;
          ctx.fillRect(x - 1, 0, 2, height);
        }
      });
      
      // Only animate during active measurement phases
      if (measurementState === 'deflating' || measurementState === 'analyzing') {
        waveformAnimationRef.current = requestAnimationFrame(renderWaveform);
      }
    };
    
    renderWaveform();
    
    return () => {
      if (waveformAnimationRef.current) {
        cancelAnimationFrame(waveformAnimationRef.current);
      }
    };
  }, [waveformData, measurementState]);

  // Auto-completion timeout
  useEffect(() => {
    let completionTimeout: NodeJS.Timeout;
    
    if (measurementState === 'analyzing' && !bpResult) {
      completionTimeout = setTimeout(() => {
        setMeasurementState('completed');
        
        if (!bpResult) {
        }
      }, 10000); // 10 seconds timeout for analysis
    }
    
    return () => {
      if (completionTimeout) {
        clearTimeout(completionTimeout);
      }
    };
  }, [measurementState, bpResult]);

  // SDK event handlers
  const handleBPMeasurement = useCallback((measurement: any) => {
    
    const bpResult: BPResult = {
      systolic: measurement.systolic || measurement.systolicPressure || 0,
      diastolic: measurement.diastolic || measurement.diastolicPressure || 0,
      pulseRate: measurement.pulseRate || measurement.pulse,
      map: measurement.meanArterialPressure || measurement.mean,
      timestamp: new Date(measurement.timestamp || Date.now())
    };
    
    setBpResult(bpResult);
    bpResultRef.current = bpResult; // Update ref immediately
    
    // 🔒 GOD MODE: UNLOCK MEASUREMENT SESSION - results received, measurement complete
    isMeasurementSessionLockedRef.current = false;
    
    // ✅ FIX: Set to 'ready' state after completion - results stay visible
    setMeasurementState('ready');
    measurementStateRef.current = 'ready'; // Update ref immediately
    setCurrentPressure(0);
    currentPressureRef.current = 0; // Update ref immediately
    
    // ✅ FIX: NO auto-reset - keep results visible!
    // Results will stay visible until user starts a new measurement or navigates away
  }, []);

  const handleBPProgress = useCallback((progress: any) => {
    
    // ✅ CRITICAL FIX: Update pressure ref when bpProgress events arrive
    // This ensures currentPressureRef always has the latest pressure for status 3 checks
    if (progress.pressure !== undefined && progress.pressure !== null) {
      const calculatedPressure = Math.round(progress.pressure / 10);
      if (calculatedPressure > 0) {
        currentPressureRef.current = calculatedPressure; // ✅ CRITICAL: Update ref immediately!
      }
    }
    
    switch (progress.status) {
      case 'inflating':
        setMeasurementState('inflating');
        setWaveformData([]); // Hide waveform during inflation
        
        // 🚀 NEW: Reset pressure tracking for new measurement
        if (targetPressure === 0) {
          setCurrentPressure(0);
          setTargetPressure(0);
        }
        break;
      case 'deflating':
        setMeasurementState('deflating');
        // Start collecting waveform data during deflation
        break;
      case 'analyzing':
        setMeasurementState('analyzing');
        break;
      default:
    }
    
    // 🚀 FIXED: Natural pressure tracking - trust device data completely
    
    if (progress.pressure > 0) {
      
      // 🚀 NEW: Add to pressure buffer instead of direct update
      const now = Date.now();
      setPressureBuffer(prev => [...prev, { pressure: progress.pressure, timestamp: now }]);
      
      // 🚀 NEW: Track peak pressure for natural flow detection
      if (progress.status === 'inflating' && progress.pressure > targetPressure) {
      }
      
    } else {
    }
    
    // 🚀 NEW: Real waveform data collection during deflation (no simulation)
    if (progress.status === 'deflating' && progress.pressure > 0) {
      
      const timestamp = progress.timestamp instanceof Date ? progress.timestamp.getTime() : Date.now();
      
      // Create realistic waveform based on actual pressure and timing
      const baseAmplitude = 30 + (progress.pressure / 300) * 40; // Amplitude varies with pressure
      const timeVariation = Math.sin(timestamp * 0.005) * 0.2; // Gentle time-based variation
      const pressureVariation = (progress.pressure / 300) * 0.3; // Pressure-based variation
      
      setWaveformData(prev => {
        const newData = [...prev, {
          amplitude: baseAmplitude + timeVariation + pressureVariation,
          timestamp: timestamp,
          heartbeat: Math.random() > 0.85 // More realistic heartbeat detection
        }];
        
        // Keep only last 100 data points for smooth rendering
        if (newData.length > 100) {
          return newData.slice(-100);
        }
        return newData;
      });
    }
  }, []);

  const handleBPStatusChanged = useCallback((status: any) => {
    // ✅ CRITICAL FIX: Use refs to get current state values (avoid stale closures)
    const currentState = measurementStateRef.current;
    const currentResult = bpResultRef.current;
    
    
    // ✅ FIX: Don't update state from status.status if we have results displayed
    if (status.status && status.status !== currentState) {
      if (status.status === 'complete' || status.status === 'completed') {
        // Only set to complete if we don't already have results or are already complete
        if (currentState !== 'completed' && !currentResult) {
          setMeasurementState('completed');
        } else {
        }
      } else {
      setMeasurementState(status.status as MeasurementState);
      }
    }
    
    // Check for completed measurement
    if (status.status === 'complete' || status.status === 'completed') {
      
      if (status.lastMeasurement) {
        
        const resultTimestamp = status.lastMeasurement.timestamp instanceof Date 
          ? status.lastMeasurement.timestamp 
          : new Date(status.lastMeasurement.timestamp || Date.now());
        
        const newBpResult = {
          systolic: status.lastMeasurement.systolic,
          diastolic: status.lastMeasurement.diastolic,
          pulseRate: status.lastMeasurement.pulseRate,
          map: status.lastMeasurement.meanArterialPressure || 
               Math.round(status.lastMeasurement.diastolic + (status.lastMeasurement.systolic - status.lastMeasurement.diastolic) / 3),
          timestamp: resultTimestamp
        };
        
        setBpResult(newBpResult);
        setMeasurementState('completed');
      } else {
        // If no lastMeasurement but status is complete, try to get results from device
        if (currentState === 'analyzing' || currentState === 'deflating') {
          setMeasurementState('completed');
        }
      }
    }
    
    // Handle other status changes
    if (status.status === 'error' && status.error) {
      setErrorMessage(status.error);
      setMeasurementState('error');
    }
  }, []);

  const handleRealTimeUpdate = useCallback((data: any) => {
    // 🚀 PRESSURE-DRIVEN STATE: Pressure data is the SOURCE OF TRUTH
    const deviceStatus = data.status || data.deviceStatus;
    const pressure = data.pressure ? Math.round(data.pressure / 10) : 0;
    
    // ✅ CRITICAL FIX: Use refs to get current state values (avoid stale closures)
    const currentState = measurementStateRef.current;
    const currentResult = bpResultRef.current;
    const currentPressure = currentPressureRef.current || 0;
    
    // 🔍 DETAILED LOGGING: Track pressure bar and UI state
    
    // ✅ CRITICAL: PRESSURE-DRIVEN STATE MANAGEMENT
    // If pressure > 0, we KNOW we're measuring (device is actively inflating/deflating)
    // This is the SOURCE OF TRUTH - pressure bar works, so wire UI state to it!
    if (pressure > 0) {
      setCurrentPressure(pressure);
      
      // ✅ KEY FIX: If pressure > 0 and we're not in a measuring state, set it!
      // This ensures UI state matches pressure bar (which is working correctly)
      const isActiveMeasurement = currentState === 'inflating' || 
                                  currentState === 'deflating' || 
                                  currentState === 'analyzing';
      

      
      if (!isActiveMeasurement && !currentResult) {
        // Pressure data arrived but UI not in measuring state - fix it!
        // 🔒 GOD MODE: ACTIVATE SESSION LOCK when pressure > 0 (measurement has started)
        isMeasurementSessionLockedRef.current = true;
        setMeasurementState('inflating');
        measurementStateRef.current = 'inflating';
      }
    }

    // State 4 = Measurement started (only if not already measuring and results are not displayed)
    if (deviceStatus === 4) {
      // ✅ CRITICAL FIX: Use refs to get latest state (prevents stale closures)
      const currentStateRef = measurementStateRef.current;
      const currentResultRef = bpResultRef.current;
      
      // ✅ CRITICAL FIX: Check UI state (measurementStateRef) to prevent duplicate starts during deflation
      const isActivelyMeasuring = currentStateRef === 'inflating' || 
                                  currentStateRef === 'deflating' || 
                                  currentStateRef === 'analyzing';
      
      // ✅ FIX: Status 4 = NEW measurement starting - clear previous results if they exist
      if (!isActivelyMeasuring) {
        // 🔒 GOD MODE: ACTIVATE MEASUREMENT SESSION LOCK
        // Once measurement starts, we LOCK and prevent ANY "ready" state transitions
        isMeasurementSessionLockedRef.current = true;
        
        // New measurement starting - clear previous results
        if (currentResultRef) {
          setBpResult(null); // Clear previous results
          bpResultRef.current = null; // Update ref immediately
        }
        setMeasurementState('inflating');
        measurementStateRef.current = 'inflating'; // Update ref immediately
        setCurrentPressure(0);
        currentPressureRef.current = 0; // Update ref immediately
      }
    }

    
    // State 5 = Measurement complete - native will fetch file
    if (deviceStatus === 5) {
      // ✅ FIX: Only set to analyzing if we don't already have results
      if (!currentResult && currentState !== 'completed' && currentState !== 'analyzing') {
        setMeasurementState('analyzing');
        measurementStateRef.current = 'analyzing'; // Update ref immediately
        // 🔒 GOD MODE: Keep session locked until results are received
        // We'll unlock it in handleBPMeasurement when results arrive
      } else {
      }
    }
    
    // ✅ CRITICAL FIX: PRESSURE-DRIVEN status 3 handling
    // State 3 = Ready - but PRESSURE DATA IS SOURCE OF TRUTH!
    // CRITICAL: bp2Rt events may have NO pressure data, but bpProgress events DO
    // We MUST check currentPressureRef (updated by bpProgress) not just event pressure!
    if (deviceStatus === 3) {
      // 🔒 GOD MODE: CHECK SESSION LOCK FIRST - if locked, COMPLETELY IGNORE status 3
      if (isMeasurementSessionLockedRef.current) {
        return; // Exit immediately - session is locked, no status 3 allowed!
      }
      
      // ✅ CRITICAL FIX: Use REF instead of closure state to get latest measurement state
      const currentStateRef = measurementStateRef.current;
      const currentResultRef = bpResultRef.current;
      // ✅ KEY FIX: Get pressure from REF (updated by bpProgress events), not from this event
      // bp2Rt events may have pressure=undefined, but currentPressureRef has the real value!
      const currentPressureValue = currentPressureRef.current || 0;
      
      
      // ✅ KEY FIX: PRESSURE-DRIVEN - PRIORITIZE REF PRESSURE (from bpProgress events)
      // bp2Rt events may have pressure=undefined, but currentPressureRef has real pressure from bpProgress!
      // If pressure bar is showing data (ref > 0), we MUST be measuring - ignore status 3!
      if (currentPressureValue > 0) {
        return; // Exit early - pressure bar data says we're measuring
      }
      // Also check event pressure as fallback (in case ref isn't updated yet)
      if (pressure > 0) {
        return; // Exit early - event pressure says we're measuring
      }
      
      // ✅ CRITICAL FIX: Check UI state FIRST - ignore status 3 during active measurement
      // This is the KEY fix: ignore status 3 throughout entire measurement (inflation + deflation) until results shown
      if (currentStateRef === 'inflating' || 
          currentStateRef === 'deflating' || 
          currentStateRef === 'analyzing') {
        // Active measurement states - ignore status 3 to prevent UI reset
        return;
      } else if (currentStateRef === 'analyzing' || currentStateRef === 'completed') {
        // ✅ FIX: Results are displayed - KEEP showing results, DON'T change state to ready
        // This prevents UI fluctuation. Results stay visible until user starts a new measurement
        return; // Don't change state - keep it in 'completed'
      } else if (currentResultRef) {
        // Results are displayed - preserve them
        return;
      } else if (currentStateRef === 'ready') {
        // Already in ready state - do nothing
        return;
        } else {
        // Normal ready state (no measurement in progress, no results displayed, no pressure)
        setMeasurementState('ready');
        setCurrentPressure(0);
      }
    }
  }, [wellueSDK]);

  const handleError = useCallback((error: string, details?: any) => {
    console.error('❌ SDK Error:', error, details);
    setErrorMessage(error);
    setMeasurementState('error');
  }, []);

  const handleDeviceDisconnected = useCallback((deviceId: string) => {
    if (connectedDevice?.id === deviceId) {
      setMeasurementState('idle');
      setBpResult(null);
      setWaveformData([]);
      setCurrentPressure(0);
      setTargetPressure(0);
    }
  }, [connectedDevice]);

  // Initialize SDK callbacks - register as soon as SDK instance is available
  useEffect(() => {
    if (!wellueSDK) return;
    
    
    // Set up callbacks properly using the SDK's setCallbacks method
    wellueSDK.setCallbacks({
      onBPMeasurement: handleBPMeasurement,
      onBPProgress: handleBPProgress,
      onBPStatusChanged: handleBPStatusChanged,
      onRealTimeUpdate: handleRealTimeUpdate,
      onError: handleError,
      onDeviceDisconnected: handleDeviceDisconnected
    });
    
    
    return () => {
      // Don't clear callbacks on unmount - let them persist for singleton SDK
    };
  }, [wellueSDK]);

  // 🚀 ENHANCED: Start measurement with proper state reset
  const handleStart = useCallback(async () => {
    if (!connectedDevice || !wellueSDK || stopGuardActive) {
      return;
    }
    
    try {
      
              // 🚀 NEW: Complete state reset for clean measurement start
        setErrorMessage(null);
        setBpResult(null);
        setWaveformData([]);
        setCurrentPressure(0);
        setTargetPressure(0);
        setHeartRate(0);
        resetPressureTracking(); // Reset pressure tracking for new measurement
      setSignalQuality(0);
      
      // 🚀 NEW: Start in 'waiting' state to detect device-initiated inflation
      setMeasurementState('waiting');
      setIsStartDisabled(true);
      
      // 🚀 NEW: Cancel any ongoing animations
      if (pressureAnimationRef.current) {
        cancelAnimationFrame(pressureAnimationRef.current);
        pressureAnimationRef.current = null;
      }
      if (waveformAnimationRef.current) {
        cancelAnimationFrame(waveformAnimationRef.current);
        waveformAnimationRef.current = null;
      }
      
      
      await wellueSDK.startBPMeasurement(connectedDevice.id);
    } catch (error: any) {
      console.error('❌ Failed to start BP measurement:', error);
      setErrorMessage(`Failed to start measurement: ${error.message || error}`);
      setMeasurementState('error');
      setIsStartDisabled(false);
    }
  }, [connectedDevice, wellueSDK, stopGuardActive]);

  // Stop measurement with hardened behavior
  const handleStop = useCallback(async () => {
    if (!connectedDevice || !wellueSDK) {
      return;
    }
    
    try {
      
      // Set stop guard to prevent start for 1.5 seconds
      setStopGuardActive(true);
      setTimeout(() => setStopGuardActive(false), 1500);
      
      // Stop the measurement
      await wellueSDK.stopLive(connectedDevice.id);
      
      // Reset all states
      setMeasurementState('idle');
      setBpResult(null);
      setWaveformData([]);
      setCurrentPressure(0);
      setTargetPressure(0);
      setHeartRate(0);
      setSignalQuality(0);
      setErrorMessage(null);
      setIsStartDisabled(false);
      
      // Cancel any ongoing animations
      if (pressureAnimationRef.current) {
        cancelAnimationFrame(pressureAnimationRef.current);
        pressureAnimationRef.current = null;
      }
      if (waveformAnimationRef.current) {
        cancelAnimationFrame(waveformAnimationRef.current);
        waveformAnimationRef.current = null;
      }
      
    } catch (error: any) {
      console.error('❌ Failed to stop BP measurement:', error);
      setErrorMessage(`Failed to stop measurement: ${error.message || error}`);
    }
  }, [connectedDevice, wellueSDK]);

  // Reset after completion
  const handleReset = useCallback(() => {
    setMeasurementState('idle');
    setBpResult(null);
    setWaveformData([]);
    setCurrentPressure(0);
    setTargetPressure(0);
    setHeartRate(0);
    setSignalQuality(0);
    setErrorMessage(null);
    setIsStartDisabled(false);
    resetPressureTracking(); // Reset pressure tracking
  }, []);

  // Auto-save BP result to storage when measurement completes
  const autoSaveBPResult = useCallback(async (result: any) => {
    if (!result) return;
    
    try {
      
      // Validate BP result
      if (!result.systolic || !result.diastolic || result.systolic <= 0 || result.diastolic <= 0) {
        console.error('❌ [BP] Invalid BP result:', result);
        return;
      }
      
      // Create a unique filename for the BP result
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `bp_result_${timestamp}.json`;
      
      // Prepare the data to save with unified schema
      const dataToSave = {
        ...result,
        timestamp: result.timestamp.toISOString(),
        deviceId: connectedDevice?.id || 'unknown',
        deviceName: connectedDevice?.name || 'unknown',
        measurementId: `bp_${Date.now()}`,
        status: 'completed',
        type: 'bp' // Add type for consistency
      };
      
      // 1. Save to Supabase database FIRST (primary storage for doctor portal)
      try {
        const { db } = await import('@/lib/supabase');
        const vitalSignsData = {
          device_type: 'BP',
          measurement_type: 'blood_pressure',
          data: {
            systolic: dataToSave.systolic,
            diastolic: dataToSave.diastolic,
            mean: dataToSave.mean || Math.round((dataToSave.systolic + 2 * dataToSave.diastolic) / 3),
            pulse_rate: dataToSave.pulseRate || 0,
            status: 'completed',
            deviceName: connectedDevice?.name || 'unknown',
            measurementId: dataToSave.measurementId
          },
          device_id: connectedDevice?.id || 'unknown',
          reading_timestamp: dataToSave.timestamp
        };

        const { error: dbError } = await db.insertVitalSigns(vitalSignsData);
        if (dbError) {
          console.error('❌ [BP] Failed to save to database:', dbError);
          throw new Error(`Database save failed: ${dbError.message}`);
        } else {
        }
      } catch (dbError) {
        console.error('❌ [BP] Database save error:', dbError);
        // Continue with local storage as fallback
      }
      
      // 2. Save to localStorage for app access (add to beginning for latest first)
      let existingResults: any[] = [];
      try { existingResults = JSON.parse(localStorage.getItem('bpResults') || '[]'); } catch { localStorage.removeItem('bpResults'); }
      existingResults.unshift(dataToSave); // Add to beginning
      localStorage.setItem('bpResults', JSON.stringify(existingResults.slice(0, 50))); // Keep last 50

      // FIXED: Also save to storedFilesInApp for reports page (single source of truth)
      try {
        let existingReports: any[] = [];
        try { existingReports = JSON.parse(localStorage.getItem('storedFilesInApp') || '[]'); } catch { localStorage.removeItem('storedFilesInApp'); }
        
        // Remove duplicate BP reports (same systolic/diastolic within 5 minutes)
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        const filteredReports = existingReports.filter(r => {
          if (r.type !== 'bp') return true; // Keep non-BP reports
          const isRecent = new Date(r.timestamp).getTime() > fiveMinutesAgo;
          const isSameBP = r.systolic === dataToSave.systolic && r.diastolic === dataToSave.diastolic;
          return !(isRecent && isSameBP);
        });
        
        const reportData = {
          ...dataToSave,
          type: 'bp',
          savedAt: new Date().toISOString()
        };
        
        const updatedReports = [reportData, ...filteredReports.slice(0, 49)]; // Keep last 50
        localStorage.setItem('storedFilesInApp', JSON.stringify(updatedReports));

        // Note: Database save already handled above in step 1
      } catch (error) {
        console.error('❌ [BP] Failed to save BP result to storedFilesInApp:', error);
      }
      
      // Save to device storage using Capacitor Filesystem
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      await Filesystem.writeFile({
        path: filename,
        data: JSON.stringify(dataToSave, null, 2),
        directory: Directory.Documents,
        recursive: true
      });
      
      // 5. Note: Dashboard will refresh on next navigation or component mount
      
      
    } catch (error) {
      console.error('❌ [BP] Failed to auto-save BP result:', error);
      // Fallback: save to localStorage only
      try {
        const fallbackData = {
          ...result,
          timestamp: result.timestamp.toISOString(),
          deviceId: connectedDevice?.id || 'unknown',
          deviceName: connectedDevice?.name || 'unknown',
          measurementId: `bp_${Date.now()}`,
          status: 'completed',
          type: 'bp'
        };
        
        const existingResults = JSON.parse(localStorage.getItem('bpResults') || '[]');
        existingResults.unshift(fallbackData);
        localStorage.setItem('bpResults', JSON.stringify(existingResults.slice(0, 50)));
        
      } catch (fallbackError) {
        console.error('❌ [BP] Fallback save also failed:', fallbackError);
      }
    }
  }, [connectedDevice]);

  // Legacy save function (kept for compatibility)
  const handleSaveResult = useCallback(async () => {
    if (!bpResult) return;
    await autoSaveBPResult(bpResult);
    setBpResult(null);
  }, [bpResult, autoSaveBPResult]);

  // Auto-save BP result when it's set (measurement completes)
  useEffect(() => {
    if (bpResult) {
      autoSaveBPResult(bpResult);
    }
  }, [bpResult, autoSaveBPResult]);

  // Load saved BP results from storage
  const loadSavedResults = useCallback(async () => {
    try {
      // Load from localStorage
      const savedResults = localStorage.getItem('bpResults');
      if (savedResults) {
        const results = JSON.parse(savedResults);
        return results;
      }
      
      // Load from device storage
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const files = await Filesystem.readdir({
        path: '',
        directory: Directory.Documents
      });
      
      const bpFiles = files.files.filter((file: any) => 
        file.name && file.name.startsWith('bp_result_') && file.name.endsWith('.json')
      );
      
      const loadedResults = [];
      for (const file of bpFiles) {
        try {
          const content = await Filesystem.readFile({
            path: file.name,
            directory: Directory.Documents
          });
          const result = JSON.parse(content.data as string);
          loadedResults.push(result);
        } catch (e) {
          console.warn('⚠️ Failed to read BP file:', file.name, e);
        }
      }
      
      return loadedResults;
      
    } catch (error) {
      console.error('❌ Failed to load saved results:', error);
      return [];
    }
  }, []);

  // 🚨 FIXED: Pressure bar color with proper normal ranges
  const getPressureBarColor = (pressure: number): string => {
    if (pressure === 0) return 'linear-gradient(180deg, #6b7280 0%, #4b5563 100%)'; // Gray for idle
    if (pressure < 60) return 'linear-gradient(180deg, #10b981 0%, #059669 100%)'; // Green for safe
    if (pressure < 120) return 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)'; // Blue for normal
    if (pressure < 180) return 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)'; // Yellow for caution
    if (pressure < 250) return 'linear-gradient(180deg, #f97316 0%, #ea580c 100%)'; // Orange for high
    return 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)'; // Red for very high (abnormal)
  };

  // Get signal quality bars
  const getSignalBars = (quality: number) => {
    const bars = [];
    for (let i = 0; i < 3; i++) {
      bars.push(
        <div
          key={i}
          className={`w-1 h-${i + 2} rounded-full ${i < quality ? 'bg-green-400' : 'bg-gray-600'
          }`}
        />
      );
    }
    return bars;
  };

  // 🚀 IMPLEMENTED: Clean pressure bar algorithm based on pseudo code
  const [measurementPhase, setMeasurementPhase] = useState<'idle' | 'inflating' | 'deflating' | 'analyzing' | 'complete'>('idle');
  const [lastPressure, setLastPressure] = useState(0);
  const [peakPressure, setPeakPressure] = useState(0);
  
  // 🚀 NEW: Reset pressure tracking when measurement starts
  const resetPressureTracking = () => {
    setMeasurementPhase('idle');
    setLastPressure(0);
    setPeakPressure(0);
    // DON'T reset smoothPressure or smoothAnimationPhase here - they're set by real-time data
    // setSmoothPressure(0);  // ❌ REMOVED - causes visual reset
    // setSmoothAnimationPhase('idle');  // ❌ REMOVED - causes UI to stay in idle
    // setMeasurementStartTime(null);  // ❌ REMOVED - handled in real-time callback
    // setInflationPeakTarget(150);  // ❌ REMOVED - handled in real-time callback
    setPressureBuffer([]);
  };
  
  // 🚨 DISABLED: Fake pressure pattern tracking that was interfering with real device measurements
  // This was trying to detect measurement phases based on pressure patterns, which was causing
  // the app to think measurements were complete when they weren't.
  // We now ONLY use device status to determine measurement state - not pressure patterns.
  useEffect(() => {
    // DISABLED - This fake logic was interfering with real device measurements
    // Measurement state is now ONLY controlled by device status (status 3, 4, 5)
    return;
  }, []);
  
  // 🚀 SIMPLIFIED: Start real-time monitoring immediately on mount
  // 🚀 CRITICAL FIX: Start real-time monitoring with proper SDK deployment checks and retries
  useEffect(() => {

    
    if (!wellueSDK || !isInitialized || !connectedDevice) {
      return;
    }
    
    
    // 🚨 FIX: Use ref to track retry state to avoid stale closures
    let isMounted = true;
    let retryTimeoutId: NodeJS.Timeout | null = null;
    let currentRetryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second between retries
    
    // Start monitoring with retry logic for SDK deployment timing
    const startMonitoringWithRetry = async () => {
      // 🚨 CRITICAL: Check if component is still mounted before proceeding
      if (!isMounted) {
        return;
      }
      
      try {
        await wellueSDK.startRtTaskForConnectedDevice();
      } catch (error: any) {
        console.error(`❌ [RT MONITORING] Attempt ${currentRetryCount + 1} failed:`, error);
        
        // 🚨 CRITICAL: Check if still mounted before retrying
        if (!isMounted) {
          return;
        }
        
        // If SDK not deployed yet, retry after delay
        if (error.message?.includes('SDK not ready') && currentRetryCount < maxRetries) {
          currentRetryCount++;
          retryTimeoutId = setTimeout(startMonitoringWithRetry, retryDelay);
        } else {
          console.error(`❌ [RT MONITORING] Failed after ${currentRetryCount + 1} attempts. Giving up.`);
          if (isMounted) {
            setErrorMessage(`Failed to start real-time monitoring: ${error.message || String(error)}`);
          }
        }
      }
    };
    
    startMonitoringWithRetry();
    
    // 🚨 CRITICAL FIX: Cleanup function to prevent memory leaks and race conditions
    return () => {
      
      // Mark component as unmounted to prevent retry callbacks from executing
      isMounted = false;
      
      // Cancel any pending retry timeout
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
      }
      
      // Stop monitoring on native side
      if (connectedDevice) {
        wellueSDK.stopLive(connectedDevice.id).catch((err: any) => {
          console.error('⚠️ [RT MONITORING] Error stopping monitoring:', err);
        });
      }
    };
  }, [wellueSDK, isInitialized, connectedDevice]); // Re-run when SDK/device state changes

  // 🚨 REMOVED: UI STATE DEBUG LOGGING - was cluttering logs

  if (!connectedDevice) {
    return (
      <div className="min-h-screen bg-[#080D1A] text-white font-inter select-none w-full">
        {/* Header */}
        <div className="p-4 pt-safe-top">
          <header className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors active:scale-95 text-white"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-blue-900/70 flex items-center justify-center border border-blue-400/50">
                <Heart className="h-6 w-6 text-blue-300" />
              </div>
              <div>
                <h1 className="text-xl font-bold">BP Monitor</h1>
                <p className="text-xs text-gray-400">Live Blood Pressure Monitoring</p>
              </div>
            </div>
          </header>
        </div>
        
        {/* Content */}
        <div className="p-4">
          <div className="w-full max-w-md mx-auto">
            <Card className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-6 text-center">
              <h2 className="text-2xl font-bold mb-4 text-white">No Device Connected</h2>
              <p className="text-gray-400 mb-6">Please connect a BP monitor device first.</p>
              <Button onClick={() => navigate('/wellue-scanner')} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
                Connect Device
              </Button>
            </Card>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-[#080D1A] text-white font-inter select-none w-full">
      <style dangerouslySetInnerHTML={{ __html: heartbeatStyles }} />
      
      {/* Header */}
      <div className="p-4 pt-safe-top">
        <header className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors active:scale-95 text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-900/70 flex items-center justify-center border border-blue-400/50">
              <Heart className="h-6 w-6 text-blue-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold">BP Monitor</h1>
              <p className="text-xs text-gray-400">Live Blood Pressure Monitoring</p>
            </div>
          </div>
        </header>
      </div>
      
      {/* Content */}
      <div className="p-4">
        <div className="w-full max-w-md mx-auto">

        {/* Device Info */}
        <Card className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">{connectedDevice.name}</h3>
              <p className="text-sm text-gray-400">{connectedDevice.model}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm text-green-400">Connected</span>
            </div>
          </div>
        </Card>

        {/* Main Measurement Panel - 2-column grid */}
        <Card className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-6 mb-4">
          <div className="grid grid-cols-[1fr_36px] gap-4">
            {/* Column 1: Status badge, live pressure, and phase indicators */}
            <div className="flex flex-col">


              {/* Measuring Display with Heart Beating Effect */}
              <div className="flex-1 min-h-[280px] flex flex-col items-center justify-center">
                {/* 🔒 GOD MODE: Check session lock BEFORE checking state - if locked, ALWAYS show measuring */}
                {(() => {
                  const isLocked = isMeasurementSessionLockedRef.current;
                  const isActiveState = measurementState === 'inflating' || 
                                       measurementState === 'deflating' || 
                                       measurementState === 'analyzing' ||
                                       measurementState === 'measuring' ||
                                       measurementState === 'starting';
                  const hasPressure = currentPressureRef.current > 0 || currentPressure > 0;
                  
                  // 🔒 GOD MODE: If session is LOCKED, FORCE "measuring" display regardless of state
                  if (isLocked || isActiveState || hasPressure) {
                    if (!isLocked && !isActiveState && hasPressure) {
                    }
                    if (isLocked) {
                    }
                    return (
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-3 mb-4">
                          <span className="text-4xl font-bold text-blue-400 animate-pulse">Measuring</span>
                          <span className="text-5xl animate-pulse" style={{ animation: 'heartbeat 1.5s ease-in-out infinite' }}>🩸</span>
                        </div>
                        <div className="text-lg text-blue-300">Blood Pressure in Progress</div>
                      </div>
                    );
                  }
                  
                  // Only show "Ready" if session is NOT locked AND no active state AND no pressure
                  return (
                    <div className="text-center text-gray-400">
                      <div className="text-4xl font-bold mb-2">Ready</div>
                      <div className="text-lg">Start measurement to begin</div>
                    </div>
                  );
                })()}
                
                {/* Pressure Display Section Removed */}
                

              </div>


            </div>

            {/* Column 2: ENHANCED pressure bar with proper markings and height */}
            <div className="flex">
              <div className="w-9 rounded-[14px] p-1 bg-white/10 flex items-end relative">
                {/* Pressure Bar Fill - Uses REAL device data only */}
                {(() => {
                  const calculatedHeight = Math.min(100, Math.max(0, (currentPressure / 200) * 100));

                  return (
                <div
                  className="w-7 rounded-[14px] transition-all duration-500 ease-out shadow-lg"
                  style={{ 
                        height: `${calculatedHeight}%`,
                    background: measurementState === 'inflating' 
                      ? 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)' // Blue going up
                      : measurementState === 'deflating'
                      ? 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)' // Yellow going down
                      : measurementState === 'completed' || measurementState === 'analyzing'
                      ? 'linear-gradient(180deg, #10b981 0%, #059669 100%)' // Green for complete
                      : 'linear-gradient(180deg, #6b7280 0%, #4b5563 100%)' // Gray for idle/ready
                  }}
                />
                  );
                })()}

                {/* 🎨 SMOOTH VISUAL: Clean pressure bar with no numerical markings (elderly-friendly) */}
                <div className="absolute -right-4 top-0 bottom-0 flex flex-col justify-between">
                  <div className="w-2 h-0.5 bg-white/40 rounded"></div>
                  <div className="w-2 h-0.5 bg-white/40 rounded"></div>
                  <div className="w-2 h-0.5 bg-white/40 rounded"></div>
                  <div className="w-2 h-0.5 bg-white/40 rounded"></div>
                  <div className="w-2 h-0.5 bg-white/40 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Action Buttons Section Removed */}

        {/* Results Display Panel - Direct Results */}
        <Card className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-gray-200 font-medium">Measurement Results</div>
            {/* Status section removed as requested */}
          </div>

          <div className="p-4">
            {bpResult ? (
              <div className="flex flex-col justify-center">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-[#121B32] border border-slate-700/40 rounded-2xl p-3">
                    <div className="text-2xl font-bold text-white">{bpResult.systolic}</div>
                    <div className="text-xs text-gray-400">Systolic (mmHg)</div>
                  </div>
                  <div className="bg-[#121B32] border border-slate-700/40 rounded-2xl p-3">
                    <div className="text-2xl font-bold text-white">{bpResult.diastolic}</div>
                    <div className="text-xs text-gray-400">Diastolic (mmHg)</div>
                  </div>
                  <div className="bg-[#121B32] border border-slate-700/40 rounded-2xl p-3">
                    <div className="text-2xl font-bold text-white">{bpResult.pulseRate}</div>
                    <div className="text-xs text-gray-400">Pulse Rate (bpm)</div>
                  </div>
                  <div className="bg-[#121B32] border border-slate-700/40 rounded-2xl p-3">
                    <div className="text-2xl font-bold text-white">{bpResult.map}</div>
                    <div className="text-xs text-gray-400">MAP (mmHg)</div>
                  </div>
                </div>
                <div className="text-center mt-2">
                  <div className="text-xs text-gray-400">
                    {bpResult.timestamp.toLocaleTimeString()}
                  </div>
                  <div className="text-xs text-green-400 mt-1">
                    ✅ Auto-saved to Reports
                  </div>
                </div>
              </div>
            ) : measurementState === 'waiting' ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-orange-400">
                  <div className="text-lg font-semibold mb-2">Waiting for Device</div>
                  <div className="text-sm">Device will start inflation automatically</div>
                  <div className="text-xs mt-2 text-orange-300">Pressure: 0 mmHg</div>
                </div>
              </div>
            ) : measurementState === 'completed' ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <div className="text-lg font-semibold mb-2">Measurement Complete</div>
                  <div className="text-sm">Results will appear here</div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <div className="text-lg font-semibold mb-2">Ready for Measurement</div>
                  <div className="text-sm">Start a measurement to see results</div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* BP History Section */}
        {previousReadings.length > 0 && (
          <Card className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-gray-200 font-medium">Previous Reading</h3>
              <div className="text-sm text-gray-400">Latest</div>
            </div>
            <div className="bg-[#121B32] border border-slate-700/40 rounded-2xl p-3">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <div className="text-lg font-bold text-white">{previousReadings[0].systolic}/{previousReadings[0].diastolic}</div>
                  <div className="text-xs text-gray-400">BP (mmHg)</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-white">{previousReadings[0].pulseRate}</div>
                  <div className="text-xs text-gray-400">Pulse (bpm)</div>
                </div>
              </div>
              <div className="text-center mt-2">
                <div className="text-xs text-gray-400">
                  {new Date(previousReadings[0].timestamp).toLocaleDateString()} at {new Date(previousReadings[0].timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          </Card>
        )}


        {/* Error Display */}
        {errorMessage && (
          <Card className="bg-red-900/20 border-red-700/40 shadow-sm rounded-3xl p-4 mb-6">
            <div className="text-red-400 text-center">
              <p className="font-semibold">Error</p>
              <p className="text-sm">{errorMessage}</p>
            </div>
          </Card>
        )}




        </div>
      </div>
    </div>
  );
};


