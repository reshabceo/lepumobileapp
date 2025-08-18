import React, { useState, useEffect } from 'react';
import { Phone, MapPin, Stethoscope, User, Mail, Building2, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

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

    useEffect(() => {
        const fetchDoctorInfo = async () => {
            if (!user) return;

            try {
                setLoading(true);
                setError(null);

                // First get the patient's profile to find assigned doctor
                const { data: patientProfile, error: patientError } = await supabase
                    .from('patients')
                    .select('assigned_doctor_id')
                    .eq('auth_user_id', user.id)
                    .single();

                if (patientError || !patientProfile?.assigned_doctor_id) {
                    setError('No doctor assigned yet. Please contact support.');
                    return;
                }

                // Get the doctor's information
                const { data: doctorData, error: doctorError } = await supabase
                    .from('doctors')
                    .select(`
            id,
            doctor_code,
            full_name,
            specialty,
            hospital,
            phone_number,
            profile_picture_url,
            years_experience,
            email
          `)
                    .eq('id', patientProfile.assigned_doctor_id)
                    .eq('is_active', true)
                    .single();

                if (doctorError || !doctorData) {
                    setError('Unable to fetch doctor information.');
                    return;
                }

                setDoctor(doctorData);
            } catch (err) {
                console.error('Error fetching doctor info:', err);
                setError('Failed to load doctor information.');
            } finally {
                setLoading(false);
            }
        };

        fetchDoctorInfo();
    }, [user]);

    if (loading) {
        return (
            <div className="bg-white rounded-xl shadow-lg p-6 animate-pulse">
                <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gray-300 rounded-full"></div>
                    <div className="flex-1">
                        <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <p className="text-red-800 text-sm">{error}</p>
                </div>
            </div>
        );
    }

    if (!doctor) {
        return (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-gray-600" />
                    <p className="text-gray-700 text-sm">No doctor assigned</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-start space-x-4">
                {/* Doctor Photo */}
                <div className="flex-shrink-0">
                    {doctor.profile_picture_url ? (
                        <img
                            src={doctor.profile_picture_url}
                            alt={doctor.full_name}
                            className="w-16 h-16 rounded-full object-cover border-2 border-blue-100"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.nextElementSibling?.classList.remove('hidden');
                            }}
                        />
                    ) : null}
                    <div className={`w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center ${doctor.profile_picture_url ? 'hidden' : ''}`}>
                        <Stethoscope className="w-8 h-8 text-white" />
                    </div>
                </div>

                {/* Doctor Information */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                            Dr. {doctor.full_name}
                        </h3>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {doctor.doctor_code}
                        </span>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center text-sm text-gray-600">
                            <Stethoscope className="w-4 h-4 mr-2 text-blue-500" />
                            <span>{doctor.specialty}</span>
                        </div>

                        <div className="flex items-center text-sm text-gray-600">
                            <Building2 className="w-4 h-4 mr-2 text-green-500" />
                            <span>{doctor.hospital}</span>
                        </div>

                        <div className="flex items-center text-sm text-gray-600">
                            <Phone className="w-4 h-4 mr-2 text-purple-500" />
                            <a
                                href={`tel:${doctor.phone_number}`}
                                className="hover:text-purple-600 transition-colors"
                            >
                                {doctor.phone_number}
                            </a>
                        </div>

                        {doctor.years_experience && (
                            <div className="flex items-center text-sm text-gray-600">
                                <Clock className="w-4 h-4 mr-2 text-orange-500" />
                                <span>{doctor.years_experience} years experience</span>
                            </div>
                        )}
                    </div>

                    {/* Emergency Contact Button */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <a
                            href={`tel:${doctor.phone_number}`}
                            className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                        >
                            <Phone className="w-4 h-4 mr-2" />
                            Emergency Contact
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};
