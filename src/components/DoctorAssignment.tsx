import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/supabase';
import { UserPlus, Stethoscope, Users, CheckCircle, AlertCircle } from 'lucide-react';

interface DoctorAssignmentProps {
    onAssignmentComplete?: () => void;
}

export const DoctorAssignment: React.FC<DoctorAssignmentProps> = ({ onAssignmentComplete }) => {
    const { user } = useAuth();
    const [doctorCode, setDoctorCode] = useState('');
    const [isAssigning, setIsAssigning] = useState(false);
    const [assignmentStatus, setAssignmentStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [statusMessage, setStatusMessage] = useState('');
    const [currentDoctor, setCurrentDoctor] = useState<any>(null);
    const [userProfile, setUserProfile] = useState<any>(null);

    // Load user profile and current doctor assignment
    useEffect(() => {
        const loadUserInfo = async () => {
            if (!user) return;

            try {
                // Get user profile
                const { data: profile } = await db.getPatientProfile(user.id);
                setUserProfile(profile);

                // Get assigned doctor info
                const { data: doctorInfo } = await db.getPatientDoctor(user.id);
                if (doctorInfo?.doctor) {
                    setCurrentDoctor(doctorInfo.doctor);
                }
            } catch (error) {
                console.error('Failed to load user info:', error);
            }
        };

        loadUserInfo();
    }, [user]);

    const handleAssignDoctor = async () => {
        if (!user || !doctorCode.trim()) return;

        setIsAssigning(true);
        setAssignmentStatus('idle');

        try {
            const { data: success, error } = await db.assignDoctorToPatient(user.id, doctorCode.trim());

            if (error || !success) {
                setAssignmentStatus('error');
                setStatusMessage('Invalid doctor code or doctor not found. Please check the code and try again.');
            } else {
                setAssignmentStatus('success');
                setStatusMessage('Successfully assigned to doctor! Your vital signs data will now be monitored.');
                setDoctorCode('');

                // Reload doctor info
                const { data: doctorInfo } = await db.getPatientDoctor(user.id);
                if (doctorInfo?.doctor) {
                    setCurrentDoctor(doctorInfo.doctor);
                }

                onAssignmentComplete?.();
            }
        } catch (error) {
            console.error('Doctor assignment error:', error);
            setAssignmentStatus('error');
            setStatusMessage('Failed to assign doctor. Please try again.');
        } finally {
            setIsAssigning(false);
        }
    };

    // Show doctor code if user is a doctor
    if (userProfile?.role === 'doctor') {
        return (
            <Card className="w-full max-w-md mx-auto">
                <CardHeader className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                        <Stethoscope className="w-8 h-8 text-blue-600" />
                    </div>
                    <CardTitle className="text-xl">Doctor Dashboard</CardTitle>
                    <CardDescription>
                        Your unique doctor code for patient assignments
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="text-center">
                        <Badge variant="outline" className="text-lg px-4 py-2">
                            {userProfile.doctor_code || 'Loading...'}
                        </Badge>
                        <p className="text-sm text-gray-600 mt-2">
                            Share this code with your patients so they can assign you as their monitoring doctor.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                    <UserPlus className="w-8 h-8 text-green-600" />
                </div>
                <CardTitle className="text-xl">Doctor Assignment</CardTitle>
                <CardDescription>
                    Enter your doctor's code to enable vital signs monitoring
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Current doctor status */}
                {currentDoctor ? (
                    <Alert className="border-green-200 bg-green-50">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                            <strong>Assigned Doctor:</strong> {currentDoctor.name}
                            <br />
                            <span className="text-sm">Code: {currentDoctor.doctor_code}</span>
                        </AlertDescription>
                    </Alert>
                ) : (
                    <Alert className="border-yellow-200 bg-yellow-50">
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        <AlertDescription className="text-yellow-800">
                            No doctor assigned. Enter a doctor code below to enable monitoring.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Doctor code input */}
                <div className="space-y-2">
                    <label htmlFor="doctor-code" className="text-sm font-medium text-gray-700">
                        Doctor Code
                    </label>
                    <Input
                        id="doctor-code"
                        type="text"
                        placeholder="Enter doctor code (e.g., DR1234)"
                        value={doctorCode}
                        onChange={(e) => setDoctorCode(e.target.value.toUpperCase())}
                        className="text-center font-mono"
                        disabled={isAssigning}
                    />
                </div>

                {/* Assignment button */}
                <Button
                    onClick={handleAssignDoctor}
                    disabled={!doctorCode.trim() || isAssigning}
                    className="w-full"
                >
                    {isAssigning ? 'Assigning...' : 'Assign Doctor'}
                </Button>

                {/* Status messages */}
                {assignmentStatus === 'success' && (
                    <Alert className="border-green-200 bg-green-50">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                            {statusMessage}
                        </AlertDescription>
                    </Alert>
                )}

                {assignmentStatus === 'error' && (
                    <Alert className="border-red-200 bg-red-50">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-800">
                            {statusMessage}
                        </AlertDescription>
                    </Alert>
                )}

                {/* Help text */}
                <div className="text-xs text-gray-500 text-center">
                    <p>Ask your doctor for their unique doctor code.</p>
                    <p>This will allow them to monitor your vital signs in real-time.</p>
                </div>
            </CardContent>
        </Card>
    );
};
