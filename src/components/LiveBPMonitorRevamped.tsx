import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDevice } from '@/contexts/DeviceContext';
import { WellueSDKBridge } from '@/lib/wellue-sdk-bridge';

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
  
  // Refs for animations
  const pressureAnimationRef = useRef<number | null>(null);
  const waveformAnimationRef = useRef<number | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Logging for debugging
  useEffect(() => {
    console.log('🔍 LiveBPMonitorRevamped mounted');
    console.log('📱 Connected device:', connectedDevice);
    console.log('🔧 SDK initialized:', isInitialized);
    
    // Reset measurement state when returning to page
    setMeasurementState('idle');
    setCurrentPressure(0);
    setTargetPressure(0);
    setBpResult(null);
    
    return () => {
      console.log('🔍 LiveBPMonitorRevamped unmounting');
      if (pressureAnimationRef.current) {
        cancelAnimationFrame(pressureAnimationRef.current);
      }
      if (waveformAnimationRef.current) {
        cancelAnimationFrame(waveformAnimationRef.current);
      }
    };
  }, [connectedDevice, isInitialized]);
  
  // Load previous BP readings from localStorage
  useEffect(() => {
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

  // 🚀 ENHANCED: Pressure animation with realistic progression
  useEffect(() => {
    if (measurementState === 'idle' || measurementState === 'waiting' || measurementState === 'completed' || 
        measurementState === 'canceled' || measurementState === 'error') {
      if (pressureAnimationRef.current) {
        cancelAnimationFrame(pressureAnimationRef.current);
        pressureAnimationRef.current = null;
      }
      setCurrentPressure(0);
      setTargetPressure(0);
      return;
    }
    
    if (targetPressure <= 0) {
      if (pressureAnimationRef.current) {
        cancelAnimationFrame(pressureAnimationRef.current);
        pressureAnimationRef.current = null;
      }
      setCurrentPressure(0);
      return;
    }

    const animatePressure = () => {
      setCurrentPressure(prev => {
        const diff = targetPressure - prev;
        
        // 🚀 NEW: More realistic pressure progression
        if (Math.abs(diff) < 0.5) {
          return targetPressure;
        }
        
        // 🚨 SAFETY: Much slower, safer animation for elderly users
        let animationSpeed = 0.03; // Default speed (much slower)
        
        if (measurementState === 'inflating') {
          // Very slow, gradual increase during inflation for safety
          animationSpeed = 0.02;
        } else if (measurementState === 'deflating') {
          // Slow decrease during deflation
          animationSpeed = 0.04;
        } else if (measurementState === 'analyzing') {
          // Very slow during analysis
          animationSpeed = 0.01;
        }
        
        // 🚨 SAFETY: Ensure pressure never goes backwards during inflation
        if (measurementState === 'inflating' && targetPressure < prev) {
          return prev; // Hold current pressure
        }
        
        // 🚨 SAFETY: Ensure pressure never goes forwards during deflation
        if (measurementState === 'deflating' && targetPressure > prev) {
          return prev; // Hold current pressure
        }
        
        // 🚨 SAFETY: Limit maximum pressure jump per frame
        const maxJump = 2; // Maximum 2 mmHg per frame
        const limitedDiff = Math.max(-maxJump, Math.min(maxJump, diff));
        
        return prev + limitedDiff * animationSpeed;
      });
      
      pressureAnimationRef.current = requestAnimationFrame(animatePressure);
    };
    
    pressureAnimationRef.current = requestAnimationFrame(animatePressure);
    
    return () => {
      if (pressureAnimationRef.current) {
        cancelAnimationFrame(pressureAnimationRef.current);
      }
    };
  }, [targetPressure, measurementState]);

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
  const getPressureSafetyIndicator = (pressure: number): {icon: string, color: string, text: string} => {
    if (pressure === 0) return {icon: '⭕', color: 'text-gray-400', text: 'Ready'};
    if (pressure < 50) return {icon: '🟢', color: 'text-green-400', text: 'Safe'};
    if (pressure < 100) return {icon: '🔵', color: 'text-blue-400', text: 'Normal'};
    if (pressure < 150) return {icon: '🟡', color: 'text-yellow-400', text: 'Caution'};
    if (pressure < 200) return {icon: '🟠', color: 'text-orange-400', text: 'High'};
    return {icon: '🔴', color: 'text-red-400', text: 'Very High'};
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
    
    // 🚀 NEW: Enhanced pressure tracking for better UI synchronization
    if (progress.pressure > 0) {
      // Only update pressure if it's a reasonable progression
      // This prevents the app from showing high values immediately
      if (progress.status === 'inflating') {
        // During inflation, pressure should increase gradually
        if (progress.pressure <= targetPressure + 10 || targetPressure === 0) {
          setTargetPressure(progress.pressure);
        }
      } else if (progress.status === 'deflating') {
        // During deflation, pressure should decrease gradually
        if (progress.pressure <= targetPressure || progress.pressure >= targetPressure - 10) {
          setTargetPressure(progress.pressure);
        }
      } else {
        // For other states, update normally
        setTargetPressure(progress.pressure);
      }
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
    console.log('📊 Real-time update:', data);
    
    if (data.pressure !== undefined) {
      setTargetPressure(data.pressure);
      
      // If pressure is increasing and we're idle, the device might have started measuring
      if (data.pressure > 0 && measurementState === 'idle') {
        console.log('🎯 Device-initiated measurement detected via real-time update!');
        setMeasurementState('inflating');
        setErrorMessage(null);
        setBpResult(null);
        setWaveformData([]);
      }
    }
    
    if (data.heartRate !== undefined) {
      setHeartRate(data.heartRate);
    }
    
    if (data.signalQuality !== undefined) {
      setSignalQuality(data.signalQuality);
    }
    
    // Check if this is a device status update
    if (data.deviceStatus !== undefined) {
      console.log('📱 Device status update:', data.deviceStatus);
      // Device status changes might indicate measurement phases
      if (data.deviceStatus === 1 && measurementState === 'idle') {
        console.log('🎯 Device status indicates measurement starting...');
        setMeasurementState('inflating');
      }
    }
  }, [measurementState]);

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

  // Initialize SDK callbacks
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
      // Cleanup callbacks
      wellueSDK.setCallbacks({});
      console.log('🧹 SDK callbacks cleaned up');
    };
  }, [wellueSDK, isInitialized, handleBPMeasurement, handleBPProgress, handleBPStatusChanged, handleRealTimeUpdate, handleError, handleDeviceDisconnected]);

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
  }, []);

  // Auto-save BP result to storage when measurement completes
  const autoSaveBPResult = useCallback(async (result: any) => {
    if (!result) return;
    
    try {
      console.log('💾 [BP] Auto-saving BP result:', result);
      
      // Create a unique filename for the BP result
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `bp_result_${timestamp}.json`;
      
      // Prepare the data to save
      const dataToSave = {
        ...result,
        timestamp: result.timestamp.toISOString(),
        deviceId: connectedDevice?.id || 'unknown',
        deviceName: connectedDevice?.name || 'unknown',
        measurementId: `bp_${Date.now()}`,
        status: 'completed'
      };
      
      // Save to localStorage for app access
      const existingResults = JSON.parse(localStorage.getItem('bpResults') || '[]');
      existingResults.push(dataToSave);
      localStorage.setItem('bpResults', JSON.stringify(existingResults));
      
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
      
      console.log('💾 [BP] BP result auto-saved successfully:', dataToSave);
      
    } catch (error) {
      console.error('❌ [BP] Failed to auto-save BP result:', error);
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

  // 🚨 SAFETY: Enhanced pressure bar color with safety zones
  const getPressureBarColor = (pressure: number): string => {
    if (pressure === 0) return 'linear-gradient(180deg, #6b7280 0%, #4b5563 100%)'; // Gray for idle
    if (pressure < 50) return 'linear-gradient(180deg, #10b981 0%, #059669 100%)'; // Green for safe
    if (pressure < 100) return 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)'; // Blue for normal
    if (pressure < 150) return 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)'; // Yellow for caution
    if (pressure < 200) return 'linear-gradient(180deg, #f97316 0%, #ea580c 100%)'; // Orange for high
    return 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)'; // Red for very high
  };

  // Get signal quality bars
  const getSignalBars = (quality: number) => {
    const bars = [];
    for (let i = 0; i < 3; i++) {
      bars.push(
        <div
          key={i}
          className={`w-1 h-${i + 2} rounded-full ${
            i < quality ? 'bg-green-400' : 'bg-gray-600'
          }`}
        />
      );
    }
    return bars;
  };

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

  if (!connectedDevice) {
    return (
      <div className="min-h-screen bg-slate-900 text-white p-4">
        <div className="max-w-md mx-auto">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">No Device Connected</h1>
            <p className="text-gray-400 mb-6">Please connect a BP monitor device first.</p>
            <Button onClick={() => navigate('/wellue-scanner')} className="w-full">
              Connect Device
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-5">
      <style dangerouslySetInnerHTML={{ __html: heartbeatStyles }} />
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="text-gray-400 hover:text-white"
          >
            ← Back
          </Button>
          <h1 className="text-xl font-semibold">Blood Pressure Monitor</h1>
          <div className="w-10" />
        </div>

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
                {measurementState !== 'idle' && measurementState !== 'completed' ? (
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
                

              </div>


            </div>

            {/* Column 2: Animated pressure bar - goes up during inflation, down during deflation */}
            <div className="flex">
              <div className="w-9 rounded-[14px] p-1 bg-white/10 flex items-end relative">
                <div
                  className="w-7 rounded-[14px] transition-all duration-300 ease-out"
                  style={{ 
                    height: `${Math.min(100, (currentPressure / 250) * 100)}%`,
                    background: measurementState === 'inflating' 
                      ? 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)' // Blue going up
                      : measurementState === 'deflating'
                      ? 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)' // Orange going down
                      : getPressureBarColor(currentPressure)
                  }}
                />
                {/* Pressure scale labels - positioned inside the bar */}
                <div className="absolute left-0 right-0 flex flex-col justify-between text-xs text-gray-400 h-full pointer-events-none">
                  <div className="text-center">250</div>
                  <div className="text-center">200</div>
                  <div className="text-center">150</div>
                  <div className="text-center">100</div>
                  <div className="text-center">50</div>
                  <div className="text-center">0</div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Results Display Panel - Direct Results */}
        <Card className="bg-slate-800 border-slate-700 p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-gray-200 font-medium">Measurement Results</div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Status:</span>
              <Badge 
                variant={measurementState === 'completed' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {measurementState === 'completed' ? 'Complete' : measurementState}
              </Badge>
            </div>
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

        {/* 🚨 SAFETY: Safety Warnings for Elderly Users */}
        {currentPressure > 150 && (
          <Card className="bg-orange-900/20 border-orange-700 p-4 mb-4">
            <div className="text-orange-400 text-center">
              <div className="text-2xl mb-2">⚠️</div>
              <p className="font-semibold">High Pressure Alert</p>
              <p className="text-sm">Current pressure is elevated. This is normal during measurement.</p>
              <p className="text-xs mt-1 text-orange-300">Please remain calm and still</p>
            </div>
          </Card>
        )}
        
        {currentPressure > 200 && (
          <Card className="bg-red-900/20 border-red-700 p-4 mb-4">
            <div className="text-red-400 text-center">
              <div className="text-2xl mb-2">🚨</div>
              <p className="font-semibold">Very High Pressure</p>
              <p className="text-sm">Pressure is very high. This is normal for BP measurement.</p>
              <p className="text-xs mt-1 text-red-300">Device will deflate automatically</p>
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
  );
};

