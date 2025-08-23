import React, { useEffect, useRef, useState } from "react";
import { Filesystem, Directory } from "@capacitor/filesystem";
import {
  Video,
  Phone,
  MessageSquare,
  FileText,
  Siren,
  LayoutGrid,
  BarChart2,
  Droplets,
  Heart,
  Wind,
  User,
  LogOut,
  Loader2,
  Activity,
  Thermometer,
  Users,
  Bluetooth,
  BluetoothOff,
  Wifi,
  WifiOff,
  BarChart3,
  ChevronUp,
  ChevronDown,
  Stethoscope,
  Settings,
  Monitor,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { HealthMetric } from "@/hooks/useHealthData";
import { useDevice } from "@/contexts/DeviceContext";
import { useRealTimeVitals } from "@/hooks/useRealTimeVitals";
import { DoctorInfoCard } from "./DoctorInfoCard";
import { EmergencyButton } from "./EmergencyButton";

// Icon mapping for different health metrics
const getMetricIcon = (name: string) => {
  switch (name.toLowerCase()) {
    case "blood sugar":
    case "blood glucose":
      return Droplets;
    case "blood pressure":
      return Heart;
    case "heart rate":
    case "ecg":
      return Activity;
    case "oxygen level":
    case "spo2":
      return Wind;
    case "temperature":
      return Thermometer;
    default:
      return Heart;
  }
};

// Reusable Health Metric Card Component
const HealthMetricCard = ({
  metric,
  onClick,
}: {
  metric: HealthMetric;
  onClick: () => void;
}) => {
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
          <span
            className="text-xs font-bold px-2 py-1 rounded-full"
            style={{ color, backgroundColor: `${color}20` }}
          >
            {status}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <div>
            <span className="text-4xl font-bold">{value.split("/")[0]}</span>
            {value.split("/")[1] && (
              <span className="text-2xl font-bold text-gray-400">
                /{value.split("/")[1]}
              </span>
            )}
            <span className="text-gray-400 ml-1.5 text-sm">{unit}</span>
          </div>
          <div className="relative w-16 h-16">
            <svg
              className="w-full h-full transform -rotate-90"
              viewBox="0 0 36 36"
            >
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
                strokeDasharray={status === "Low" ? "65, 100" : "85, 100"}
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
              backgroundColor: index < 4 ? color : "#4A4A4A",
            }}
          ></div>
        ))}
      </div>
    </div>
  );
};

// Utility function to calculate age from date of birth
const calculateAge = (dateOfBirth: string | undefined): number | null => {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
};

// Main Dashboard Component
export const HealthDashboard = () => {
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { logout } = useAuth();

  // DEBUG: Add console log to verify this component is rendering
  console.log(
    "🔍 [DEBUG] HealthDashboard component is rendering - version with arrow button and no Live Health Overview"
  );

  const { toast } = useToast();
  const {
    vitals,
    patientProfile,
    loading: vitalsLoading,
    error: vitalsError,
    getLatestReadings,
    addVitalSign,
  } = useRealTimeVitals();
  const {
    connectedDevice,
    bluetoothEnabled,
    isInitialized,
    error: deviceError,
    wellueSDK,
    startScan,
    stopScan,
    availableDevices,
    connectToDevice,
    manualInitializeSDK,
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
  const [filterType, setFilterType] = useState<"all" | "ecg" | "bp">("all");
  const [savedFilesFromPhone, setSavedFilesFromPhone] = useState<StoredItem[]>(
    []
  );
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("");
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [deviceStatusExpanded, setDeviceStatusExpanded] = useState(true);
  const [cameraConnected, setCameraConnected] = useState(false);
  const [cgmConnected, setCgmConnected] = useState(false);

  // DEBUG: Log the current state after declaration
  console.log("🔍 [DEBUG] deviceStatusExpanded state:", deviceStatusExpanded);

  // Auto-collapse device status when all three devices are connected
  useEffect(() => {
    // Check if all devices are connected/available
    const hasBP2Connected = connectedDevice?.name?.includes('BP2') || connectedDevice?.name?.includes('3049');
    const hasCGMConnected = cgmConnected;
    const hasCameraConnected = cameraConnected;
    
    if (hasBP2Connected && hasCGMConnected && hasCameraConnected && deviceStatusExpanded) {
      // Auto-collapse after a short delay to show the user all devices are connected
      const timer = setTimeout(() => {
        setDeviceStatusExpanded(false);
      }, 2000); // 2 second delay
      
      return () => clearTimeout(timer);
    }
  }, [connectedDevice, cgmConnected, cameraConnected, deviceStatusExpanded]);



  const fetchStoredECG = async () => {
    try {
      if (!connectedDevice?.id) {
        toast({
          title: "No Device Connected",
          description: "Connect BP2 to fetch stored ECG data.",
          variant: "destructive",
        });
        return;
      }

      console.log("🔍 Fetching BP2 stored file list...");
      setIsFetchingStored(true);
      const files = await wellueSDK.getStoredFiles(connectedDevice.id);
      const fileEntries: Array<{ fileName: string; fileType?: number }> = (
        files || []
      ).map((f: unknown) =>
        typeof f === "string"
          ? { fileName: f }
          : {
              fileName: (f as { fileName?: string }).fileName || String(f),
              fileType: (f as { fileType?: number }).fileType,
            }
      );

      console.log("📁 BP2 files:", fileEntries);
      if (!fileEntries.length) {
        toast({
          title: "No Stored ECG Measurements",
          description: "Device reported 0 files.",
          variant: "default",
        });
        setIsFetchingStored(false);
        return;
      }

      // Read all files; we will keep both BP (type 1) and ECG (type 2)
      const listToRead = fileEntries;
      const totalCount = listToRead.length;

      toast({
        title: "Fetching Stored ECG…",
        description: `Reading ${totalCount} file(s) from device…`,
        variant: "default",
      });

      let success = 0;
      const collected: StoredItem[] = [];
      for (const entry of listToRead) {
        try {
          console.log("📖 Reading file:", entry.fileName);
          const res = (await wellueSDK.readStoredFile(
            connectedDevice.id,
            entry.fileName
          )) as {
            fileType?: number;
            fileName?: string;
            waveformCounts?: number[];
            fileContent?: string;
            sampleRate?: number;
            recordingTimeSec?: number;
            measureTimeSec?: number;
            diagnosis?: string;
            mvPerCount?: number;
          };
          console.log("📦 Raw response for", entry.fileName, ":", res);

          const fileTypeNum =
            typeof res?.fileType === "number"
              ? res.fileType
              : Number(res?.fileType);

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
              console.warn("⚠️ Failed to parse base64 content for ECG:", e);
            }
          }

          // Build payload with proper data extraction
          const payload: StoredItem = {
            fileName: entry.fileName,
            fileType: fileTypeNum,
            sampleRate: res?.sampleRate,
            recordingTimeSec: res?.recordingTimeSec,
            measureTimeSec: res?.measureTimeSec,
            diagnosis: res?.diagnosis,
            mvPerCount: res?.mvPerCount || 0.003098,
            waveformCounts: waveformCounts,
            base64: res?.fileContent,
          };

          console.log("📊 Parsed payload for", entry.fileName, ":", {
            type: payload.fileType,
            sampleRate: payload.sampleRate,
            duration: payload.recordingTimeSec || payload.measureTimeSec,
            waveformLength: payload.waveformCounts?.length || 0,
            hasBase64: !!payload.base64,
          });

          // Save to Downloads for external access as well
          const json = JSON.stringify(payload, null, 2);
          const safeName = entry.fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
          const outPath = `bp2_ecg_${Date.now()}_${safeName}.json`;
          await Filesystem.writeFile({
            path: outPath,
            data: json,
            directory: Directory.Documents,
          });
          console.log("💾 Saved:", outPath);
          success++;
          collected.push(payload);
        } catch (e) {
          console.warn("⚠️ Failed reading/saving", entry.fileName, e);
        }
      }

      setStoredFilesInApp(collected);
      setSelectedIdx(collected.length ? 0 : null);
      const ecgCount = collected.filter((f) => f.fileType === 2).length;
      const bpCount = collected.filter((f) => f.fileType === 1).length;
      toast({
        title: "Stored Data Fetch Complete",
        description: `Loaded ${ecgCount} ECG and ${bpCount} BP out of ${totalCount} entries.`,
        variant: "default",
      });
    } catch (err) {
      console.error("❌ Fetch stored ECG failed:", err);
      toast({
        title: "Fetch Failed",
        description: "Unable to fetch stored ECG data.",
        variant: "destructive",
      });
    } finally {
      setIsFetchingStored(false);
    }
  };

  // Load saved JSON files from phone Documents folder
  const loadSavedFilesFromPhone = async () => {
    try {
      setIsLoadingSaved(true);
      console.log("📱 Loading saved files from phone Documents...");

      // List all files in Documents directory
      const result = await Filesystem.readdir({
        path: "",
        directory: Directory.Documents,
      });

      console.log("📁 Documents folder contents:", result.files);

      // Filter for our BP2/ECG JSON files
      const jsonFiles = result.files.filter(
        (file: { name?: string }) =>
          file.name &&
          (file.name.startsWith("bp2_ecg_") ||
            file.name.includes("bp2") ||
            file.name.includes("ecg"))
      );

      console.log("📄 Found JSON files:", jsonFiles);

      if (jsonFiles.length === 0) {
        toast({
          title: "No Saved Files",
          description: "No BP2/ECG JSON files found in Documents folder.",
          variant: "default",
        });
        return;
      }

      const loadedFiles: StoredItem[] = [];

      for (const file of jsonFiles) {
        try {
          console.log("📖 Reading saved file:", file.name);
          const fileContent = await Filesystem.readFile({
            path: file.name,
            directory: Directory.Documents,
          });

          const parsedData = JSON.parse(fileContent.data as string);
          console.log("📊 Parsed saved file:", file.name, parsedData);

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
          console.warn("⚠️ Failed to read/parse saved file:", file.name, e);
        }
      }

      setSavedFilesFromPhone(loadedFiles);
      setStoredFilesInApp(loadedFiles); // Replace the current stored files with loaded ones
      setSelectedIdx(loadedFiles.length > 0 ? 0 : null);

      const ecgCount = loadedFiles.filter((f) => f.fileType === 2).length;
      const bpCount = loadedFiles.filter((f) => f.fileType === 1).length;

      toast({
        title: "Files Loaded from Phone",
        description: `Loaded ${ecgCount} ECG and ${bpCount} BP files from Documents folder.`,
        variant: "default",
      });
    } catch (err) {
      console.error("❌ Failed to load saved files from phone:", err);
      toast({
        title: "Load Failed",
        description: "Unable to load saved files from phone Documents folder.",
        variant: "destructive",
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
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = 320;
    const cssH = 140;
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    if (typeof ctx.resetTransform === "function") ctx.resetTransform();
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, cssW, cssH);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x < cssW; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cssH);
      ctx.stroke();
    }
    for (let y = 0; y < cssH; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cssW, y);
      ctx.stroke();
    }

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
        console.warn("⚠️ Failed to parse base64 content for ECG:", e);
      }
    }

    if (waveformData.length === 0) {
      // No waveform data available
      ctx.fillStyle = "#666";
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.fillText("No waveform data available", cssW / 2, cssH / 2);
      return;
    }

    // Scale data
    const mvPerCount = file.mvPerCount || 0.003098;
    const values = waveformData
      .slice(
        0,
        file.sampleRate
          ? Math.min(waveformData.length, file.sampleRate * 4)
          : 2000
      )
      .map((c) => (c as number) * mvPerCount);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const mid = (minV + maxV) / 2;
    const amp = Math.max(0.5, maxV - minV);

    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < values.length; i++) {
      const x = (i / (values.length - 1)) * cssW;
      const y = cssH * 0.5 - ((values[i] - mid) / amp) * (cssH * 0.4);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [selectedIdx, storedFilesInApp]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.error("Logout failed", e);
    } finally {
      navigate("/");
    }
  };

  const handleChatClick = () => {
    navigate("/chat");
  };

  const handleViewReports = () => {
    // Navigate to reports page which will include stored files functionality
    navigate("/reports");
  };

  const handleMetricClick = (metricName: string, deviceId?: string) => {
    toast({
      title: "Vital Sign Information",
      description: deviceId
        ? `${metricName} from device ${deviceId}`
        : `${metricName} monitoring data`,
    });
  };

  // Show loading state
  if (vitalsLoading) {
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
  if (vitalsError) {
    return (
      <div className="bg-[#101010] min-h-screen text-white flex items-center justify-center p-4">
        <div className="max-w-sm mx-auto text-center">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6">
            <Siren className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-red-400 mb-2">
              Connection Error
            </h2>
            <p className="text-gray-300 mb-4">{vitalsError}</p>
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

  // Note: BP data will refresh automatically through existing mechanisms:
  // 1. Real-time Supabase subscription in useRealTimeVitals
  // 2. localStorage fallback in getLatestReadings
  // 3. Component re-renders when navigating back to dashboard

  return (
    <div className="bg-[#101010] min-h-screen text-white p-4 font-inter">
      <div className="max-w-sm mx-auto">
        {/* Status Bar Spacing */}
        <div className="h-6"></div>

        {/* Dashboard Header with User Profile */}
        <header className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <img
              src="/monitraq-logo.png"
              alt="Monitraq Logo"
              className="w-8 h-8 object-contain"
            />
            <h1 className="text-2xl font-bold">
              <span className="text-green-400">Monitraq</span> Dashboard
            </h1>
          </div>
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="bg-green-500 hover:bg-green-600 p-3 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <User className="w-5 h-5 text-white" />
              <ChevronDown className={`w-4 h-4 text-white transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {/* User Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-[#21262D] border border-gray-700 rounded-lg shadow-lg z-50">
                <div className="p-2">
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      // Temporary routing for profile settings until a dedicated page exists
                      navigate('/doctor-assignment');
                    }}
                    className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#30363D] rounded-md transition-colors duration-200"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Profile Settings</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      navigate('/devices');
                    }}
                    className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#30363D] rounded-md transition-colors duration-200"
                  >
                    <Bluetooth className="w-4 h-4" />
                    <span>Device Settings</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors duration-200"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Device Connection Status */}
        <div className="mb-4">
          <div className="bg-[#1E1E1E] rounded-2xl p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white">
                Device Status
              </h3>
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    bluetoothEnabled ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                <span className="text-sm text-gray-400">
                  {bluetoothEnabled ? "Bluetooth On" : "Bluetooth Off"}
                </span>
              </div>
            </div>

            {/* Collapsible Device Status Content */}
            <div
              className={`transition-all duration-300 overflow-hidden ${
                deviceStatusExpanded
                  ? "max-h-96 opacity-100"
                  : "max-h-0 opacity-0"
              }`}
            >
              {/* BP & ECG Device Status */}
              {connectedDevice ? (
                <div className="mb-2 p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="bg-green-500 p-1.5 rounded-full">
                        <Bluetooth className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {connectedDevice.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {connectedDevice.model}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-xs text-green-400">Connected</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-2 p-2 bg-gray-500/10 border border-gray-500/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="bg-gray-500 p-1.5 rounded-full">
                        <WifiOff className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-400">
                          BP & ECG Device
                        </p>
                        <p className="text-xs text-gray-500">Not connected</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          // Check Bluetooth state first
                          if (!bluetoothEnabled) {
                            toast({
                              title: "Bluetooth Required",
                              description: "Please enable Bluetooth to connect to your device",
                              variant: "destructive",
                            });
                            return;
                          }

                          try {
                            setIsConnecting(true);
                            setConnectionStatus("Initializing...");
                            
                            // Step 1: Ensure SDK is initialized
                            if (!isInitialized) {
                              console.log("🚀 Initializing Wellue SDK...");
                              await manualInitializeSDK();
                              await new Promise(resolve => setTimeout(resolve, 1000));
                            }
                            
                            // Step 2: Check if device is already connected
                            if (connectedDevice) {
                              console.log("✅ Device already connected:", connectedDevice.name);
                              setIsConnecting(false);
                              setConnectionStatus("");
                              return;
                            }
                            
                            // Step 3: Robust scanning with retry mechanism
                            const maxRetries = 3;
                            let retryCount = 0;
                            let deviceFound = false;
                            
                            while (retryCount < maxRetries && !deviceFound) {
                              if (retryCount > 0) {
                                setConnectionStatus("Refreshing scan...");
                                console.log(`🔄 Retry ${retryCount + 1}: Refreshing scan...`);
                                await stopScan();
                                await new Promise(resolve => setTimeout(resolve, 500));
                              } else {
                                setConnectionStatus("Scanning for devices...");
                                console.log("🔍 Starting initial device scan...");
                              }
                              
                              // Start fresh scan
                              await startScan();
                              
                              // Wait for devices to be found with longer timeout
                              let scanTime = 0;
                              const scanTimeout = 4000; // 4 seconds per attempt
                              
                              while (scanTime < scanTimeout && availableDevices.length === 0) {
                                await new Promise(resolve => setTimeout(resolve, 200));
                                scanTime += 200;
                              }
                              
                              if (availableDevices.length > 0) {
                                deviceFound = true;
                                console.log(`✅ Found ${availableDevices.length} device(s) on attempt ${retryCount + 1}`);
                              } else {
                                retryCount++;
                                console.log(`❌ No devices found on attempt ${retryCount}, retrying...`);
                              }
                            }
                            
                            // Step 4: Auto-connect to first BP2 device found
                            if (deviceFound && availableDevices.length > 0) {
                              const bp2Device = availableDevices.find(device => 
                                device.name.toLowerCase().includes('bp2') || 
                                device.name.toLowerCase().includes('3049')
                              ) || availableDevices[0];
                              
                              setConnectionStatus(`Connecting to ${bp2Device.name}...`);
                              console.log("🔗 Auto-connecting to device:", bp2Device.name);
                              
                              await connectToDevice(bp2Device);
                              
                              // Store last connected device
                              localStorage.setItem("lastConnectedDevice", bp2Device.id);
                              
                              setConnectionStatus("");
                              toast({
                                title: "✅ Connected!",
                                description: `Successfully connected to ${bp2Device.name}`,
                              });
                            } else {
                              throw new Error("No BP2 devices found after multiple scan attempts. Please ensure your device is on and nearby.");
                            }
                            
                          } catch (error) {
                            console.error("❌ Smart Connect failed:", error);
                            setIsConnecting(false);
                            setConnectionStatus("");
                            
                            toast({
                              title: "Connection Failed",
                              description: error instanceof Error ? error.message : "Failed to connect to device",
                              variant: "destructive",
                            });
                          }
                        }}
                        disabled={isConnecting || !bluetoothEnabled}
                        className={`${
                          !bluetoothEnabled 
                            ? "bg-gray-500 cursor-not-allowed" 
                            : "bg-blue-500 hover:bg-blue-600"
                        } disabled:bg-blue-400 disabled:cursor-not-allowed text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center gap-1`}
                      >
                        {!bluetoothEnabled ? (
                          <>
                            <BluetoothOff className="w-3 h-3" />
                            Enable Bluetooth
                          </>
                        ) : isConnecting ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {connectionStatus || "Connecting..."}
                          </>
                        ) : (
                          <>
                            <Bluetooth className="w-3 h-3" />
                            Connect
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* CGM Device Status */}
              {cgmConnected ? (
                <div className="mb-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="bg-blue-500 p-1.5 rounded-full">
                        <Activity className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">Dexcom CGM</p>
                        <p className="text-xs text-gray-400">Continuous Glucose Monitor</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                      <span className="text-xs text-blue-400">Connected</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-2 p-2 bg-gray-500/10 border border-gray-500/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="bg-gray-500 p-1.5 rounded-full">
                        <Activity className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-400">Dexcom CGM</p>
                        <p className="text-xs text-gray-500">Not connected</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        toast({
                          title: "CGM Not Found",
                          description: "No Dexcom CGM device detected. Please check your device.",
                          variant: "destructive",
                        });
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center gap-1"
                    >
                      <Activity className="h-3 w-3" />
                      Connect
                    </button>
                  </div>
                </div>
              )}

              {/* Camera Device Status */}
              {cameraConnected ? (
                <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="bg-purple-500 p-1.5 rounded-full">
                        <Video className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">Camera</p>
                        <p className="text-xs text-gray-400">Video Monitoring</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                      <span className="text-xs text-purple-400">Connected</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-2 bg-gray-500/10 border border-gray-500/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="bg-gray-500 p-1.5 rounded-full">
                        <Video className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-400">Camera</p>
                        <p className="text-xs text-gray-500">Not connected</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        toast({
                          title: "Camera Not Found",
                          description: "No camera device detected. Please check your device connection.",
                          variant: "destructive",
                        });
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center gap-1"
                    >
                      <Video className="h-3 w-3" />
                      Connect
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Compact Status Summary (Always Visible) */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-600">
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      connectedDevice ? "bg-green-500" : "bg-gray-500"
                    }`}
                  />
                  <span className="text-gray-400">BP/ECG</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${cgmConnected ? "bg-blue-500" : "bg-gray-500"}`} />
                  <span className="text-gray-400">CGM</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${cameraConnected ? "bg-purple-500" : "bg-gray-500"}`} />
                  <span className="text-gray-400">Camera</span>
                </div>
              </div>
              <button
                onClick={() => setDeviceStatusExpanded(!deviceStatusExpanded)}
                className="p-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 transition-all duration-200 border border-blue-500/30 hover:border-blue-500/50"
                title={
                  deviceStatusExpanded
                    ? "Collapse Device Status"
                    : "Expand Device Status"
                }
              >
                {deviceStatusExpanded ? (
                  <ChevronUp className="w-5 h-5 text-blue-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-blue-400" />
                )}
              </button>
            </div>

            {/* Show device errors if any */}
            {deviceError && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Siren className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-400 font-medium">
                    Device Error
                  </span>
                </div>
                <p className="text-sm text-red-300 mt-1">{deviceError}</p>
              </div>
            )}
          </div>
        </div>

        {/* Your Doctor */}
        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-3 text-white">Your Doctor</h2>
          <DoctorInfoCard />
        </div>

        {/* Device Actions */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="col-span-2 grid grid-cols-3 gap-4">
            {/* BP Monitor Button */}
            <button
              onClick={() => navigate("/live-bp-monitor")}
              className="bg-blue-900/60 backdrop-blur-sm hover:bg-blue-800/70 text-white p-6 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all duration-300 hover:scale-105 active:scale-95 border border-blue-400/40 hover:border-blue-400/60"
            >
              <Heart className="h-8 w-8 text-blue-400" />
              <div className="text-center">
                <h3 className="font-bold text-lg text-white">BP Monitor</h3>
                <p className="text-xs text-gray-400">
                  Blood Pressure
                </p>
              </div>
            </button>

            {/* ECG Monitor Button */}
            <button
              onClick={() => navigate("/ecg-monitor")}
              className="bg-purple-900/60 backdrop-blur-sm hover:bg-purple-800/70 text-white p-6 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all duration-300 hover:scale-105 active:scale-95 border border-purple-400/40 hover:border-purple-400/60"
            >
              <Activity className="h-8 w-8 text-purple-400" />
              <div className="text-center">
                <h3 className="font-bold text-lg text-white">ECG Monitor</h3>
                <p className="text-xs text-gray-400">
                  Heart Activity
                </p>
              </div>
            </button>

            {/* CGM Monitor Button */}
            <button
              onClick={() => navigate("/cgm-monitor")}
              className="bg-green-900/60 backdrop-blur-sm hover:bg-green-800/70 text-white p-6 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all duration-300 hover:scale-105 active:scale-95 border border-green-400/40 hover:border-green-400/60"
            >
              <BarChart3 className="h-8 w-8 text-green-400" />
              <div className="text-center">
                <h3 className="font-bold text-lg text-white">CGM Monitor</h3>
                <p className="text-xs text-gray-400">
                  Glucose Levels
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Bottom Action Buttons */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={handleViewReports}
            className="bg-purple-900/60 backdrop-blur-sm hover:bg-purple-800/70 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 hover:scale-105 active:scale-95 border border-purple-400/40 hover:border-purple-400/60"
          >
            <FileText size={20} className="text-purple-400" />
            <span>Reports</span>
          </button>
          <button
            onClick={() => navigate("/doctor-assignment")}
            className="bg-blue-900/60 backdrop-blur-sm hover:bg-blue-800/70 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 hover:scale-105 active:scale-95 border border-blue-400/40 hover:border-blue-400/60"
          >
            <Stethoscope size={20} className="text-blue-400" />
            <span>Doctor</span>
          </button>
        </div>
        <div className="pb-8">
          <EmergencyButton size="lg" className="w-full" />
        </div>
      </div>
    </div>
  );
};