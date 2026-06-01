import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Phone,
  Clock,
  AlertCircle,
  MessageSquare,
  Loader2,
  Stethoscope,
  User,
  Video,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { usePatientVideoCall } from '@/hooks/usePatientVideoCall';

interface Doctor {
  id: string;
  doctor_code: string;
  full_name: string;
  specialty: string;
  hospital: string;
  phone_number: string;
  profile_picture_url?: string;
  years_experience?: number;
  email: string;
  national_medical_council_number?: string | null;
}

export const DoctorInfoCard: React.FC = React.memo(() => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currentCall, initiateCall } = usePatientVideoCall(user?.id);

  const cacheKey = useMemo(() => user ? `doctor_info_${user.id}` : null, [user?.id]);

  const [doctor, setDoctor] = useState<Doctor | null>(() => {
    if (typeof window !== 'undefined' && user?.id) {
      const cached = localStorage.getItem(`doctor_info_${user.id}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const cacheTime = parsed._cached_at || 0;
          if (Date.now() - cacheTime < 10 * 60 * 1000) {
            return parsed;
          }
        } catch (e) {
          console.warn('Failed to parse cached doctor info', e);
        }
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(!doctor);
  const [error, setError] = useState<string | null>(null);

  // Prevent multiple simultaneous fetches
  const fetchingRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const fetchDoctorInfo = async () => {
      // Skip if no user or already fetching
      if (!user || fetchingRef.current) {
        if (!user) setLoading(false); // don't leave spinner while auth is initializing
        return;
      }

      // Skip if we already have data for this user
      if (lastUserIdRef.current === user.id && doctor) {
        setLoading(false);
        return;
      }

      // Check cache first
      if (cacheKey) {
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            const cacheTime = parsed._cached_at || 0;
            const now = Date.now();
            // Use cache if less than 10 minutes old
            if (now - cacheTime < 10 * 60 * 1000) {
              console.log('✅ Using cached doctor info');
              setDoctor(parsed);
              setLoading(false);
              lastUserIdRef.current = user.id;
              // Still fetch fresh data in background
            }
          }
        } catch (e) {
          console.warn('Failed to parse cached doctor info', e);
        }
      }

      // Set fetching flag
      fetchingRef.current = true;

      try {
        // Only show loading if we don't have cached data
        if (!doctor) {
          setLoading(true);
        }
        setError(null);

        // Safety timeout - prevent infinite loading
        const timeoutId = setTimeout(() => {
          console.warn('⚠️ Doctor info fetch timeout');
          setLoading(false);
          fetchingRef.current = false;
        }, 8000);

        // First get the patient's profile to find assigned doctor
        const { data: patientProfile, error: patientError } = await supabase
          .from("patients")
          .select("assigned_doctor_id")
          .eq("auth_user_id", user.id)
          .single();

        if (patientError) {
          clearTimeout(timeoutId);
          setError("Could not load doctor info. Check your connection and try again.");
          setLoading(false);
          fetchingRef.current = false;
          return;
        }
        if (!patientProfile?.assigned_doctor_id) {
          clearTimeout(timeoutId);
          setError("No doctor assigned yet. Please contact support.");
          setLoading(false);
          fetchingRef.current = false;
          return;
        }

        // Get the doctor's information
        const { data: doctorData, error: doctorError } = await supabase
          .from("doctors")
          .select(
            `
            id,
            doctor_code,
            full_name,
            specialty,
            hospital,
            phone_number,
            profile_picture_url,
            years_experience,
            email,
            national_medical_council_number
          `
          )
          .eq("id", patientProfile.assigned_doctor_id)
          .eq("is_active", true)
          .single();

        clearTimeout(timeoutId);

        if (doctorError || !doctorData) {
          setError("Unable to fetch doctor information.");
          setLoading(false);
          fetchingRef.current = false;
          return;
        }

        // Cache the doctor data
        if (cacheKey) {
          const dataToCache = { ...doctorData, _cached_at: Date.now() };
          localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
        }

        setDoctor(doctorData);
        lastUserIdRef.current = user.id;
        setLoading(false);
      } catch (err) {
        console.error("Error fetching doctor info:", err);
        setError("Failed to load doctor information.");
        setLoading(false);
      } finally {
        fetchingRef.current = false;
      }
    };

    fetchDoctorInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleChatClick = () => {
    navigate("/chat");
  };

  const handleVideoCall = async () => {
    console.log('[CALL] VideoCall button pressed. currentCall=', currentCall)
    if (currentCall?.channel_name) {
      console.log('[CALL] Navigating to existing channel', currentCall.channel_name)
      navigate(`/call/${currentCall.channel_name}`)
      return
    }

    if (!user) { return }
    console.log('[CALL] Querying for existing pending/accepted call')
    const { data: patient, error: pErr } = await supabase
      .from('patients')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()
    if (pErr || !patient?.id) return

    const { data: calls } = await supabase
      .from('video_calls')
      .select('id, channel_name, status, call_type')
      .eq('patient_id', patient.id)
      .in('status', ['pending', 'accepted'])
      .order('initiated_at', { ascending: false })
      .limit(1)
    const call = calls?.[0]
    if (call?.channel_name) {
      console.log('[CALL] Found pending/accepted call, navigating to', call.channel_name)
      navigate(`/call/${call.channel_name}`)
      return
    }

    console.log('[CALL] No active call. Initiating new one…')
    await initiateCall('video')
    navigate('/call/wait')
  };

  if (loading) {
    return (
      <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl mb-6 overflow-hidden animate-pulse">
        <div className="relative">
          <div className="w-full h-44 bg-slate-800 animate-pulse"></div>
        </div>
        <div className="p-4">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="bg-slate-800 p-3 rounded-full w-12 h-12"></div>
              <div className="space-y-2">
                <div className="h-4 bg-slate-800 rounded w-32"></div>
                <div className="h-3 bg-slate-800 rounded w-24"></div>
                <div className="h-3 bg-slate-800 rounded w-40"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl mb-6 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="bg-[#1A243D] border border-slate-700/40 shadow-sm rounded-3xl mb-6 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-slate-550" />
            <p className="text-slate-400 text-sm">No doctor assigned</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1A243D] border border-slate-700/40 shadow-md rounded-3xl mb-6 overflow-hidden transition-all duration-200 hover:shadow-lg">

      <div className="p-4">
        <div className="flex flex-wrap gap-2 justify-between items-start">
          <div className="flex items-center gap-3">
            {/* Doctor Avatar */}
            <div className="bg-blue-600 p-0.5 rounded-full flex items-center justify-center">
              {doctor.profile_picture_url ? (
                <img
                  src={doctor.profile_picture_url}
                  alt={doctor.full_name}
                  className="h-10 w-10 rounded-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    target.nextElementSibling?.classList.remove("hidden");
                  }}
                />
              ) : null}
              <Stethoscope
                className={`h-5 w-5 text-white ${doctor.profile_picture_url ? "hidden" : ""
                  }`}
              />
            </div>

            {/* Doctor Information */}
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="font-bold text-base text-white">
                  Dr. {doctor.full_name}
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {doctor.doctor_code}
                </span>
              </div>

              <p className="text-slate-400 text-xs">
                {doctor.specialty} • {doctor.hospital}
              </p>

              {doctor.national_medical_council_number && (
                <p className="text-slate-500 text-[11px] mt-0.5">
                  NMC No.{" "}
                  <span className="text-slate-300 font-mono">
                    {doctor.national_medical_council_number}
                  </span>
                </p>
              )}

              <div className="flex items-center gap-4 mt-2 text-xs">
                <div className="flex items-center gap-1 text-slate-300">
                  <Stethoscope className="w-3.5 h-3.5 text-blue-400" />
                  <span>{doctor.specialty}</span>
                </div>
                {doctor.years_experience && (
                  <div className="flex items-center gap-1 text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>{doctor.years_experience} years</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleChatClick}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-2.5 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
              title="Chat with Doctor"
            >
              <MessageSquare size={18} />
            </button>
          </div>
        </div>

        {/* Emergency Contact Section */}
        <div className="mt-4 pt-4 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-xs font-semibold text-slate-300">Emergency Contact</span>
            </div>
            <a
              href={`tel:${doctor.phone_number}`}
              className="inline-flex items-center px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 shadow-md shadow-red-900/30"
            >
              <Phone className="w-3.5 h-3.5 mr-1.5" />
              Call Now
            </a>
          </div>
        </div>
      </div>
    </div>
  );
});
DoctorInfoCard.displayName = "DoctorInfoCard";
