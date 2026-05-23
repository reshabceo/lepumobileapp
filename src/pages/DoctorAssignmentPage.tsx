import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Stethoscope } from 'lucide-react';
import { DoctorAssignment } from '@/components/DoctorAssignment';

export const DoctorAssignmentPage: React.FC = () => {
    const navigate = useNavigate();

    const handleAssignmentComplete = () => {
        // Navigate back to dashboard after successful assignment
        setTimeout(() => {
            navigate('/dashboard');
        }, 2000);
    };

    return (
        <div className="bg-[#080D1A] min-h-screen text-white p-4 pt-safe-top">
            <div className="max-w-sm mx-auto">

                {/* Header */}
                <header className="flex items-center gap-3 mb-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors active:scale-95 text-white"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-indigo-900/70 flex items-center justify-center border border-indigo-400/50">
                            <Stethoscope className="h-6 w-6 text-indigo-300" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">Doctor Assignment</h1>
                            <p className="text-xs text-gray-400">Consultation Setup</p>
                        </div>
                    </div>
                </header>

                {/* Doctor Assignment Component */}
                <div className="mt-8">
                    <DoctorAssignment onAssignmentComplete={handleAssignmentComplete} />
                </div>
            </div>
        </div>
    );
};

export default DoctorAssignmentPage;
