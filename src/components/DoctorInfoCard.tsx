import React, { useState, useEffect } from "react";
import {
  Phone,
  MapPin,
  Stethoscope,
  User,
  Mail,
  Building2,
  Clock,
  AlertCircle,
  Video,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

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
}

export const DoctorInfoCard: React.FC = () => {
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDoctorInfo = async () => {
      if (!user) return;

      try {
        setLoading(true);
        setError(null);

        // First get the patient's profile to find assigned doctor
        const { data: patientProfile, error: patientError } = await supabase
          .from("patients")
          .select("assigned_doctor_id")
          .eq("auth_user_id", user.id)
          .single();

        if (patientError || !patientProfile?.assigned_doctor_id) {
          setError("No doctor assigned yet. Please contact support.");
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
            email
          `
          )
          .eq("id", patientProfile.assigned_doctor_id)
          .eq("is_active", true)
          .single();

        if (doctorError || !doctorData) {
          setError("Unable to fetch doctor information.");
          return;
        }

        setDoctor(doctorData);
      } catch (err) {
        console.error("Error fetching doctor info:", err);
        setError("Failed to load doctor information.");
      } finally {
        setLoading(false);
      }
    };

    fetchDoctorInfo();
  }, [user]);

  const handleChatClick = () => {
    navigate("/chat");
  };

  const handleVideoCall = () => {
    // Placeholder for video call functionality
    console.log("Video call requested with doctor:", doctor?.full_name);
  };

  if (loading) {
    return (
      <div className="bg-[#1E1E1E] rounded-2xl mb-6 overflow-hidden transition-all duration-200 hover:bg-[#252525] animate-pulse">
        <div className="relative">
          <div className="w-full h-44 bg-gray-700"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        </div>
        <div className="p-4">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="bg-gray-600 p-3 rounded-full w-12 h-12"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-600 rounded w-32"></div>
                <div className="h-3 bg-gray-600 rounded w-24"></div>
                <div className="h-3 bg-gray-600 rounded w-40"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#1E1E1E] rounded-2xl mb-6 overflow-hidden transition-all duration-200 hover:bg-[#252525]">
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
      <div className="bg-[#1E1E1E] rounded-2xl mb-6 overflow-hidden transition-all duration-200 hover:bg-[#252525]">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-gray-400" />
            <p className="text-gray-300 text-sm">No doctor assigned</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1E1E1E] rounded-2xl mb-6 overflow-hidden transition-all duration-200 hover:bg-[#252525]">
      <div className="relative">
        {/* Doctor Cover Image */}
        <img
          src={
            doctor.profile_picture_url ||
            "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=2938&auto=format&fit=crop"
          }
          alt={doctor.full_name}
          className="w-full h-44 object-cover object-center"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src =
              "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=2940&auto=format&fit=crop";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>

        {/* Video Call Button */}
        <button
          onClick={handleVideoCall}
          className="absolute top-4 right-4 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-3 rounded-lg flex items-center gap-2 text-sm transition-all duration-200 hover:scale-105 active:scale-95"
        >
          <Video size={16} />
          <span>Video Call</span>
        </button>
      </div>

      <div className="p-4">
        <div className="flex flex-wrap gap-2 justify-between items-start">
          <div className="flex items-center gap-3">
            {/* Doctor Avatar */}
            <div className="bg-blue-500 p-3 rounded-full">
              {doctor.profile_picture_url ? (
                <img
                  src={doctor.profile_picture_url}
                  alt={doctor.full_name}
                  className="h-6 w-6 rounded-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    target.nextElementSibling?.classList.remove("hidden");
                  }}
                />
              ) : null}
              <Stethoscope
                className={`h-6 w-6 text-white ${
                  doctor.profile_picture_url ? "hidden" : ""
                }`}
              />
            </div>

            {/* Doctor Information */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-bold text-lg text-white">
                  Dr. {doctor.full_name}
                </h2>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {doctor.doctor_code}
                </span>
              </div>

              <p className="text-gray-400 text-xs">
                {doctor.specialty} • {doctor.hospital}
              </p>

              <div className="flex items-center gap-4 mt-2 text-sm">
                <div className="flex items-center gap-1 text-gray-300">
                  <Stethoscope className="w-3 h-3 text-blue-400" />
                  <span>{doctor.specialty}</span>
                </div>
                {doctor.years_experience && (
                  <div className="flex items-center gap-1 text-gray-300">
                    <Clock className="w-3 h-3 text-orange-400" />
                    <span>{doctor.years_experience} years</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-1">
            {/* <a
              href={`tel:${doctor.phone_number}`}
              className="bg-gray-700/80 hover:bg-gray-600 p-3 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
              title="Call Doctor"
            >
              <Phone size={20} className="text-white" />
            </a> */}
            <button
              onClick={handleChatClick}
              className="bg-gray-700/80 hover:bg-gray-600 p-3 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
              title="Chat with Doctor"
            >
              <MessageSquare size={20} className="text-white" />
            </button>
          </div>
        </div>

        {/* Emergency Contact Section */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-gray-300">Emergency Contact</span>
            </div>
            <a
              href={`tel:${doctor.phone_number}`}
              className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <Phone className="w-4 h-4 mr-2" />
              Call Now
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
