import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/supabase';
import { UserPlus, Stethoscope, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { usePatientVideoCall } from '@/hooks/usePatientVideoCall';
import { useNavigate } from 'react-router-dom';

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
    const [editing, setEditing] = useState(false);
    const navigate = useNavigate();
    // Video call notifications are now handled globally by GlobalVideoCallNotification component
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
                    setEditing(false);
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
            // No-op if same as current doctor
            if (currentDoctor && doctorCode.trim().toUpperCase() === String(currentDoctor.doctor_code).toUpperCase()) {
                setAssignmentStatus('success');
                setStatusMessage('Already assigned to this doctor.');
                setDoctorCode('');
                setIsAssigning(false);
                setEditing(false);
                return;
            }
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
                    setEditing(false);
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
            <Card className="w-full max-w-md mx-auto bg-[#1A243D] border-slate-700/40 text-white shadow-xl rounded-3xl">
                <CardHeader className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-indigo-500/10 border border-indigo-500/30 rounded-full flex items-center justify-center">
                        <Stethoscope className="w-8 h-8 text-indigo-400" />
                    </div>
                    <CardTitle className="text-xl text-white">Doctor Dashboard</CardTitle>
                    <CardDescription className="text-slate-400">
                        Your unique doctor code for patient assignments
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="text-center">
                        <Badge variant="outline" className="text-lg px-4 py-2 border-indigo-500/30 text-indigo-300">
                            {userProfile.doctor_code || 'Loading...'}
                        </Badge>
                        <p className="text-sm text-slate-300 mt-2">
                            Share this code with your patients so they can assign you as their monitoring doctor.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-md mx-auto bg-[#1A243D] border-slate-700/40 text-white shadow-xl rounded-3xl">
            <CardHeader className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center">
                    <UserPlus className="w-8 h-8 text-emerald-400" />
                </div>
                <CardTitle className="text-xl text-white">Doctor Assignment</CardTitle>
                <CardDescription className="text-slate-400">
                    Enter your doctor's code to enable vital signs monitoring
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Current doctor status */}
                {currentDoctor && (
                    <Alert className="border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                        <AlertDescription className="text-emerald-300">
                            <strong>Assigned Doctor:</strong> {currentDoctor.full_name || currentDoctor.name}
                            <br />
                            <span className="text-sm">Code: {currentDoctor.doctor_code}</span>
                        </AlertDescription>
                    </Alert>
                )}
                {!currentDoctor && (
                    <Alert className="border-amber-500/20 bg-amber-500/10 text-amber-400">
                        <AlertCircle className="h-4 w-4 text-amber-400" />
                        <AlertDescription className="text-amber-300">
                            No doctor assigned. Enter a doctor code below to enable monitoring.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Doctor code input */}
                {(!currentDoctor || editing) && (
                    <>
                        <div className="space-y-2">
                            <label htmlFor="doctor-code" className="text-sm font-medium text-slate-300">
                                Doctor Code
                            </label>
                            <Input
                                id="doctor-code"
                                type="text"
                                placeholder="Enter doctor code (e.g., DR1234)"
                                value={doctorCode}
                                onChange={(e) => setDoctorCode(e.target.value.toUpperCase())}
                                className="text-center font-mono bg-[#121B32] border-slate-700/40 text-white placeholder-slate-500 focus-visible:ring-indigo-500"
                                disabled={isAssigning}
                            />
                        </div>

                        {/* Assignment button */}
                        <Button
                            onClick={handleAssignDoctor}
                            disabled={!doctorCode.trim() || isAssigning}
                            className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold"
                        >
                            {isAssigning ? 'Assigning...' : 'Assign Doctor'}
                        </Button>
                    </>
                )}

                {/* Change doctor CTA when already assigned */}
                {currentDoctor && !editing && (
                    <Button variant="outline" className="w-full border-slate-700/80 text-slate-300 hover:bg-slate-800" onClick={() => setEditing(true)}>
                        Change doctor
                    </Button>
                )}

                {/* Status messages */}
                {assignmentStatus === 'success' && (
                    <Alert className="border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                        <AlertDescription className="text-emerald-300">
                            {statusMessage}
                        </AlertDescription>
                    </Alert>
                )}

                {assignmentStatus === 'error' && (
                    <Alert className="border-red-500/20 bg-red-500/10 text-red-400">
                        <AlertCircle className="h-4 w-4 text-red-400" />
                        <AlertDescription className="text-red-300">
                            {statusMessage}
                        </AlertDescription>
                    </Alert>
                )}

                {/* Help text */}
                <div className="text-xs text-slate-500 text-center">
                    <p>Ask your doctor for their unique doctor code.</p>
                    <p>This will allow them to monitor your vital signs in real-time.</p>
                </div>
            </CardContent>
        </Card>
    );
};
