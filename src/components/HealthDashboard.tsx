import React, { useEffect, useRef, useState } from 'react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Video, Phone, MessageSquare, FileText, Siren, LayoutGrid, BarChart2, Droplets, Heart, Wind, User, LogOut, Loader2, Activity, Thermometer, Users, Bluetooth, Wifi, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useHealthData, HealthMetric } from '@/hooks/useHealthData';
import { useDevice } from '@/contexts/DeviceContext';

// Icon mapping for different health metrics
const getMetricIcon = (name: string) => {
  switch (name.toLowerCase()) {
    case 'blood sugar':
    case 'blood glucose':
      return Droplets;
    case 'blood pressure':
      return Heart;
    case 'heart rate':
    case 'ecg':
      return Activity;
    case 'oxygen level':
    case 'spo2':
      return Wind;
    case 'temperature':
      return Thermometer;
    default:
      return Heart;
  }
};

// Reusable Health Metric Card Component
const HealthMetricCard = ({ metric, onClick }: { metric: HealthMetric, onClick: () => void }) => {
  const { name, value, unit, status, color, chartData } = metric;
  const Icon = getMetricIcon(name);

  return (
    <div
      className="bg-[#1E1E1E] rounded-2xl p-4 flex flex-col justify-between h-full transition-all duration-200 hover:bg-[#252525] cursor-pointer"
      onClick={onClick}
    >
      <div>
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2 text-gray-400">
            <Icon className="w-5 h-5" />
            <span className="font-semibold text-sm">{name}</span>
          </div>
          <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ color, backgroundColor: `${color}20` }}>
            {status}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <div>
            <span className="text-4xl font-bold">{value.split('/')[0]}</span>
            {value.split('/')[1] && <span className="text-2xl font-bold text-gray-400">/{value.split('/')[1]}</span>}
            <span className="text-gray-400 ml-1.5 text-sm">{unit}</span>
          </div>
          <div className="relative w-16 h-16">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-gray-700"
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke={color}
                strokeWidth="3"
                strokeDasharray={status === 'Low' ? "65, 100" : "85, 100"}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
          </div>
        </div>
      </div>
      <div className="h-8 flex items-end gap-1 mt-3">
        {chartData.map((height, index) => (
          <div
            key={index}
            className="w-full rounded-sm transition-all duration-300 hover:opacity-80"
            style={{
              height: `${height / 1.5}%`,
              backgroundColor: index < 4 ? color : '#4A4A4A'
            }}
          ></div>
        ))}
      </div>
    </div>
  );
};

// Main Dashboard Component
export const HealthDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { devices, metrics, loading, error } = useHealthData();
  const { 
    connectedDevice, 
    bluetoothEnabled, 
    isInitialized, 
    error: deviceError,
    wellueSDK,
    startScan,
    stopScan,
    availableDevices,
    connectToDevice
  } = useDevice();

  // In-app stored file viewer state (supports both BP (1) and ECG (2))
  type StoredItem = {
    fileName: string;
    fileType?: number; // 1: BP, 2: ECG
    // ECG fields
    sampleRate?: number;
    recordingTimeSec?: number;
    // Common fields
    measureTimeSec?: number;
    diagnosis?: string;
    mvPerCount?: number;
    waveformCounts?: number[]; // ECG only
    base64?: string; // raw content when available (BP or ECG)
  };
  const [storedFilesInApp, setStoredFilesInApp] = useState<StoredItem[]>([]);
  const [isFetchingStored, setIsFetchingStored] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'ecg' | 'bp'>('all');
  const [savedFilesFromPhone, setSavedFilesFromPhone] = useState<StoredItem[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const fetchStoredECG = async () => {
    try {
      if (!connectedDevice?.id) {
        toast({ title: 'No Device Connected', description: 'Connect BP2 to fetch stored ECG data.', variant: 'destructive' });
        return;
      }

      console.log('🔍 Fetching BP2 stored file list...');
      setIsFetchingStored(true);
      const files = await wellueSDK.getStoredFiles(connectedDevice.id);
      const fileEntries: Array<{ fileName: string; fileType?: number }> = (files || []).map((f: any) =>
        typeof f === 'string' ? { fileName: f } : { fileName: f.fileName || String(f), fileType: f.fileType }
      );

      console.log('📁 BP2 files:', fileEntries);
      if (!fileEntries.length) {
        toast({ title: 'No Stored ECG Measurements', description: 'Device reported 0 files.', variant: 'default' });
        setIsFetchingStored(false);
        return;
      }

      // Read all files; we will keep both BP (type 1) and ECG (type 2)
      const listToRead = fileEntries;
      const totalCount = listToRead.length;

      toast({ title: 'Fetching Stored ECG…', description: `Reading ${totalCount} file(s) from device…`, variant: 'default' });

      let success = 0;
      const collected: StoredItem[] = [];
      for (const entry of listToRead) {
        try {
          console.log('📖 Reading file:', entry.fileName);
          const res: any = await wellueSDK.readStoredFile(connectedDevice.id, entry.fileName);
          console.log('📦 Raw response for', entry.fileName, ':', res);
          
          const fileTypeNum = typeof res?.fileType === 'number' ? res.fileType : Number(res?.fileType);
          
          // Parse waveform data - convert base64 to array if needed
          let waveformCounts: number[] | undefined;
          if (res?.waveformCounts && Array.isArray(res.waveformCounts)) {
            waveformCounts = res.waveformCounts;
          } else if (res?.fileContent && res.fileType === 2) {
            // For ECG files, try to parse the base64 content if no waveformCounts
            try {
              const binaryString = atob(res.fileContent);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              // Convert bytes to waveform counts (assuming 16-bit signed integers)
              waveformCounts = [];
              for (let i = 0; i < bytes.length - 1; i += 2) {
                const value = (bytes[i + 1] << 8) | bytes[i];
                waveformCounts.push(value > 32767 ? value - 65536 : value);
              }
            } catch (e) {
              console.warn('⚠️ Failed to parse base64 content for ECG:', e);
            }
          }
          
          // Build payload with proper data extraction
          const payload: StoredItem = {
            fileName: entry.fileName,
            fileType: fileTypeNum,
            sampleRate: res?.sampleRate || res?.samplingRate,
            recordingTimeSec: res?.recordingTimeSec || res?.recordingTime,
            measureTimeSec: res?.measureTimeSec || res?.measureTime,
            diagnosis: res?.diagnosis,
            mvPerCount: res?.mvPerCount || 0.003098,
            waveformCounts: waveformCounts,
            base64: res?.fileContent,
          };

          console.log('📊 Parsed payload for', entry.fileName, ':', {
            type: payload.fileType,
            sampleRate: payload.sampleRate,
            duration: payload.recordingTimeSec || payload.measureTimeSec,
            waveformLength: payload.waveformCounts?.length || 0,
            hasBase64: !!payload.base64
          });

          // Save to Downloads for external access as well
          const json = JSON.stringify(payload, null, 2);
          const safeName = entry.fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
          const outPath = `bp2_ecg_${Date.now()}_${safeName}.json`;
          await Filesystem.writeFile({ path: outPath, data: json, directory: Directory.Documents });
          console.log('💾 Saved:', outPath);
          success++;
          collected.push(payload);
        } catch (e) {
          console.warn('⚠️ Failed reading/saving', entry.fileName, e);
        }
      }

      setStoredFilesInApp(collected);
      setSelectedIdx(collected.length ? 0 : null);
      const ecgCount = collected.filter(f => f.fileType === 2).length;
      const bpCount = collected.filter(f => f.fileType === 1).length;
      toast({ title: 'Stored Data Fetch Complete', description: `Loaded ${ecgCount} ECG and ${bpCount} BP out of ${totalCount} entries.`, variant: 'default' });
    } catch (err) {
      console.error('❌ Fetch stored ECG failed:', err);
      toast({ title: 'Fetch Failed', description: 'Unable to fetch stored ECG data.', variant: 'destructive' });
    } finally {
      setIsFetchingStored(false);
    }
  };

  // Load saved JSON files from phone Documents folder
  const loadSavedFilesFromPhone = async () => {
    try {
      setIsLoadingSaved(true);
      console.log('📱 Loading saved files from phone Documents...');
      
      // List all files in Documents directory
      const result = await Filesystem.readdir({
        path: '',
        directory: Directory.Documents
      });
      
      console.log('📁 Documents folder contents:', result.files);
      
      // Filter for our BP2/ECG JSON files
      const jsonFiles = result.files.filter((file: any) => 
        file.name && (file.name.startsWith('bp2_ecg_') || file.name.includes('bp2') || file.name.includes('ecg'))
      );
      
      console.log('📄 Found JSON files:', jsonFiles);
      
      if (jsonFiles.length === 0) {
        toast({ title: 'No Saved Files', description: 'No BP2/ECG JSON files found in Documents folder.', variant: 'default' });
        return;
      }
      
      const loadedFiles: StoredItem[] = [];
      
      for (const file of jsonFiles) {
        try {
          console.log('📖 Reading saved file:', file.name);
          const fileContent = await Filesystem.readFile({
            path: file.name,
            directory: Directory.Documents
          });
          
          const parsedData = JSON.parse(fileContent.data as string);
          console.log('📊 Parsed saved file:', file.name, parsedData);
          
          // Ensure the data has the right structure
          const storedItem: StoredItem = {
            fileName: parsedData.fileName || file.name,
            fileType: parsedData.fileType,
            sampleRate: parsedData.sampleRate,
            recordingTimeSec: parsedData.recordingTimeSec,
            measureTimeSec: parsedData.measureTimeSec,
            diagnosis: parsedData.diagnosis,
            mvPerCount: parsedData.mvPerCount || 0.003098,
            waveformCounts: parsedData.waveformCounts,
            base64: parsedData.base64,
          };
          
          loadedFiles.push(storedItem);
        } catch (e) {
          console.warn('⚠️ Failed to read/parse saved file:', file.name, e);
        }
      }
      
      setSavedFilesFromPhone(loadedFiles);
      setStoredFilesInApp(loadedFiles); // Replace the current stored files with loaded ones
      setSelectedIdx(loadedFiles.length > 0 ? 0 : null);
      
      const ecgCount = loadedFiles.filter(f => f.fileType === 2).length;
      const bpCount = loadedFiles.filter(f => f.fileType === 1).length;
      
      toast({ 
        title: 'Files Loaded from Phone', 
        description: `Loaded ${ecgCount} ECG and ${bpCount} BP files from Documents folder.`, 
        variant: 'default' 
      });
      
    } catch (err) {
      console.error('❌ Failed to load saved files from phone:', err);
      toast({ 
        title: 'Load Failed', 
        description: 'Unable to load saved files from phone Documents folder.', 
        variant: 'destructive' 
      });
    } finally {
      setIsLoadingSaved(false);
    }
  };

  // Draw preview for selected file
  useEffect(() => {
    if (selectedIdx == null) return;
    const file = storedFilesInApp[selectedIdx];
    if (!file) return;
    
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = 320;
    const cssH = 140;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    // @ts-ignore
    if (typeof ctx.resetTransform === 'function') ctx.resetTransform();
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, cssW, cssH);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < cssW; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cssH); ctx.stroke(); }
    for (let y = 0; y < cssH; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cssW, y); ctx.stroke(); }

    // Get waveform data - try waveformCounts first, then parse base64 if needed
    let waveformData: number[] = [];
    if (file.waveformCounts && file.waveformCounts.length > 0) {
      waveformData = file.waveformCounts;
    } else if (file.base64 && file.fileType === 2) {
      // Try to parse base64 content for ECG files
      try {
        const binaryString = atob(file.base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        // Convert bytes to waveform data (assuming 16-bit signed integers)
        for (let i = 0; i < bytes.length - 1; i += 2) {
          const value = (bytes[i + 1] << 8) | bytes[i];
          waveformData.push(value > 32767 ? value - 65536 : value);
        }
      } catch (e) {
        console.warn('⚠️ Failed to parse base64 content for ECG:', e);
      }
    }

    if (waveformData.length === 0) {
      // No waveform data available
      ctx.fillStyle = '#666';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('No waveform data available', cssW / 2, cssH / 2);
      return;
    }

    // Scale data
    const mvPerCount = file.mvPerCount || 0.003098;
    const values = waveformData.slice(0, file.sampleRate ? Math.min(waveformData.length, file.sampleRate * 4) : 2000)
      .map(c => (c as number) * mvPerCount);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const mid = (minV + maxV) / 2;
    const amp = Math.max(0.5, maxV - minV);

    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < values.length; i++) {
      const x = (i / (values.length - 1)) * cssW;
      const y = cssH * 0.5 - ((values[i] - mid) / amp) * (cssH * 0.4);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [selectedIdx, storedFilesInApp]);

  const handleLogout = () => {
    navigate('/');
  };

  const handleChatClick = () => {
    navigate('/chat');
  };

  const handleViewReports = () => {
    navigate('/reports');
  };

  const handleMetricClick = (metricName: string, deviceId?: string) => {
    const device = devices.find(d => d.id === deviceId);
    toast({
      title: "Device Information",
      description: device
        ? `${metricName} from ${device.name} (${device.model})`
        : `${metricName} monitoring data`,
    });
  };

  // Show loading state
  if (loading) {
    return (
      <div className="bg-[#101010] min-h-screen text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-gray-400">Loading health data...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="bg-[#101010] min-h-screen text-white flex items-center justify-center p-4">
        <div className="max-w-sm mx-auto text-center">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6">
            <Siren className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-400 mb-2">Connection Error</h2>
            <p className="text-gray-300 mb-4">{error}</p>
            <p className="text-sm text-gray-400">
              Make sure the backend server is running on port 3000
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-all duration-200"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#101010] min-h-screen text-white p-4 font-inter">
      <div className="max-w-sm mx-auto">
        {/* Status Bar Spacing */}
        <div className="h-6"></div>

        {/* Header */}
        <header className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <LayoutGrid size={24} className="text-gray-400" />
            <h1 className="text-2xl font-bold">Dashboard</h1>
          </div>
          <button
            onClick={handleLogout}
            className="bg-gray-700/80 hover:bg-gray-600 p-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <LogOut size={20} />
          </button>
        </header>

        {/* Device Connection Status */}
        <div className="mb-4">
          <div className="bg-[#1E1E1E] rounded-2xl p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white">Device Status</h3>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${bluetoothEnabled ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-gray-400">
                  {bluetoothEnabled ? 'Bluetooth On' : 'Bluetooth Off'}
                </span>
              </div>
            </div>
            
            {connectedDevice ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-green-500 p-2 rounded-full">
                    <Bluetooth className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{connectedDevice.name}</p>
                    <p className="text-sm text-gray-400">{connectedDevice.model}</p>
                    {connectedDevice.battery !== undefined && (
                      <p className="text-xs text-gray-500">Battery: {connectedDevice.battery}%</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm text-green-400">Connected</span>
                  <button
                    onClick={() => navigate('/live-bp-monitor')}
                    className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold py-1 px-3 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 ml-2"
                  >
                    BP Monitor
                  </button>
                  <button
                    onClick={fetchStoredECG}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold py-1 px-3 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 ml-1"
                    title="Fetch stored ECG files from device and save to Documents"
                  >
                    Fetch Stored ECG
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-gray-500 p-2 rounded-full">
                    <WifiOff className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-400">No Device Connected</p>
                    <p className="text-sm text-gray-500">Connect your BP monitor to start</p>
                  </div>
                </div>
                <div className="flex gap-2">
                <button
                    onClick={async () => {
                      try {
                        // Try to connect to last known device first
                        const lastDeviceId = localStorage.getItem('lastConnectedDevice');
                        if (lastDeviceId) {
                          console.log('🔄 Attempting to connect to last known device:', lastDeviceId);
                          await wellueSDK.connect(lastDeviceId);
                        } else {
                          // No last known device, start scanning
                          console.log('🔍 Starting scan to find devices...');
                          await startScan();
                          setTimeout(() => {
                            stopScan();
                            if (availableDevices.length > 0) {
                              // Auto-connect to first available device
                              connectToDevice(availableDevices[0]);
                            }
                          }, 3000);
                        }
                      } catch (error) {
                        console.error('Failed to connect:', error);
                      }
                    }}
                  className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  Connect
                </button>
                </div>
              </div>
            )}
            
            {/* Show device errors if any */}
            {deviceError && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Siren className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-400 font-medium">Device Error</span>
                </div>
                <p className="text-sm text-red-300 mt-1">{deviceError}</p>
              </div>
            )}
          </div>
        </div>

        {/* Patient Card */}
        <div className="bg-[#1E1E1E] rounded-2xl mb-6 overflow-hidden transition-all duration-200 hover:bg-[#252525]">
          <div className="relative">
            <img
              src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=2938&auto=format&fit=crop"
              alt="Doctor in scrubs"
              className="w-full h-44 object-cover object-center"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=2940&auto=format&fit=crop';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            <button className="absolute top-4 right-4 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-3 rounded-lg flex items-center gap-2 text-sm transition-all duration-200 hover:scale-105 active:scale-95">
              <Video size={16} />
              <span>Connect</span>
            </button>
          </div>
          <div className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500 p-3 rounded-full">
                  <User className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Kunal Singh</h2>
                  <p className="text-gray-400 text-xs">ID: #PT-7842 • Age: 42</p>
                  <p className="text-gray-300 mt-2 text-sm">
                    <span className="font-semibold">Condition:</span> Full body Paralysed
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <button className="bg-gray-700/80 hover:bg-gray-600 p-3 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95">
                  <Phone size={20} />
                </button>
                <button
                  onClick={handleChatClick}
                  className="bg-gray-700/80 hover:bg-gray-600 p-3 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  <MessageSquare size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Live Health Overview Section */}
        <div className="mb-4">
          <h3 className="text-xl font-bold mb-3">Live Health Overview</h3>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/patients')}
              className="bg-purple-500/90 text-white text-xs font-semibold py-2 px-3 rounded-lg flex items-center gap-2 hover:bg-purple-600 transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <Users size={14} />
              <span>Patients</span>
            </button>
            <button
              onClick={() => navigate('/devices')}
              className="bg-blue-500/90 text-white text-xs font-semibold py-2 px-3 rounded-lg flex items-center gap-2 hover:bg-blue-600 transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <Activity size={14} />
              <span>Devices</span>
            </button>
            <button className="bg-green-500/90 text-white text-xs font-semibold py-2 px-3 rounded-lg flex items-center gap-2 hover:bg-green-600 transition-all duration-200 hover:scale-105 active:scale-95">
              <BarChart2 size={14} />
              <span>Analytics</span>
            </button>
          </div>
        </div>

        {/* In-App Stored ECG Viewer */}
        <div className="mb-4">
          <div className="bg-[#1E1E1E] rounded-2xl p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-white">Stored Files (Device + Phone)</h3>
              <div className="text-xs text-gray-400">
                {isFetchingStored ? 'Loading…' : storedFilesInApp.length ? `${storedFilesInApp.length} loaded` : 'None loaded'}
              </div>
            </div>
            <div className="flex gap-2 mb-3">
              <button
                onClick={fetchStoredECG}
                disabled={isFetchingStored}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50"
              >
                {isFetchingStored ? 'Fetching...' : 'Fetch from Device'}
              </button>
              <button
                onClick={loadSavedFilesFromPhone}
                disabled={isLoadingSaved}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50"
              >
                {isLoadingSaved ? 'Loading...' : 'Load Saved Files'}
              </button>
            </div>

            {storedFilesInApp.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {/* Filter controls */}
                  <div className="flex items-center gap-2 mr-2">
                    <button onClick={() => setFilterType('all')} className={`text-xs px-2 py-1 rounded ${filterType==='all'?'bg-gray-600 text-white':'bg-gray-800 text-gray-300'}`}>All</button>
                    <button onClick={() => setFilterType('ecg')} className={`text-xs px-2 py-1 rounded ${filterType==='ecg'?'bg-blue-600 text-white':'bg-gray-800 text-gray-300'}`}>ECG</button>
                    <button onClick={() => setFilterType('bp')} className={`text-xs px-2 py-1 rounded ${filterType==='bp'?'bg-green-600 text-white':'bg-gray-800 text-gray-300'}`}>BP</button>
                  </div>
                  {storedFilesInApp.filter(f => filterType==='all' || (filterType==='ecg' ? f.fileType===2 : f.fileType===1)).map((f, i) => (
                    <button
                      key={`${f.fileName}-${i}`}
                      onClick={() => setSelectedIdx(storedFilesInApp.findIndex(sf => sf.fileName===f.fileName && sf.fileType===f.fileType))}
                      className={`text-xs px-3 py-1.5 rounded-lg border ${selectedIdx === i ? 'bg-blue-600 border-blue-500 text-white' : 'bg-transparent border-gray-700 text-gray-300'} whitespace-nowrap`}
                      title={f.fileName}
                    >
                      {f.fileType===2 ? 'ECG' : f.fileType===1 ? 'BP' : 'UNK'} • {f.fileName}
                    </button>
                  ))}
                </div>

                {selectedIdx != null && storedFilesInApp[selectedIdx] && (
                  <div className="grid grid-cols-1 gap-3">
                    <div className="text-sm text-gray-300">
                      <div><span className="text-gray-400">File:</span> {storedFilesInApp[selectedIdx].fileName}</div>
                      <div><span className="text-gray-400">Type:</span> {storedFilesInApp[selectedIdx].fileType === 2 ? 'ECG' : storedFilesInApp[selectedIdx].fileType === 1 ? 'BP' : storedFilesInApp[selectedIdx].fileType ?? '-'}</div>
                      <div><span className="text-gray-400">Sample Rate:</span> {storedFilesInApp[selectedIdx].sampleRate ? `${storedFilesInApp[selectedIdx].sampleRate} Hz` : 'Not available'}</div>
                      <div><span className="text-gray-400">Duration:</span> {storedFilesInApp[selectedIdx].recordingTimeSec || storedFilesInApp[selectedIdx].measureTimeSec ? `${storedFilesInApp[selectedIdx].recordingTimeSec || storedFilesInApp[selectedIdx].measureTimeSec} seconds` : 'Not available'}</div>
                      <div><span className="text-gray-400">Diagnosis:</span> {storedFilesInApp[selectedIdx].diagnosis || 'Not available'}</div>
                      <div><span className="text-gray-400">Waveform Data:</span> {storedFilesInApp[selectedIdx].waveformCounts ? `${storedFilesInApp[selectedIdx].waveformCounts.length} samples` : 'Not available'}</div>
                      <div><span className="text-gray-400">Raw Content:</span> {storedFilesInApp[selectedIdx].base64 ? `${Math.round(storedFilesInApp[selectedIdx].base64.length * 0.75)} bytes` : 'Not available'}</div>
                    </div>
                    {storedFilesInApp[selectedIdx].fileType === 2 ? (
                      <div className="rounded-lg overflow-hidden border border-gray-700 w-full">
                        <canvas ref={previewCanvasRef} className="block" />
                      </div>
                    ) : (
                      <div className="rounded-lg border border-gray-700 p-3 text-sm text-gray-300">
                        BP Record preview not supported in graph yet. File saved to Documents for analysis.
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-400">No stored files loaded yet. Connect device and press "Fetch from Device" or "Load Saved Files" to view previously saved data.</div>
            )}
          </div>
        </div>

        {/* Health Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {metrics.length > 0 ? (
            metrics.map((metric) => (
              <HealthMetricCard
                key={metric.id}
                metric={metric}
                onClick={() => handleMetricClick(metric.name, metric.deviceId)}
              />
            ))
          ) : (
            <div className="col-span-2 bg-[#1E1E1E] rounded-2xl p-8 text-center">
              <Activity className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-400 mb-2">No Devices Connected</h3>
              <p className="text-sm text-gray-500">
                Connect your medical devices to start monitoring your health metrics
              </p>
            </div>
          )}
        </div>

        {/* Bottom Action Buttons */}
        <div className="grid grid-cols-2 gap-4 pb-8">
          <button
            onClick={handleViewReports}
            className="bg-[#4A37A8] hover:bg-[#5A47B8] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <FileText size={20} />
            <span>View Reports</span>
          </button>
          <button className="bg-[#D93B3B] hover:bg-[#E94B4B] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 hover:scale-105 active:scale-95">
            <Siren size={20} />
            <span>Emergency SOS</span>
          </button>
        </div>
      </div>
    </div>
  );
};
