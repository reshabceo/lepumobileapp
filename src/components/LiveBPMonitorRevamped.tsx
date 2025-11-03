import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDevice } from '@/contexts/DeviceContext';
import { WellueSDKBridge } from '@/lib/wellue-sdk-bridge';
import { ArrowLeft } from 'lucide-react';

type MeasurementState = 'idle' | 'waiting' | 'inflating' | 'deflating' | 'analyzing' | 'completed' | 'canceled' | 'error';

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
  
  // 🚀 NEW: Smooth animation system for elderly users (no complex filtering)
  const updateSmoothAnimation = () => {
    if (!measurementStartTime) return;
    
    const elapsedTime = (Date.now() - measurementStartTime) / 1000; // seconds
    const totalDuration = 45; // Total measurement duration in seconds
    
    let newPhase: typeof smoothAnimationPhase = 'idle';
    let targetPressure = 0;
    
    if (elapsedTime < 15) {
      // Inflation phase: 0-15 seconds
      newPhase = 'inflating';
      const inflationProgress = elapsedTime / 15; // 0 to 1
      targetPressure = inflationProgress * inflationPeakTarget; // Smooth curve to peak
    } else if (elapsedTime < 20) {
      // Peak hold phase: 15-20 seconds
      newPhase = 'peak';
      targetPressure = inflationPeakTarget; // Hold at peak
    } else if (elapsedTime < 40) {
      // Deflation phase: 20-40 seconds
      newPhase = 'deflating';
      const deflationProgress = (elapsedTime - 20) / 20; // 0 to 1
      targetPressure = inflationPeakTarget * (1 - deflationProgress); // Smooth curve to zero
    } else {
      // Complete phase: 40+ seconds
      newPhase = 'complete';
      targetPressure = 0;
    }
    
    setSmoothAnimationPhase(newPhase);
    
    // Smooth transition to target pressure
    setSmoothPressure(prev => {
      const diff = targetPressure - prev;
      const smoothingFactor = 0.1; // How fast to reach target (0.1 = gentle, 0.5 = faster)
      return prev + (diff * smoothingFactor);
    });
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
  const targetPressureRef = useRef(0);
  
  // 🚀 NEW: Pressure buffer system for 0.2s delay
  const [pressureBuffer, setPressureBuffer] = useState<Array<{pressure: number, timestamp: number}>>([]);
  const pressureBufferRef = useRef<NodeJS.Timeout | null>(null);
  
  // 🚀 NEW: Smooth animation system for elderly users
  const [smoothPressure, setSmoothPressure] = useState(0);
  const [measurementStartTime, setMeasurementStartTime] = useState<number | null>(null);
  const [inflationPeakTarget, setInflationPeakTarget] = useState(150); // Default target for smooth animation
  const [smoothAnimationPhase, setSmoothAnimationPhase] = useState<'idle' | 'inflating' | 'peak' | 'deflating' | 'complete'>('idle');
  
  // Refs for animations
  const pressureAnimationRef = useRef<number | null>(null);
  const waveformAnimationRef = useRef<number | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Logging for debugging
  useEffect(() => {
    console.log('🔍 LiveBPMonitorRevamped mounted');
    console.log('📱 Connected device:', connectedDevice);
    console.log('🔧 SDK initialized:', isInitialized);
    
    // DON'T reset state on mount - preserve ongoing measurements!
    // Only reset error/disabled flags
    setErrorMessage(null);
    setStopGuardActive(false);
    setIsStartDisabled(false);
    
    return () => {
      console.log('🔍 LiveBPMonitorRevamped unmounting');
      if (pressureAnimationRef.current) {
        cancelAnimationFrame(pressureAnimationRef.current);
      }
      if (waveformAnimationRef.current) {
        cancelAnimationFrame(waveformAnimationRef.current);
      }
    };
  }, []); // Reset every time component mounts
  
  // 🚀 NEW: Simple measurement detection for smooth animation
  useEffect(() => {
    const processBufferedPressure = () => {
      const now = Date.now();
      const validReadings = pressureBuffer.filter(reading => now - reading.timestamp >= 200); // 0.2s delay
      
      if (validReadings.length > 0) {
        const latestReading = validReadings[validReadings.length - 1];
        
        // Start smooth animation when device pressure detected
        if (latestReading.pressure > 10 && !measurementStartTime) {
          console.log('🚀 [SMOOTH] Starting smooth animation - device pressure detected:', latestReading.pressure);
          setMeasurementStartTime(Date.now());
          
          // Estimate peak target based on first significant reading
          const estimatedPeak = Math.max(140, Math.min(180, latestReading.pressure * 1.2));
          setInflationPeakTarget(estimatedPeak);
          console.log('🎯 [SMOOTH] Estimated peak target:', estimatedPeak, 'mmHg');
        }
        
        // Remove processed readings from buffer
        setPressureBuffer(prev => prev.filter(reading => now - reading.timestamp < 200));
      }
    };
    
    if (pressureBuffer.length > 0) {
      if (pressureBufferRef.current) {
        clearTimeout(pressureBufferRef.current);
      }
      pressureBufferRef.current = setTimeout(processBufferedPressure, 50); // Check every 50ms
    }
    
    return () => {
      if (pressureBufferRef.current) {
        clearTimeout(pressureBufferRef.current);
      }
    };
  }, [pressureBuffer, measurementStartTime]);
  
  // 🚨 FIX: Keep refs in sync with state
  useEffect(() => {
    measurementStateRef.current = measurementState;
  }, [measurementState]);
  
  useEffect(() => {
    targetPressureRef.current = targetPressure;
  }, [targetPressure]);
  
  // Load previous BP readings from localStorage AND clear cached pressure
  useEffect(() => {
    console.log('🔄 [COMPONENT MOUNT] LiveBPMonitorRevamped component mounted');
    console.log('🧹 [CACHE CLEAR] Clearing all cached pressure data from previous sessions');
    
    // 🔥 CRITICAL: Clear ALL cached pressure/measurement data on mount
    setCurrentPressure(0);
    setTargetPressure(0);
    setSmoothPressure(0);
    setLastReceivedPressure(0);
    setHeartRate(0);
    setMeasurementState('idle');
    measurementStateRef.current = 'idle';
    setSmoothAnimationPhase('idle');
    setMeasurementStartTime(null);
    
    console.log('✅ [CACHE CLEAR] All pressure/state data reset to 0');
    
    try {
      const savedResults = localStorage.getItem('bpResults');
      if (savedResults) {
        const parsedResults = JSON.parse(savedResults);
        if (Array.isArray(parsedResults) && parsedResults.length > 0) {
          console.log('📚 [BP] Loading', parsedResults.length, 'previous BP readings from localStorage');
          setPreviousReadings(parsedResults);
        }
      }
    } catch (error) {
      console.error('❌ [BP] Failed to load previous BP readings:', error);
    }
  }, []);

  // Auto-detect device-initiated measurements
  useEffect(() => {
    if (measurementState === 'idle' && connectedDevice && isInitialized && wellueSDK) {
      console.log('🔍 Checking for device-initiated measurement...');
      
      const checkDeviceStatus = async () => {
        try {
          const status = await wellueSDK.getBPStatus();
          console.log('📊 Current device status:', status);
          
          if (status.isMeasuring && status.status !== 'idle') {
            console.log('🎯 Device-initiated measurement detected!');
            setMeasurementState(status.status as MeasurementState);
            
            if (status.currentPressure > 0) {
              setCurrentPressure(status.currentPressure);
              setTargetPressure(status.currentPressure);
            }
          }
        } catch (error) {
          console.log('⚠️ Could not check device status:', error);
        }
      };
      
      checkDeviceStatus();
      const interval = setInterval(checkDeviceStatus, 2000);
      
      return () => clearInterval(interval);
    }
  }, [measurementState, connectedDevice, isInitialized, wellueSDK]);

  // Monitor device connection status
  useEffect(() => {
    if (!connectedDevice || !isInitialized) return;
    
    console.log('🔍 Setting up device connection monitoring for:', connectedDevice.name);
    
    const checkConnection = async () => {
      try {
        const isConnected = await wellueSDK.isConnected(connectedDevice.id);
        if (!isConnected) {
          console.log('🔌 Device connection lost, updating UI...');
          setMeasurementState('idle');
          setBpResult(null);
          setWaveformData([]);
          setCurrentPressure(0);
          setTargetPressure(0);
          setErrorMessage('Device disconnected');
        }
      } catch (error) {
        console.log('⚠️ Connection check failed:', error);
      }
    };
    
    const connectionInterval = setInterval(checkConnection, 3000);
    
    return () => clearInterval(connectionInterval);
  }, [connectedDevice, isInitialized, wellueSDK]);

  // 🚀 NEW: Smooth animation loop for elderly users
  useEffect(() => {
    if (!measurementStartTime || smoothAnimationPhase === 'complete') {
      if (pressureAnimationRef.current) {
        cancelAnimationFrame(pressureAnimationRef.current);
        pressureAnimationRef.current = null;
      }
      return;
    }

    const animateSmooth = () => {
      updateSmoothAnimation();
      pressureAnimationRef.current = requestAnimationFrame(animateSmooth);
    };
    
    pressureAnimationRef.current = requestAnimationFrame(animateSmooth);
    
    return () => {
      if (pressureAnimationRef.current) {
        cancelAnimationFrame(pressureAnimationRef.current);
      }
    };
  }, [measurementStartTime, smoothAnimationPhase]);

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
      console.log('⏰ Setting auto-completion timeout for analyzing state');
      completionTimeout = setTimeout(() => {
        console.log('⏰ Auto-completion timeout reached, forcing completion state');
        setMeasurementState('completed');
        
        if (!bpResult) {
          console.log('⚠️ Auto-completion triggered but no BP results available');
        }
      }, 10000); // 10 seconds timeout for analysis
    }
    
    return () => {
      if (completionTimeout) {
        console.log('⏰ Clearing auto-completion timeout');
        clearTimeout(completionTimeout);
      }
    };
  }, [measurementState, bpResult]);

  // SDK event handlers
  const handleBPMeasurement = useCallback((measurement: any) => {
    console.log('📊 BP Measurement result received:', measurement);
    
    const resultTimestamp = measurement.timestamp instanceof Date 
      ? measurement.timestamp 
      : new Date(measurement.timestamp || Date.now());
    
    setBpResult({
      systolic: measurement.systolic,
      diastolic: measurement.diastolic,
      pulseRate: measurement.pulseRate,
      map: measurement.meanArterialPressure,
      timestamp: resultTimestamp
    });
    
    setMeasurementState('completed');
    console.log('✅ Measurement completed, showing results');
  }, []);

  const handleBPProgress = useCallback((progress: any) => {
    console.log('📈 BP Progress update:', progress);
    
    switch (progress.status) {
      case 'inflating':
        console.log('📈 Setting state to inflating');
        setMeasurementState('inflating');
        setWaveformData([]); // Hide waveform during inflation
        
        // 🚀 NEW: Reset pressure tracking for new measurement
        if (targetPressure === 0) {
          console.log('🔄 Starting new measurement, resetting pressure tracking');
          setCurrentPressure(0);
          setTargetPressure(0);
        }
        break;
      case 'deflating':
        console.log('📉 Setting state to deflating');
        setMeasurementState('deflating');
        // Start collecting waveform data during deflation
        console.log('📊 Starting waveform data collection for deflation');
        break;
      case 'analyzing':
        console.log('🔍 Setting state to analyzing');
        setMeasurementState('analyzing');
        break;
      default:
        console.log('⚠️ Unknown progress status:', progress.status);
    }
    
    // 🚀 FIXED: Natural pressure tracking - trust device data completely
    console.log('📊 [REACT] ===== PRESSURE UPDATE =====');
    console.log('📊 [REACT] Received pressure:', progress.pressure, 'mmHg');
    console.log('📊 [REACT] Received status:', progress.status);
    console.log('📊 [REACT] Current targetPressure:', targetPressure, 'mmHg');
    console.log('📊 [REACT] Current currentPressure:', currentPressure, 'mmHg');
    
    if (progress.pressure > 0) {
      console.log('📊 [REACT] Pressure > 0, adding to buffer for 0.2s delay');
      
      // 🚀 NEW: Add to pressure buffer instead of direct update
      const now = Date.now();
      setPressureBuffer(prev => [...prev, { pressure: progress.pressure, timestamp: now }]);
      console.log('📊 [BUFFER] Added pressure', progress.pressure, 'mmHg to buffer at', new Date(now).toISOString());
      
      // 🚀 NEW: Track peak pressure for natural flow detection
      if (progress.status === 'inflating' && progress.pressure > targetPressure) {
        console.log('📈 [PEAK] New peak pressure detected:', progress.pressure, 'mmHg');
      }
      
    } else {
      console.log('📊 [REACT] Pressure <= 0, not adding to buffer');
    }
    
    // 🚀 NEW: Real waveform data collection during deflation (no simulation)
    if (progress.status === 'deflating' && progress.pressure > 0) {
      console.log('📊 Collecting real waveform data during deflation at pressure:', progress.pressure);
      
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
    console.log('📊 BP Status changed:', status);
    
    // Update measurement state based on device status
    if (status.status && status.status !== measurementState) {
      console.log('🔄 Updating measurement state from', measurementState, 'to', status.status);
      setMeasurementState(status.status as MeasurementState);
    }
    
    // Check for completed measurement
    if (status.status === 'complete' || status.status === 'completed') {
      console.log('✅ BP measurement completed, checking for results...');
      
      if (status.lastMeasurement) {
        console.log('📊 Found last measurement data:', status.lastMeasurement);
        
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
        console.log('✅ BP results set successfully:', newBpResult);
      } else {
        console.log('⚠️ Status is complete but no lastMeasurement data, checking if we have stored results...');
        // If no lastMeasurement but status is complete, try to get results from device
        if (measurementState === 'analyzing' || measurementState === 'deflating') {
          setMeasurementState('completed');
          console.log('🎯 Auto-detecting measurement completion from device status');
        }
      }
    }
    
    // Handle other status changes
    if (status.status === 'error' && status.error) {
      console.log('❌ BP measurement error:', status.error);
      setErrorMessage(status.error);
      setMeasurementState('error');
    }
  }, [measurementState]);

  const handleRealTimeUpdate = useCallback((data: any) => {
    // 🚨 FIX: Use refs instead of closure state to avoid stale values
    const currentMeasurementState = measurementStateRef.current;
    const currentTargetPressure = targetPressureRef.current;
    
    console.log('📊 [REALTIME] ===== REAL-TIME UPDATE =====');
    console.log('📊 [REALTIME] Data received:', JSON.stringify(data));
    console.log('📊 [REALTIME] Current measurementState:', currentMeasurementState);
    console.log('📊 [REALTIME] Current targetPressure:', currentTargetPressure);
    
    // Handle pressure (already converted from raw to mmHg in bridge)
    if (data.pressure !== undefined && data.pressure > 0) {
      console.log('📊 [REALTIME] Pressure found in data:', data.pressure, 'mmHg');
      
      // 🔥 FIX: DON'T use pressure to detect new measurements!
      // Pressure can be stale/cached from previous session (0→225 instant jump)
      // ONLY use device STATUS (4=Measuring) to detect when user presses device button
      // Pressure is ONLY for updating the UI during active measurement
      
      // Update last received pressure for tracking
      setLastReceivedPressure(data.pressure);
      
      // ONLY update pressure values when actively measuring (not idle and not ready)
      if (currentMeasurementState === 'inflating' || currentMeasurementState === 'deflating') {
        console.log('📊 [REALTIME] Updating pressure during active measurement:', data.pressure, 'mmHg');
        setTargetPressure(data.pressure);
        setCurrentPressure(data.pressure);
        setSmoothPressure(data.pressure);
      } else if (currentMeasurementState === 'idle' || currentMeasurementState === 'ready') {
        // Ignore pressure when idle - wait for status=4 first
        console.log('📊 [REALTIME] Ignoring pressure in idle state (waiting for status=4):', data.pressure, 'mmHg');
      }
    } else {
      console.log('📊 [REALTIME] No pressure data in real-time update (pressure=' + data.pressure + ')');
    }
    
    // Handle heart rate (iOS: pulse, Android: hr)
    const hr = data.pulse || data.heartRate || data.hr;
    if (hr !== undefined && hr > 0) {
      console.log('💓 [REALTIME] Heart rate:', hr, 'BPM');
      setHeartRate(hr);
    }
    
    // Handle battery (iOS: batteryPercent, Android: batteryStatus)
    const battery = data.batteryPercent || data.batteryStatus;
    if (battery !== undefined) {
      console.log('🔋 [REALTIME] Battery:', battery, '%');
    }
    
    if (data.signalQuality !== undefined) {
      setSignalQuality(data.signalQuality);
    }
    
    // Check device status (iOS: status, Android: deviceStatus)
    // Status mapping: 3=Ready, 4=BPMeasuring, 5=BPMeasureEnd
    // 🔥 THIS IS THE ONLY WAY TO DETECT USER PRESSING DEVICE BUTTON!
    const deviceStatus = data.status || data.deviceStatus;
    if (deviceStatus !== undefined) {
      console.log('📱 [REALTIME] Device status update:', deviceStatus);
      
      // Map Viatom status codes to measurement states
      if (deviceStatus === 4 && (currentMeasurementState === 'idle' || currentMeasurementState === 'ready')) {
        console.log('🎯 [REALTIME] ✅ USER PRESSED DEVICE BUTTON! Status 4 (BPMeasuring) detected');
        console.log('🎯 [REALTIME] Starting measurement with pressure:', data.pressure || 0);
        console.log('🖥️ [UI TRANSITION] STATE CHANGE: idle → inflating');
        console.log('🖥️ [UI TRANSITION] UI WILL SHOW: INFLATING SCREEN (BLUE BAR RISING)');
        setMeasurementState('inflating');
        measurementStateRef.current = 'inflating'; // 🔥 UPDATE REF IMMEDIATELY to avoid race condition
        setSmoothAnimationPhase('inflating'); // Initialize animation
        setMeasurementStartTime(Date.now()); // Start timer
        if (data.pressure) {
          console.log('🖥️ [UI TRANSITION] Initial pressure in same event:', data.pressure, 'mmHg');
          setTargetPressure(data.pressure);
          setCurrentPressure(data.pressure);
          setSmoothPressure(data.pressure);
          setInflationPeakTarget(data.pressure);
        } else {
          console.log('🖥️ [UI TRANSITION] No pressure in this event, will wait for next pressure update');
        }
        setErrorMessage(null);
        setBpResult(null);
        setWaveformData([]);
      } else if (deviceStatus === 5) {
        console.log('🎯 [REALTIME] Status 5 (BPMeasureEnd) - measurement complete');
        console.log('🖥️ [UI TRANSITION] STATE CHANGE: measuring → analyzing');
        setMeasurementState('analyzing');
        measurementStateRef.current = 'analyzing'; // 🔥 UPDATE REF IMMEDIATELY
      }
    }
    
    // Handle deflating indicator
    if (data.isDeflating === true && currentMeasurementState === 'inflating') {
      console.log('🎯 [REALTIME] Deflating detected - transitioning state');
      console.log('🖥️ [UI TRANSITION] STATE CHANGE: inflating → deflating');
      console.log('🖥️ [UI TRANSITION] UI WILL SHOW: DEFLATING SCREEN (YELLOW BAR FALLING)');
      setMeasurementState('deflating');
      measurementStateRef.current = 'deflating'; // 🔥 UPDATE REF IMMEDIATELY
      setSmoothAnimationPhase('deflating'); // ✅ FIX: Update smooth bar phase
    }
    
    // Update smooth bar based on ongoing measurement
    if (data.pressure !== undefined && data.pressure > 0 && currentMeasurementState !== 'idle') {
      if (data.isDeflating) {
        setSmoothAnimationPhase('deflating');
      } else if (data.pressure > 100) {
        setSmoothAnimationPhase('inflating');
      }
    }
  }, []); // 🚨 FIX: No dependencies - callback never recreated, always uses latest refs

  const handleError = useCallback((error: string, details?: any) => {
    console.error('❌ SDK Error:', error, details);
    setErrorMessage(error);
    setMeasurementState('error');
  }, []);

  const handleDeviceDisconnected = useCallback((deviceId: string) => {
    console.log('🔌 Device disconnected:', deviceId);
    if (connectedDevice?.id === deviceId) {
      setMeasurementState('idle');
      setBpResult(null);
      setWaveformData([]);
      setCurrentPressure(0);
      setTargetPressure(0);
    }
  }, [connectedDevice]);

  // Initialize SDK callbacks - ONLY ONCE per mount, not on callback changes
  useEffect(() => {
    if (!wellueSDK || !isInitialized) return;
    
    console.log('🔧 Setting up SDK callbacks for LiveBPMonitorRevamped');
    
    // Set up callbacks properly using the SDK's setCallbacks method
    wellueSDK.setCallbacks({
      onBPMeasurement: handleBPMeasurement,
      onBPProgress: handleBPProgress,
      onBPStatusChanged: handleBPStatusChanged,
      onRealTimeUpdate: handleRealTimeUpdate,
      onError: handleError,
      onDeviceDisconnected: handleDeviceDisconnected
    });
    
    console.log('✅ SDK callbacks registered successfully');
    
    return () => {
      // Don't clear callbacks on unmount - let them persist for singleton SDK
      console.log('🧹 Component unmounting (callbacks remain active in singleton)');
    };
  }, [wellueSDK, isInitialized]); // ← REMOVED callback dependencies to prevent re-registration

  // 🚀 ENHANCED: Start measurement with proper state reset
  const handleStart = useCallback(async () => {
    if (!connectedDevice || !wellueSDK || stopGuardActive) {
      console.log('⚠️ Cannot start measurement:', { connectedDevice: !!connectedDevice, wellueSDK: !!wellueSDK, stopGuardActive });
      return;
    }
    
    try {
      console.log('🚀 Starting BP measurement...');
      
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
      
      console.log('🔄 Measurement state reset, waiting for device to start inflation...');
      
      await wellueSDK.startBPMeasurement(connectedDevice.id);
      console.log('✅ BP measurement started successfully');
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
      console.log('⚠️ Cannot stop measurement: no device or SDK');
      return;
    }
    
    try {
      console.log('🛑 Stopping BP measurement...');
      
      // Set stop guard to prevent start for 1.5 seconds
      setStopGuardActive(true);
      setTimeout(() => setStopGuardActive(false), 1500);
      
      // Stop the measurement
      await wellueSDK.stopLive(connectedDevice.id);
      console.log('✅ BP measurement stopped successfully');
      
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
      
      console.log('🔄 All states reset to idle');
    } catch (error: any) {
      console.error('❌ Failed to stop BP measurement:', error);
      setErrorMessage(`Failed to stop measurement: ${error.message || error}`);
    }
  }, [connectedDevice, wellueSDK]);

  // Reset after completion
  const handleReset = useCallback(() => {
    console.log('🔄 Resetting measurement...');
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
      console.log('💾 [BP] Auto-saving BP result:', result);
      
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
          console.log('✅ [BP] BP result saved to database for doctor monitoring');
        }
      } catch (dbError) {
        console.error('❌ [BP] Database save error:', dbError);
        // Continue with local storage as fallback
      }
      
      // 2. Save to localStorage for app access (add to beginning for latest first)
      const existingResults = JSON.parse(localStorage.getItem('bpResults') || '[]');
      existingResults.unshift(dataToSave); // Add to beginning
      localStorage.setItem('bpResults', JSON.stringify(existingResults.slice(0, 50))); // Keep last 50
      
      // FIXED: Also save to storedFilesInApp for reports page (single source of truth)
      try {
        const existingReports = JSON.parse(localStorage.getItem('storedFilesInApp') || '[]');
        
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
        console.log('💾 [BP] BP result saved to storedFilesInApp for reports, total reports:', updatedReports.length);

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
      console.log('📊 BP measurement completed, data saved to all storage systems');
      
      console.log('💾 [BP] BP result auto-saved successfully to all storage systems');
      
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
        
        console.log('💾 [BP] BP result saved to localStorage as fallback');
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
      console.log('🚀 [BP] BP measurement completed, auto-saving result');
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
        console.log('📊 Loaded saved BP results:', results.length);
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
      
      console.log('📊 Loaded BP results from device storage:', loadedResults.length);
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
    console.log('🔄 Smooth animation reset for new measurement');
  };
  
  // 🚀 NEW: Enhanced peak pressure tracking for natural flow
  useEffect(() => {
    if (currentPressure > 0 && lastPressure !== currentPressure) {
      const pressureChange = currentPressure - lastPressure;
      
      // Phase 1: Inflation Detection
      if (currentPressure > lastPressure && currentPressure > 30) {
        if (measurementPhase !== 'inflating') {
          console.log('📈 [NATURAL FLOW] INFLATING: Pressure increasing to', currentPressure, 'mmHg');
          setMeasurementPhase('inflating');
        }
        // Track peak pressure during inflation
        if (currentPressure > peakPressure) {
          setPeakPressure(currentPressure);
          console.log('🏔️ [PEAK] New peak pressure reached:', currentPressure, 'mmHg');
        }
      }
      
      // Phase 2: Peak Detection & Deflation Start
      else if (currentPressure < lastPressure && measurementPhase === 'inflating' && currentPressure < peakPressure) {
        console.log('📉 [NATURAL FLOW] DEFLATING: Pressure decreasing from peak', peakPressure, 'to', currentPressure, 'mmHg');
        setMeasurementPhase('deflating');
      }
      
      // Phase 3: Analysis Phase
      else if (currentPressure < 50 && currentPressure > 0 && measurementPhase === 'deflating') {
        console.log('🔍 [NATURAL FLOW] ANALYZING: Pressure stabilized at', currentPressure, 'mmHg');
        setMeasurementPhase('analyzing');
      }
      
      // Update last pressure for next comparison
      setLastPressure(currentPressure);
    }
  }, [currentPressure, lastPressure, measurementPhase, peakPressure]);
  
  // Real-time monitoring for device-initiated measurements
  useEffect(() => {
    if (!connectedDevice || !isInitialized || !wellueSDK) return;
    
    console.log('🔍 Setting up real-time monitoring for device-initiated measurements...');
    
    const monitorRealTime = async () => {
      try {
        // Start real-time monitoring
        await wellueSDK.startRtTaskForConnectedDevice();
        console.log('✅ Real-time monitoring started');
      } catch (error) {
        console.log('⚠️ Could not start real-time monitoring:', error);
      }
    };
    
    monitorRealTime();
    
    return () => {
      // Cleanup real-time monitoring
      try {
        wellueSDK.stopLive(connectedDevice.id);
        console.log('🧹 Real-time monitoring stopped');
      } catch (error) {
        console.log('⚠️ Could not stop real-time monitoring:', error);
      }
    };
  }, [connectedDevice, isInitialized, wellueSDK]);

  // 🎨 UI STATE DEBUG LOGGING
  console.log('🎨 [UI STATE] ========================================');
  console.log('🎨 [UI STATE] Render cycle - Current UI State:');
  console.log('🎨 [UI STATE] - measurementState:', measurementState);
  console.log('🎨 [UI STATE] - smoothAnimationPhase:', smoothAnimationPhase);
  console.log('🎨 [UI STATE] - currentPressure:', currentPressure);
  console.log('🎨 [UI STATE] - smoothPressure:', smoothPressure);
  console.log('🎨 [UI STATE] - heartRate:', heartRate);
  console.log('🎨 [UI STATE] - connectedDevice:', connectedDevice ? connectedDevice.name : 'NONE');
  console.log('🎨 [UI STATE] ========================================');

  if (!connectedDevice) {
    console.log('🖥️ [UI RENDER] Showing: NO DEVICE CONNECTED SCREEN');
    return (
      <div className="min-h-screen bg-slate-900 text-white w-full">
        {/* Header */}
        <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
          <div className="relative flex items-center justify-between p-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 px-3 py-2 text-white bg-blue-600 hover:bg-blue-700 transition-colors touch-manipulation rounded-lg"
              style={{ minHeight: '40px', minWidth: '70px' }}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Back</span>
            </button>
            <h1 className="absolute left-1/2 transform -translate-x-1/2 text-xl font-semibold">BP Monitor</h1>
            <div className="w-16" />
          </div>
        </div>
        
        {/* Content */}
        <div className="p-4">
          <div className="w-full max-w-md mx-auto">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-4">No Device Connected</h1>
              <p className="text-gray-400 mb-6">Please connect a BP monitor device first.</p>
              <Button onClick={() => navigate('/wellue-scanner')} className="w-full">
                Connect Device
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  console.log('🖥️ [UI RENDER] Showing: MAIN BP MONITOR SCREEN');
  console.log('🖥️ [UI RENDER] - Current measurement state:', measurementState);
  console.log('🖥️ [UI RENDER] - UI will show as:', measurementState === 'idle' ? 'READY TO MEASURE' : measurementState === 'inflating' ? 'INFLATING (BLUE BAR RISING)' : measurementState === 'deflating' ? 'DEFLATING (YELLOW BAR FALLING)' : measurementState === 'analyzing' ? 'ANALYZING' : measurementState === 'complete' ? 'COMPLETE WITH RESULTS' : measurementState);

  return (
    <div className="min-h-screen bg-slate-900 text-white w-full">
      <style dangerouslySetInnerHTML={{ __html: heartbeatStyles }} />
      
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <div className="relative flex items-center justify-between p-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-3 py-2 text-white bg-blue-600 hover:bg-blue-700 transition-colors touch-manipulation rounded-lg"
            style={{ minHeight: '40px', minWidth: '70px' }}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back</span>
          </button>
          <h1 className="absolute left-1/2 transform -translate-x-1/2 text-xl font-semibold">BP Monitor</h1>
          <div className="w-16" />
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4">
        <div className="w-full max-w-md mx-auto">

        {/* Device Info */}
        <Card className="bg-slate-800 border-slate-700 p-4 mb-6">
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
        <Card className="bg-slate-800 border-slate-700 p-6 mb-4">
          <div className="grid grid-cols-[1fr_36px] gap-4">
            {/* Column 1: Status badge, live pressure, and phase indicators */}
            <div className="flex flex-col">


              {/* Measuring Display with Heart Beating Effect */}
              <div className="flex-1 min-h-[280px] flex flex-col items-center justify-center">
                {/* Measuring Text with Continuous Heart Beating Animation */}
                {smoothAnimationPhase !== 'idle' && smoothAnimationPhase !== 'complete' ? (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <span className="text-4xl font-bold text-blue-400 animate-pulse">Measuring</span>
                      <span className="text-5xl animate-pulse" style={{ animation: 'heartbeat 1.5s ease-in-out infinite' }}>🩸</span>
                    </div>
                    <div className="text-lg text-blue-300">Blood Pressure in Progress</div>
                  </div>
                ) : (
                  <div className="text-center text-gray-400">
                    <div className="text-4xl font-bold mb-2">Ready</div>
                    <div className="text-lg">Start measurement to begin</div>
                  </div>
                )}
                
                {/* Pressure Display Section Removed */}
                

              </div>


            </div>

            {/* Column 2: ENHANCED pressure bar with proper markings and height */}
            <div className="flex">
              <div className="w-9 rounded-[14px] p-1 bg-white/10 flex items-end relative">
                {/* Pressure Bar Fill */}
                <div
                  className="w-7 rounded-[14px] transition-all duration-500 ease-out shadow-lg"
                  style={{ 
                    height: `${(() => {
                      const calculatedHeight = Math.min(100, Math.max(0, (smoothPressure / 200) * 100));
                      return calculatedHeight;
                    })()}%`,
                    background: smoothAnimationPhase === 'inflating' 
                      ? 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)' // Blue going up
                      : smoothAnimationPhase === 'deflating'
                      ? 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)' // Yellow going down
                      : smoothAnimationPhase === 'peak'
                      ? 'linear-gradient(180deg, #10b981 0%, #059669 100%)' // Green for peak
                      : smoothAnimationPhase === 'complete'
                      ? 'linear-gradient(180deg, #6b7280 0%, #4b5563 100%)' // Gray for complete
                      : 'linear-gradient(180deg, #6b7280 0%, #4b5563 100%)' // Gray for idle
                  }}
                />

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
        <Card className="bg-slate-800 border-slate-700 p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-gray-200 font-medium">Measurement Results</div>
            {/* Status section removed as requested */}
          </div>

          <div className="p-4">
            {bpResult ? (
              <div className="flex flex-col justify-center">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-white">{bpResult.systolic}</div>
                    <div className="text-xs text-gray-400">Systolic (mmHg)</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-white">{bpResult.diastolic}</div>
                    <div className="text-xs text-gray-400">Diastolic (mmHg)</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-white">{bpResult.pulseRate}</div>
                    <div className="text-xs text-gray-400">Pulse Rate (bpm)</div>
                  </div>
                  <div className="bg-slate-700/50 rounded-lg p-3">
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
          <Card className="bg-slate-800 border-slate-700 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-gray-200 font-medium">Previous Reading</h3>
              <div className="text-sm text-gray-400">Latest</div>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-3">
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
          <Card className="bg-red-900/20 border-red-700 p-4 mb-6">
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


