import React, { useState, useEffect } from "react";
import {
  Video,
  FileText,
  Activity,
  Bluetooth,
  BarChart3,
  Stethoscope,
  Settings,
  Calendar,
  FileCheck,
  Edit3,
  Pill,
  Target,
  Receipt,
  LogOut,
  Heart,
  ShieldAlert,
  Info
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useRealTimeVitals } from "@/hooks/useRealTimeVitals";
import { useInsuranceClaimsNotifications } from "@/hooks/useInsuranceClaimsNotifications";
import { useHealthRecommendationsNotifications } from "@/hooks/useHealthRecommendationsNotifications";
import { MobileAppContainer } from "@/components/MobileAppContainer";
import { supabase, getPatientRiskCriteria } from "@/lib/supabase";

export const ServicesRecords = () => {
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { user, logout } = useAuth();
  const { patientProfile } = useRealTimeVitals();
  const [riskCriteria, setRiskCriteria] = useState<any | null>(null);
  const [loadingRisk, setLoadingRisk] = useState(true);

  useEffect(() => {
    const fetchRiskCriteria = async () => {
      if (!user) {
        setLoadingRisk(false);
        return;
      }
      try {
        setLoadingRisk(true);
        const { data: patientData, error: profileErr } = await supabase
          .from('patients')
          .select('id')
          .eq('auth_user_id', user.id)
          .single();

        if (patientData && !profileErr) {
          const { data: riskData } = await getPatientRiskCriteria(patientData.id);
          if (riskData) {
            setRiskCriteria(riskData);
          }
        }
      } catch (err) {
        console.error("Error fetching risk criteria:", err);
      } finally {
        setLoadingRisk(false);
      }
    };
    fetchRiskCriteria();
  }, [user]);

  // Insurance claims notifications
  const { unreadCount: claimsUnreadCount, markAsRead: markClaimsAsRead } = useInsuranceClaimsNotifications();

  // Health recommendations notifications
  const { unreadCount: recommendationsUnreadCount, markAsRead: markRecommendationsAsRead } = useHealthRecommendationsNotifications();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.error("Logout failed", e);
    } finally {
      navigate("/");
    }
  };

  const services = [
    // { label: "Doctor", icon: Stethoscope, color: "text-blue-400", path: "/doctor-assignment" },
    { label: "Prescriptions", icon: Pill, color: "text-purple-400", path: "/prescriptions" },
    { label: "Health Plan", icon: Target, color: "text-emerald-400", path: "/recommendations", badge: recommendationsUnreadCount },
    { label: "Invoices", icon: Receipt, color: "text-amber-400", path: "/invoices" },
    { label: "Claims", icon: FileCheck, color: "text-cyan-400", path: "/insurance-claims", badge: claimsUnreadCount },
    { label: "ECG Records", icon: Activity, color: "text-rose-400", path: "/alivecor-history" },
    { label: "Reports", icon: FileText, color: "text-purple-400", path: "/reports" },
    { label: "Book Appointment", icon: Calendar, color: "text-orange-400", path: "/appointments" },
    { label: "Live RPM", icon: Video, color: "text-teal-300", path: "/live-monitoring" },
  ];

  return (
    <MobileAppContainer>
      <div className="min-h-screen bg-[#080D1A] text-white font-inter select-none pb-12">
        {/* Top Banner Spacing */}
        <div className="h-6"></div>

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

        {/* Services & Records Section */}
        <div className="px-4 space-y-5">
          {/* Vital High Risk Thresholds Card */}
          <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-rose-500/20 flex items-center justify-center border border-rose-500/30">
                  <ShieldAlert className="h-5 w-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Vital Alert Thresholds</h3>
                  <p className="text-[11px] text-slate-400">Configured by your doctor</p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase ${riskCriteria?.is_high_risk
                ? 'bg-rose-500/20 border border-rose-500/30 text-rose-300 animate-pulse'
                : 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                }`}>
                {riskCriteria?.is_high_risk ? 'High Risk Alert' : 'System Stable'}
              </span>
            </div>

            {loadingRisk ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-500"></div>
              </div>
            ) : riskCriteria ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2.5">
                  {/* BP Column */}
                  <div className="bg-[#121B32] border border-slate-800/40 p-3 rounded-2xl flex flex-col items-center text-center">
                    <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center mb-2 border border-rose-500/20">
                      <Heart className="w-4 h-4 text-rose-400" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">BP Limit</span>
                    <span className="text-xs font-black text-white mt-1">
                      &gt; {riskCriteria.systolic_high || 140}/{riskCriteria.diastolic_high || 90}
                    </span>
                    <span className="text-[9px] text-slate-500 font-medium mt-0.5">mmHg</span>
                  </div>

                  {/* Heart Rate Column */}
                  <div className="bg-[#121B32] border border-slate-800/40 p-3 rounded-2xl flex flex-col items-center text-center">
                    <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center mb-2 border border-orange-500/20">
                      <Activity className="w-4 h-4 text-orange-400" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Heart Rate</span>
                    <span className="text-xs font-black text-white mt-1">
                      &gt; {riskCriteria.heart_rate_high || 100}
                    </span>
                    <span className="text-[9px] text-slate-500 font-medium mt-0.5">BPM</span>
                  </div>

                  {/* SpO2 Column */}
                  <div className="bg-[#121B32] border border-slate-800/40 p-3 rounded-2xl flex flex-col items-center text-center">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center mb-2 border border-blue-500/20">
                      <BarChart3 className="w-4 h-4 text-blue-400" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">O2 Sat</span>
                    <span className="text-xs font-black text-white mt-1">
                      &lt; {riskCriteria.spo2_low || 95}
                    </span>
                    <span className="text-[9px] text-slate-500 font-medium mt-0.5">SpO2 %</span>
                  </div>
                </div>

                {riskCriteria.doctor_notes && (
                  <div className="bg-amber-500/5 border border-amber-500/25 p-3.5 rounded-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
                    <div className="flex gap-2">
                      <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] text-amber-400 font-extrabold uppercase tracking-wide">Doctor's Guidance</p>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed italic">
                          "{riskCriteria.doctor_notes}"
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 bg-[#121B32] rounded-2xl border border-slate-800/80">
                <p className="text-xs text-slate-400 italic">No custom risk thresholds set by physician.</p>
              </div>
            )}
          </div>

          {/* Manual Vitals Submission & History */}
          <div className="grid grid-cols-2 gap-3 ">
            <button
              onClick={() => navigate("/manual-vitals")}
              className="h-12 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-950/20 text-xs hover:scale-[1.01] active:scale-95"
            >
              <Edit3 size={15} />
              <span>Manual Entry</span>
            </button>
            <button
              onClick={() => navigate("/vitals-history")}
              className="h-12 bg-gradient-to-r from-blue-500 to-indigo-655 hover:from-blue-600 hover:to-indigo-700 text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-950/20 text-xs hover:scale-[1.01] active:scale-95"
            >
              <BarChart3 size={15} />
              <span>Vitals History</span>
            </button>
          </div>

          {/* Services & Records Grid */}
          <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl p-4 space-y-4">
            <h3 className="text-sm font-bold text-white">Other Services</h3>

            <div className="grid grid-cols-3 gap-3 py-1">
              {services.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    if (item.badge && item.label === "Claims") markClaimsAsRead();
                    if (item.badge && item.label === "Health Plan") markRecommendationsAsRead();
                    navigate(item.path);
                  }}
                  className="w-full h-[84px] bg-[#0F172A]/70 hover:bg-[#121B32]/95 border border-slate-800/40 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all text-center relative group"
                >
                  {item.badge && item.badge > 0 && (
                    <div className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[8px] font-extrabold rounded-full h-4 w-4 flex items-center justify-center animate-pulse">
                      {item.badge}
                    </div>
                  )}
                  <item.icon className={`h-5 w-5 ${item.color} group-hover:scale-110 transition-transform`} />
                  <span className="text-[10px] font-bold text-slate-200 truncate px-1 w-full">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </MobileAppContainer>
  );
};

export default ServicesRecords;
