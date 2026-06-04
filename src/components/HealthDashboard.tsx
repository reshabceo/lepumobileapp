import React, { useEffect, useRef, useState } from "react";
import { Filesystem, Directory } from "@capacitor/filesystem";
import {
  Video,
  Phone,
  MessageSquare,
  FileText,
  Heart,
  Loader2,
  Activity,
  Bluetooth,
  BarChart3,
  ChevronUp,
  ChevronDown,
  Stethoscope,
  Settings,
  Calendar,
  FileCheck,
  Edit3,
  Pill,
  Target,
  Receipt,
  AlertCircle,
  RefreshCw,
  LogOut,
  Monitor,
  Shield,
  Crown,
  Lock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useDevice } from "@/contexts/DeviceContext";
import { useRealTimeVitals } from "@/hooks/useRealTimeVitals";
import { DoctorInfoCard } from "./DoctorInfoCard";
import { EmergencyButton } from "./EmergencyButton";
import { getPatientRiskCriteria } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useInsuranceClaimsNotifications } from "@/hooks/useInsuranceClaimsNotifications";
import { useHealthRecommendationsNotifications } from "@/hooks/useHealthRecommendationsNotifications";
import { usePatientUnreadMessages } from "@/hooks/usePatientChat";
import { useSubscriptionTier } from "@/hooks/useSubscriptionTier";
import { supabase } from "@/lib/supabase";

// Stored Item type definition
type StoredItem = {
  fileName: string;
  fileType?: number; // 1: BP, 2: ECG
  sampleRate?: number;
  recordingTimeSec?: number;
  measureTimeSec?: number;
  diagnosis?: string;
  mvPerCount?: number;
  waveformCounts?: number[];
  base64?: string;
};

// Main Dashboard Component
export const HealthDashboard = () => {
  const navigate = useNavigate();
  const { tier: subscriptionTier } = useSubscriptionTier();
  const isFreeTier = subscriptionTier === "free";
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [forceStopLoading, setForceStopLoading] = useState(false);
  const { user, logout } = useAuth();
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { toast } = useToast();
  const {
    vitals,
    patientProfile,
    loading: vitalsLoading,
    error: vitalsError,
    getLatestReadings,
    addVitalSign,
  } = useRealTimeVitals();

  const [patientRowId, setPatientRowId] = useState<string | null>(null);
  const [vitalTriggerBanner, setVitalTriggerBanner] = useState<string | null>(null);
  const chatUnread = usePatientUnreadMessages(patientRowId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("patients")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (!cancelled) setPatientRowId(data?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!patientRowId) {
      setVitalTriggerBanner(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("health_recommendations")
        .select("title, description")
        .eq("patient_id", patientRowId)
        .eq("source", "vital_trigger")
        .eq("status", "active")
        .limit(3);
      if (cancelled || !data?.length) {
        if (!cancelled) setVitalTriggerBanner(null);
        return;
      }
      setVitalTriggerBanner(data.map((r: { title: string }) => r.title).join(" · "));
    })();
    return () => {
      cancelled = true;
    };
  }, [patientRowId]);



  // Safety timeout - force stop loading after 5 seconds
  useEffect(() => {
    if (vitalsLoading) {
      loadingTimeoutRef.current = setTimeout(() => {
        console.warn('⚠️ HealthDashboard: Loading timeout - forcing stop');
        setForceStopLoading(true);
      }, 5000);
    } else {
      setForceStopLoading(false);
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    }

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [vitalsLoading]);

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
    aliveCorConnected,
    aliveCorDeviceInfo,
    aliveCorBackendReady,
    checkAliveCorStatus,
    isKardiaScanning,
    kardiaDevices,
    startKardiaScan,
    stopKardiaScan,
    connectKardia,
    kardiaBattery,
    kardiaStatusText,
  } = useDevice();

  const availableDevicesRef = useRef(availableDevices);
  useEffect(() => {
    availableDevicesRef.current = availableDevices;
  }, [availableDevices]);

  // Ensure the banner doesn't show a stale Bluetooth error when Bluetooth is ON
  const bannerError = bluetoothEnabled && deviceError === 'Bluetooth is disabled' ? null : deviceError;

  // Stored file viewer state
  const [storedFilesInApp, setStoredFilesInApp] = useState<StoredItem[]>([]);
  const [isFetchingStored, setIsFetchingStored] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<"all" | "ecg" | "bp">("all");
  const [savedFilesFromPhone, setSavedFilesFromPhone] = useState<StoredItem[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [riskAlertOpen, setRiskAlertOpen] = useState(false);
  const [activeRisk, setActiveRisk] = useState<any>(null);

  // High Risk Alert Check
  useEffect(() => {
    const checkRisk = async () => {
      if (user) {
        try {
          const { data: patient } = await supabase
            .from('patients')
            .select('id')
            .eq('auth_user_id', user.id)
            .single();

          if (patient) {
            const { data: riskData } = await getPatientRiskCriteria(patient.id);
            if (riskData && riskData.is_high_risk) {
              setActiveRisk(riskData);
              setTimeout(() => setRiskAlertOpen(true), 1500);
            }
          }
        } catch (err) {
          console.error("Risk check failed:", err);
        }
      }
    };
    checkRisk();
  }, [user]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 2000);
  };

  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("");
  const [isConnectingO2, setIsConnectingO2] = useState(false);
  const [connectionStatusO2, setConnectionStatusO2] = useState("");
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [deviceStatusExpanded, setDeviceStatusExpanded] = useState(true);
  const [cameraConnected, setCameraConnected] = useState(false);
  const [cgmConnected, setCgmConnected] = useState(false);

  const isO2Ring = (device: any) => {
    if (!device) return false;
    const name = (device.name || "").toLowerCase();
    return name.includes("o2") || name.includes("ring") || name.includes("oxy") || device.model === "O2Ring";
  };

  const isOximeterConnected = connectedDevice ? isO2Ring(connectedDevice) : false;
  const isBPDeviceConnected = connectedDevice ? !isO2Ring(connectedDevice) : false;

  // Auto-collapse device status when all three devices are connected
  useEffect(() => {
    const hasBP2Connected = connectedDevice?.name?.includes('BP2') || connectedDevice?.name?.includes('3049');
    const hasCGMConnected = cgmConnected;
    const hasCameraConnected = cameraConnected;

    if (hasBP2Connected && hasCGMConnected && hasCameraConnected && deviceStatusExpanded) {
      const timer = setTimeout(() => {
        setDeviceStatusExpanded(false);
      }, 2000);

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
      ).map((f: any) =>
        typeof f === "string"
          ? { fileName: f }
          : {
            fileName: f.fileName || String(f),
            fileType: f.fileType,
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
          )) as any;
          console.log("📦 Raw response for", entry.fileName, ":", res);

          const fileTypeNum =
            typeof res?.fileType === "number"
              ? res.fileType
              : Number(res?.fileType);

          let waveformCounts: number[] | undefined;
          if (res?.waveformCounts && Array.isArray(res.waveformCounts)) {
            waveformCounts = res.waveformCounts;
          } else if (res?.fileContent && res.fileType === 2) {
            try {
              const binaryString = atob(res.fileContent);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              waveformCounts = [];
              for (let i = 0; i < bytes.length - 1; i += 2) {
                const value = (bytes[i + 1] << 8) | bytes[i];
                waveformCounts.push(value > 32767 ? value - 65536 : value);
              }
            } catch (e) {
              console.warn("⚠️ Failed to parse base64 content for ECG:", e);
            }
          }

          const payload: StoredItem = {
            fileName: entry.fileName,
            fileType: fileTypeNum,
            sampleRate: res?.sampleRate,
            recordingTimeSec: res?.recordingTimeSec,
            measureTimeSec: res?.measureTimeSec,
            diagnosis: res?.diagnosis,
            mvPerCount: res?.mvPerCount || 0.003098,
            waveformCounts,
            base64: res?.fileContent,
          };

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

  const loadSavedFilesFromPhone = async () => {
    try {
      setIsLoadingSaved(true);
      console.log("📱 Loading saved files from phone Documents...");

      const result = await Filesystem.readdir({
        path: "",
        directory: Directory.Documents,
      });

      console.log("📁 Documents folder contents:", result.files);

      const jsonFiles = result.files.filter(
        (file: any) =>
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
      setStoredFilesInApp(loadedFiles);
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

    ctx.clearRect(0, 0, cssW, cssH);

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

    let waveformData: number[] = [];
    if (file.waveformCounts && file.waveformCounts.length > 0) {
      waveformData = file.waveformCounts;
    } else if (file.base64 && file.fileType === 2) {
      try {
        const binaryString = atob(file.base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        for (let i = 0; i < bytes.length - 1; i += 2) {
          const value = (bytes[i + 1] << 8) | bytes[i];
          waveformData.push(value > 32767 ? value - 65536 : value);
        }
      } catch (e) {
        console.warn("⚠️ Failed to parse base64 content for ECG:", e);
      }
    }

    if (waveformData.length === 0) {
      ctx.fillStyle = "#666";
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.fillText("No waveform data available", cssW / 2, cssH / 2);
      return;
    }

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

  const handleViewReports = () => {
    navigate("/reports");
  };

  const goPaidFeature = (path: string, featureName: string) => {
    if (isFreeTier) {
      toast({
        title: `${featureName} is locked on Free`,
        description: "Upgrade to Monitraq+ to access this feature.",
      });
      navigate("/subscription");
      return;
    }
    navigate(path);
  };

  const handleEmergencyCall = () => {
    const phone = patientProfile?.emergency_contact_phone || patientProfile?.phone_number;
    if (!phone) {
      toast({
        title: 'No phone on file',
        description: 'Add an emergency contact number in Profile Settings.',
        variant: 'destructive'
      });
      return;
    }
    try {
      window.location.href = `tel:${phone}`;
    } catch (e) {
      console.error('Failed to open dialer', e);
      toast({ title: 'Unable to open dialer', variant: 'destructive' });
    }
  };

  const loading = (vitalsLoading || !patientProfile) && !forceStopLoading;

  if (loading && !patientProfile) {
    return (
      <div className="bg-[#080D1A] min-h-screen text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
          <div className="flex flex-col items-center">
            <p className="text-xl font-bold tracking-tight text-white">Syncing Health Data...</p>
            <p className="text-slate-400 text-sm">This may take a few seconds</p>
          </div>
        </div>
      </div>
    );
  }

  if ((vitalsError || forceStopLoading) && !patientProfile) {
    return (
      <div className="bg-[#080D1A] min-h-screen text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#1A243D] border border-red-500/20 rounded-3xl p-8 text-center shadow-xl">
          <div className="bg-red-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Request Timeout</h3>
          <p className="text-slate-400 mb-8 leading-relaxed">
            The application is taking longer than usual to load. This might be due to a poor connection or session sync issue.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl font-bold transition-all shadow-md shadow-red-900/30 flex items-center justify-center gap-2"
          >
            <RefreshCw className="h-5 w-5" />
            Reload App Properly
          </button>
        </div>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-[#080D1A] text-white font-inter select-none pb-12">
      {/* Top Banner Spacing */}
      <div className="h-6"></div>

      {vitalTriggerBanner && (
        <div className="mx-4 mt-2 mb-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-amber-400 text-xs shadow-sm">
          <span className="font-semibold text-amber-300">Vital alert: </span>
          {vitalTriggerBanner}
        </div>
      )}

      {/* Header Section */}
      <header className="flex items-center justify-between py-3 px-4 mb-3">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <img src="/monitraq-logo.png" alt="Logo" className="w-10 h-10 object-contain rounded-xl" />
          <div>
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Have a Healthy Day</p>
            <h1 className="text-lg font-black tracking-tight text-white mt-0.5">
              {patientProfile?.full_name || "John Doe"}
            </h1>
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="relative block rounded-full focus:outline-none"
          >
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-md ring-2 ring-slate-800">
              {patientProfile?.profile_picture_url ? (
                <img
                  src={patientProfile.profile_picture_url}
                  alt={patientProfile.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-indigo-500 to-purple-550 flex items-center justify-center text-white font-bold text-lg">
                  {patientProfile?.full_name?.charAt(0) || "J"}
                </div>
              )}
            </div>
            <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white bg-emerald-500" />
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-[#1A243D] border border-slate-700/40 rounded-2xl shadow-xl z-50 overflow-hidden">
              <div className="p-1.5 space-y-0.5">
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    navigate('/profile');
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs text-slate-300 hover:bg-[#121B32] rounded-xl transition-all"
                >
                  <Settings className="w-4 h-4 text-indigo-400" />
                  <span>Profile Settings</span>
                </button>
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    navigate('/devices');
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs text-slate-300 hover:bg-[#121B32] rounded-xl transition-all"
                >
                  <Bluetooth className="w-4 h-4 text-emerald-400" />
                  <span>Device Settings</span>
                </button>
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs text-red-400 hover:bg-red-950/30 rounded-xl transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {isFreeTier && (
        <div className="mx-4 mb-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-amber-200 font-semibold flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                Free plan active
              </p>
              <p className="text-[11px] text-slate-300 mt-1">
                Upgrade to unlock monitoring, reports, prescriptions and premium care tools.
              </p>
            </div>
            <button
              onClick={() => navigate("/subscription")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2 text-xs font-extrabold text-black hover:bg-amber-300 transition-colors"
            >
              <Crown className="h-3.5 w-3.5" />
              Upgrade
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="px-4 space-y-5">
        {/* Device Status Card */}
        <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-4 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white">Device Status</h3>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${bluetoothEnabled ? "bg-emerald-500" : "bg-rose-500"}`} />
              <span className="text-xs text-slate-400 font-semibold">
                {bluetoothEnabled ? "Bluetooth On" : "Bluetooth Off"}
              </span>
            </div>
          </div>

          {deviceStatusExpanded && (
            <div className="space-y-2 mb-3 animate-in fade-in slide-in-from-top-1 duration-200">
              {/* BP & ECG Device */}
              <div className="bg-[#0F172A]/70 border border-slate-800/45 rounded-2xl p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-950/40 flex items-center justify-center text-indigo-400 border border-indigo-900/50">
                    <Heart className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">BP & ECG Device</p>
                    <p className="text-[10px] text-slate-400 font-medium">{isBPDeviceConnected ? connectedDevice.name : "Not connected"}</p>
                  </div>
                </div>
                {isBPDeviceConnected ? (
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold text-emerald-400">Connected</span>
                  </div>
                ) : (
                  <button
                    onClick={async () => {
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
                        setConnectionStatus("Scanning...");
                        if (!isInitialized) {
                          await manualInitializeSDK();
                        }
                        await startScan();

                        let scanTime = 0;
                        const scanTimeout = 4000;
                        while (scanTime < scanTimeout && availableDevicesRef.current.length === 0) {
                          await new Promise(resolve => setTimeout(resolve, 200));
                          scanTime += 200;
                        }

                        if (availableDevicesRef.current.length > 0) {
                          const bp2Device = availableDevicesRef.current.find(device =>
                            device.name.toLowerCase().includes('bp2') ||
                            device.name.toLowerCase().includes('3049')
                          ) || availableDevicesRef.current[0];

                          await connectToDevice(bp2Device);
                          localStorage.setItem("lastConnectedDevice", bp2Device.id);
                          toast({
                            title: "Connected!",
                            description: `Connected to ${bp2Device.name}`,
                          });
                        } else {
                          throw new Error("No BP2 devices found nearby.");
                        }

                      } catch (error) {
                        console.error("Smart Connect failed:", error);
                        toast({
                          title: "Connection Failed",
                          description: error instanceof Error ? error.message : "Failed to connect to device",
                          variant: "destructive",
                        });
                      } finally {
                        setIsConnecting(false);
                        setConnectionStatus("");
                      }
                    }}
                    disabled={isConnecting || !bluetoothEnabled}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-[10px] font-extrabold px-3 py-1.5 rounded-xl transition-all shadow-sm"
                  >
                    {isConnecting ? (connectionStatus || "Connecting...") : "Connect"}
                  </button>
                )}
              </div>

              {/* O2 Ring Device */}
              <div className="bg-[#0F172A]/70 border border-slate-800/45 rounded-2xl p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-950/40 flex items-center justify-center text-rose-450 border border-rose-900/50">
                    <Heart className="w-4.5 h-4.5 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">O2 Ring</p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {isOximeterConnected ? connectedDevice.name : "Not connected"}
                    </p>
                  </div>
                </div>
                {isOximeterConnected ? (
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold text-emerald-400">Connected</span>
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      if (!bluetoothEnabled) {
                        toast({
                          title: "Bluetooth Required",
                          description: "Please enable Bluetooth to connect to your O2 Ring",
                          variant: "destructive",
                        });
                        return;
                      }

                      try {
                        setIsConnectingO2(true);
                        setConnectionStatusO2("Scanning...");
                        if (!isInitialized) {
                          await manualInitializeSDK();
                        }
                        await startScan();

                        let scanTime = 0;
                        const scanTimeout = 4000;
                        while (scanTime < scanTimeout && availableDevicesRef.current.length === 0) {
                          await new Promise(resolve => setTimeout(resolve, 200));
                          scanTime += 200;
                        }

                        const o2Devices = availableDevicesRef.current.filter(device =>
                          device.name.toLowerCase().includes('o2') ||
                          device.name.toLowerCase().includes('ring') ||
                          device.name.toLowerCase().includes('oxy')
                        );

                        if (o2Devices.length > 0) {
                          const o2Device = o2Devices[0];
                          await connectToDevice(o2Device);
                          localStorage.setItem("lastConnectedDevice", o2Device.id);
                          toast({
                            title: "Connected!",
                            description: `Connected to ${o2Device.name}`,
                          });
                        } else {
                          throw new Error("No O2 Ring devices found nearby.");
                        }

                      } catch (error) {
                        console.error("O2 Connect failed:", error);
                        toast({
                          title: "Connection Failed",
                          description: error instanceof Error ? error.message : "Failed to connect to O2 Ring",
                          variant: "destructive",
                        });
                      } finally {
                        setIsConnectingO2(false);
                        setConnectionStatusO2("");
                      }
                    }}
                    disabled={isConnectingO2 || !bluetoothEnabled}
                    className="bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-[10px] font-extrabold px-3 py-1.5 rounded-xl transition-all shadow-sm"
                  >
                    {isConnectingO2 ? (connectionStatusO2 || "Connecting...") : "Connect"}
                  </button>
                )}
              </div>

              {/* Kardia Device */}
              <div className="bg-[#0F172A]/70 border border-slate-800/45 rounded-2xl p-2.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-950/40 flex items-center justify-center text-emerald-400 border border-emerald-900/50">
                      <Activity className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">KardiaMobile 6L</p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {aliveCorConnected
                          ? (kardiaStatusText || "Connected")
                          : isKardiaScanning
                            ? kardiaDevices.length > 0
                              ? `${kardiaDevices.length} device${kardiaDevices.length > 1 ? 's' : ''} found`
                              : "Scanning nearby..."
                            : "Not connected"}
                      </p>
                    </div>
                  </div>
                  {aliveCorConnected ? (
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-[10px] font-bold text-emerald-400">Connected</span>
                    </div>
                  ) : isKardiaScanning ? (
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 text-emerald-400 animate-spin" />
                      <button
                        onClick={() => stopKardiaScan()}
                        className="text-[10px] text-slate-400 hover:text-white font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={async () => {
                        if (!bluetoothEnabled) {
                          toast({
                            title: "Bluetooth Required",
                            description: "Please enable Bluetooth to connect Kardia",
                            variant: "destructive",
                          });
                          return;
                        }
                        await startKardiaScan();
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-extrabold px-3 py-1.5 rounded-xl transition-all shadow-sm"
                    >
                      Connect
                    </button>
                  )}
                </div>

                {/* Device list — shown when scan finds devices and not yet connected */}
                {!aliveCorConnected && kardiaDevices.length > 0 && (
                  <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-800/40">
                    {kardiaDevices.map((dev) => (
                      <button
                        key={dev.deviceId}
                        onClick={async () => {
                          await stopKardiaScan();
                          await connectKardia(dev.deviceId);
                        }}
                        className="flex items-center justify-between w-full bg-emerald-950/30 border border-emerald-900/40 rounded-xl px-3 py-2 hover:bg-emerald-900/40 transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                          <span className="text-[11px] font-bold text-white">{dev.deviceName}</span>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-semibold">Tap to connect</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Compact Status Tags */}
          <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/40">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-0.5">
              <span className="text-[9px] font-extrabold px-2.5 py-1 rounded-full bg-indigo-950/50 text-indigo-400 border border-indigo-900/50">All Devices</span>
              <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full ${isBPDeviceConnected ? "bg-emerald-950/50 text-emerald-400 border border-emerald-900/50" : "bg-slate-900 text-slate-550"}`}>BP/ECG</span>
              <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full ${isOximeterConnected ? "bg-emerald-950/50 text-emerald-400 border border-emerald-900/50" : "bg-slate-900 text-slate-550"}`}>O2 Ring</span>
              <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full ${cgmConnected ? "bg-emerald-950/50 text-emerald-400 border border-emerald-900/50" : "bg-slate-900 text-slate-555"}`}>CGM</span>
              <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full ${aliveCorConnected ? "bg-emerald-950/50 text-emerald-400 border border-emerald-900/50" : "bg-slate-900 text-slate-555"}`}>Kardia</span>
            </div>
            <button
              onClick={() => setDeviceStatusExpanded(!deviceStatusExpanded)}
              className="p-1 rounded-lg bg-[#0F172A]/70 border border-slate-800 text-slate-400 hover:text-slate-200"
            >
              {deviceStatusExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Emergency Side-by-Side Buttons Container */}
        <div className="grid grid-cols-2 gap-3">
          <EmergencyButton
            size="md"
            className="w-full h-12 bg-gradient-to-r from-red-655 via-rose-600 to-red-655 hover:from-red-700 hover:to-rose-700 text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 border border-red-500/20 shadow-md shadow-red-900/25 text-xs transition-all hover:scale-[1.01] active:scale-95"
          />
          <button
            onClick={handleEmergencyCall}
            className="w-full h-12 bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-500 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 border border-emerald-500/20 shadow-md shadow-emerald-900/25 text-xs transition-all hover:scale-[1.01] active:scale-95"
            title="Call care-team coordinator / emergency contact"
          >
            <Phone size={15} className="text-white" />
            <span>Call Care Team</span>
          </button>
        </div>

        {/* Doctor Container */}
        <div>
          <h2 className="text-base font-bold text-white mb-3 px-1">Your Clinical Doctor</h2>
          <DoctorInfoCard />
        </div>

        {/* Connected Health Monitors (Standalone Cards Grid) */}
        <div>
          <h2 className="text-base font-bold text-white mb-3 px-1">Connected Health Monitors</h2>
          <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-none snap-x snap-mandatory select-none touch-pan-x">
            {/* BP Monitor */}
            <button
              onClick={() => goPaidFeature("/live-bp-monitor", "BP Monitor")}
              className="relative overflow-hidden flex-shrink-0 w-36 snap-start bg-[#1A243D] hover:bg-[#1A243D]/80 border border-slate-700/40 p-4 rounded-3xl flex flex-col items-center justify-center gap-2.5 transition-all text-center group shadow-md"
            >
              <Heart className={`h-7 w-7 text-blue-400 ${isFreeTier ? "opacity-40" : "group-hover:scale-105 transition-transform"}`} />
              <div>
                <h4 className="font-extrabold text-xs text-white">BP Monitor</h4>
                <p className="text-[9px] text-slate-400 font-semibold mt-0.5">Blood Pressure</p>
              </div>
              {isFreeTier && (
                <span className="pointer-events-none absolute inset-0 rounded-3xl bg-slate-950/55 backdrop-blur-[1.5px] flex flex-col items-center justify-center border border-amber-400/35">
                  <span className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-gradient-to-br from-amber-100/25 via-orange-300/15 to-yellow-200/20 border border-amber-300/45 shadow-[0_0_22px_rgba(251,191,36,0.24)] transition-transform duration-200 group-hover:scale-110">
                    <Lock className="h-5 w-5 text-amber-200" />
                  </span>
                </span>
              )}
            </button>

            {/* ECG Monitor */}
            <button
              onClick={() => goPaidFeature("/ecg-monitor", "ECG Monitor")}
              className="relative overflow-hidden flex-shrink-0 w-36 snap-start bg-[#1A243D] hover:bg-[#1A243D]/80 border border-slate-700/40 p-4 rounded-3xl flex flex-col items-center justify-center gap-2.5 transition-all text-center group shadow-md"
            >
              <Activity className={`h-7 w-7 text-purple-400 ${isFreeTier ? "opacity-40" : "group-hover:scale-105 transition-transform"}`} />
              <div>
                <h4 className="font-extrabold text-xs text-white">ECG Monitor</h4>
                <p className="text-[9px] text-slate-400 font-semibold mt-0.5">BP2 Single-Lead</p>
              </div>
              {isFreeTier && (
                <span className="pointer-events-none absolute inset-0 rounded-3xl bg-slate-950/55 backdrop-blur-[1.5px] flex flex-col items-center justify-center border border-amber-400/35">
                  <span className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-gradient-to-br from-amber-100/25 via-orange-300/15 to-yellow-200/20 border border-amber-300/45 shadow-[0_0_22px_rgba(251,191,36,0.24)] transition-transform duration-200 group-hover:scale-110">
                    <Lock className="h-5 w-5 text-amber-200" />
                  </span>
                </span>
              )}
            </button>

            {/* O2 Ring Monitor */}
            <button
              onClick={() => navigate("/o2ring-monitor")}
              className="flex-shrink-0 w-36 snap-start bg-[#1A243D] hover:bg-[#1A243D]/80 border border-slate-700/40 p-4 rounded-3xl flex flex-col items-center justify-center gap-2.5 transition-all text-center group shadow-md"
            >
              <Heart className="h-7 w-7 text-rose-400 group-hover:scale-105 transition-transform" />
              <div>
                <h4 className="font-extrabold text-xs text-white">O2 Ring</h4>
                <p className="text-[9px] text-slate-400 font-semibold mt-0.5">Pulse Oximeter</p>
              </div>
            </button>

            {/* 6-Channel ECG */}
            <button
              onClick={() => goPaidFeature("/kardia-6l-ecg", "6-Channel ECG")}
              className="relative overflow-hidden flex-shrink-0 w-36 snap-start bg-[#1A243D] hover:bg-[#1A243D]/80 border border-slate-700/40 p-4 rounded-3xl flex flex-col items-center justify-center gap-2.5 transition-all text-center group shadow-md"
            >
              <Monitor className={`h-7 w-7 text-indigo-400 ${isFreeTier ? "opacity-40" : "group-hover:scale-105 transition-transform"}`} />
              <div>
                <h4 className="font-extrabold text-xs text-white">6-Channel ECG</h4>
                <p className="text-[9px] text-slate-400 font-semibold mt-0.5">KardiaMobile 6L</p>
              </div>
              {isFreeTier && (
                <span className="pointer-events-none absolute inset-0 rounded-3xl bg-slate-950/55 backdrop-blur-[1.5px] flex flex-col items-center justify-center border border-amber-400/35">
                  <span className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-gradient-to-br from-amber-100/25 via-orange-300/15 to-yellow-200/20 border border-amber-300/45 shadow-[0_0_22px_rgba(251,191,36,0.24)] transition-transform duration-200 group-hover:scale-110">
                    <Lock className="h-5 w-5 text-amber-200" />
                  </span>
                </span>
              )}
            </button>

            {/* CGM Monitor */}
            <button
              onClick={() => goPaidFeature("/cgm-monitor", "CGM Monitor")}
              className="relative overflow-hidden flex-shrink-0 w-36 snap-start bg-[#1A243D] hover:bg-[#1A243D]/80 border border-slate-700/40 p-4 rounded-3xl flex flex-col items-center justify-center gap-2.5 transition-all text-center group shadow-md"
            >
              <BarChart3 className={`h-7 w-7 text-green-400 ${isFreeTier ? "opacity-40" : "group-hover:scale-105 transition-transform"}`} />
              <div>
                <h4 className="font-extrabold text-xs text-white">CGM Monitor</h4>
                <p className="text-[9px] text-slate-400 font-semibold mt-0.5">Glucose Levels</p>
              </div>
              {isFreeTier && (
                <span className="pointer-events-none absolute inset-0 rounded-3xl bg-slate-950/55 backdrop-blur-[1.5px] flex flex-col items-center justify-center border border-amber-400/35">
                  <span className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-gradient-to-br from-amber-100/25 via-orange-300/15 to-yellow-200/20 border border-amber-300/45 shadow-[0_0_22px_rgba(251,191,36,0.24)] transition-transform duration-200 group-hover:scale-110">
                    <Lock className="h-5 w-5 text-amber-200" />
                  </span>
                </span>
              )}
            </button>

            {/* Camera Setup */}
            <button
              onClick={() => goPaidFeature("/connect-camera", "Live Monitoring")}
              className="relative overflow-hidden flex-shrink-0 w-36 snap-start bg-[#1A243D] hover:bg-[#1A243D]/80 border border-slate-700/40 p-4 rounded-3xl flex flex-col items-center justify-center gap-2.5 transition-all text-center group shadow-md"
            >
              <Video className={`h-7 w-7 text-indigo-400 ${isFreeTier ? "opacity-40" : "group-hover:scale-105 transition-transform"}`} />
              <div>
                <h4 className="font-extrabold text-xs text-white">Camera Setup</h4>
                <p className="text-[9px] text-slate-400 font-semibold mt-0.5">Monitor Camera</p>
              </div>
              {isFreeTier && (
                <span className="pointer-events-none absolute inset-0 rounded-3xl bg-slate-950/55 backdrop-blur-[1.5px] flex flex-col items-center justify-center border border-amber-400/35">
                  <span className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-gradient-to-br from-amber-100/25 via-orange-300/15 to-yellow-200/20 border border-amber-300/45 shadow-[0_0_22px_rgba(251,191,36,0.24)] transition-transform duration-200 group-hover:scale-110">
                    <Lock className="h-5 w-5 text-amber-200" />
                  </span>
                </span>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* High Risk Alert Dialog */}
      <Dialog open={riskAlertOpen} onOpenChange={setRiskAlertOpen}>
        <DialogContent className="bg-[#1A243D] border border-red-500/20 text-white rounded-3xl max-w-xs mx-auto shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-red-500">
              <AlertCircle className="h-5 w-5 text-red-500" />
              High Risk Alert
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              A high risk medical alert has been triggered for your profile.
            </DialogDescription>
          </DialogHeader>
          {activeRisk && (
            <div className="space-y-3 my-2 bg-red-500/10 border border-red-500/20 p-3 rounded-2xl text-xs">
              <div className="space-y-1">
                <p className="font-bold text-red-400">Alert Reason:</p>
                <p className="text-slate-350 leading-relaxed">{activeRisk.risk_reason}</p>
              </div>
              {activeRisk.vital_value && (
                <div className="space-y-0.5">
                  <p className="text-red-400 text-[10px] font-bold">Measured Value:</p>
                  <p className="font-black text-white text-sm">{activeRisk.vital_value}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex gap-2 mt-2">
            <Button
              onClick={() => setRiskAlertOpen(false)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-1.5 h-auto rounded-xl border border-slate-700"
            >
              Acknowledge
            </Button>
            <Button
              onClick={() => {
                setRiskAlertOpen(false);
                handleEmergencyCall();
              }}
              className="bg-red-600 hover:bg-red-700 text-white text-xs py-1.5 h-auto rounded-xl"
            >
              Call Emergency
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};