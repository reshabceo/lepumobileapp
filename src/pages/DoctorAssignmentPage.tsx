import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
        <div className="bg-[#101010] min-h-screen text-white p-4">
            <div className="max-w-sm mx-auto">
                {/* Status Bar Spacing */}
                <div className="h-6"></div>

                {/* Header */}
                <header className="flex items-center justify-between mb-6">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/dashboard')}
                        className="text-gray-400 hover:text-white p-2"
                    >
                        <ArrowLeft size={20} />
                    </Button>
                    <h1 className="text-xl font-bold">Doctor Assignment</h1>
                    <div className="w-8"></div> {/* Spacer for centering */}
                </header>

                {/* Doctor Assignment Component */}
                <div className="mt-8">
                    <DoctorAssignment onAssignmentComplete={handleAssignmentComplete} />
                </div>
            </div>
        </div>
    );
};
