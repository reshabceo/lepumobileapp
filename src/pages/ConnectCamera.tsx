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

    // Reolink RTSP (E1 / E1 Outdoor / Go). Sub stream = low bandwidth.
    const mainStream = `rtsp://${displayUser}:${encodedPassword}@${displayIp}:554/h264Preview_01_main`;
    const subStream = `rtsp://${displayUser}:${encodedPassword}@${displayIp}:554/h264Preview_01_sub`;

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
          camera_model: "reolink_e1_pro",
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
    <MobileAppContainer>
      <div className="bg-slate-950 min-h-screen text-white font-inter pt-safe-top flex flex-col items-center">
        <div className="w-full max-w-sm min-h-screen bg-gradient-to-br from-slate-950 via-[#131024] to-slate-950 flex flex-col relative overflow-hidden">

          {/* Header Section */}
          <div className="bg-slate-900/50 backdrop-blur-sm border-b border-white/5 sticky top-0 z-40">
            <div className="flex items-center justify-between p-4">
              <button
                onClick={() => navigate("/dashboard")}
                className="flex items-center gap-2 px-3 py-2 text-white bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 transition-all rounded-lg"
                style={{ minHeight: "40px", minWidth: "70px" }}
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm">Back</span>
              </button>
              <h1 className="text-md font-bold tracking-tight bg-gradient-to-r from-purple-400 to-indigo-300 bg-clip-text text-transparent">
                Reolink Camera
              </h1>
              <button
                onClick={() => setIsInstructionOpen(true)}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 hover:scale-105 active:scale-95 transition-all text-white rounded-lg border border-indigo-400/30 flex items-center justify-center gap-1 shadow-lg shadow-indigo-600/25"
                style={{ minHeight: "40px", minWidth: "40px" }}
                title="Show Instructions"
              >
                <Eye className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content Body */}
          <div className="p-4 space-y-6 pb-24 overflow-y-auto flex-1">

            {/* Card Overview */}
            <div className="bg-gradient-to-br from-indigo-900/30 via-slate-900/40 to-purple-900/20 border border-indigo-500/20 rounded-2xl p-5 shadow-2xl backdrop-blur-md">
              <div className="flex items-start gap-4">
                <div className="bg-indigo-500/10 border border-indigo-500/30 p-3 rounded-xl flex-shrink-0">
                  <Video className="w-6 h-6 text-indigo-400 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">Reolink RTSP Connection</h3>
                  <p className="text-gray-400 text-xs leading-relaxed">
                    Enter Reolink credentials to build the
                    <span className="text-indigo-300 font-semibold"> RTSP preview URL</span>.
                    The Pi monitoring kit or Phase-2 native bridge ingests this LAN URL and forwards it to doctors.
                  </p>
                </div>
              </div>
            </div>

            {/* Form Card */}
            <div className="bg-[#151329]/60 border border-white/5 rounded-2xl p-5 shadow-xl space-y-5 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>

              <h3 className="text-sm font-semibold uppercase tracking-wider text-purple-300">
                Camera Credentials
              </h3>

              {/* Input 1: Username */}
              <div className="space-y-2">
                <label className="text-xs text-gray-300 font-medium flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  Camera Username
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. john smith"
                    className="bg-black/40 border-white/10 text-white placeholder-gray-500 rounded-xl py-6 pl-4 pr-10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all text-sm"
                  />
                </div>
              </div>

              {/* Input 2: Password */}
              <div className="space-y-2">
                <label className="text-xs text-gray-300 font-medium flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-indigo-400" />
                  Camera Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your camera account password"
                    className="bg-black/40 border-white/10 text-white placeholder-gray-500 rounded-xl py-6 pl-4 pr-12 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all text-sm"
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
                <label className="text-xs text-gray-300 font-medium flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-indigo-400" />
                  Camera IP Address
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    placeholder="e.g. 192.168.0.100"
                    className="bg-black/40 border-white/10 text-white placeholder-gray-500 rounded-xl py-6 pl-4 pr-10 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all text-sm"
                  />
                </div>
              </div>

              {/* Save Button */}
              <Button
                onClick={handleSaveConnection}
                disabled={saving}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-6 rounded-xl transition-all shadow-lg shadow-indigo-600/35 border border-indigo-400/20 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Saving details...</span>
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
              <div className="bg-[#121021]/80 border border-indigo-500/30 rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 relative overflow-hidden">
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
                    <span className="text-xs text-gray-400 font-semibold">Main stream — h264Preview_01_main</span>
                    {isCopiedMain ? (
                      <span className="text-[10px] text-green-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Copied!
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 bg-black/60 rounded-xl p-3 border border-white/5 relative group">
                    <code className="text-xs text-emerald-300 break-all select-all font-mono flex-1 pr-6">
                      {generatedRtsp}
                    </code>
                    <button
                      onClick={() => handleCopy(generatedRtsp, false)}
                      className="p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-all"
                      title="Copy URL"
                    >
                      {isCopiedMain ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Sub stream (low quality) */}
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400 font-semibold">Sub stream — h264Preview_01_sub</span>
                    {isCopiedSub ? (
                      <span className="text-[10px] text-green-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Copied!
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 bg-black/60 rounded-xl p-3 border border-white/5 relative group">
                    <code className="text-xs text-emerald-400/80 break-all select-all font-mono flex-1 pr-6">
                      {generatedRtspSub}
                    </code>
                    <button
                      onClick={() => handleCopy(generatedRtspSub, true)}
                      className="p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-all"
                      title="Copy URL"
                    >
                      {isCopiedSub ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* URL Encoding Notice */}
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-2">
                  <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-200 leading-relaxed">
                    <span className="font-semibold">URL Encoding Applied:</span> Your password has been automatically URL encoded (e.g. replacing <code className="font-mono text-[10px] bg-black/30 px-1 rounded text-white">@</code> with <code className="font-mono text-[10px] bg-black/30 px-1 rounded text-white">%40</code>) to prevent stream loading failures in standard video software.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Modal: Setup Instructions (Rendered Inline for perfect viewport constraint) */}
          {isInstructionOpen && (
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-[#151329] border border-white/10 text-white w-full max-w-[90%] rounded-2xl flex flex-col max-h-[80vh] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">

                {/* Modal Header */}
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-indigo-950/20">
                  <div className="space-y-1">
                    <h3 className="text-md font-bold flex items-center gap-2 text-indigo-400">
                      <Shield className="w-4 h-4" />
                      Reolink Camera Setup Guide
                    </h3>
                    <p className="text-gray-400 text-[10px]">
                      Follow these steps inside the official Reolink mobile app.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsInstructionOpen(false)}
                    className="p-1.5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-all"
                    title="Close Setup Guide"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-4 overflow-y-auto space-y-4 text-xs leading-relaxed custom-scrollbar flex-grow">

                  {/* Step 1 */}
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-white text-[11px] uppercase tracking-wide text-purple-300 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/40 text-[9px] flex items-center justify-center text-purple-200 font-extrabold font-mono flex-shrink-0">1</span>
                      Add Camera to Wi-Fi
                    </h4>
                    <div className="pl-6 text-gray-300 text-[11px] space-y-1">
                      <p>In the Reolink app, add your camera and connect it to your home Wi-Fi:</p>
                      <p className="bg-black/40 p-2 rounded-lg border border-white/5 text-[10px] font-mono break-all select-all">
                        Reolink app → Add Device → follow pairing
                      </p>
                      <p className="text-gray-400 text-[10px]">Use the <span className="text-white font-semibold">same Wi-Fi network</span> that this phone is on.</p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-white text-[11px] uppercase tracking-wide text-purple-300 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/40 text-[9px] flex items-center justify-center text-purple-200 font-extrabold font-mono flex-shrink-0">2</span>
                      Note Username &amp; Password
                    </h4>
                    <div className="pl-6 text-gray-300 text-[11px] space-y-1">
                      <p>Use the camera login you set when adding the device:</p>
                      <p className="bg-black/40 p-2 rounded-lg border border-white/5 text-[10px] font-mono break-all select-all">
                        Device Settings → Login / User → admin + your password
                      </p>
                      <p className="text-gray-400 text-[10px]">The username is usually <code className="font-mono text-white bg-white/10 px-1 rounded text-[10px]">admin</code>. Enter it and the password into our form.</p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-white text-[11px] uppercase tracking-wide text-purple-300 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/40 text-[9px] flex items-center justify-center text-purple-200 font-extrabold font-mono flex-shrink-0">3</span>
                      Enable RTSP / ONVIF
                    </h4>
                    <div className="pl-6 text-gray-300 text-[11px] space-y-1">
                      <p>Turn on standard streaming so we can read the feed:</p>
                      <p className="bg-black/40 p-2 rounded-lg border border-white/5 text-[10px] font-mono break-all select-all">
                        Device Settings → Network → Advanced → Server / Port Settings → enable RTSP &amp; ONVIF
                      </p>
                      <p className="text-gray-400 text-[10px]">This lets our app securely pull the camera video on your local network.</p>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-white text-[11px] uppercase tracking-wide text-purple-300 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/40 text-[9px] flex items-center justify-center text-purple-200 font-extrabold font-mono flex-shrink-0">4</span>
                      Find Camera IP Address
                    </h4>
                    <div className="pl-6 text-gray-300 text-[11px] space-y-1">
                      <p>Locate the camera's IP in the Reolink app under:</p>
                      <p className="bg-black/40 p-2 rounded-lg border border-white/5 text-[10px] font-mono break-all select-all">
                        Device Settings → Network Information → IP Address
                      </p>
                      <p className="text-gray-400 text-[10px]">Usually looks like <code className="font-mono text-white bg-white/10 px-1 rounded text-[10px]">192.168.0.100</code>. Tip: set a DHCP reservation in your router so it never changes.</p>
                    </div>
                  </div>

                  {/* How it works (privacy note) */}
                  <div className="space-y-1.5 border-t border-white/5 pt-3">
                    <h4 className="font-bold text-white text-[11px] uppercase tracking-wide text-indigo-300 flex items-center gap-1.5">
                      <Info className="w-4.5 h-4.5 flex-shrink-0" />
                      How It Works
                    </h4>
                    <div className="pl-6 text-gray-300 text-[11px] space-y-2">
                      <p className="text-gray-400 text-[10px] leading-normal">
                        Your phone reads the camera on your local Wi-Fi and securely forwards the live video to your doctor only while monitoring is turned on. No router changes, port-forwarding, or static IP are needed, and nothing is exposed to the public internet.
                      </p>
                      <p className="text-[10px] text-gray-400 leading-normal">
                        Keep your phone on the <span className="text-white font-semibold">same Wi-Fi as the camera</span> while monitoring is active.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-white/5 bg-slate-950/20">
                  <Button
                    onClick={() => setIsInstructionOpen(false)}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-4 text-xs font-semibold"
                  >
                    Got it, Close Guide
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </MobileAppContainer>
  );
}
