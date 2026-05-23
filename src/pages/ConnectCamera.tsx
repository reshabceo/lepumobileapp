import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Video,
  Eye,
  Lock,
  User,
  Globe,
  Copy,
  Check,
  Info,
  Server,
  EyeOff,
  Database,
  Shield,
  X,
} from "lucide-react";
import { MobileAppContainer } from "@/components/MobileAppContainer";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function ConnectCamera() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [generatedRtsp, setGeneratedRtsp] = useState("");
  const [generatedRtspSub, setGeneratedRtspSub] = useState("");
  const [isInstructionOpen, setIsInstructionOpen] = useState(false);
  const [isCopiedMain, setIsCopiedMain] = useState(false);
  const [isCopiedSub, setIsCopiedSub] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Load existing credentials from Supabase (with localStorage fallback)
  useEffect(() => {
    let isMounted = true;
    
    const loadCameraDetails = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user) return;

        // Get patient profile ID
        const { data: patientData, error: patientError } = await supabase
          .from("patients")
          .select("id")
          .eq("auth_user_id", userData.user.id)
          .single();

        if (patientError || !patientData) {
          console.warn("Could not retrieve patient profile from Supabase:", patientError);
          loadFromLocalStorage();
          return;
        }

        // Fetch camera settings
        const { data: cameraData, error: cameraError } = await supabase
          .from("patient_cameras")
          .select("*")
          .eq("patient_id", patientData.id)
          .maybeSingle();

        if (cameraError) {
          console.warn("Could not retrieve camera settings from Supabase:", cameraError);
          loadFromLocalStorage();
          return;
        }

        if (cameraData && isMounted) {
          setUsername(cameraData.camera_username || "");
          setPassword(cameraData.camera_password || "");
          setIpAddress(cameraData.ip_address || "");
          if (cameraData.camera_username && cameraData.ip_address) {
            generateLinks(cameraData.camera_username, cameraData.camera_password, cameraData.ip_address);
          }
        } else {
          loadFromLocalStorage();
        }
      } catch (err) {
        console.error("Failed to load camera settings:", err);
        loadFromLocalStorage();
      }
    };

    const loadFromLocalStorage = () => {
      if (!isMounted) return;
      const savedUsername = localStorage.getItem("tapo_camera_username") || "";
      const savedIp = localStorage.getItem("tapo_camera_ip") || "";
      setUsername(savedUsername);
      setIpAddress(savedIp);
      if (savedUsername && savedIp) {
        generateLinks(savedUsername, "", savedIp);
      }
    };

    loadCameraDetails();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Recalculate stream links whenever inputs change
  useEffect(() => {
    generateLinks(username, password, ipAddress);
  }, [username, password, ipAddress]);

  const generateLinks = (userVal: string, passVal: string, ipVal: string) => {
    const cleanUser = userVal.trim();
    const cleanIp = ipVal.trim();

    if (!cleanUser || !cleanIp) {
      setGeneratedRtsp("");
      setGeneratedRtspSub("");
      return;
    }

    // Safely URL encode password because passwords with special characters (like @, #, etc.) break basic URI parsers
    const encodedPassword = passVal ? encodeURIComponent(passVal) : "YOUR_PASSWORD";
    const displayUser = cleanUser || "YOUR_USERNAME";
    const displayIp = cleanIp || "YOUR_CAMERA_IP";

    // Format: rtsp://username:password@CAMERA_IP:554/stream1
    const mainStream = `rtsp://${displayUser}:${encodedPassword}@${displayIp}:554/stream1`;
    const subStream = `rtsp://${displayUser}:${encodedPassword}@${displayIp}:554/stream2`;

    setGeneratedRtsp(mainStream);
    setGeneratedRtspSub(subStream);
  };

  const handleCopy = (text: string, isSub: boolean) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (isSub) {
      setIsCopiedSub(true);
      setTimeout(() => setIsCopiedSub(false), 2000);
    } else {
      setIsCopiedMain(true);
      setTimeout(() => setIsCopiedMain(false), 2000);
    }
    toast.success("RTSP stream link copied to clipboard!");
  };

  const handleSaveConnection = async () => {
    if (!username.trim()) {
      toast.error("Please enter a camera username");
      return;
    }
    if (!password.trim()) {
      toast.error("Please enter the camera password");
      return;
    }
    if (!ipAddress.trim()) {
      toast.error("Please enter your camera's IP Address");
      return;
    }

    // IP address regex check
    const ipPattern = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (!ipPattern.test(ipAddress.trim())) {
      toast.error("Please enter a valid IP address (e.g. 192.168.1.100)");
      return;
    }

    try {
      setSaving(true);

      // Store locally for immediate client-side availability
      localStorage.setItem("tapo_camera_username", username.trim());
      localStorage.setItem("tapo_camera_ip", ipAddress.trim());
      localStorage.setItem("tapo_camera_rtsp_main", generatedRtsp);
      localStorage.setItem("tapo_camera_rtsp_sub", generatedRtspSub);

      // Save to Supabase patient_cameras table
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        throw new Error("User session not found. Please log in again.");
      }

      // Get patient profile
      const { data: patientData, error: patientError } = await supabase
        .from("patients")
        .select("id")
        .eq("auth_user_id", userData.user.id)
        .single();

      if (patientError || !patientData) {
        throw new Error("Could not find patient profile associated with this user.");
      }

      // Upsert to patient_cameras
      const { error: upsertError } = await supabase
        .from("patient_cameras")
        .upsert({
          patient_id: patientData.id,
          camera_username: username.trim(),
          camera_password: password.trim(),
          ip_address: ipAddress.trim(),
          rtsp_url: generatedRtsp,
          rtsp_url_sub: generatedRtspSub,
          updated_at: new Date().toISOString()
        }, {
          onConflict: "patient_id"
        });

      if (upsertError) {
        throw upsertError;
      }

      // Also try to update `camera_rtsp_url` if it exists in patients table as a redundant fallback
      try {
        await supabase
          .from("patients")
          .update({
            camera_rtsp_url: generatedRtsp,
          } as any)
          .eq("auth_user_id", userData.user.id);
      } catch (err) {
        console.warn("Secondary save to patients table failed (non-critical):", err);
      }

      toast.success("Camera settings saved successfully to cloud!");
    } catch (err: any) {
      console.error("Failed to store camera settings:", err);
      toast.error(err?.message || "Failed to save to database, saved locally instead.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080D1A] text-white font-inter select-none p-4 pt-safe-top relative">
      <div className="max-w-2xl mx-auto pb-20">
        {/* Standardized Header */}
        <header className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors active:scale-95 text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center justify-between flex-1">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-indigo-900/70 flex items-center justify-center border border-indigo-400/50">
                <Video className="h-6 w-6 text-indigo-300" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Connect Camera</h1>
                <p className="text-xs text-gray-400">Configure your Tapo RTSP stream</p>
              </div>
            </div>
            <button
              onClick={() => setIsInstructionOpen(true)}
              className="p-2 px-3 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-xl border border-indigo-500/30 transition-all flex items-center justify-center gap-1 shadow-sm active:scale-95"
              title="Show Instructions"
            >
              <Eye className="w-4 h-4 mr-1" />
              <span className="text-xs font-semibold">Guide</span>
            </button>
          </div>
        </header>

        {/* Card Overview */}
        <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-5 mb-6">
          <div className="flex items-start gap-4">
            <div className="bg-indigo-900/50 border border-indigo-500/30 p-3 rounded-2xl flex-shrink-0">
              <Video className="w-6 h-6 text-indigo-300 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Tapo RTSP Connection</h3>
              <p className="text-gray-400 text-xs leading-relaxed font-medium">
                Enter your camera credentials below to generate a secure
                <span className="text-indigo-300 font-semibold"> RTSP stream URL</span>.
                This link can be integrated into go2rtc or MediaMTX to view the stream live inside your web dashboard.
              </p>
            </div>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-6 space-y-5 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>

          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
            Camera Credentials
          </h3>

          {/* Input 1: Username */}
          <div className="space-y-2">
            <label className="text-xs text-gray-300 font-semibold flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              Camera Username
            </label>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin"
              className="bg-[#121B32] border-slate-700/40 text-white placeholder-gray-500 rounded-xl py-5 px-4 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all text-sm border"
            />
          </div>

          {/* Input 2: Password */}
          <div className="space-y-2">
            <label className="text-xs text-gray-300 font-semibold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              Camera Password
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter camera account password"
                className="bg-[#121B32] border-slate-700/40 text-white placeholder-gray-500 rounded-xl py-5 pl-4 pr-12 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all text-sm border"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Input 3: IP Address */}
          <div className="space-y-2">
            <label className="text-xs text-gray-300 font-semibold flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              Camera IP Address
            </label>
            <Input
              type="text"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              placeholder="e.g. 192.168.1.100"
              className="bg-[#121B32] border-slate-700/40 text-white placeholder-gray-500 rounded-xl py-5 px-4 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all text-sm border"
            />
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSaveConnection}
            disabled={saving}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-5 rounded-2xl transition-all shadow-md shadow-indigo-600/25 border border-indigo-400/20 active:scale-95 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Saving Connection...</span>
              </>
            ) : (
              <>
                <Database className="w-4 h-4 text-indigo-100" />
                <span>Generate & Save Stream Link</span>
              </>
            )}
          </Button>
        </div>

        {/* Generated Stream URLs Card */}
        {generatedRtsp && (
          <div className="bg-[#1A243D] border border-indigo-500/30 rounded-3xl p-6 shadow-sm space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 relative overflow-hidden mb-6">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>

            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-indigo-300 flex items-center gap-1.5">
                <Server className="w-4 h-4" />
                Your RTSP Stream Links
              </h4>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-200">
                Ready
              </span>
            </div>

            {/* Main HD Stream */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-semibold">HD High Quality Stream (stream1)</span>
                {isCopiedMain ? (
                  <span className="text-[10px] text-green-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Copied!
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2 bg-[#121B32] rounded-xl p-3 border border-slate-700/40 relative group">
                <code className="text-xs text-emerald-300 break-all select-all font-mono flex-1 pr-6">
                  {generatedRtsp}
                </code>
                <button
                  onClick={() => handleCopy(generatedRtsp, false)}
                  className="p-2 hover:bg-white/5 text-gray-400 hover:text-white rounded-lg transition-all"
                  title="Copy URL"
                >
                  {isCopiedMain ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Sub stream (low quality) */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-semibold">SD Low Quality Stream (stream2)</span>
                {isCopiedSub ? (
                  <span className="text-[10px] text-green-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Copied!
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2 bg-[#121B32] rounded-xl p-3 border border-slate-700/40 relative group">
                <code className="text-xs text-emerald-400/80 break-all select-all font-mono flex-1 pr-6">
                  {generatedRtspSub}
                </code>
                <button
                  onClick={() => handleCopy(generatedRtspSub, true)}
                  className="p-2 hover:bg-white/5 text-gray-400 hover:text-white rounded-lg transition-all"
                  title="Copy URL"
                >
                  {isCopiedSub ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* URL Encoding Notice */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-2">
              <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-200 leading-relaxed font-medium">
                <span className="font-semibold text-amber-300">URL Encoding Applied:</span> Your password has been automatically URL encoded (e.g. replacing <code className="font-mono text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-white">@</code> with <code className="font-mono text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-white">%40</code>) to prevent stream loading failures in standard video software.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Setup Instructions */}
      {isInstructionOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#1A243D] border border-slate-700/40 text-white w-full max-w-lg rounded-3xl flex flex-col max-h-[85vh] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">

            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-[#121B32]/40">
              <div className="space-y-1">
                <h3 className="text-md font-bold flex items-center gap-2 text-indigo-300">
                  <Shield className="w-4 h-4" />
                  Tapo Camera Setup Guide
                </h3>
                <p className="text-gray-400 text-xs">
                  Follow these steps inside your Tapo mobile application.
                </p>
              </div>
              <button
                onClick={() => setIsInstructionOpen(false)}
                className="p-1.5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-all"
                title="Close Setup Guide"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs leading-relaxed custom-scrollbar flex-grow">

              {/* Step 1 */}
              <div className="space-y-2">
                <h4 className="font-bold text-white text-[11px] uppercase tracking-wide text-indigo-300 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-[9px] flex items-center justify-center text-indigo-200 font-extrabold font-mono flex-shrink-0">1</span>
                  Create Camera Account
                </h4>
                <div className="pl-6 text-gray-300 text-[11px] space-y-1">
                  <p>In your Tapo mobile app:</p>
                  <p className="bg-[#121B32] p-3 rounded-xl border border-slate-700/40 text-[10px] font-mono break-all select-all text-emerald-300">
                    Camera Settings → Advanced Settings → Camera Account
                  </p>
                  <p className="text-gray-400 text-[10px]">Create a secure username and password. This is what you will type into our form.</p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-2">
                <h4 className="font-bold text-white text-[11px] uppercase tracking-wide text-indigo-300 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-[9px] flex items-center justify-center text-indigo-200 font-extrabold font-mono flex-shrink-0">2</span>
                  Enable RTSP Compatibility
                </h4>
                <div className="pl-6 text-gray-300 text-[11px] space-y-1">
                  <p>Inside Advanced Settings:</p>
                  <p className="bg-[#121B32] p-3 rounded-xl border border-slate-700/40 text-[10px] font-mono break-all select-all text-emerald-300">
                    Advanced Settings → Camera Account / Third Party Compatibility → Enable
                  </p>
                  <p className="text-gray-400 text-[10px]">This allows third-party players (like our app or VLC) to stream the camera feed.</p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-2">
                <h4 className="font-bold text-white text-[11px] uppercase tracking-wide text-indigo-300 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-[9px] flex items-center justify-center text-indigo-200 font-extrabold font-mono flex-shrink-0">3</span>
                  Find Camera IP Address
                </h4>
                <div className="pl-6 text-gray-300 text-[11px] space-y-1">
                  <p>Locate your Camera IP address in the Tapo App under:</p>
                  <p className="bg-[#121B32] p-3 rounded-xl border border-slate-700/40 text-[10px] font-mono break-all select-all text-emerald-300">
                    Camera Settings → Device Info → IP Address
                  </p>
                  <p className="text-gray-400 text-[10px]">Usually looks like <code className="font-mono text-white bg-white/10 px-1 rounded text-[10px]">192.168.0.100</code>.</p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="space-y-2 border-t border-slate-800 pt-4">
                <h4 className="font-bold text-white text-[11px] uppercase tracking-wide text-indigo-300 flex items-center gap-1.5">
                  <Info className="w-4.5 h-4.5 flex-shrink-0 text-indigo-400" />
                  Browser Integration Architecture
                </h4>
                <div className="pl-6 text-gray-300 text-[11px] space-y-2">
                  <p className="text-gray-400 text-[10px] leading-normal font-medium">
                    React Web Browsers cannot play RTSP streams natively. To render video inside the web dashboard, you must transcode or proxy the stream.
                  </p>

                  <div className="bg-[#121B32] border border-slate-700/40 rounded-xl p-3 space-y-1.5">
                    <p className="font-bold text-indigo-300 text-[10px]">Quick Setup with go2rtc (Docker):</p>
                    <code className="block bg-black/40 p-2 rounded text-[9px] break-all select-all font-mono text-emerald-300 border border-slate-800 leading-normal">
                      docker run --rm -p 1984:1984 -p 8554:8554 -p 8555:8555 alexxit/go2rtc
                    </code>
                    <p className="text-[9px] text-gray-400">
                      Configure your streams and map the generated RTSP link to a WebRTC source to render inside HTML5 video players.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-[#121B32]/40">
              <Button
                onClick={() => setIsInstructionOpen(false)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl py-4 text-xs font-semibold transition-all active:scale-95"
              >
                Got it, Close Guide
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
